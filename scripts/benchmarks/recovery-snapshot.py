"""Save the private input and completed pairs beside a portable source bundle."""
import datetime, hashlib, json, pathlib, subprocess, zipfile
root = pathlib.Path.cwd()
artifacts = root / 'artifacts/nrc19'
assert not subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=no']).strip(), 'Commit tracked work before snapshot'
branch = subprocess.check_output(['git', 'branch', '--show-current'], text=True).strip()
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
baseline = '8d68abb678ab3c74d6de4a9d793749cb93f9ab60'
bundle = artifacts / 'recovery-code.bundle'
subprocess.run(['git', 'bundle', 'create', str(bundle), baseline + '..' + branch], check=True)
files = [(bundle, 'code.bundle'), (artifacts / 'profiles.json', 'artifacts/nrc19/profiles.json')]
runs = {}
for before in sorted(artifacts.glob('*-before')):
    after = before.with_name(before.name[:-7] + '-after')
    if not after.is_dir(): continue
    count = 0
    for first in sorted(before.glob('case-*.json')):
        second = after / first.name
        if not second.exists(): continue
        try:
            rows = [json.loads(p.read_text()) for p in [first, second]]
            assert all(all(r.get(k) for k in ['sourceHash', 'catalogHash', 'presetsHash', 'profileManifestHash']) for r in rows)
            assert rows[0]['input'] == rows[1]['input']
        except (ValueError, AssertionError): continue
        files += [(p, str(p.relative_to(root))) for p in [first, second]]
        count += 1
    files += [(p, str(p.relative_to(root))) for p in before.glob('plan-*.json')]
    runs[before.name[:-7]] = count
for pattern in ['*-summary.json', '*-integrity.json', '*-report.json', '*-plan.json', '*.log']:
    files += [(p, str(p.relative_to(root))) for p in artifacts.glob(pattern)]
metadata = {'schema': 1, 'privateInputIncluded': True, 'branch': branch, 'head': head, 'baseline': baseline,
    'createdUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'completedPairs': runs,
    'note': 'Only matched completed pairs are recoverable. Rerun interrupted pairs from scratch on BOTH versions. Checkpoints are deliberately excluded.',
    'profileFileSha256': hashlib.sha256((artifacts / 'profiles.json').read_bytes()).hexdigest()}
out = artifacts / 'twst-nrc19-private-recovery-2026-11-14.zip'
with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=1) as archive:
    for path, name in files: archive.write(path, name)
    archive.writestr('RECOVERY.json', json.dumps(metadata, ensure_ascii=False, indent=2))
print(json.dumps({'path': str(out), 'bytes': out.stat().st_size, **metadata}, ensure_ascii=False))
