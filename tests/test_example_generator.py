"""Selection policy tests using a tiny local dictionary, without network access."""
import sys
import unittest
import gzip
import hashlib
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_examples import generate_examples, load_pinned_source, download_source, parse_entries, ROOT


def generate(raw, **overrides):
    options = dict(common='', isolated_choices={}, contextual_choices={}, third_choices={})
    options.update(overrides)
    return generate_examples(raw, **options)


class ExampleGeneratorTests(unittest.TestCase):
    def test_single_and_context_are_independent(self):
        raw = '眼 眼 [yan3] /eye/\n演說者 演说者 [yan3 shuo1 zhe3] /speaker/'
        data, _ = generate(raw, common='演说者', isolated_choices={'yan3': ('眼', 'Familiar eye character')})
        self.assertEqual(data['isolatedExamples']['yan3']['text'], '眼')
        self.assertEqual(data['contextualExamples']['yan3']['text'], '演说者')

    def test_unknown_characters_stay_unrecorded_until_reviewed(self):
        raw = '儼 俨 [yan3] /solemn/\n眼 眼 [yan3] /eye/\n吲 吲 [yin3] /chemical prefix/'
        data, report = generate(raw)
        self.assertEqual(data['isolatedExamples'], {})
        self.assertEqual(len(report['unselectedCandidates']['yan3']), 2)
        data, _ = generate(raw, common='眼')
        self.assertEqual(data['isolatedExamples']['yan3']['text'], '眼')
        self.assertNotIn('yin3', data['isolatedExamples'])

    def test_automatic_exclusions_and_reviewed_exceptions(self):
        raw = ('剖 剖 [pou1] /to cut open/to analyze/Taiwan pr. [pou3]/\n'
               '女 女 [nu:3] /female/\n女 女 [ru3] /archaic you/\n'
               '頂 顶 [ding3] /top/(slang) most/\n陳 陈 [Chen2] /surname Chen/')
        data, _ = generate(raw, common='剖女顶陈')
        self.assertEqual(data['isolatedExamples'], {})
        data, report = generate(raw, common='剖女顶陈', isolated_choices={
            'pou1': ('剖', 'Ordinary meaning; Taiwan reading note is separate'),
            'nü3': ('女', 'Reviewed female reading'),
        })
        self.assertEqual(set(data['isolatedExamples']), {'pou1', 'nü3'})
        self.assertIn('ding3', report['unselectedCandidates'])

    def test_invalid_manual_requests_fail_instead_of_silently_falling_back(self):
        raw = '女 女 [nu:3] /female/\n眼睛 眼睛 [yan3 jing5] /eyes/'
        for key, word in [('nü4', '女'), ('yan3', '眼睛'), ('ma5', '吗')]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                generate(raw, isolated_choices={key: (word, 'Reviewed')})
        with self.assertRaises(ValueError):
            generate(raw, contextual_choices={'jing5': '睛'})
        with self.assertRaises(ValueError):
            generate(raw, isolated_choices={'nü3': ('女', '')})

    def test_neutral_always_has_context_and_targets_the_last_matching_syllable(self):
        raw = '媽 妈 [ma1] /mother/\n嗎 吗 [ma5] /particle/\n媽媽 妈妈 [ma1 ma5] /mother/'
        data, _ = generate(raw, common='妈吗', contextual_choices={'ma5': '妈妈'})
        self.assertNotIn('ma5', data['isolatedExamples'])
        self.assertEqual(data['contextualExamples']['ma5'], {'text': '妈妈', 'tokens': ['ma1', 'ma5'], 'target': 1})

    def test_third_tone_contexts_must_be_explicit_and_match(self):
        raw = ('好 好 [hao3] /good/\n好吃 好吃 [hao3 chi1] /tasty/\n'
               '好友 好友 [hao3 you3] /friend/\n好的 好的 [hao3 de5] /okay/')
        data, _ = generate(raw, common='好', third_choices={'hao3': {'half': '好吃', 'sandhi': '好友'}})
        self.assertEqual(set(data['thirdToneExamples']['hao3']), {'half', 'sandhi'})
        self.assertNotIn('full', data['thirdToneExamples']['hao3'])
        for form, word in [('full', '好'), ('half', '好友'), ('half', '好的'), ('sandhi', '好吃')]:
            with self.subTest(form=form, word=word), self.assertRaises(ValueError):
                generate(raw, third_choices={'hao3': {form: word}})

    def test_results_and_review_report_do_not_depend_on_dictionary_order(self):
        raw = '眼 眼 [yan3] /eye/\n儼 俨 [yan3] /solemn/\n眼睛 眼睛 [yan3 jing5] /eyes/\n演說 演说 [yan3 shuo1] /speech/'
        self.assertEqual(generate(raw), generate('\n'.join(reversed(raw.splitlines()))))
        self.assertEqual(generate(raw, common='眼'), generate(raw, common='眼'))

    def test_ambiguous_curated_readings_fail_but_duplicate_definitions_are_allowed(self):
        raw = '好吃 好吃 [hao3 chi1] /tasty/\n好吃 好吃 [hao3 chi1] /palatable/'
        data, _ = generate(raw, third_choices={'hao3': {'half': '好吃'}})
        self.assertEqual(data['thirdToneExamples']['hao3']['half']['tokens'], ['hao3', 'chi1'])
        # Synthetic alternate dictionary reading: neither ordering may silently win.
        ambiguous = raw + '\n好吃 好吃 [hao3 chi2] /fixture alternate reading/'
        for text in (ambiguous, '\n'.join(reversed(ambiguous.splitlines()))):
            with self.assertRaisesRegex(ValueError, 'Ambiguous'):
                generate(text, third_choices={'hao3': {'half': '好吃'}})
            with self.assertRaisesRegex(ValueError, 'Ambiguous'):
                generate(text, contextual_choices={'hao3': '好吃'})

    def test_bundled_source_is_readable_without_cache_or_network(self):
        with patch('build_examples.urllib.request.urlopen', side_effect=AssertionError('Unexpected network')):
            compressed, source = load_pinned_source(ROOT / 'data' / 'cedict')
            entries = parse_entries(gzip.decompress(compressed).decode('utf-8'))
        self.assertTrue(entries)
        self.assertEqual(source['sha256'], hashlib.sha256(compressed).hexdigest())
        # Deliberately do not compare old generated JSON here: these tests run
        # before regeneration, including when the editorial choices have changed.

    def test_pinned_source_rejects_tampering_missing_files_and_path_escape(self):
        work = (ROOT / 'work').resolve()
        work.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='source-test-', dir=work) as temporary:
            directory = Path(temporary).resolve()
            self.assertEqual(directory.parent, work)  # Check the eventual cleanup target.
            compressed = gzip.compress(b'fixture dictionary')
            sha = hashlib.sha256(compressed).hexdigest()
            meta = {'filename': f'cedict-{sha}.txt.gz', 'sha256': sha,
                    'source': 'fixture', 'url': 'https://example.test/dictionary',
                    'license': 'fixture', 'licenseUrl': 'https://example.test/license', 'retrieved': '2026-10-07'}
            manifest = directory / 'source.json'
            manifest.write_text(json.dumps(meta), encoding='utf-8')
            with self.assertRaises(FileNotFoundError):
                load_pinned_source(directory)
            snapshot = directory / meta['filename']
            snapshot.write_bytes(compressed)
            self.assertEqual(load_pinned_source(directory), (compressed, meta))
            snapshot.write_bytes(compressed + b'corruption')
            with self.assertRaisesRegex(ValueError, 'SHA-256'):
                load_pinned_source(directory)
            manifest.write_text(json.dumps({**meta, 'filename': '../outside.txt.gz'}), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'manifest'):
                load_pinned_source(directory)

    def test_downloading_new_source_is_explicit_and_records_the_downloaded_bytes(self):
        compressed = gzip.compress('眼 眼 [yan3] /eye/'.encode('utf-8'))
        with patch('build_examples.urllib.request.urlopen') as request:
            request.return_value.__enter__.return_value.read.return_value = compressed
            actual, meta = download_source()
        self.assertEqual(actual, compressed)
        self.assertEqual(meta['sha256'], hashlib.sha256(compressed).hexdigest())
        self.assertIn(meta['sha256'], meta['filename'])


if __name__ == '__main__':
    unittest.main()
