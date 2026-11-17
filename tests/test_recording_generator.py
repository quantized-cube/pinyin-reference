"""Offline checks for restoring recordings against their approved fingerprints."""
import hashlib
import copy
import io
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import build_recordings as recordings


class RecordingRestoreTests(unittest.TestCase):
    def setUp(self):
        work = (recordings.ROOT / 'work').resolve()
        work.mkdir(exist_ok=True)
        temporary = tempfile.TemporaryDirectory(prefix='recording-restore-', dir=work)
        self.root = Path(temporary.name).resolve()
        self.assertEqual(self.root.parent, work)  # Bound the eventual cleanup target.
        self.addCleanup(temporary.cleanup)
        self.folder = self.root / 'public/audio/syllables'
        self.folder.mkdir(parents=True)
        self.patch('ROOT', self.root)
        self.patch('FOLDER', self.folder)
        self.source = {'revision': 'a' * 40, 'directory': 'fixture',
                       'speaker': 'Fixture Speaker', 'licenseTag': 'CC BY-SA 3.0'}
        self.data = b'fixture audio\0' + b''.join(
            (key + '\0' + value + '\0').encode()
            for key, value in [('SWAC_TEXT', 'a1'), ('SWAC_LANG', 'cmn'),
                               ('SWAC_SPEAK_NAME', self.source['speaker']),
                               ('SWAC_COLL_LICENSE', self.source['licenseTag'])]
        )
        self.row = {'token': 'a1', 'sourceToken': 'a1', 'file': 'a1.mp3',
                    'sha256': hashlib.sha256(self.data).hexdigest(),
                    'bytes': len(self.data), 'duration': 0.75}
        self.download = self.patch('urllib.request.urlopen', return_value=io.BytesIO(self.data))
        self.probe = self.patch('probe', return_value={'duration': '0.75'})

    def patch(self, name, *args, **kwargs):
        patcher = patch('build_recordings.' + name, *args, **kwargs)
        result = patcher.start()
        self.addCleanup(patcher.stop)
        return result

    def restore(self, data, cached=False, row=None):
        if cached:
            cache = self.root / 'public/audio/comparison/a1.mp3'
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_bytes(data)
        else:
            self.download.return_value = io.BytesIO(data)
        return recordings.fetch_recording(self.source, self.row if row is None else row)

    def test_downloaded_recording_preserves_approved_metadata(self):
        original = dict(self.row)
        self.assertEqual(self.restore(self.data), original)
        self.assertEqual(self.row, original)
        self.assertEqual((self.folder / 'a1.mp3').read_bytes(), self.data)
        self.download.assert_called_once()
        self.probe.assert_not_called()

    def test_cached_recording_preserves_approved_metadata_without_network(self):
        self.assertEqual(self.restore(self.data, cached=True), self.row)
        self.assertEqual((self.folder / 'a1.mp3').read_bytes(), self.data)
        self.download.assert_not_called()
        self.probe.assert_not_called()

    def test_changed_downloads_and_caches_fail_before_saving(self):
        # Keep every identity tag intact; both size changes and same-size edits must fail.
        original = dict(self.row)
        for cached in [False, True]:
            for changed in [self.data + b'extra', b'X' + self.data[1:]]:
                with self.subTest(cached=cached, size=len(changed)):
                    with self.assertRaisesRegex(ValueError, 'File changed: a1'):
                        self.restore(changed, cached=cached)
                    self.assertFalse((self.folder / 'a1.mp3').exists())
                    self.assertEqual(self.row, original)
        self.probe.assert_not_called()

    def test_existing_recordings_are_verified_without_fetching(self):
        path = self.folder / 'a1.mp3'
        path.write_bytes(self.data)
        self.assertEqual(recordings.fetch_recording(self.source, self.row), self.row)
        path.write_bytes(b'X' + self.data[1:])
        with self.assertRaisesRegex(ValueError, 'File changed: a1'):
            recordings.fetch_recording(self.source, self.row)
        self.download.assert_not_called()
        self.probe.assert_not_called()

    def test_unpinned_recording_gets_its_initial_metadata(self):
        row = {key: value for key, value in self.row.items()
               if key not in ('sha256', 'bytes', 'duration')}
        original = dict(row)
        self.assertEqual(self.restore(self.data, row=row), self.row)
        self.assertEqual(row, original)
        self.probe.assert_called_once_with(self.folder / 'a1.mp3')

    def collection_fixture(self):
        source = {'kind': 'shtooka', 'downloadBaseUrl': 'https://example.test/mp3/',
                  'speaker': 'Fixture Speaker', 'author': 'Fixture Author',
                  'license': 'CC BY', 'licenseUrl': 'https://example.test/license',
                  'sourcePage': 'https://example.test/readme', 'indexUrl': 'https://example.test/index.xml',
                  'retrieved': '2026-11-17', 'metadataSpeaker': 'Fixture Speaker', 'metadataLicense': 'CC BY'}
        data = b'original collection MP3 with no SWAC tags'
        row = {'token': 'a1', 'file': 'a1.mp3', 'sourceId': 'fixture', 'sourceFile': 'cmn-1234abcd.mp3',
               'sourceText': '啊', 'sourcePinyin': 'ā', 'bytes': len(data),
               'sha256': hashlib.sha256(data).hexdigest(), 'duration': .8,
               'sourceMetadata': {'swac_text': '啊', 'swac_pron_phon': 'ā', 'swac_lang': 'cmn',
                                  'swac_speak_name': 'Fixture Speaker', 'swac_coll_license': 'CC BY'}}
        return source, row, data

    def test_collection_restore_uses_its_source_and_ignores_superseded_cache(self):
        source, row, data = self.collection_fixture()
        cached = self.root / 'public/audio/comparison/a1.mp3'
        cached.parent.mkdir(parents=True)
        cached.write_bytes(self.data)
        self.download.return_value = io.BytesIO(data)
        self.assertEqual(recordings.fetch_recording(source, row), row)
        self.download.assert_called_once_with('https://example.test/mp3/cmn-1234abcd.mp3', timeout=30)
        self.assertEqual((self.folder / row['file']).read_bytes(), data)
        self.probe.assert_not_called()

    def test_collection_restore_rejects_changed_bytes_before_writing(self):
        source, row, data = self.collection_fixture()
        self.download.return_value = io.BytesIO(b'X' + data[1:])
        with self.assertRaisesRegex(ValueError, 'File changed'):
            recordings.fetch_recording(source, row)
        self.assertFalse((self.folder / row['file']).exists())

    def test_collection_manifest_binds_reading_and_metadata_to_source(self):
        source, row, _ = self.collection_fixture()
        manifest = {'schemaVersion': 1, 'source': self.source,
                    'additionalSources': {'fixture': source}, 'records': [row]}
        recordings.validate_manifest(manifest)
        self.assertIs(recordings.recording_source(manifest, row), source)
        for field, wrong in [('sourcePinyin', 'á'), ('sourceFile', '../other.mp3'),
                             ('sha256', 'unfixed'), ('sourceId', 'unknown')]:
            changed = copy.deepcopy(manifest)
            changed['records'][0][field] = wrong
            with self.subTest(field=field), self.assertRaises((ValueError, KeyError)):
                recordings.validate_manifest(changed)
        changed = copy.deepcopy(manifest)
        changed['records'][0]['sourceMetadata']['swac_speak_name'] = 'Other Speaker'
        with self.assertRaisesRegex(ValueError, 'Collection index mismatch'):
            recordings.validate_manifest(changed)

    def test_explicit_tts_fallback_requires_a_matching_example_and_no_audio_file(self):
        row = {'token': 'fa4', 'unavailable': 'Rejected',
               'ttsFallback': {'text': '长发', 'tokens': ['chang2', 'fa4'], 'target': 1}}
        manifest = {'schemaVersion': 1, 'source': self.source, 'records': [row]}
        recordings.validate_manifest(manifest)
        index = recordings.generated_index(manifest)
        self.assertIn('syllableSpeechExamples', index)
        self.assertIn('长发', index)
        for field, value in [('text', '发'), ('target', 0), ('tokens', ['chang2', 'fa1'])]:
            changed = copy.deepcopy(manifest)
            changed['records'][0]['ttsFallback'][field] = value
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, 'Invalid TTS fallback'):
                recordings.validate_manifest(changed)
        changed = copy.deepcopy(manifest)
        changed['records'][0]['file'] = 'fa4.mp3'
        with self.assertRaisesRegex(ValueError, 'Invalid unavailable recording'):
            recordings.validate_manifest(changed)


if __name__ == '__main__':
    unittest.main()
