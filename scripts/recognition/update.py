"""Build descriptors from Japanese Wiki artwork and existing catalog icons."""
import argparse, hashlib, io, json, struct
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from wikiru import ORIGIN, WikiClient, inventory, page_name, parse_page
ROOT=Path(__file__).resolve().parents[2]
EXTRACTOR='orb-art-catalog-diverse-v5'
SHARDS=64

def digest(raw):return hashlib.sha256(raw).hexdigest()
def encoded(obj):return json.dumps(obj,ensure_ascii=False,separators=(',',':')).encode('utf-8')
def atomic(path,raw):
 path.parent.mkdir(parents=True,exist_ok=True)
 temp=path.with_suffix(path.suffix+'.tmp');temp.write_bytes(raw);temp.replace(path)

def extract(raw):
 image=Image.open(io.BytesIO(raw))
 if image.width*image.height>20_000_000 or min(image.size)<32:raise ValueError('Unsupported artwork dimensions')
 image=np.asarray(image.convert('RGB'));h,w=image.shape[:2]
 image=cv2.resize(image,(960,round(h*960/w)),interpolation=cv2.INTER_AREA)
 gray=cv2.cvtColor(image,cv2.COLOR_RGB2GRAY)
 options=dict(scaleFactor=1.2,nlevels=10,edgeThreshold=8,patchSize=31,fastThreshold=7)
 points,descriptors=cv2.ORB_create(nfeatures=640,**options).detectAndCompute(gray,None)
 if descriptors is None or len(points)<12:raise ValueError('Insufficient artwork features')
 # Keep multiscale anchors, then prevent many neighboring points from taking
 # the entire budget. This retains small faces in large ensemble artwork.
 dense_points,dense_descriptors=cv2.ORB_create(nfeatures=4000,**options).detectAndCompute(gray,None)
 seen={bytes(descriptor) for descriptor in descriptors};cells=set();extra=[]
 for point,descriptor in sorted(zip(dense_points,dense_descriptors),key=lambda item:-item[0].response):
  cell=(round(point.pt[0]/4),round(point.pt[1]/4))
  if cell in cells:continue
  cells.add(cell)
  if bytes(descriptor) in seen:continue
  seen.add(bytes(descriptor));extra.append((point,descriptor))
  if len(extra)>=1920:break
 pairs=list(zip(points,descriptors))+extra
 data=b''.join(struct.pack('<ff',*point.pt)+bytes(descriptor) for point,descriptor in pairs)
 return dict(count=len(data)//40,width=image.shape[1],height=image.shape[0]),data

def extract_icon(raw):
 image=np.asarray(Image.open(io.BytesIO(raw)).convert('RGB'));gray=cv2.cvtColor(cv2.resize(image,(128,128)),cv2.COLOR_RGB2GRAY)
 points,descriptors=cv2.ORB_create(nfeatures=640,scaleFactor=1.2,nlevels=10,edgeThreshold=8,patchSize=31,fastThreshold=7).detectAndCompute(gray,None)
 if descriptors is None or len(points)<12:raise ValueError('Insufficient icon features')
 return dict(count=len(points),width=128,height=128),b''.join(struct.pack('<ff',*point.pt)+bytes(descriptor) for point,descriptor in zip(points,descriptors))

def allowed_source(template):
 url=template.get('sourceUrl','')
 return (template.get('kind')=='art' and (url.startswith(ORIGIN+'attach2/') or url.startswith('https://cdn.gamerch.com/contents/wiki/5992/entry/'))) or (template.get('kind')=='icon' and url=='app-icons/'+template['cardKey']+'.webp')

def previous_release(output):
 try:
  m=json.loads((output/'latest.json').read_text(encoding='utf-8'))
  if m['source']!=ORIGIN or m['schemaVersion']!=2 or m['extractor']!=EXTRACTOR:return {},{}
  catalog_path=m.get('catalog',{}).get('path','catalog.json')
  if catalog_path not in ['catalog.json','objects/'+m['catalogHash']+'.json']:raise ValueError('Invalid catalog path')
  if digest((output/catalog_path).read_bytes())!=m['catalogHash']:raise ValueError('Corrupt previous catalog')
  buffers=[]
  for part in [m['index'],*m['features']['parts']]:
   if part['path'] not in ['objects/'+part['sha256']+'.json','objects/'+part['sha256']+'.bin']:raise ValueError('Invalid path')
   raw=(output/part['path']).read_bytes()
   if len(raw)!=part['bytes'] or digest(raw)!=part['sha256']:raise ValueError('Corrupt previous object')
   buffers.append(raw)
  index=json.loads(buffers[0]);binary=b''.join(buffers[1:])
  return m,{t['id']:(t,binary[t['offset']:t['offset']+t['count']*40]) for t in index['templates'] if allowed_source(t)}
 except (OSError,KeyError,ValueError,TypeError):return {},{}

def merge_catalog(cards,records,previous):
 bypage={page_name(c['wikiURL']):dict(c) for c in cards}
 for old in previous:
  page=page_name(old['wikiURL'])
  if page not in bypage:bypage[page]=dict(old)
  elif old.get('wikiGenerated'):
   if bypage[page]['name']!=old['name']:bypage[page]['imageKey']=bypage[page]['name']
   bypage[page]['name']=old['name'];bypage[page]['wikiGenerated']=True
 next_id=max((int(c['id']) for c in bypage.values()),default=0)+1;pending=[]
 for record in records:
  if 'info' not in record:continue
  info=record['info'];page=record['page']
  if page in bypage:
   if bypage[page].get('wikiGenerated'):
    bypage[page].update({k:v for k,v in info.items() if v not in ['',None]})
   continue
  required=['attr','hp','atk','base_hp','base_atk','magic1atr','magic1pow','magic2atr','magic2pow','buddy1c','buddy1s']
  if info['rare']=='SSR':required+=['magic3atr','magic3pow','duo','buddy3c']
  if any(not info.get(key) for key in required):pending.append(page);continue
  card={key:'' for key in ['duo','etc','growtype','implementation_date',*[f'magic{i}{s}' for i in range(1,4) for s in ['atr','pow','buf','heal']],*[f'buddy{i}{s}' for i in range(1,4) for s in ['c','s','s_totsu']]]}
  card.update(buff_count=0,debuff_count=0);card.update(info)
  card.update(name='jp_'+digest(page.encode())[:20],id=str(next_id),wikiGenerated=True)
  next_id+=1;bypage[page]=card
 return list(bypage.values()),pending

def publish(output,cards,templates,catalog_pending):
 output.mkdir(parents=True,exist_ok=True);old,_=previous_release(output)
 def object_part(raw,suffix):
  sha=digest(raw);path='objects/'+sha+suffix
  if not(output/path).exists():atomic(output/path,raw)
  return dict(path=path,sha256=sha,bytes=len(raw))
 buckets=[[] for _ in range(SHARDS)]
 for template,data in templates.values():buckets[int(digest(template['cardKey'].encode())[:8],16)%SHARDS].append((template,data))
 parts=[];index_templates=[];offset=0
 for bucket in buckets:
  if not bucket:continue
  buffers=[]
  for template,data in sorted(bucket,key=lambda item:item[0]['id']):
   index_templates.append({**template,'offset':offset});buffers.append(data);offset+=len(data)
  parts.append(object_part(b''.join(buffers),'.bin'))
 if not parts:raise ValueError('No usable Japanese Wiki templates; preserving last release')
 catalog=[]
 for c in cards:
  normal=c['name']+':normal' in templates;groovy=c['name']+':groovy' in templates
  catalog.append(dict(cardKey=c['name'],name=c['chara']+' '+c['costume'],normal=normal,groovy=groovy,**({} if normal and groovy else {'reason':'Wiki artwork unavailable'})))
 index=object_part(encoded(dict(schemaVersion=2,extractor=EXTRACTOR,templates=index_templates,cards=catalog)),'.json')
 catalog_raw=encoded(cards);catalog_part=object_part(catalog_raw,'.json')
 m=dict(schemaVersion=2,extractor=EXTRACTOR,source=ORIGIN,index=index,catalog=catalog_part,features=dict(parts=parts,bytes=offset),catalogHash=digest(catalog_raw),cardCount=len(cards),readyCount=sum(c['normal'] or c['groovy'] for c in catalog),pending=[c['cardKey'] for c in catalog if not(c['normal'] and c['groovy'])],catalogPending=catalog_pending)
 m['datasetVersion']=digest(encoded(m))[:20];m['checkedAt']=datetime.now(timezone.utc).isoformat()
 atomic(output/'catalog.json',catalog_raw);atomic(output/'latest.json',encoded(m))
 keep={p['path'] for p in [index,catalog_part,*parts]}
 if old:
  keep.update(p['path'] for p in [old['index'],*old['features']['parts']])
  if old.get('catalog'):keep.add(old['catalog']['path'])
 for path in (output/'objects').iterdir():
  if 'objects/'+path.name not in keep:path.unlink()
 return m

def reuse_release(output):
 # Keep repository edits and stable generated IDs when deploying without a crawl.
 output=Path(output);manifest,_=previous_release(output)
 if not manifest:return False
 previous=json.loads((output/manifest['catalog']['path']).read_text(encoding='utf-8'))
 path=ROOT/'src/assets/chara.json';current=json.loads(path.read_text(encoding='utf-8'))
 cards,_=merge_catalog(current,[],previous)
 if cards!=current:atomic(path,json.dumps(cards,ensure_ascii=False,indent=2).encode('utf-8')+b'\n')
 return True

def pages_to_collect(pages,cards,templates,catalog_pending=()):
 bypage={page_name(card['wikiURL']):card for card in cards}
 return {page:url for page,url in pages.items() if page not in bypage or page in catalog_pending or
         any(bypage[page]['name']+':'+variant not in templates for variant in ('normal','groovy'))}

def build(output,cache,max_age=86400):
 output=Path(output);cache=Path(cache);cache.mkdir(parents=True,exist_ok=True);client=WikiClient(cache/'http')
 pages=inventory(client.fetch(ORIGIN+'?cmd=list',max_age=max_age).decode('utf-8'))
 cards=json.loads((ROOT/'src/assets/chara.json').read_text(encoding='utf-8'))
 if len(pages)<max(1,int(len(cards)*.95)):raise ValueError('Incomplete Wiki inventory; preserving last release')
 old,previous=previous_release(output)
 previous_catalog=json.loads((output/old.get('catalog',{}).get('path','catalog.json')).read_text(encoding='utf-8')) if old else []
 cards,_=merge_catalog(cards,[],previous_catalog)
 targets=pages_to_collect(pages,cards,previous,old.get('catalogPending',[]))
 def collect(item):
  page,url=item
  try:return parse_page(client.fetch(url,max_age=max_age).decode('utf-8'),url)
  except Exception as error:return dict(page=page,error=str(error))
 with ThreadPoolExecutor(max_workers=1) as pool:records=list(pool.map(collect,targets.items()))
 if sum('error' in r for r in records)>len(records)*.1:raise ValueError('Too many page errors; preserving last release')
 cards,pending=merge_catalog(cards,records,previous_catalog);keys={page_name(c['wikiURL']):c['name'] for c in cards}
 pending=sorted(set(pending)|{page for page in old.get('catalogPending',[]) if page not in keys})
 # The verified published dictionary is the durable completion record, even
 # when Actions has evicted the source-image cache. Never revisit acquired art.
 templates={identity:value for identity,value in previous.items() if value[0]['cardKey'] in keys.values()}
 issues=[];feature_cache=cache/'features';feature_cache.mkdir(exist_ok=True)
 for n,record in enumerate(records):
  key=keys.get(record['page'])
  if not key:continue
  for variant in ['normal','groovy']:
   identity=key+':'+variant
   if identity in templates:continue
   asset=record.get('images',{}).get(variant)
   try:
    if asset is None:raise ValueError(record.get('error','Artwork not published'))
    raw=client.fetch(asset['url'],max_age=float('inf'));sha=digest(raw);stem=feature_cache/(sha+'-'+EXTRACTOR)
    if stem.with_suffix('.json').exists() and stem.with_suffix('.bin').exists():
     meta=json.loads(stem.with_suffix('.json').read_text());data=stem.with_suffix('.bin').read_bytes()
     if len(data)!=meta['count']*40:raise ValueError('Corrupt feature cache')
    else:
     meta,data=extract(raw);atomic(stem.with_suffix('.bin'),data);atomic(stem.with_suffix('.json'),encoded(meta))
    templates[identity]=(dict(id=identity,cardKey=key,variant=variant,kind='art',sourceHash=sha,sourceUrl=asset['url'],**meta),data)
   except Exception as error:
    issues.append(dict(cardKey=key,variant=variant,error=str(error)))
    if identity in previous:templates[identity]=previous[identity]
  if (n+1)%50==0:print('Extracted',n+1,'/',len(records),flush=True)
 # Missing artwork is supplemented from a second Japanese Wiki's exact card labels.
 try:
  from supplement import collect_missing
  for card,variant,page,url,raw in collect_missing(cards,templates,cache/'supplement',max_age):
   sha=digest(raw);stem=feature_cache/(sha+'-'+EXTRACTOR)
   if stem.with_suffix('.json').exists():meta=json.loads(stem.with_suffix('.json').read_text());data=stem.with_suffix('.bin').read_bytes()
   else:
    meta,data=extract(raw);atomic(stem.with_suffix('.json'),encoded(meta));atomic(stem.with_suffix('.bin'),data)
   identity=card['name']+':'+variant;templates[identity]=(dict(id=identity,cardKey=card['name'],variant=variant,kind='art',sourceUrl=url,sourcePage=page,sourceHash=sha,**meta),data)
 except Exception as error:issues.append(dict(supplement=str(error)))
 # Existing app icons provide direct list-layout evidence, alongside full artwork.
 for card in cards:
  path=ROOT/'src/assets/img'/((card.get('imageKey') or card['name'])+'.webp')
  if not path.is_file():continue
  raw=path.read_bytes();sha=digest(raw);stem=feature_cache/(sha+'-'+EXTRACTOR+'-icon')
  try:
   if stem.with_suffix('.json').exists():meta=json.loads(stem.with_suffix('.json').read_text());data=stem.with_suffix('.bin').read_bytes()
   else:
    meta,data=extract_icon(raw);atomic(stem.with_suffix('.json'),encoded(meta));atomic(stem.with_suffix('.bin'),data)
   identity=card['name']+':catalog';templates[identity]=(dict(id=identity,cardKey=card['name'],variant='catalog',kind='icon',sourceUrl='app-icons/'+card['name']+'.webp',sourceHash=sha,**meta),data)
  except Exception as error:issues.append(dict(cardKey=card['name'],icon=str(error)))
 m=publish(output,cards,templates,pending)
 original=json.loads((ROOT/'src/assets/chara.json').read_text(encoding='utf-8'))
 if cards!=original:atomic(ROOT/'src/assets/chara.json',json.dumps(cards,ensure_ascii=False,indent=2).encode('utf-8')+b'\n')
 atomic(cache/'last-report.json',encoded(dict(manifest=m,inventoryCards=len(pages),targetPages=list(targets),skippedCompletePages=len(pages)-len(targets),pageErrors=[r for r in records if 'error' in r],issues=issues,catalogPending=pending)))
 print('Published',m['datasetVersion'],m['readyCount'],'/',len(cards),'cards;',len(templates),'artworks;',m['features']['bytes'],'feature bytes',flush=True)
 return m

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path,default=ROOT/'public/recognition');p.add_argument('--cache',type=Path,default=ROOT/'.cache/recognition-jp');p.add_argument('--max-age',type=int,default=86400)
 p.add_argument('--reuse-if-available',action='store_true',help='Reuse a valid published dictionary; build it normally when unavailable')
 a=p.parse_args()
 if a.reuse_if_available and reuse_release(a.output):
  print('Reusing the published dictionary without contacting source Wikis.',flush=True)
 else:
  if a.reuse_if_available:print('No reusable dictionary found. Starting the initial dictionary build.',flush=True)
  build(a.output,a.cache,a.max_age)
