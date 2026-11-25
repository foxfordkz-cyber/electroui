"""Regression tests for household visibility, demo isolation and map storage."""
import http.client
import json
import os
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

import server


class Session:
    def __init__(self, port):
        self.port = port
        self.cookie = ''

    def request(self, action, data=None, expected=200):
        conn = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        try:
            body = None if data is None else json.dumps(data)
            conn.request('GET' if data is None else 'POST', '/api/' + action, body,
                         {'Cookie': self.cookie, 'Content-Type': 'application/json'})
            res = conn.getresponse()
            result = json.loads(res.read())
            if res.status != expected:
                raise AssertionError((action, res.status, result))
            if res.getheader('Set-Cookie'):
                self.cookie = res.getheader('Set-Cookie').split(';')[0]
            return result
        finally:
            conn.close()

    def register(self, login):
        return self.request('register', {'login': login, 'fullName': 'Test Resident',
                            'email': login + '@example.invalid', 'password': 'Test12345',
                            'confirm': 'Test12345'})['user']['id']


class ApartmentMapTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        folder = directory.name
        database = patch.object(server, 'DB', Path(folder) / 'test.db')
        environment = patch.dict(os.environ, {'ELECTROUI_ADMIN_PASSWORD': 'PrivateTest123'})
        for fixture in (database, environment):
            fixture.start()
            self.addCleanup(fixture.stop)
        server.init_db()
        self.httpd = server.Server(('127.0.0.1', 0), server.Handler)
        thread = threading.Thread(target=self.httpd.serve_forever, kwargs={'poll_interval': 0.02}, daemon=True)
        thread.start()
        self.addCleanup(self.httpd.server_close)
        self.addCleanup(self.httpd.shutdown)
        self.port = self.httpd.server_port

    def test_resident_location_and_scope(self):
        resident, neighbor = Session(self.port), Session(self.port)
        resident.request('apartments', expected=401)
        own = resident.register('firstflat')
        other = neighbor.register('nextflat')
        self.assertEqual([own], [i['id'] for i in resident.request('apartments')['items']])
        self.assertIsNone(resident.request('apartments')['items'][0]['point'])
        resident.request('apartment-view?id=' + str(other), expected=403)
        resident.request('apartment-location', {'id': other, 'latCell': 5112, 'lonCell': 7141}, 400)
        resident.request('apartment-location', {'latCell': 5112.123, 'lonCell': 7141}, 400)
        resident.request('apartment-location', {'latCell': 9112, 'lonCell': 7141}, 400)
        resident.request('apartment-location', {'latCell': 5112, 'lonCell': 7141})
        server.init_db()
        self.assertEqual([51.12, 71.41], resident.request('apartments')['items'][0]['point'])
        self.assertIsNone(neighbor.request('apartments')['items'][0]['point'])
        self.assertIsNone(resident.request('apartment-location', {'remove': True})['items'][0]['point'])
        self.assertEqual(4, len(resident.request('apartment-view?id=' + str(own))['rooms']))

    def test_staff_and_public_demo_are_separate(self):
        staff, demo, resident = (Session(self.port) for _ in range(3))
        uid = resident.register('realflat')
        resident.request('apartment-location', {'latCell': 5111, 'lonCell': 7153})
        staff.request('login', {'login': server.SECTOR_LOGIN, 'password': 'PrivateTest123'})
        live = staff.request('apartments')['items']
        self.assertEqual([uid], [i['id'] for i in live])
        self.assertEqual([51.11, 71.53], live[0]['point'])
        detail = staff.request('apartment-view?id=' + str(uid))
        self.assertNotIn('me', detail)
        self.assertEqual(4, len(detail['rooms']))
        demo.request('login', {'login': 'admin', 'password': 'Admin123!'})
        samples = demo.request('apartments')['items']
        self.assertEqual(3, len(samples))
        self.assertNotIn(live[0]['point'], [i['point'] for i in samples])
        for sample in samples:
            detail = demo.request('apartment-view?id=' + str(sample['id']))
            self.assertEqual(sample['power'], detail['totals']['power'])
            self.assertEqual(sample['kwhDay'], detail['totals']['kwhDay'])
            self.assertAlmostEqual(sample['kwhDay'], sum(r['kwhDay'] for r in detail['rooms']), places=2)
        demo.request('login', {'login': 'aru', 'password': 'Aru12345!'})
        self.assertEqual(1, len(demo.request('apartments')['items']))
        demo.request('apartment-location', {'latCell': 5111, 'lonCell': 7153}, 403)
        demo.request('apartment-location', {'latCell': 5118, 'lonCell': 7140})
        self.assertEqual(13, demo.request('state')['totals']['count'])
        second_uid = demo.register('fromdemo')
        self.assertEqual([second_uid], [i['id'] for i in demo.request('apartments')['items']])
        self.assertEqual(2, len(staff.request('apartments')['items']))
