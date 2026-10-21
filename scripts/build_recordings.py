"""Maintain the reviewed syllable recordings; network access requires --fetch.

The manifest fixes the adopted scope. This script never discovers/approves new
tokens from upstream filenames. --audit requires ffmpeg and ffprobe on PATH.
"""
import argparse
import array
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import html
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
FOLDER = ROOT / 'public/audio/syllables'
MANIFEST = FOLDER / 'manifest.json'
INDEX = ROOT / 'src/syllable-recording-index.ts'


def source_url(source, row):
    return (f"https://raw.githubusercontent.com/hugolpz/audio-cmn/{source['revision']}/"
            f"{source['directory']}/cmn-{row['sourceToken']}.mp3")


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
            continue
        if row['file'] != token.replace('ü', 'v') + '.mp3' or row['file'] in files:
            raise ValueError(f'Invalid or duplicate filename: {token}')
        files.add(row['file'])
        if not re.fullmatch(r'[a-z]+[1-4]', row['sourceToken']):
            raise ValueError(f'Invalid source token: {token}')
        if row['sourceToken'][-1] != token[-1]:
            raise ValueError(f'Source tone mismatch: {token}')


def verify_bytes(source, row, data):
    if len(data) != row['bytes'] or hashlib.sha256(data).hexdigest() != row['sha256']:
        raise ValueError(f"File changed: {row['token']}")
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
    if path.exists() and 'sha256' in row:
        verify_bytes(source, row, path.read_bytes())
        return row
    if not path.exists():
        # Reuse previously shipped, unchanged recordings before requesting upstream.
        old = [ROOT / 'public/audio' / kind / row['file'] for kind in ('comparison', 'detail')]
        cached = next((p for p in old if p.exists()), None)
        if cached:
            shutil.copyfile(cached, path)
        else:
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(source_url(source, row), timeout=30) as response:
                        data = response.read()
                    path.write_bytes(data)
                    break
                except OSError:
                    if attempt == 2:
                        raise
                    time.sleep(attempt + 1)
    data = path.read_bytes()
    result = probe(path)
    updated = {**row, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data),
               'duration': round(float(result['duration']), 6)}
    verify_bytes(source, updated, data)
    return updated


def generated_index(manifest):
    available = [r['token'] for r in manifest['records'] if 'file' in r]
    missing = [r['token'] for r in manifest['records'] if 'unavailable' in r]
    def lines(tokens):
        return '\n'.join('  ' + ', '.join(repr(t) for t in tokens[i:i+12]) + ',' for i in range(0, len(tokens), 12))
    return ('// Generated from public/audio/syllables/manifest.json by scripts/build_recordings.py.\n'
            '// Source metadata verifies identity, not an auditory judgment of pronunciation.\n'
            'export const syllableRecordingTokens: readonly string[] = [\n' + lines(available) + '\n];\n'
            'export const unavailableRecordingTokens: readonly string[] = [\n' + lines(missing) + '\n];\n')


def generated_credits(manifest):
    s = manifest['source']
    esc = html.escape
    rows = []
    for r in manifest['records']:
        if 'file' not in r:
            continue
        url = f"{s['repository']}/blob/{s['revision']}/{s['directory']}/cmn-{r['sourceToken']}.mp3"
        note = '（元音源に発音・話者のID3タグなし。取得したバージョンの配布元情報を参照）' if r.get('metadataNote') else ''
        rows.append(f'<tr><td>{esc(r["token"])}</td><td><a href="{esc(url)}">{esc(r["sourceToken"])}</a>{note}</td></tr>')
    return f'''<!doctype html>
<html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>単独音の録音 — 出典・ライセンス</title>
<style>body{{font:16px/1.8 system-ui,sans-serif;max-width:56rem;margin:3rem auto;padding:0 1rem;color:#233536}}table{{border-collapse:collapse}}td,th{{border-bottom:1px solid #ddd;padding:.3rem 1.5rem .3rem 0;text-align:left}}a{{color:#17625a}}</style>
<h1>単独音の録音</h1>
<p>音節詳細の第1〜4声と聞き比べには、共通の音源を使っています。録音は元の速度で再生します。図とIPAは、録音を測定して作成したものではありません。</p>
<p>話者：{esc(s['speaker'])}<br>著作者：{esc(s['author'])}<br>
音源：<a href="{esc(s['repository'])}">{esc(s['name'])}</a><br>
ライセンス：<a href="{esc(s['licenseUrl'])}">{esc(s['license'])}</a><br>
取得日：{esc(s['retrieved'])}。MP3の音声・メタデータは改変していません。ファイル名のみアプリの表記に合わせています。</p>
<p>取得元のバージョンを固定しています。元ファイル名・SHA-256・サイズ・長さは<a href="manifest.json">音源一覧</a>で確認できます。元のファイルと一致するかを検証しても、すべての録音を聞いて発音を確認したことにはなりません。</p>
<table><thead><tr><th>アプリの音節・声調</th><th>元の録音</th></tr></thead><tbody>
{chr(10).join(rows)}
</tbody></table></html>
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
            tasks = [pool.submit(fetch_recording, manifest['source'], row) for row in records]
            for i, task in enumerate(as_completed(tasks), 1):
                row = task.result()
                updated[row['token']] = row
                if i % 100 == 0 or i == len(records):
                    print(f'Fetched/verified {i}/{len(records)}', flush=True)
        manifest['records'] = [updated.get(r['token'], r) for r in manifest['records']]
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        records = [r for r in manifest['records'] if 'file' in r]
    for row in records:
        verify_bytes(manifest['source'], row, (FOLDER / row['file']).read_bytes())
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
