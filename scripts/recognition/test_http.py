"""Verify source traffic controls without contacting external sites."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import requests
import supplement
import wikiru


def response(status=200, headers=None):
    result=MagicMock()
    result.status_code=status
    result.headers=headers or {}
    result.is_redirect=False
    result.url=wikiru.ORIGIN+'?test'
    result.iter_content.return_value=[b'cached body']
    result.__enter__.return_value=result
    if status>=400:
        result.raise_for_status.side_effect=requests.HTTPError(str(status))
    return result


class HttpTests(unittest.TestCase):
    def clients(self, directory):
        primary=wikiru.WikiClient(Path(directory)/'primary')
        return [
            ('primary',wikiru.ORIGIN+'?test',primary.fetch),
            ('supplement','https://gamerch.com/twst/123',
             lambda url, **kw:supplement.fetch(url,Path(directory)/'supplement',**kw)),
        ]

    def test_fresh_cache_avoids_network_and_304_preserves_validators(self):
        with tempfile.TemporaryDirectory() as directory:
            for name,url,fetch in self.clients(directory):
                with self.subTest(name=name),patch('requests.get') as get,patch('time.sleep'):
                    get.return_value=response(headers={'ETag':'version-1','Last-Modified':'yesterday'})
                    self.assertEqual(fetch(url,max_age=86400),b'cached body')
                    get.reset_mock()
                    self.assertEqual(fetch(url,max_age=86400),b'cached body')
                    get.assert_not_called()
                    get.return_value=response(304)
                    for _ in range(2):
                        self.assertEqual(fetch(url,max_age=0),b'cached body')
                        headers=get.call_args.kwargs['headers']
                        self.assertEqual(headers['If-None-Match'],'version-1')
                        self.assertEqual(headers['If-Modified-Since'],'yesterday')

    def test_primary_stops_all_remaining_requests_after_backpressure(self):
        for status in (429,503):
            with self.subTest(status=status),tempfile.TemporaryDirectory() as directory:
                client=wikiru.WikiClient(directory)
                with patch('requests.get',return_value=response(status)) as get,patch('time.sleep'):
                    for url in (wikiru.ORIGIN+'?first',wikiru.ORIGIN+'?second'):
                        with self.assertRaises(ValueError):client.fetch(url)
                    self.assertEqual(get.call_count,1)

    def test_supplement_stops_collection_after_backpressure(self):
        cards=[dict(name=str(i),rare='SR',chara='Grim',costume=str(i)) for i in range(3)]
        pages={supplement.label(c):'https://gamerch.com/twst/'+str(i) for i,c in enumerate(cards)}
        for status in (429,503):
            with self.subTest(status=status),tempfile.TemporaryDirectory() as directory:
                with patch('requests.get',side_effect=[response(),response(status)]) as get,patch('time.sleep'),patch.object(supplement,'inventory',return_value=pages):
                    with self.assertRaises(supplement.SourceUnavailable):
                        supplement.collect_missing(cards,{},directory,0)
                    self.assertEqual(get.call_count,2)

    def test_request_spacing(self):
        with tempfile.TemporaryDirectory() as directory:
            for name,url,fetch in self.clients(directory):
                with self.subTest(name=name),patch('requests.get',return_value=response()),patch('time.sleep') as sleep,patch('time.monotonic',return_value=10):
                    fetch(url,max_age=0)
                    fetch(url,max_age=0)
                    self.assertGreaterEqual(sleep.call_args.args[0],1)


if __name__=='__main__':unittest.main()
