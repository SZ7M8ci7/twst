"""Report missing/invalid display icons after simulator synchronization or catalog merge."""
import argparse
import json
import os
from pathlib import Path

from PIL import Image


def check(catalog, images):
    failures = []
    for card in catalog:
        name = card.get('imageKey') or card['name']
        try:
            root = Path(images).resolve()
            path = (root / (name + '.webp')).resolve()
            if path.parent != root:
                raise ValueError('Unsafe image name')
            with Image.open(path) as image:
                if image.format != 'WEBP' or image.size != (80, 80):
                    raise ValueError('Expected an 80x80 WebP icon')
                image.verify()
            with Image.open(path) as image:
                image.load()
        except Exception as error:
            failures.append({'name': card['name'], 'imageKey': name,
                             'label': '{} / {}'.format(card.get('chara', ''), card.get('costume', '')),
                             'error': str(error)})
    return failures


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', type=Path, default=Path('src/assets/chara.json'))
    parser.add_argument('--images', type=Path, default=Path('src/assets/img'))
    parser.add_argument('--report', type=Path, default=Path('reports/card-icons.json'))
    args = parser.parse_args()
    cards = json.loads(args.catalog.read_text(encoding='utf-8'))
    failures = check(cards, args.images)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps({'cardCount': len(cards), 'failedCount': len(failures),
                                      'failures': failures}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    summary = 'Card display icons: {} / {} valid\n'.format(len(cards) - len(failures), len(cards))
    summary += ''.join('- `{}` {}: {}\n'.format(f['name'], f['label'], f['error']) for f in failures)
    print(summary)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as stream:
            stream.write('### ' + summary + '\n')
    return int(bool(failures))


if __name__ == '__main__':
    raise SystemExit(main())
