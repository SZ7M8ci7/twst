import collections, json, pathlib, sys
root=pathlib.Path('artifacts/nrc19');tag=sys.argv[1]
rows=[]
for side in ['before','after']:
    files=(root/(tag+'-'+side)).glob('case-*.json')
    values={}
    for p in files:
        try:
            value=json.loads(p.read_text())
            if all(value.get(k) for k in ['sourceHash','catalogHash','presetsHash','profileManifestHash']):values[p.name]=value
        except ValueError:pass
    rows.append(values)
matched=rows[0].keys()&rows[1].keys()
assert all(all(check['ok'] for check in rows[side][key]['constraints']) for key in matched for side in [0,1])
print(json.dumps({'tag':tag,'before':len(rows[0]),'after':len(rows[1]),'pairs':len(matched),'byProfile':dict(collections.Counter(rows[0][key]['profile'] for key in matched)),'constraints':'pass'},ensure_ascii=False))
