"""Read card pages and artwork exclusively from the Japanese PukiWiki."""
import hashlib
import json
from pathlib import Path
import re
import threading
import time
import unicodedata
from urllib.parse import unquote, urljoin, urlsplit
import requests
from bs4 import BeautifulSoup

ORIGIN='https://twst.wikiru.jp/'
HEADERS={'User-Agent':'TwstCollectionSync/2.0 (+https://github.com/SZ7M8ci7/twst)'}
PAGE_RE=re.compile(r'^(SSR|SR|R)/([^【]+)【(.+)】$')

def normalize(value):
    return unicodedata.normalize('NFC',value).strip()

def page_name(url):
    if urlsplit(url).hostname!='twst.wikiru.jp': raise ValueError('Unexpected Wiki origin')
    return normalize(unquote(urlsplit(url).query))

def page_url(name):
    if not PAGE_RE.fullmatch(normalize(name)): raise ValueError('Invalid card page')
    return ORIGIN+'?'+normalize(name)

def inventory(html):
    soup=BeautifulSoup(html,'html.parser')
    body=soup.select_one('#body')
    if body is None: raise ValueError('Missing Wiki body')
    pages={}
    for link in body.select('a[href]'):
        url=urljoin(ORIGIN,link['href'])
        if urlsplit(url).hostname!='twst.wikiru.jp':continue
        name=page_name(url)
        if PAGE_RE.fullmatch(name): pages[name]=page_url(name)
    return pages

def table_rows(table):
    """Expand PukiWiki row/column spans before reading level/buddy cells."""
    occupied={};result=[]
    for y,row in enumerate(table.select('tr')):
        x=0
        for cell in row.find_all(['td','th'],recursive=False):
            while (y,x) in occupied:x+=1
            value=re.sub(r'\s+','',unicodedata.normalize('NFKC',cell.get_text(' ',strip=True)))
            for dy in range(int(cell.get('rowspan',1))):
                for dx in range(int(cell.get('colspan',1))):occupied[y+dy,x+dx]=value
            x+=int(cell.get('colspan',1))
        result.append([occupied[y,i] for i in range(max((xx for yy,xx in occupied if yy==y),default=-1)+1)])
    return result

def parse_abilities(body,info):
    effects=[];buffs=0;debuffs=0
    for number in range(1,4):
        heading=next((h for h in body.find_all(['h3','h4']) if re.match(r'^魔法\s*'+str(number)+r'\b',h.get_text(' ',strip=True))),None)
        if heading is None:continue
        rows=table_rows(heading.find_next('table'))
        row=next((row for row in rows if 'Lv10' in row),None)
        if row is None:continue
        effect=row[-1];prefix=f'magic{number}'
        if row[0] in ['火','水','木','無']:info[prefix+'atr']=row[0]
        power=re.search(r'(?:(\d)連撃の)?[火水木無]属性ダメージ\((弱|強|極小|小|中|大|極大)\)',effect)
        if power:info[prefix+'pow']=('連撃' if power[1]=='2' else (power[1]+'連撃') if power[1] else '単発')+'('+power[2]+')'
        duo=re.search(r'\[DUO\]([^と]+)と',effect)
        if duo:info['duo']=duo[1]
        info[prefix+'buf']='';info[prefix+'heal']=''
        for part in effect.split('&')[1:]:
            if 'DUO' in part or '効果が変化' in part:continue
            effects.append(part+f'(M{number})')
            if 'UP' in part:buffs+=1
            if 'DOWN' in part:debuffs+=1
            heal=re.search(r'(?:HP)?(継続回復|回復)\(([^)]+)\)',part)
            if heal:info[prefix+'heal']=heal[1]+'('+heal[2]+')'
            buff=re.match(r'((?:ATK|ダメージ)UP\([^)]+\))\(自/',part)
            if buff:info[prefix+'buf']=buff[1]
    if effects:info.update(etc='<br>'.join(effects),buff_count=buffs,debuff_count=debuffs)
    buddy=next((h for h in body.find_all(['h3','h4']) if h.get_text(strip=True).startswith('バディボーナス')),None)
    if buddy:
        buddies={}
        for row in table_rows(buddy.find_next('table'))[1:]:
            if len(row)<3:continue
            chara=row[0];bonus=row[-2]
            if not re.search(r'(?:UP|回復)\(',bonus):continue
            entry=buddies.setdefault(chara,{'normal':bonus,'totsu':bonus})
            if len(row)>3 and row[1]=='限界突破2回':entry['totsu']=bonus
        for i,(chara,bonus) in enumerate(buddies.items(),1):
            info.update({f'buddy{i}c':chara,f'buddy{i}s':bonus['normal'],f'buddy{i}s_totsu':bonus['totsu']})

def parse_page(html,url):
    name=page_name(url);match=PAGE_RE.fullmatch(name)
    if not match:raise ValueError('Invalid card identity')
    rare,chara,costume=match.groups()
    soup=BeautifulSoup(html,'html.parser');body=soup.select_one('#body')
    if body is None:raise ValueError('Missing card body')
    basic=next((table for table in body.select('table.style_table') if 'レアリティ' in table.get_text() and 'タイプ' in table.get_text()),None)
    if basic is None:raise ValueError('Missing basic card table')
    text=basic.get_text(' ',strip=True)
    if rare not in text or unicodedata.normalize('NFKC',costume) not in unicodedata.normalize('NFKC',text):raise ValueError('Card identity mismatch')
    info={'rare':rare,'chara':chara,'costume':costume,'wikiURL':page_url(name)}
    rows=[row.get_text(' ',strip=True) for row in basic.select('tr')]
    for i,row in enumerate(rows):
        if row=='タイプ' and i+1<len(rows) and rows[i+1] in ['バランス','アタック','ディフェンス']:info['attr']=rows[i+1]
        if row in ['HP','ATK']:
            for nextrow in rows[i+1:i+3]:
                value=re.fullmatch(r'(初期|最大)\s+([\d,]+)',nextrow)
                if value:
                    key=('base_' if value[1]=='初期' else '')+row.lower()
                    if int(value[2].replace(',',''))>0:info[key]=value[2].replace(',','')
    parse_abilities(body,info)
    images={}
    # Only the basic information section: ignore comments, adverts and magic icons.
    for node in basic.find_all_next():
        if node.name in ['h2','h3'] and '魔法' in node.get_text():break
        if node.name!='img':continue
        src=urljoin(ORIGIN,node.get('src',''));parts=urlsplit(src)
        if parts.hostname!='twst.wikiru.jp' or not parts.path.startswith('/attach2/'):continue
        alt=normalize(node.get('alt','')+' '+node.get('title',''))
        region=node.find_parent(class_='rgn-content')
        description=region.find_previous_sibling(class_='rgn-description') if region else None
        groovy_context=description is not None and 'グルー' in description.get_text()
        if node.find_parent('table') is basic: variant='normal'
        elif groovy_context or re.search(r'グルー|groovy',alt,re.I): variant='groovy'
        else: continue
        if variant in images and images[variant]['url']!=src:raise ValueError('Ambiguous artwork variant')
        images[variant]={'url':src,'name':node.get('alt',''),'variant':variant}
    return {'page':name,'info':info,'images':images}

class WikiClient:
    def __init__(self,cache,interval=1.0):
        self.cache=Path(cache);self.cache.mkdir(parents=True,exist_ok=True)
        self.interval=interval;self.lock=threading.Lock();self.last=0;self.stopped=False
    def fetch(self,url,max_age=0,max_bytes=20_000_000):
        if urlsplit(url).hostname!='twst.wikiru.jp':raise ValueError('Unexpected origin')
        key=hashlib.sha256(url.encode()).hexdigest();body=self.cache/(key+'.body');meta=self.cache/(key+'.json')
        previous=json.loads(meta.read_text()) if meta.exists() else {}
        if body.exists() and time.time()-previous.get('checkedAt',0)<max_age:return body.read_bytes()
        headers=dict(HEADERS)
        if body.exists():
            if previous.get('etag'):headers['If-None-Match']=previous['etag']
            if previous.get('lastModified'):headers['If-Modified-Since']=previous['lastModified']
        with self.lock:
            if self.stopped:raise ValueError('Wiki rate limited; retry next update')
            time.sleep(max(0,self.interval-(time.monotonic()-self.last)));self.last=time.monotonic()
        with requests.get(url,headers=headers,timeout=30,stream=True,allow_redirects=False) as response:
            if response.is_redirect or urlsplit(response.url).hostname!='twst.wikiru.jp':raise ValueError('Unexpected redirect')
            if response.status_code in (429,503):
                self.stopped=True;raise ValueError('Wiki rate limited')
            if response.status_code==304 and body.exists():raw=body.read_bytes()
            else:
                response.raise_for_status();chunks=[];size=0
                for chunk in response.iter_content(65536):
                    size+=len(chunk)
                    if size>max_bytes:raise ValueError('Wiki response too large')
                    chunks.append(chunk)
                raw=b''.join(chunks);body.write_bytes(raw)
            meta.write_text(json.dumps({'url':url,'checkedAt':time.time(),'etag':response.headers.get('ETag',previous.get('etag')),'lastModified':response.headers.get('Last-Modified',previous.get('lastModified'))}),encoding='utf-8')
            return raw
