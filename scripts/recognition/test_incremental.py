"""Exercise daily builds with a published dictionary and no HTTP image cache."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import update as u
from wikiru import ORIGIN, page_name


def card(key):
 return dict(name=key,id=str(len(key)),wikiURL=ORIGIN+'?SR/リドル【'+key+'】',
             rare='SR',chara='リドル',costume=key,attr='バランス',hp='10000',atk='5000',
             base_hp='2000',base_atk='1000',magic1atr='火',magic1pow='単発(強)',
             magic2atr='水',magic2pow='連撃(弱)',buddy1c='トレイ',buddy1s='HPUP(小)')


def template(key,variant,source=ORIGIN+'attach2/'):
 identity=key+':'+variant
 return dict(id=identity,cardKey=key,variant=variant,kind='art',count=12,width=960,
             height=540,sourceUrl=source+identity+'.png',sourceHash='0'*64),b'x'*480


class IncrementalTests(unittest.TestCase):
 def test_finished_cards_only_check_inventory_even_without_http_cache(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);(root/'src/assets').mkdir(parents=True)
   cards=[card('complete')];(root/'src/assets/chara.json').write_text(json.dumps(cards))
   templates={}
   for variant in ('normal','groovy'):
    item=template('complete',variant,'https://cdn.gamerch.com/contents/wiki/5992/entry/')
    templates[item[0]['id']]=item
   out=root/'public';first=u.publish(out,cards,templates,[])
   pages={page_name(c['wikiURL']):c['wikiURL'] for c in cards}
   with patch.object(u,'ROOT',root),patch.object(u,'inventory',return_value=pages),patch.object(u.WikiClient,'fetch',return_value=b'list') as fetch,patch('supplement.fetch') as secondary,patch.object(u,'extract') as extract:
    second=u.build(out,root/'empty-cache',max_age=0)
    fetch.assert_called_once_with(ORIGIN+'?cmd=list',max_age=0)
    secondary.assert_not_called();extract.assert_not_called()
   self.assertEqual(first['datasetVersion'],second['datasetVersion'])
   report=json.loads((root/'empty-cache/last-report.json').read_text())
   self.assertEqual(report['targetPages'],[])
   self.assertEqual(report['skippedCompletePages'],1)

 def test_new_card_and_missing_variant_only_then_no_repeat_downloads(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);(root/'src/assets').mkdir(parents=True)
   cards=[card('complete'),card('partial')];new=card('new')
   (root/'src/assets/chara.json').write_text(json.dumps(cards))
   templates={}
   for key,variant in [('complete','normal'),('complete','groovy'),('partial','normal')]:
    item=template(key,variant);templates[item[0]['id']]=item
   out=root/'public';u.publish(out,cards,templates,[])
   pages={page_name(c['wikiURL']):c['wikiURL'] for c in [*cards,new]}
   records={c['wikiURL']:dict(page=page_name(c['wikiURL']),info=c,
            images={v:{'url':ORIGIN+'attach2/'+c['name']+'-'+v+'.png'} for v in ('normal','groovy')}) for c in [*cards,new]}
   requested=[]
   def fetch(url,**kwargs):
    requested.append(url)
    if '/attach2/' in url:self.assertEqual(kwargs['max_age'],float('inf'))
    return url.encode()
   def parse(raw,url):return records[url]
   with patch.object(u,'ROOT',root),patch.object(u,'inventory',return_value=pages),patch.object(u.WikiClient,'fetch',side_effect=fetch),patch.object(u,'parse_page',side_effect=parse),patch.object(u,'extract',return_value=({'count':12,'width':960,'height':540},b'y'*480)),patch('supplement.fetch') as secondary:
    u.build(out,root/'empty-cache',max_age=0)
    expected=[ORIGIN+'?cmd=list',cards[1]['wikiURL'],new['wikiURL'],
              ORIGIN+'attach2/partial-groovy.png',ORIGIN+'attach2/new-normal.png',ORIGIN+'attach2/new-groovy.png']
    self.assertEqual(requested,expected)
    secondary.assert_not_called()
    requested.clear()
    u.build(out,root/'another-empty-cache',max_age=0)
    self.assertEqual(requested,[ORIGIN+'?cmd=list'])
   _,saved=u.previous_release(out)
   self.assertEqual(saved['partial:normal'][1],b'x'*480)
   self.assertEqual(len(saved),6)

 def test_catalog_pending_remains_a_target_even_when_artwork_complete(self):
  existing=card('existing');page=page_name(existing['wikiURL'])
  templates={existing['name']+':'+v:template(existing['name'],v) for v in ('normal','groovy')}
  self.assertEqual(u.pages_to_collect({page:existing['wikiURL']},[existing],templates),{})
  self.assertEqual(u.pages_to_collect({page:existing['wikiURL']},[existing],templates,[page]),{page:existing['wikiURL']})


if __name__=='__main__':unittest.main()
