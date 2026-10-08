"""Check display icons: absent files wait quietly; malformed files fail."""
import argparse
import json
import os
from pathlib import Path

from PIL import Image


def check(catalog, images):
    root = Path(images).resolve()
    if not root.is_dir():
        raise ValueError('Image directory is missing: ' + str(root))
    failures, pending = [], []
    for card in catalog:
        name = card.get('imageKey') or card['name']
        record = {'name': card['name'], 'imageKey': name,
                  'label': '{} / {}'.format(card.get('chara', ''), card.get('costume', ''))}
        try:
            path = (root / (name + '.webp')).resolve()
            if path.parent != root:
                raise ValueError('Unsafe image name')
            with Image.open(path) as image:
                if image.format != 'WEBP' or image.size != (80, 80):
                    raise ValueError('Expected an 80x80 WebP icon')
                image.verify()
            with Image.open(path) as image:
                image.load()
        except FileNotFoundError:
            pending.append({**record, 'reason': 'Display icon not available yet'})
        except Exception as error:
            failures.append({**record, 'error': str(error)})
    return {'cardCount': len(catalog), 'validCount': len(catalog) - len(failures) - len(pending),
            'failedCount': len(failures), 'pendingCount': len(pending),
            'failures': failures, 'pending': pending}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog', type=Path, default=Path('src/assets/chara.json'))
    parser.add_argument('--images', type=Path, default=Path('src/assets/img'))
    parser.add_argument('--report', type=Path, default=Path('reports/card-icons.json'))
    args = parser.parse_args(argv)
    cards = json.loads(args.catalog.read_text(encoding='utf-8'))
    report = check(cards, args.images)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    failures = report['failures']
    summary = 'Card display icons: {} cards checked\n'.format(len(cards))
    summary += ''.join('- `{}` {}: {}\n'.format(f['name'], f['label'], f['error']) for f in failures)
    print(summary, end='')
    # Pending details stay in the diagnostic artifact, not in a notification/summary.
    if failures and os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as stream:
            stream.write('### ' + summary + '\n')
    return int(bool(failures))


if __name__ == '__main__':
    raise SystemExit(main())
