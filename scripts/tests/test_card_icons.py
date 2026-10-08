import importlib.util
import tempfile
import unittest
from pathlib import Path
from PIL import Image

spec = importlib.util.spec_from_file_location('check_card_icons', Path(__file__).parents[1] / 'check_card_icons.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CardIconCheckTest(unittest.TestCase):
    def test_alias_missing_invalid_and_valid_are_distinguished(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            Image.new('RGB', (80, 80)).save(root / 'real.webp', 'WEBP')
            (root / 'html.webp').write_text('<html>challenge</html>')
            cards = [{'name': 'alias', 'imageKey': 'real'}, {'name': 'absent'}, {'name': 'html'}]
            self.assertEqual([f['name'] for f in module.check(cards, root)], ['absent', 'html'])

    def test_wrong_dimensions_or_format_are_invalid(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            Image.new('RGB', (10, 10)).save(root / 'tiny.webp', 'WEBP')
            Image.new('RGB', (80, 80)).save(root / 'png.webp', 'PNG')
            self.assertEqual(len(module.check([{'name': 'tiny'}, {'name': 'png'}], root)), 2)

    def test_path_traversal_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertIn('Unsafe', module.check([{'name': '../outside'}], folder)[0]['error'])


if __name__ == '__main__':
    unittest.main()
