"""Additional Japanese Wiki artwork, matched by exact rarity / character / costume."""
import re,unicodedata,requests,hashlib,json,time
from pathlib import Path
from bs4 import BeautifulSoup

INDEX='https://gamerch.com/twst/967287'

class SourceUnavailable(RuntimeError):pass
def label(card):return unicodedata.normalize('NFKC',card['rare']+card['chara']+'［'+card['costume']+'］').replace(' ','')
def fetch(url,cache,max_age):
 if not (re.fullmatch(r'https://gamerch.com/twst/\d+',url) or url.startswith('https://cdn.gamerch.com/contents/wiki/5992/entry/')):raise ValueError('Unexpected supplementary source')
 cache=Path(cache);cache.mkdir(parents=True,exist_ok=True);key=hashlib.sha256(url.encode()).hexdigest();file=cache/(key+'.body');meta=cache/(key+'.json');previous=json.loads(meta.read_text()) if meta.exists() else {}
 if file.exists() and time.time()-previous.get('checkedAt',0)<max_age:return file.read_bytes()
 headers={'User-Agent':'TwstCollectionSync/2.0 (+https://github.com/SZ7M8ci7/twst)','Accept-Encoding':'gzip, deflate'}
 if file.exists():
  if previous.get('etag'):headers['If-None-Match']=previous['etag']
  if previous.get('lastModified'):headers['If-Modified-Since']=previous['lastModified']
 time.sleep(1.0)
 with requests.get(url,headers=headers,timeout=30,allow_redirects=False,stream=True) as response:
  if response.status_code in (429,503):raise SourceUnavailable('Supplement rate limited or unavailable; retry next daily update')
  if response.status_code==304 and file.exists():raw=file.read_bytes()
  else:
   response.raise_for_status()
   if response.is_redirect:raise ValueError('Unexpected redirect')
   chunks=[];size=0
   for chunk in response.iter_content(65536):
    size+=len(chunk)
    if size>20_000_000:raise ValueError('Supplement too large')
    chunks.append(chunk)
   raw=b''.join(chunks)
   if not raw:raise ValueError('Empty supplementary page')
   file.write_bytes(raw)
  meta.write_text(json.dumps(dict(url=url,etag=response.headers.get('ETag',previous.get('etag')),lastModified=response.headers.get('Last-Modified',previous.get('lastModified')),checkedAt=time.time())))
 return raw

def inventory(raw):
 soup=BeautifulSoup(raw,'html.parser');result={}
 for link in soup.select('a[href]'):
  name=unicodedata.normalize('NFKC',link.get_text('',strip=True)).replace(' ','');url=link['href']
  if url.startswith('/twst/'):url='https://gamerch.com'+url
  if re.fullmatch(r'(SSR|SR|R).+\[.+\]',name) and re.fullmatch(r'https://gamerch.com/twst/\d+',url):result[name]=url
 return result

def artworks(raw,expected):
 soup=BeautifulSoup(raw,'html.parser');heading=soup.select_one('h1')
 if not heading or unicodedata.normalize('NFKC',heading.get_text('',strip=True)).replace(' ','')!=expected:raise ValueError('Supplementary identity mismatch')
 result={}
 for node in soup.find_all(string=lambda text:text and (text.strip()=='CARD ILLUSTRATION' or text.strip() in ['▼GROOVY','GROOVY'])):
  image=node.find_next('img');url=(image.get('data-original') or image.get('data-src') or image.get('src','')) if image else ''
  if url.startswith('https://cdn.gamerch.com/contents/wiki/5992/entry/'):
   result['normal' if node.strip()=='CARD ILLUSTRATION' else 'groovy']=url
 return result

def collect_missing(cards,templates,cache,max_age):
 def needed(card,variant):
  return card['name']+':'+variant not in templates
 # Acquired artwork is permanent, regardless of which Wiki supplied it.
 missing=[card for card in cards if any(needed(card,v) for v in ['normal','groovy'])]
 if not missing:return []
 pages=inventory(fetch(INDEX,cache,max_age));result=[]
 for card in missing:
  name=label(card);url=pages.get(name)
  if not url:continue
  try:
   for variant,image in artworks(fetch(url,cache,max_age),name).items():
    if needed(card,variant):result.append((card,variant,url,image,fetch(image,cache,float('inf'))))
  except SourceUnavailable:raise
  except Exception as error:print('Supplement unavailable',card['name'],str(error),flush=True)
 return result
