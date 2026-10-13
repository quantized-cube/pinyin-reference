"""Generate CC-CEDICT example data. Importing this module has no side effects.
Run with Python 3.10+. --check verifies the catalog against the saved dictionary.
"""
from pathlib import Path
from dataclasses import dataclass
from datetime import datetime, timezone
import argparse
import gzip
import hashlib
import json
import re
import urllib.request

from example_choices import COMMON, ISOLATED_CHOICES, CONTEXTUAL_CHOICES, THIRD_TONE_CHOICES

ROOT = Path(__file__).resolve().parent.parent
URL = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz'
BLOCKED = re.compile(r'variant of|old variant|archaic|obsolete|dialect|Taiwan pr\.|surname|used in names|transliteration|vulgar|slang', re.I)


@dataclass(frozen=True)
class Entry:
    word: str
    tokens: tuple[str, ...]
    gloss: str
    original: str


def parse_entries(raw):
    entries = []
    for line in raw.splitlines():
        match = re.match(r'\S+ (\S+) \[([^\]]+)\] /(.*)/$', line)
        if not match:
            continue
        word, pinyin, gloss = match.groups()
        tokens = tuple(pinyin.lower().replace('u:', 'ü').split())
        if (len(word) != len(tokens) or not 1 <= len(word) <= 3
                or not all(re.fullmatch(r'[a-züê]+[1-5]', t) for t in tokens)
                or not all('\u4e00' <= c <= '\u9fff' for c in word)):
            continue
        entries.append(Entry(word, tokens, gloss, pinyin))
    return entries


def exclusion(entry):
    if BLOCKED.search(entry.gloss):
        return 'excluded-sense-or-usage'
    if any(c.isupper() for c in entry.original):
        return 'proper-name'
    return None


def example(entry, target=0):
    return {'text': entry.word, 'tokens': list(entry.tokens), 'target': target}


def verified(entries, key, word, predicate):
    matches = [e for e in entries if e.word == word and key in e.tokens and predicate(e)]
    if not matches:
        raise ValueError(f'Example not verified in CC-CEDICT: {key}/{word}')
    # Dictionary order never decides between alternate contextual readings.
    return min(matches, key=lambda e: (e.tokens, e.word))


def generate_examples(raw, *, common=COMMON, isolated_choices=ISOLATED_CHOICES,
                      contextual_choices=CONTEXTUAL_CHOICES, third_choices=THIRD_TONE_CHOICES):
    entries = parse_entries(raw)
    rank = {c: i for i, c in enumerate(dict.fromkeys(common))}
    readings = {}
    for e in entries:
        if len(e.word) == 1:
            readings.setdefault(e.word, set()).add(e.tokens[0])
    isolated_options, contextual_options, review = {}, {}, {}
    for e in entries:
        excluded = exclusion(e)
        if len(e.word) == 1:
            token = e.tokens[0]
            reasons = []
            if excluded:
                reasons.append(excluded)
            if len(readings[e.word]) != 1:
                reasons.append('multiple-readings')
            if e.word not in rank:
                reasons.append('outside-familiarity-list')
            if token.endswith('5'):
                reasons.append('neutral-requires-context')
            if reasons:
                review.setdefault(token, []).append({'text': e.word, 'reasons': reasons})
            else:
                isolated_options.setdefault(token, []).append(e)
        elif not excluded:
            for target, token in enumerate(e.tokens):
                score = 400 + (len(e.word) - 1) * 80 + sum(rank.get(c, 1200) for c in e.word) / len(e.word)
                if token.endswith('3') and target and e.tokens[target - 1].endswith('3'):
                    score += 1000
                contextual_options.setdefault(token, []).append((score, e.word, e.tokens, target))

    isolated = {key: example(min(options, key=lambda e: (rank[e.word], e.word)))
                for key, options in isolated_options.items()}
    selected_by = {key: 'familiar-unambiguous' for key in isolated}
    for key, (word, reason) in isolated_choices.items():
        if not re.fullmatch(r'[a-züê]+[1-4]', key) or len(word) != 1 or not reason.strip():
            raise ValueError(f'Invalid isolated choice: {key}/{word}')
        e = verified(entries, key, word, lambda e: e.tokens == (key,))
        isolated[key] = example(e)
        selected_by[key] = 'curated: ' + reason

    contextual = {}
    for key, options in contextual_options.items():
        _, word, tokens, target = min(options)
        contextual[key] = {'text': word, 'tokens': list(tokens), 'target': target}
    for key, word in contextual_choices.items():
        e = verified(entries, key, word, lambda e: len(e.tokens) >= 2)
        contextual[key] = example(e, len(e.tokens) - 1 - e.tokens[::-1].index(key))

    third = {}
    for key, choices in third_choices.items():
        if not re.fullmatch(r'[a-züê]+3', key):
            raise ValueError(f'Invalid third-tone key: {key}')
        forms = {}
        for form, word in choices.items():
            if form not in ('half', 'sandhi'):
                raise ValueError(f'Invalid contextual third-tone form: {form}')
            e = verified(entries, key, word, lambda e: len(e.tokens) == 2 and e.tokens[0] == key
                         and e.tokens[1][-1] in ('124' if form == 'half' else '3'))
            forms[form] = example(e)
        third[key] = dict(sorted(forms.items()))

    maps = {'isolatedExamples': dict(sorted(isolated.items())),
            'contextualExamples': dict(sorted(contextual.items())),
            'thirdToneExamples': dict(sorted(third.items()))}
    # Unfamiliar candidates remain visible to editors; code-point order is not a
    # reason to adopt an obscure character. Definitions are never exported.
    report = {'selectedBy': dict(sorted(selected_by.items())), 'unselectedCandidates': {}}
    for key, options in sorted(review.items()):
        if key not in isolated and not key.endswith('5'):
            unique = {(v['text'], tuple(v['reasons'])) for v in options}
            report['unselectedCandidates'][key] = [
                {'text': word, 'reasons': list(reasons)} for word, reasons in sorted(unique)]
    return maps, report


def retrieval_date(sha, previous_meta, receipt):
    for meta in (receipt, previous_meta):
        if meta.get('sha256') == sha and meta.get('retrieved'):
            return meta['retrieved']
    raise ValueError('Unknown cache retrieval date. Restore its source metadata or download a fresh dictionary.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    cache = ROOT / 'work' / 'cedict.txt.gz'
    output = ROOT / 'public' / 'examples.json'
    receipt_path = cache.with_suffix('.source.json')
    cache.parent.mkdir(exist_ok=True)
    previous = json.loads(output.read_text(encoding='utf-8')) if output.exists() else {}
    receipt = json.loads(receipt_path.read_text(encoding='utf-8')) if receipt_path.exists() else {}
    if not cache.exists():
        if args.check:
            raise ValueError('--check requires the saved dictionary cache')
        with urllib.request.urlopen(URL, timeout=90) as response:
            downloaded = response.read()
        gzip.decompress(downloaded)
        receipt = {'sha256': hashlib.sha256(downloaded).hexdigest(),
                   'retrieved': datetime.now(timezone.utc).strftime('%Y-%m-%d')}
        cache.write_bytes(downloaded)
        receipt_path.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    compressed = cache.read_bytes()
    sha = hashlib.sha256(compressed).hexdigest()
    retrieved = retrieval_date(sha, previous.get('meta', {}), receipt)
    maps, report = generate_examples(gzip.decompress(compressed).decode('utf-8'))
    data = {'schemaVersion': 2, 'meta': {
        'source': 'CC-CEDICT / MDBG', 'url': URL, 'license': 'CC BY-SA 4.0',
        'licenseUrl': 'https://creativecommons.org/licenses/by-sa/4.0/',
        'retrieved': retrieved, 'sha256': sha,
        'changes': 'Selected simplified headwords and readings; definitions omitted; isolated examples selected by reviewed choices or familiar unambiguous characters; contextual and curated third-tone words stored separately.',
    }, **maps}
    if args.check:
        if data != previous:
            raise ValueError('Committed example data differs from the saved dictionary and selection policy')
        print('Example catalog matches the saved source and selection policy.')
    else:
        output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        report['sourceSha256'] = sha
        (cache.parent / 'example-selection-report.json').write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'Generated {len(maps["isolatedExamples"])} isolated / {len(maps["contextualExamples"])} contextual examples; '
              f'{sum(len(v) for v in maps["thirdToneExamples"].values())} third-tone contexts.')
        print(f'{len(report["unselectedCandidates"])} isolated keys have unapproved candidates; see work/example-selection-report.json.')


if __name__ == '__main__':
    main()
