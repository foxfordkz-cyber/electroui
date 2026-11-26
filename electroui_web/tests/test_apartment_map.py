"""Regression tests for household visibility, demo isolation and map storage."""
import http.client
import json
import os
import struct
import tempfile
import threading
import unittest
import zlib
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

    def file(self, version, data=None, mime='image/png', expected=200):
        conn = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        try:
            conn.request('GET' if data is None else 'POST', '/api/apartment-file?v=' + version, data,
                         {'Cookie': self.cookie, 'Content-Type': mime})
            res = conn.getresponse()
            body = res.read()
            if res.status != expected:
                raise AssertionError((res.status, body[:120]))
            if res.getheader('Content-Type').startswith('application/json'):
                return json.loads(body)
            if 'no-store' not in res.getheader('Cache-Control', ''):
                raise AssertionError('Personal attachment must not be cached')
            return body
        finally:
            conn.close()


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

    def test_layout_preserves_appliances_sockets_and_owner_scope(self):
        owner, neighbor, staff = (Session(self.port) for _ in range(3))
        owner.request('apartment-layout', {'roomCount': 1}, 401)
        uid = owner.register('layoutowner')
        neighbor.register('layoutneighbor')
        staff.request('login', {'login': server.SECTOR_LOGIN, 'password': 'PrivateTest123'})
        start = owner.request('state')
        self.assertEqual(2, start['roomCount'])
        _, living, bedroom, _ = start['rooms']
        template = owner.request('catalog')['items'][0]['id']
        payload = {'catalogId': template, 'roomId': bedroom['id'], 'plugged': True}
        device = owner.request('appliance_add', payload)['id']
        owner.request('apartment-location', {'latCell':5115, 'lonCell':7143})
        for bad in (0, 3, True, '1'):
            owner.request('apartment-layout', {'roomCount':bad}, 400)
        neighbor.request('apartment-layout', {'roomCount':1, 'id':uid}, 400)
        staff.request('apartment-layout', {'roomCount':1}, 403)
        merged = owner.request('apartment-layout', {'roomCount':1})['state']
        self.assertEqual(['Ас үй', 'Қонақ бөлме', 'Жуынатын бөлме'], [r['name'] for r in merged['rooms']])
        self.assertEqual(living['sockets'] + bedroom['sockets'], merged['rooms'][1]['sockets'])
        self.assertEqual(living['id'], merged['appliances'][0]['roomId'])
        self.assertEqual([device], [a['id'] for a in owner.request('search?room='+str(living['id']))['items']])
        owner.request('appliance_add', payload, 400)
        payload['roomId'] = living['id']
        for _ in range(merged['rooms'][1]['sockets'] - 1):
            owner.request('appliance_add', payload)
        owner.request('appliance_add', payload, 400)
        owner.request('plug', {'id':device, 'plugged':False})
        owner.request('plug', {'id':device, 'plugged':True})
        totals = owner.request('state')['totals']
        server.init_db()
        self.assertEqual(1, staff.request('apartment-view?id='+str(uid))['roomCount'])
        self.assertEqual(2, neighbor.request('state')['roomCount'])
        restored = owner.request('apartment-layout', {'roomCount':2})['state']
        self.assertEqual([r['id'] for r in start['rooms']], [r['id'] for r in restored['rooms']])
        self.assertEqual(bedroom['id'], next(a['roomId'] for a in restored['appliances'] if a['id']==device))
        self.assertTrue(all(r['free'] >= 0 for r in restored['rooms']))
        for field in ('power', 'kwhDay', 'count', 'plugged'):
            self.assertEqual(totals[field], restored['totals'][field])
        self.assertEqual([51.15, 71.43], owner.request('apartments')['items'][0]['point'])

    def test_private_file_replacement_and_scope(self):
        owner, neighbor, staff, shared = (Session(self.port) for _ in range(4))
        owner.file('new', expected=401)
        owner.register('myflat')
        neighbor.register('otherflat')
        staff.request('login', {'login': server.SECTOR_LOGIN, 'password': 'PrivateTest123'})
        shared.request('login', {'login': 'aru', 'password': 'Aru12345!'})
        self.assertIsNone(owner.request('apartment-file-info')['file'])

        def chunk(tag, raw):
            return struct.pack('>I', len(raw)) + tag + raw + struct.pack('>I', zlib.crc32(tag + raw))
        header = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 6, 0, 0, 0))
        pixels = chunk(b'IDAT', zlib.compress(bytes([0, 10, 20, 30, 255]))) + chunk(b'IEND', b'')
        uploaded = owner.file('new', header + chunk(b'tEXt', b'Description\0private metadata') + pixels)['file']
        v = uploaded['version']
        self.assertEqual(header + pixels, owner.file(v))
        self.assertIsNone(neighbor.request('apartment-file-info')['file'])
        neighbor.file(v, expected=404)
        for other in (staff, shared):
            other.file(v, expected=403)
            other.request('apartment-file-info', expected=403)
            other.file('new', header + pixels, expected=403)
        owner.file(v, b'not a picture', expected=415)
        owner.file(v, b'other', 'text/plain', expected=415)
        owner.file('new', header + pixels, expected=409)
        self.assertEqual(v, owner.request('apartment-file-info')['file']['version'])
        plan = b'%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n'
        replaced = owner.file(v, plan, 'application/pdf')['file']
        self.assertEqual(replaced['mime'], 'application/pdf')
        owner.request('apartment-file-remove', {'version': v}, 409)
        owner.file(v, expected=404)
        self.assertEqual(plan, owner.file(replaced['version']))
        owner.request('apartment-file-remove', {'version': replaced['version']})
        owner.file(replaced['version'], expected=404)
