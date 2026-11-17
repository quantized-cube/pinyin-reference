"""Maintain the reviewed syllable recordings; network access requires --fetch.

The manifest fixes the adopted scope. This script never discovers/approves new
tokens from upstream filenames. --audit requires ffmpeg and ffprobe on PATH.
"""
import argparse
import array
from datetime import date
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import html
import json
import math
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.request
from urllib.parse import urlsplit
import unicodedata

ROOT = Path(__file__).resolve().parent.parent
FOLDER = ROOT / 'public/audio/syllables'
MANIFEST = FOLDER / 'manifest.json'
INDEX = ROOT / 'src/syllable-recording-index.ts'


def recording_source(manifest, row):
    if 'sourceId' not in row:
        return manifest['source']
    return manifest['additionalSources'][row['sourceId']]


def source_url(source, row):
    if source.get('kind') == 'shtooka':
        return source['downloadBaseUrl'] + row['sourceFile']
    return (f"https://raw.githubusercontent.com/hugolpz/audio-cmn/{source['revision']}/"
            f"{source['directory']}/cmn-{row['sourceToken']}.mp3")


def reading_token(pinyin):
    marks = {'\u0304': '1', '\u0301': '2', '\u030c': '3', '\u0300': '4'}
    decomposed = unicodedata.normalize('NFD', pinyin)
    tones = [marks[c] for c in decomposed if c in marks]
    if len(tones) != 1:
        raise ValueError(f'Expected one tone-marked syllable: {pinyin}')
    letters = ''.join(c for c in decomposed if c not in marks)
    return unicodedata.normalize('NFC', letters) + tones[0]


def validate_manifest(manifest):
    source = manifest['source']
    if manifest['schemaVersion'] != 1 or not re.fullmatch(r'[a-f0-9]{40}', source['revision']):
        raise ValueError('Invalid manifest version or source revision')
    seen, files = set(), set()
    for row in manifest['records']:
        token = row['token']
        if not re.fullmatch(r'[a-züê]+[1-4]', token) or token in seen:
            raise ValueError(f'Invalid or duplicate token: {token}')
        seen.add(token)
        if 'unavailable' in row:
            if not row['unavailable'] or 'file' in row:
                raise ValueError(f'Invalid unavailable recording: {token}')
            if 'ttsFallback' in row:
                example = row['ttsFallback']
                text, tokens, target = example['text'], example['tokens'], example['target']
                if (not text or len(text) != len(tokens) or type(target) is not int or
                        not 0 <= target < len(tokens) or tokens[target] != token or
                        not all(re.fullmatch(r'[a-züê]+[1-5]', t) for t in tokens) or
                        not all('\u3400' <= c <= '\u9fff' for c in text)):
                    raise ValueError(f'Invalid TTS fallback: {token}')
            continue
        if row['file'] != token.replace('ü', 'v') + '.mp3' or row['file'] in files:
            raise ValueError(f'Invalid or duplicate filename: {token}')
        files.add(row['file'])
        if 'sourceId' in row:
            alternate = recording_source(manifest, row)
            if alternate['kind'] != 'shtooka':
                raise ValueError(f'Unknown source kind: {token}')
            for field in ('speaker', 'author', 'license', 'licenseUrl', 'sourcePage', 'indexUrl', 'retrieved'):
                if not alternate[field]:
                    raise ValueError(f'Missing source attribution: {token}/{field}')
            if not re.fullmatch(r'cmn-[a-f0-9]{8}\.mp3', row['sourceFile']):
                raise ValueError(f'Invalid source filename: {token}')
            if reading_token(row['sourcePinyin']) != token:
                raise ValueError(f'Source reading mismatch: {token}')
            if not row['sourceText'] or 'sourceToken' in row or 'metadataNote' in row:
                raise ValueError(f'Invalid collection metadata: {token}')
            expected_metadata = {'swac_text': row['sourceText'],
                                 'swac_lang': 'cmn', 'swac_speak_name': alternate['metadataSpeaker'],
                                 'swac_coll_license': alternate['metadataLicense']}
            if 'swac_pron_phon' in row['sourceMetadata']:
                expected_metadata['swac_pron_phon'] = row['sourcePinyin']
                if 'readingReview' in row:
                    raise ValueError(f'Redundant reading review: {token}')
            else:
                review = row.get('readingReview', {})
                reference = urlsplit(review.get('referenceUrl', ''))
                if (review.get('text') != row['sourceText'] or
                        review.get('pinyin') != row['sourcePinyin'] or
                        review.get('status') != 'user-approved' or
                        reference.scheme != 'https' or not reference.netloc):
                    raise ValueError(f'Missing or inconsistent reading review: {token}')
                date.fromisoformat(review.get('date', ''))
            if row['sourceMetadata'] != expected_metadata:
                raise ValueError(f'Collection index mismatch: {token}')
            if not re.fullmatch(r'[a-f0-9]{64}', row['sha256']):
                raise ValueError(f'Unpinned collection recording: {token}')
            continue
        if not re.fullmatch(r'[a-z]+[1-4]', row['sourceToken']):
            raise ValueError(f'Invalid source token: {token}')
        if row['sourceToken'][-1] != token[-1]:
            raise ValueError(f'Source tone mismatch: {token}')


def verify_bytes(source, row, data):
    if len(data) != row['bytes'] or hashlib.sha256(data).hexdigest() != row['sha256']:
        raise ValueError(f"File changed: {row['token']}")
    if source.get('kind') == 'shtooka':
        # These MP3s do not contain SWAC pronunciation tags (some have no ID3
        # tags at all). The adopted reading comes from the collection index or
        # an explicit review when absent there. Size and SHA-256 pin the file.
        return
    # One upstream replacement (peng3) has encoder tags only. Its provenance is
    # the pinned repository and per-file hash, explicitly recorded in the manifest.
    if row.get('metadataNote'):
        if b'SWAC_' in data:
            raise ValueError(f"Unexpected SWAC metadata: {row['token']}")
        return
    # Original ID3 TXXX metadata is preserved, including source spelling jv4/lv/nv.
    for key, value in [('SWAC_TEXT', row['sourceToken']), ('SWAC_LANG', 'cmn'),
                       ('SWAC_SPEAK_NAME', source['speaker']),
                       ('SWAC_COLL_LICENSE', source['licenseTag'])]:
        if (key + '\0' + value + '\0').encode() not in data:
            raise ValueError(f"Metadata mismatch: {row['token']}/{key}")


def probe(path):
    result = subprocess.run(['ffprobe', '-v', 'error', '-show_format', '-of', 'json', str(path)],
                            check=True, capture_output=True, encoding='utf-8')
    return json.loads(result.stdout)['format']


def fetch_recording(source, row):
    path = FOLDER / row['file']
    if path.exists():
        data = path.read_bytes()
    else:
        # Reuse previously shipped, unchanged recordings before requesting upstream.
        old = [ROOT / 'public/audio' / kind / row['file'] for kind in ('comparison', 'detail')]
        # Legacy caches can contain the superseded audio-cmn recording. Reuse
        # one only when it matches the approved bytes, otherwise fetch the source.
        cached = next((p for p in old if p.exists() and (
            source.get('kind') != 'shtooka' or
            hashlib.sha256(p.read_bytes()).hexdigest() == row['sha256'])), None)
        if cached:
            data = cached.read_bytes()
        else:
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(source_url(source, row), timeout=30) as response:
                        data = response.read()
                    break
                except OSError:
                    if attempt == 2:
                        raise
                    time.sleep(attempt + 1)
    if 'sha256' in row:
        # Restoring a missing file must preserve the identity approved in the manifest.
        verify_bytes(source, row, data)
        if not path.exists():
            path.write_bytes(data)
        return row
    path.write_bytes(data)
    result = probe(path)
    updated = {**row, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data),
               'duration': round(float(result['duration']), 6)}
    verify_bytes(source, updated, data)
    return updated


def generated_index(manifest):
    available = [r['token'] for r in manifest['records'] if 'file' in r]
    missing = [r['token'] for r in manifest['records'] if 'unavailable' in r]
    speech = {r['token']: r['ttsFallback'] for r in manifest['records'] if 'ttsFallback' in r}
    def lines(tokens):
        return '\n'.join('  ' + ', '.join(repr(t) for t in tokens[i:i+12]) + ',' for i in range(0, len(tokens), 12))
    return ('// Generated from public/audio/syllables/manifest.json by scripts/build_recordings.py.\n'
            '// Source metadata verifies identity, not an auditory judgment of pronunciation.\n'
            "import type {PronunciationExample} from './types.js';\n"
            'export const syllableRecordingTokens: readonly string[] = [\n' + lines(available) + '\n];\n'
            'export const unavailableRecordingTokens: readonly string[] = [\n' + lines(missing) + '\n];\n'
            'export const syllableSpeechExamples: Readonly<Record<string, PronunciationExample>> = '
            + json.dumps(speech, ensure_ascii=False, indent=2) + ';\n')


def generated_credits(manifest):
    s = manifest['source']
    esc = html.escape
    rows = []
    for r in manifest['records']:
        if 'file' not in r:
            continue
        rs = recording_source(manifest, r)
        if rs.get('kind') == 'shtooka':
            url = source_url(rs, r)
            label = f"{r['sourceText']} {r['sourcePinyin']}"
        else:
            url = f"{rs['repository']}/blob/{rs['revision']}/{rs['directory']}/cmn-{r['sourceToken']}.mp3"
            label = r['sourceToken']
        note = '（元音源に発音・話者のID3タグなし。取得したバージョンの配布元情報を参照）' if r.get('metadataNote') else ''
        if r.get('readingReview'):
            note = f'（配布元の一覧に読みの記載なし。<a href="{esc(r["readingReview"]["referenceUrl"])}">辞書の読み</a>を確認し、利用者の試聴後に採用）'
        retrieved = r.get('retrieved', rs['retrieved'])
        rows.append(f'<tr><td>{esc(r["token"])}</td><td><a href="{esc(url)}">{esc(label)}</a>{note}</td><td>{esc(rs["speaker"])}</td><td><a href="{esc(rs["licenseUrl"])}">{esc(rs["license"])}</a></td><td>{esc(retrieved)}</td></tr>')
    additional = []
    for sid, extra in manifest.get('additionalSources', {}).items():
        count = sum(r.get('sourceId') == sid for r in manifest['records'])
        additional.append(f'<p>話者：{esc(extra["speaker"])}（{count}件）<br>著作者：{esc(extra["author"])}<br>'
                          f'音源：<a href="{esc(extra["sourcePage"])}">{esc(extra["name"])}</a><br>'
                          f'ライセンス：<a href="{esc(extra["licenseUrl"])}">{esc(extra["license"])}</a><br>'
                          f'<a href="{esc(extra["indexUrl"])}">配布元の録音一覧</a></p>')
    return f'''<!doctype html>
<html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>単独音の録音 — 出典・ライセンス</title>
<style>body{{font:16px/1.8 system-ui,sans-serif;max-width:64rem;margin:3rem auto;padding:0 1rem;color:#233536}}.table-wrap{{overflow-x:auto}}table{{border-collapse:collapse}}td,th{{border-bottom:1px solid #ddd;padding:.3rem 1.5rem .3rem 0;text-align:left}}a{{color:#17625a}}</style>
<h1>単独音の録音</h1>
<p>音節詳細の第1〜4声と聞き比べには、共通の音源を使っています。録音は元の速度で再生します。図とIPAは、録音を測定して作成したものではありません。</p>
<p>問題を指摘された録音のうち、代わりの録音を採用できていない{sum('ttsFallback' in r for r in manifest['records'])}組はTTSで再生します。元の録音は配布ファイルから除外しています。</p>
<p>話者：{esc(s['speaker'])}（{sum('file' in r and 'sourceId' not in r for r in manifest['records'])}件）<br>著作者：{esc(s['author'])}<br>
音源：<a href="{esc(s['repository'])}">{esc(s['name'])}</a><br>
ライセンス：<a href="{esc(s['licenseUrl'])}">{esc(s['license'])}</a></p>
{chr(10).join(additional)}
<p>取得日は各録音の一覧に記載しています。MP3の音声・メタデータは改変していません。ファイル名のみアプリの表記に合わせています。</p>
<p>元ファイル名・SHA-256・サイズ・長さ・出典は<a href="manifest.json">音源一覧</a>で確認できます。audio-cmnは取得元のバージョンも固定しています。Shtookaの録音の読みは配布元の一覧で確認しています。読みの記載がない録音は、辞書の読みを確認し、利用者の試聴後に採用しています。元のファイルとの一致は発音の聴取確認とは別です。</p>
<div class="table-wrap"><table><thead><tr><th>アプリの音節・声調</th><th>元の録音</th><th>話者</th><th>ライセンス</th><th>取得日</th></tr></thead><tbody>
{chr(10).join(rows)}
</tbody></table></div></html>
'''


def audit_recording(row):
    result = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(FOLDER / row['file']),
                             '-f', 's16le', '-ac', '1', '-ar', '16000', '-'],
                            check=True, capture_output=True)
    samples = array.array('h', result.stdout)
    if sys.byteorder != 'little':
        samples.byteswap()
    if not samples:
        raise ValueError(f"Empty audio: {row['token']}")
    peak = max(abs(n) for n in samples) / 32768
    rms = math.sqrt(sum(n*n for n in samples) / len(samples)) / 32768
    warnings = []
    if len(samples) / 16000 < .2 or len(samples) / 16000 > 3:
        warnings.append('duration')
    if peak < .01 or rms < .002:
        warnings.append('quiet-or-silent')
    if sum(abs(n) >= 32760 for n in samples) / len(samples) > .005:
        warnings.append('clipping')
    return {'token': row['token'], 'seconds': len(samples)/16000,
            'peak': round(peak, 5), 'rms': round(rms, 5),
            'pcmSha256': hashlib.sha256(result.stdout).hexdigest(), 'warnings': warnings}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true', help='Download missing approved recordings (ffprobe required)')
    parser.add_argument('--check', action='store_true', help='Verify files and generated outputs without writing')
    parser.add_argument('--audit', action='store_true', help='Decode all files, check levels/duplicates; write work report')
    args = parser.parse_args()
    if args.fetch and args.check:
        parser.error('--fetch and --check cannot be combined')
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    validate_manifest(manifest)
    records = [r for r in manifest['records'] if 'file' in r]
    if args.fetch:
        updated = {}
        with ThreadPoolExecutor(max_workers=8) as pool:
            tasks = [pool.submit(fetch_recording, recording_source(manifest, row), row) for row in records]
            for i, task in enumerate(as_completed(tasks), 1):
                row = task.result()
                updated[row['token']] = row
                if i % 100 == 0 or i == len(records):
                    print(f'Fetched/verified {i}/{len(records)}', flush=True)
        manifest['records'] = [updated.get(r['token'], r) for r in manifest['records']]
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        records = [r for r in manifest['records'] if 'file' in r]
    for row in records:
        verify_bytes(recording_source(manifest, row), row, (FOLDER / row['file']).read_bytes())
    expected = {r['file'] for r in records}
    if expected != {p.name for p in FOLDER.glob('*.mp3')}:
        raise ValueError('Audio files do not match the manifest')
    for path, content in [(INDEX, generated_index(manifest)), (FOLDER / 'credits.html', generated_credits(manifest))]:
        if args.check:
            if path.read_text(encoding='utf-8') != content:
                raise ValueError(f'Stale generated file: {path.relative_to(ROOT)}')
        else:
            path.write_text(content, encoding='utf-8')
    if args.audit:
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(audit_recording, records))
        hashes = {}
        for row in results:
            hashes.setdefault(row['pcmSha256'], []).append(row['token'])
        duplicates = [tokens for tokens in hashes.values() if len(tokens) > 1]
        report = {'count': len(results), 'duplicates': duplicates, 'recordings': results}
        destination = ROOT / 'work/syllable-recording-audit.json'
        destination.parent.mkdir(exist_ok=True)
        destination.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        warnings = [r for r in results if r['warnings']]
        print(f'Decoded {len(results)} files; {len(warnings)} level/duration flags; {len(duplicates)} PCM duplicate groups')
    print(f"Verified {len(records)} recordings; {len(manifest['records']) - len(records)} unavailable")


if __name__ == '__main__':
    main()
