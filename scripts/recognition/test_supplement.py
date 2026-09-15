import unittest
from unittest.mock import patch
import supplement as s

class SupplementTests(unittest.TestCase):
 def test_exact_inventory_and_lazy_artwork(self):
  card=dict(rare='SSR',chara='グリム',costume='ツムステ')
  name=s.label(card)
  raw='<a href="/twst/123">SSRグリム［ツムステ］</a><a href="https://other.invalid/twst/123">SSR別人［衣装］</a>'
  self.assertEqual(s.inventory(raw),{name:'https://gamerch.com/twst/123'})
  prefix='https://cdn.gamerch.com/contents/wiki/5992/entry/'
  page='<h1>SSRグリム［ツムステ］</h1><p>CARD ILLUSTRATION</p><img src="placeholder" data-original="'+prefix+'normal.png"><p>▼GROOVY</p><img data-src="'+prefix+'groovy.jpg">'
  self.assertEqual(s.artworks(page,name),dict(normal=prefix+'normal.png',groovy=prefix+'groovy.jpg'))
  with self.assertRaises(ValueError):s.artworks(page,'SSR別人[衣装]')
 def test_untrusted_source_is_rejected_before_network(self):
  with patch('supplement.requests.get') as request:
   with self.assertRaises(ValueError):s.fetch('https://gamerch.com.evil.invalid/twst/123','unused',0)
   request.assert_not_called()
 def test_only_missing_variants_are_fetched(self):
  card=dict(name='a',rare='SR',chara='グリム',costume='実験着')
  with patch.object(s,'fetch') as fetch:
   primary=({'sourceUrl':'https://twst.wikiru.jp/attach2/art.png'},b'')
   self.assertEqual(s.collect_missing([card],{'a:normal':primary,'a:groovy':primary},'unused',0),[])
   fetch.assert_not_called()
 def test_previous_supplements_are_never_refetched(self):
  card=dict(name='a',rare='SR',chara='グリム',costume='実験着')
  url='https://cdn.gamerch.com/contents/wiki/5992/entry/new.png'
  old=({'sourceUrl':url.replace('new','old')},b'old')
  with patch.object(s,'fetch',return_value=b'new') as fetch,patch.object(s,'inventory',return_value={s.label(card):'https://gamerch.com/twst/123'}),patch.object(s,'artworks',return_value={'normal':url}):
   result=s.collect_missing([card],{'a:normal':old,'a:groovy':old},'unused',0)
   self.assertEqual(result,[]);fetch.assert_not_called()
 def test_only_unacquired_groovy_is_downloaded(self):
  card=dict(name='a',rare='SR',chara='グリム',costume='実験着')
  prefix='https://cdn.gamerch.com/contents/wiki/5992/entry/'
  normal=({'sourceUrl':prefix+'normal.png'},b'old')
  with patch.object(s,'fetch',return_value=b'new') as fetch,patch.object(s,'inventory',return_value={s.label(card):'https://gamerch.com/twst/123'}),patch.object(s,'artworks',return_value={'normal':prefix+'normal.png','groovy':prefix+'groovy.png'}):
   result=s.collect_missing([card],{'a:normal':normal},'unused',0)
   self.assertEqual([item[1] for item in result],['groovy'])
   self.assertEqual(fetch.call_count,3)
   fetch.assert_called_with(prefix+'groovy.png','unused',float('inf'))

if __name__=='__main__':unittest.main()
