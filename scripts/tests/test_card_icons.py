import importlib.util
import io
import json
import os
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch
from PIL import Image

spec = importlib.util.spec_from_file_location('check_card_icons', Path(__file__).parents[1] / 'check_card_icons.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CardIconCheckTest(unittest.TestCase):
    def test_alias_pending_invalid_and_valid_are_distinguished(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            Image.new('RGB', (80, 80)).save(root / 'real.webp', 'WEBP')
            (root / 'html.webp').write_text('<html>challenge</html>')
            cards = [{'name': 'alias', 'imageKey': 'real'}, {'name': 'absent'}, {'name': 'html'}]
            report = module.check(cards, root)
            self.assertEqual([f['name'] for f in report['failures']], ['html'])
            self.assertEqual([f['name'] for f in report['pending']], ['absent'])
            self.assertEqual((report['validCount'], report['pendingCount'], report['failedCount']), (1, 1, 1))

    def test_wrong_dimensions_or_format_are_invalid(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            Image.new('RGB', (10, 10)).save(root / 'tiny.webp', 'WEBP')
            Image.new('RGB', (80, 80)).save(root / 'png.webp', 'PNG')
            self.assertEqual(module.check([{'name': 'tiny'}, {'name': 'png'}], root)['failedCount'], 2)

    def test_path_traversal_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertIn('Unsafe', module.check([{'name': '../outside'}], folder)['failures'][0]['error'])

    def test_missing_directory_is_configuration_error(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError, 'directory is missing'):
                module.check([{'name': 'one'}], Path(folder) / 'nonexistent')

    def test_filesystem_permission_errors_are_not_pending(self):
        with tempfile.TemporaryDirectory() as folder:
            with patch.object(module.Image, 'open', side_effect=PermissionError('denied')):
                report = module.check([{'name': 'one'}], folder)
            self.assertEqual(report['failedCount'], 1)
            self.assertEqual(report['pendingCount'], 0)

    def run_cli(self, root, cards):
        (root / 'catalog.json').write_text(json.dumps(cards), encoding='utf8')
        return module.main(['--catalog', str(root / 'catalog.json'), '--images', str(root),
                            '--report', str(root / 'report.json')])

    def test_pending_only_exits_zero_without_summary_or_warning(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            summary = root / 'summary.md'
            output = io.StringIO()
            with patch.dict(os.environ, {'GITHUB_STEP_SUMMARY': str(summary)}), redirect_stdout(output):
                self.assertEqual(self.run_cli(root, [{'name': 'waiting'}]), 0)
            self.assertFalse(summary.exists())
            self.assertNotIn('waiting', output.getvalue())
            self.assertNotIn('error', output.getvalue().lower())
            self.assertNotIn('warning', output.getvalue().lower())
            report = json.loads((root / 'report.json').read_text())
            self.assertEqual((report['pendingCount'], report['failedCount']), (1, 0))

    def test_mixed_case_reports_only_actual_corruption(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            summary = root / 'summary.md'
            (root / 'broken.webp').write_bytes(b'<html>challenge</html>')
            Image.new('RGB', (80, 80)).save(root / 'ready.webp', 'WEBP')
            with patch.dict(os.environ, {'GITHUB_STEP_SUMMARY': str(summary)}), redirect_stdout(io.StringIO()):
                self.assertEqual(self.run_cli(root, [{'name': 'waiting'}, {'name': 'broken'}, {'name': 'ready'}]), 1)
            notice = summary.read_text()
            self.assertIn('broken', notice)
            self.assertNotIn('waiting', notice)
            report = json.loads((root / 'report.json').read_text())
            self.assertEqual((report['validCount'], report['pendingCount'], report['failedCount']), (1, 1, 1))

    def test_later_file_arrival_becomes_valid_without_special_handling(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            self.assertEqual(module.check([{'name': 'one'}], root)['pendingCount'], 1)
            Image.new('RGB', (80, 80)).save(root / 'one.webp', 'WEBP')
            report = module.check([{'name': 'one'}], root)
            self.assertEqual((report['validCount'], report['pendingCount'], report['failedCount']), (1, 0, 0))


if __name__ == '__main__':
    unittest.main()
