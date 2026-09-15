import json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import update as u
from wikiru import inventory,parse_page,ORIGIN

class UpdateTests(unittest.TestCase):
 def test_reuse_release_preserves_repo_changes_without_network(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);(root/'src/assets').mkdir(parents=True)
   path=root/'src/assets/chara.json';out=root/'public';out.mkdir()
   current=[dict(name='existing',wikiURL=ORIGIN+'?SR/リドル【テスト】',hp='edited',id='1')]
   previous=[{**current[0],'hp':'old'},dict(name='jp_new',wikiURL=ORIGIN+'?SR/リドル【新規】',id='2',wikiGenerated=True)]
   path.write_text(json.dumps(current));(out/'catalog.json').write_text(json.dumps(previous))
   with patch.object(u,'ROOT',root),patch.object(u,'previous_release',return_value=({'catalog':{'path':'catalog.json'}},{})),patch('requests.get') as get:
    u.reuse_release(out)
    result=json.loads(path.read_text())
    self.assertEqual(result[0]['hp'],'edited');self.assertEqual(result[1]['name'],'jp_new')
    get.assert_not_called()
 def test_inventory_uses_exact_card_pages(self):
  html='<div id="body"><a href="?SSR/リドル【寮服】">card</a><a href="?コメント/SSR/リドル【寮服】">comment</a><a href="https://other.invalid/?SSR/リドル【寮服】">foreign</a></div>'
  self.assertEqual(inventory(html),{'SSR/リドル【寮服】':ORIGIN+'?SSR/リドル【寮服】'})
 def test_variant_context_and_spans(self):
  html='''<div id="body"><table class="style_table"><tr><th>レアリティ</th><td>R</td><td><img src="/attach2/normal.png" alt="IMG_5968.jpeg"></td></tr><tr><td>制服</td></tr><tr><td>タイプ</td></tr><tr><td>バランス</td></tr></table><div class="rgn-description">グルーヴィー化</div><div class="rgn-content"><img src="/attach2/groovy.png" alt="GROOVY"></div><h3>魔法</h3><h4>魔法1</h4><table><tr><td rowspan="2">火</td><td rowspan="2">名前</td><td>Lv1</td><td>火属性ダメージ（弱）</td></tr><tr><td>Lv10</td><td>火属性ダメージ（強）＆ATK UP（小）（自/1T）</td></tr></table></div><img src="/attach2/outside.png">'''
  r=parse_page(html,ORIGIN+'?R/リドル【制服】')
  self.assertEqual(set(r['images']),{'normal','groovy'})
  self.assertEqual(r['info']['magic1atr'],'火');self.assertEqual(r['info']['magic1pow'],'単発(強)')
  self.assertEqual(r['info']['magic1buf'],'ATKUP(小)')
  self.assertNotIn('hp',r['info'])
 def test_new_card_catalog_identity_and_missing_stats(self):
  info=dict(wikiURL=ORIGIN+'?SR/リドル【テスト】',rare='SR',chara='リドル',costume='テスト',attr='バランス',hp='10000',atk='5000',base_hp='2000',base_atk='1000',magic1atr='火',magic1pow='単発(強)',magic2atr='水',magic2pow='連撃(弱)',buddy1c='トレイ',buddy1s='HPUP(小)')
  r=dict(page='SR/リドル【テスト】',info=info)
  cards,pending=u.merge_catalog([], [r],[])
  self.assertEqual(len(cards),1);self.assertFalse(pending)
  key=cards[0]['name'];self.assertTrue(key.startswith('jp_'))
  later={**cards[0],'name':'upstream_name'}
  again,_=u.merge_catalog([later],[r],cards)
  self.assertEqual(again[0]['name'],key)
  missing={**r,'info':{k:v for k,v in info.items() if k!='hp'}}
  kept,_=u.merge_catalog(cards,[missing],cards);self.assertEqual(kept[0]['hp'],'10000')
  empty,pending=u.merge_catalog([],[missing],[]);self.assertEqual(empty,[]);self.assertEqual(pending,[r['page']])
 def test_content_shards_change_only_one_bucket_and_preserve_source(self):
  with tempfile.TemporaryDirectory() as directory:
   out=Path(directory);cards=[];templates={}
   for i in range(100):
    key='card'+str(i);cards.append(dict(name=key,chara='リドル',costume=str(i)))
    t=dict(id=key+':normal',cardKey=key,variant='normal',kind='art',count=12,width=960,height=540,sourceUrl=ORIGIN+'attach2/'+key+'.png',sourceHash=str(i).zfill(64))
    templates[t['id']]=(t,bytes([i])*480)
   first=u.publish(out,cards,templates,[])
   t={**templates['card0:normal'][0],'id':'new:normal','cardKey':'new'};templates[t['id']]=(t,b'z'*480);cards.append(dict(name='new',chara='リドル',costume='new'))
   second=u.publish(out,cards,templates,[])
   old={p['path'] for p in first['features']['parts']};new={p['path'] for p in second['features']['parts']}
   self.assertEqual(len(new-old),1)
   self.assertEqual(second['cardCount'],101)
   self.assertEqual(len(u.previous_release(out)[1]),101)
   before=(out/'latest.json').read_bytes()
   with self.assertRaises(ValueError):u.publish(out,cards,{},[])
   self.assertEqual((out/'latest.json').read_bytes(),before)
   m=json.loads(before);m['source']='https://other.invalid/';(out/'latest.json').write_text(json.dumps(m))
   self.assertEqual(u.previous_release(out),({},{}))
if __name__=='__main__':unittest.main()
