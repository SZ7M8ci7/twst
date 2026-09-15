"""Reproduce the user-requested public screenshot fixtures; never used by the app."""
import hashlib
import json
from pathlib import Path
import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / 'artifacts/recognition-real-posts'
TARGET.mkdir(parents=True, exist_ok=True)
for image in json.loads(Path(__file__).with_name('real-posts.json').read_text(encoding='utf-8'))['images']:
    target = TARGET / image['file']
    if not target.exists():
        response = requests.get(image['url'], timeout=30)
        response.raise_for_status()
        data = response.content
        if hashlib.sha256(data).hexdigest() != image['sha256']:
            raise RuntimeError(f"Source changed: {image['post']}")
        target.write_bytes(data)
    if hashlib.sha256(target.read_bytes()).hexdigest() != image['sha256']:
        raise RuntimeError(f'Fixture hash mismatch: {target.name}')
    Image.open(target).convert('RGBA').save(target.with_suffix('.png'))
    print(target.name)
    if target.name in ['2093301178482450833-1.jpg', '1819999957765759150-1.jpg']:
        original = Image.open(target)
        small = target.with_name(target.stem + '-small.jpg')
        original.resize((round(original.width * .7), round(original.height * .7))).save(small, quality=70)
        Image.open(small).convert('RGBA').save(small.with_suffix('.png'))
