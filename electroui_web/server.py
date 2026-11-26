# -*- coding: utf-8 -*-
"""
ЭлектроҮй — «Үйдегі электр құралдары» веб-қосымшасының сервері.

Тек Python 3 стандартты кітапханасы қолданылады:
  http.server (ThreadingHTTPServer) — HTTP сервер және JSON API (/api/...)
  sqlite3                         — SQL дерекқор (electroui.db)
  hashlib + hmac + secrets        — құпиясөз хэші (PBKDF2-HMAC-SHA256) және сессия токендері
  json                            — API жауаптары

Файлдың құрылымы:
  1. ООП: электр құралдарының класс иерархиясы (Python кластары)
  2. Дерекқор: кестелер (CREATE TABLE) және бастапқы деректер (seed)
  3. Қауіпсіздік: хэштеу, сессиялар, логинді уақытша бұғаттау
  4. API әрекеттері (GET / POST), рөлдерді серверде тексеру (403)
  5. HTTP өңдеуші: статикалық файлдар, медиа, Range сұраулары (видео)

Іске қосу:  python server.py          (порт 8090, PORT айнымалысы арқылы өзгертуге болады)
Дерекқорды тазалау:  python server.py --reset
"""
import hashlib
import hmac
import json
import math
import os
import re
import secrets
import socket
import sqlite3
import sys
import threading
import time
from abc import ABC, abstractmethod
from contextlib import contextmanager
from http.cookies import CookieError, SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

import apartment_files

ROOT = Path(__file__).resolve().parent
DB = Path(os.environ.get('ELECTROUI_DB') or ROOT / 'electroui.db')
STATIC = ROOT / 'static'
MEDIA = ROOT / 'media'
PORT = int(os.environ.get('PORT', '8090'))
LOCK = threading.RLock()
DEMO_LOGINS = {'admin', 'aru'}
SECTOR_LOGIN = 'sector.admin'  # Public registration does not allow a dot.
SAMPLE_PLACES = {'aru': (5113, 7143), 'demo_esil': (5109, 7142), 'demo_saryarka': (5118, 7140)}

COOKIE = 'eu_session'
SESSION_TTL = 7 * 24 * 3600          # сессия 7 күн жарамды
PBKDF2_ITERATIONS = 120_000          # PBKDF2 итерация саны
SALT_BYTES = 16                      # 16 байт кездейсоқ тұз
MAX_FAILS = 5                        # 5 қате әрекеттен кейін ...
LOCK_SECONDS = 30                    # ... логин 30 секундқа бұғатталады
FAILS = {}                           # login -> [қате саны, бұғат аяқталатын уақыт]

ENERGY_CLASSES = ['A+++', 'A++', 'A+', 'A', 'B', 'C', 'D']
DEFAULT_ROOMS = [('Ас үй', 4), ('Қонақ бөлме', 5), ('Жатын бөлме', 3), ('Жуынатын бөлме', 2)]
DEFAULT_SETTINGS = {'tariff': 25.0, 'apartment_limit': 7000.0, 'room_limit': 3500.0}
LOGIN_RE = re.compile(r'^[A-Za-z0-9_]{3,20}$')
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$')

TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
    '.webm': 'video/webm', '.mp4': 'video/mp4', '.ogv': 'video/ogg',
    '.apk': 'application/vnd.android.package-archive',
}


class Fail(Exception):
    """Пайдаланушыға көрсетілетін қате (HTTP коды + қазақша хабар)."""

    def __init__(self, message, code=400, extra=None):
        super().__init__(message)
        self.code = code
        self.extra = extra or {}


def require(ok, message, code=400):
    if not ok:
        raise Fail(message, code)


def log(message):
    line = time.strftime('%H:%M:%S') + ' ' + str(message)
    try:
        print(line, flush=True)
    except UnicodeEncodeError:  # консоль UTF-8 емес болса — қате әріптерді ауыстырып шығарамыз
        enc = getattr(sys.stdout, 'encoding', None) or 'ascii'
        print(line.encode(enc, 'replace').decode(enc), flush=True)


def num(x, digits=2):
    """Қазақша сан форматы: 12 345,5"""
    if x is None:
        return '—'
    s = f'{float(x):,.{digits}f}'.replace(',', ' ').replace('.', ',')
    if ',' in s:
        s = s.rstrip('0').rstrip(',')
    return s


def kz_lower(s):
    """SQLite-тің LOWER() функциясы кирилл әріптерін кішірейтпейді, сондықтан өзіміз тіркейміз."""
    return s.lower() if isinstance(s, str) else s


# ============================================================================
# 1. ООП — ЭЛЕКТР ҚҰРАЛДАРЫНЫҢ КЛАСС ИЕРАРХИЯСЫ
#    Android қосымшасындағы Java кластарымен және static/model.js ішіндегі
#    JavaScript кластарымен бірдей.
# ============================================================================

class Pluggable(ABC):
    """Интерфейс «Розеткаға қосылатын»."""
    KZ = 'Розеткаға қосылатын'

    @abstractmethod
    def plug_in(self): ...

    @abstractmethod
    def unplug(self): ...

    @abstractmethod
    def is_plugged_in(self): ...


class Heating(ABC):
    """Интерфейс «Қыздырғыш элемент»."""
    KZ = 'Қыздырғыш элемент'

    @abstractmethod
    def max_temperature(self): ...


class ElectricAppliance(Pluggable, ABC):
    """Абстрактілі класс «Электр құралы» — барлық құралдардың ата-класы."""
    TYPE = None
    KZ = 'Электр құралы'
    EXTRA_LABEL = 'Қосымша параметр'
    EXTRA_UNIT = ''

    def __init__(self, id=None, name='', brand='', power=0.0, voltage=220.0, energy_class='A',
                 weight=0.0, extra=0.0, hours_per_day=0.0, plugged_in=False, room=None):
        self.id = id
        self.name = name
        self.brand = brand
        self.power = float(power)                # P, Вт
        self.voltage = float(voltage)            # U, В
        self.energy_class = energy_class
        self.weight = float(weight)              # кг
        self.extra = float(extra)                # түріне байланысты параметр (көлем, диагональ ...)
        self.hours_per_day = float(hours_per_day)  # t, сағ/тәулік
        self.plugged_in = bool(plugged_in)
        self.room = room                         # Room объектісі
        self.image = ''
        self.catalog_id = None
        self.circuit_position = None

    # --- Pluggable интерфейсін іске асыру ---
    def plug_in(self):
        self.plugged_in = True

    def unplug(self):
        self.plugged_in = False

    def is_plugged_in(self):
        return self.plugged_in

    # --- Есептеулер ---
    def current(self):
        """Ток күші I = P / U (А)."""
        return self.power / self.voltage if self.voltage else 0.0

    def daily_kwh(self):
        """Тәуліктік энергия E = P · t / 1000 (кВт·сағ)."""
        return self.power * self.hours_per_day / 1000.0

    def monthly_cost(self, tariff):
        """Айлық төлем = E · 30 · тариф (₸)."""
        return self.daily_kwh() * 30 * tariff

    def extra_text(self):
        return f'{self.EXTRA_LABEL}: {num(self.extra)} {self.EXTRA_UNIT}'

    @classmethod
    def group(cls):
        """Тікелей ата-класс (санат): KitchenAppliance, ClimateAppliance ..."""
        return cls.__bases__[0]

    @abstractmethod
    def describe(self):
        """Полиморфты әдіс — әр класс өзінше сипаттайды."""

    def to_json(self, tariff):
        heating = isinstance(self, Heating)
        group = self.group()
        return {
            'id': self.id, 'type': self.TYPE, 'className': type(self).__name__, 'kz': self.KZ,
            'group': group.__name__, 'groupKz': group.KZ,
            'name': self.name, 'brand': self.brand, 'power': self.power, 'voltage': self.voltage,
            'energyClass': self.energy_class, 'weight': self.weight, 'extra': self.extra,
            'extraLabel': self.EXTRA_LABEL, 'extraUnit': self.EXTRA_UNIT, 'hoursPerDay': self.hours_per_day,
            'pluggedIn': self.plugged_in, 'roomId': self.room.id if self.room else None,
            'room': self.room.name if self.room else None, 'image': self.image, 'catalogId': self.catalog_id,
            'circuitPosition': self.circuit_position,
            'heating': heating, 'maxTemperature': self.max_temperature() if heating else None,
            'current': round(self.current(), 4), 'dailyKwh': round(self.daily_kwh(), 4),
            'monthlyCost': round(self.monthly_cost(tariff), 2), 'describe': self.describe(),
        }


# --- Санаттар (абстрактілі аралық кластар) ---
class KitchenAppliance(ElectricAppliance, ABC):
    KZ = 'Ас үй техникасы'


class HouseholdAppliance(ElectricAppliance, ABC):
    KZ = 'Тұрмыстық техника'


class MultimediaAppliance(ElectricAppliance, ABC):
    KZ = 'Мультимедиа техникасы'


class ClimateAppliance(ElectricAppliance, ABC):
    KZ = 'Климаттық техника'


class LightingAppliance(ElectricAppliance, ABC):
    KZ = 'Жарықтандыру'


# --- Нақты кластар ---
class Kettle(KitchenAppliance, Heating):
    TYPE, KZ, EXTRA_LABEL, EXTRA_UNIT = 'KETTLE', 'Электр шәйнек', 'Көлемі', 'л'

    def max_temperature(self):
        return 100

    def describe(self):
        return (f'Электр шәйнек «{self.name}»: {num(self.extra)} л суды {self.max_temperature()} °C-қа '
                f'дейін қайнатады, қуаты {num(self.power)} Вт.')


class Refrigerator(KitchenAppliance):
    TYPE, KZ, EXTRA_LABEL, EXTRA_UNIT = 'FRIDGE', 'Тоңазытқыш', 'Көлемі', 'л'

    def describe(self):
        return (f'Тоңазытқыш «{self.name}»: {num(self.extra)} л азықты салқындатады, тәулігіне '
                f'{num(self.hours_per_day)} сағ компрессор жұмыс істейді.')


class Microwave(KitchenAppliance, Heating):
    TYPE, KZ, EXTRA_LABEL, EXTRA_UNIT = 'MICROWAVE', 'Микротолқынды пеш', 'Көлемі', 'л'

    def max_temperature(self):
        return 250

    def describe(self):
        return (f'Микротолқынды пеш «{self.name}»: {num(self.extra)} л камера, тағамды '
                f'{self.max_temperature()} °C-қа дейін қыздырады.')


class WashingMachine(HouseholdAppliance):
    TYPE, KZ, EXTRA_LABEL, EXTRA_UNIT = 'WASHER', 'Кір жуғыш машина', 'Жүктемесі', 'кг'

    def describe(self):
        return f'Кір жуғыш машина «{self.name}»: бір жуғанда {num(self.extra)} кг кір жуады.'


class VacuumCleaner(HouseholdAppliance):
    TYPE, KZ, EXTRA_LABEL, EXTRA_UNIT = 'VACUUM', 'Шаңсорғыш', 'Шаң ыдысы', 'л'

    def describe(self):
        return f'Шаңсорғыш «{self.name}»: {num(self.extra)} л шаң ыдысы, сору қуаты {num(self.power)} Вт.'


class Iron(HouseholdAppliance, Heating):
    TYPE, KZ, EXTRA_LABEL, EXTRA_UNIT = 'IRON', 'Үтік', 'Су ыдысы', 'мл'

    def max_temperature(self):
        return 220

    def describe(self):
        return (f'Үтік «{self.name}»: табаны {self.max_temperature()} °C-қа дейін қызады, '
                f'су ыдысы {num(self.extra)} мл.')


class Television(MultimediaAppliance):
    TYPE, KZ, EXTRA_LABEL, EXTRA_UNIT = 'TV', 'Теледидар', 'Диагоналы', 'дюйм'

    def describe(self):
        return f'Теледидар «{self.name}»: экран диагоналы {num(self.extra)} дюйм.'


class Computer(MultimediaAppliance):
    TYPE, KZ, EXTRA_LABEL, EXTRA_UNIT = 'COMPUTER', 'Компьютер', 'Жедел жады', 'ГБ'

    def describe(self):
        return f'Компьютер «{self.name}»: {num(self.extra)} ГБ жедел жады, қоректендіру блогы {num(self.power)} Вт.'


class AirConditioner(ClimateAppliance):
    TYPE, KZ, EXTRA_LABEL, EXTRA_UNIT = 'AIRCON', 'Кондиционер', 'Аудан', 'м²'

    def describe(self):
        return f'Кондиционер «{self.name}»: {num(self.extra)} м² бөлмені салқындатады.'


class Heater(ClimateAppliance, Heating):
    TYPE, KZ, EXTRA_LABEL, EXTRA_UNIT = 'HEATER', 'Майлы жылытқыш', 'Аудан', 'м²'

    def max_temperature(self):
        return 90

    def describe(self):
        return (f'Майлы жылытқыш «{self.name}»: {num(self.extra)} м² бөлмені жылытады, '
                f'майы {self.max_temperature()} °C-қа дейін қызады.')


class Fan(ClimateAppliance):
    TYPE, KZ, EXTRA_LABEL, EXTRA_UNIT = 'FAN', 'Желдеткіш', 'Аудан', 'м²'

    def describe(self):
        return f'Желдеткіш «{self.name}»: {num(self.extra)} м² бөлмедегі ауаны айналдырады.'


class Lamp(LightingAppliance):
    TYPE, KZ, EXTRA_LABEL, EXTRA_UNIT = 'LAMP', 'Шам', 'Жарық ағыны', 'лм'

    def describe(self):
        return (f'Шам «{self.name}»: {num(self.extra)} лм жарық береді, '
                f'тиімділігі {num(self.extra / self.power if self.power else 0, 1)} лм/Вт.')


GROUP_CLASSES = [KitchenAppliance, HouseholdAppliance, MultimediaAppliance, ClimateAppliance, LightingAppliance]
APPLIANCE_CLASSES = [Kettle, Refrigerator, Microwave, WashingMachine, VacuumCleaner, Iron,
                     Television, Computer, AirConditioner, Heater, Fan, Lamp]
BY_TYPE = {cls.TYPE: cls for cls in APPLIANCE_CLASSES}
GROUP_NAMES = {g.__name__: g for g in GROUP_CLASSES}


def create_appliance(row):
    """Фабрика: SQL жолынан (type бағаны бойынша) керекті класс объектісін жасайды."""
    cls = BY_TYPE[row['type']]
    a = cls(id=row['id'], name=row['name'], brand=row['brand'], power=row['power'], voltage=row['voltage'],
            energy_class=row['energy_class'], weight=row['weight'], extra=row['extra'],
            hours_per_day=row['hours_per_day'], plugged_in=row['plugged'])
    a.image = row['image']
    a.catalog_id = row['catalog_id']
    return a


class Room:
    """Бөлме — розеткалар саны шектеулі."""

    def __init__(self, id, name, sockets):
        self.id = id
        self.name = name
        self.sockets = sockets
        self.appliances = []

    def used_sockets(self):
        return sum(1 for a in self.appliances if a.is_plugged_in())

    def free_sockets(self):
        return self.sockets - self.used_sockets()

    def power(self):
        return sum(a.power for a in self.appliances if a.is_plugged_in())

    def plug(self, appliance):
        """Құралды бос розеткаға қосу (бос розетка болмаса — қате)."""
        if appliance.is_plugged_in():
            return
        if self.free_sockets() <= 0:
            raise Fail('Бұл бөлмеде бос розетка жоқ')
        appliance.plug_in()


class Apartment:
    """Пәтер — бөлмелер мен құралдардың жиыны, қуатты есептеу, сұрыптау, іздеу."""

    def __init__(self, rooms, settings):
        self.rooms = rooms
        self.tariff = settings['tariff']
        self.limit = settings['apartment_limit']
        self.room_limit = settings['room_limit']

    def appliances(self):
        return [a for r in self.rooms for a in r.appliances]

    def plugged(self):
        return [a for a in self.appliances() if a.is_plugged_in()]

    def find_appliance(self, appliance_id):
        for a in self.appliances():
            if a.id == appliance_id:
                return a
        raise Fail('Құрал табылмады.', 404)

    def room_by_id(self, room_id):
        for r in self.rooms:
            if r.id == room_id:
                return r
        raise Fail('Бөлме табылмады.', 404)

    def total_power(self):
        return sum(a.power for a in self.plugged())

    def total_current(self):
        return sum(a.current() for a in self.plugged())

    def daily_kwh(self):
        return sum(a.daily_kwh() for a in self.plugged())

    def monthly_cost(self):
        return sum(a.monthly_cost(self.tariff) for a in self.plugged())

    def load_percent(self):
        return self.total_power() / self.limit * 100 if self.limit else 0

    def sorted_by(self, key, reverse=False, plugged_only=False):
        items = self.plugged() if plugged_only else self.appliances()
        items = sorted(items, key=lambda a: a.name.lower())        # бірдей мәнде — атауы бойынша
        return sorted(items, key=key, reverse=reverse)              # тұрақты (stable) сұрыптау

    def find(self, predicate):
        return [a for a in self.appliances() if predicate(a)]


# ============================================================================
# 2. ДЕРЕКҚОР
# ============================================================================

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    login         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    full_name     TEXT    NOT NULL,
    email         TEXT    NOT NULL,
    salt          TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'CLIENT' CHECK (role IN ('ADMIN', 'CLIENT')),
    blocked       INTEGER NOT NULL DEFAULT 0 CHECK (blocked IN (0, 1)),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE TABLE IF NOT EXISTS apartment_locations (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    lat_cell INTEGER NOT NULL CHECK (lat_cell BETWEEN -8500 AND 8500),
    lon_cell INTEGER NOT NULL CHECK (lon_cell BETWEEN -18000 AND 18000)
);
CREATE TABLE IF NOT EXISTS apartment_files (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    mime TEXT NOT NULL CHECK (mime IN ('image/png','application/pdf')),
    content BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS appliance_types (
    code        TEXT PRIMARY KEY,
    class_name  TEXT NOT NULL,
    name_kz     TEXT NOT NULL,
    category    TEXT NOT NULL,
    category_kz TEXT NOT NULL,
    extra_label TEXT NOT NULL,
    extra_unit  TEXT NOT NULL,
    heating     INTEGER NOT NULL DEFAULT 0 CHECK (heating IN (0, 1)),
    max_temp    INTEGER
);
CREATE TABLE IF NOT EXISTS rooms (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name     TEXT    NOT NULL,
    sockets  INTEGER NOT NULL CHECK (sockets BETWEEN 1 AND 20),
    position INTEGER NOT NULL DEFAULT 0,
    UNIQUE (user_id, name)
);
CREATE TABLE IF NOT EXISTS catalog (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    type          TEXT    NOT NULL REFERENCES appliance_types(code),
    name          TEXT    NOT NULL,
    brand         TEXT    NOT NULL,
    power         REAL    NOT NULL CHECK (power > 0),
    voltage       REAL    NOT NULL CHECK (voltage > 0),
    energy_class  TEXT    NOT NULL CHECK (energy_class IN ('A+++','A++','A+','A','B','C','D')),
    weight        REAL    NOT NULL CHECK (weight >= 0),
    extra         REAL    NOT NULL DEFAULT 0,
    hours_per_day REAL    NOT NULL CHECK (hours_per_day BETWEEN 0 AND 24),
    image         TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE TABLE IF NOT EXISTS appliances (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id       INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    catalog_id    INTEGER REFERENCES catalog(id) ON DELETE SET NULL,
    type          TEXT    NOT NULL REFERENCES appliance_types(code),
    name          TEXT    NOT NULL,
    brand         TEXT    NOT NULL,
    power         REAL    NOT NULL CHECK (power > 0),
    voltage       REAL    NOT NULL CHECK (voltage > 0),
    energy_class  TEXT    NOT NULL CHECK (energy_class IN ('A+++','A++','A+','A','B','C','D')),
    weight        REAL    NOT NULL CHECK (weight >= 0),
    extra         REAL    NOT NULL DEFAULT 0,
    hours_per_day REAL    NOT NULL CHECK (hours_per_day BETWEEN 0 AND 24),
    image         TEXT    NOT NULL DEFAULT '',
    plugged       INTEGER NOT NULL DEFAULT 0 CHECK (plugged IN (0, 1)),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT    NOT NULL,
    body       TEXT    NOT NULL DEFAULT '',
    kind       TEXT    NOT NULL DEFAULT 'INFO' CHECK (kind IN ('INFO', 'SUCCESS', 'WARNING', 'BROADCAST')),
    is_read    INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
    created_at TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE TABLE IF NOT EXISTS events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appliance_id INTEGER REFERENCES appliances(id) ON DELETE SET NULL,
    action       TEXT    NOT NULL CHECK (action IN ('ADD', 'EDIT', 'DELETE', 'PLUG', 'UNPLUG', 'UNPLUG_ALL')),
    details      TEXT    NOT NULL DEFAULT '',
    power        REAL    NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_appliances_user ON appliances(user_id);
CREATE INDEX IF NOT EXISTS idx_appliances_room ON appliances(room_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id);
"""

SEED_CATALOG = [
    # type, name, brand, power, voltage, class, weight, extra, hours/day, image
    ('KETTLE', 'Bosch TWK7203', 'Bosch', 2200, 220, 'A', 1.3, 1.7, 0.5, 'kettle.jpg'),
    ('FRIDGE', 'Panasonic NR-C320', 'Panasonic', 150, 220, 'A++', 62, 320, 8, 'fridge.jpg'),
    ('MICROWAVE', 'Panasonic NN-GM333', 'Panasonic', 1150, 220, 'A', 11, 23, 0.3, 'microwave.jpg'),
    ('WASHER', 'Samsung WW70', 'Samsung', 2000, 220, 'A+++', 60, 7, 1, 'washer.jpg'),
    ('VACUUM', 'Hitachi CV-HG5', 'Hitachi', 1600, 220, 'A', 5.2, 1.5, 0.3, 'vacuum.jpg'),
    ('IRON', 'Hitachi CSI-M701', 'Hitachi', 1400, 220, 'A', 1.2, 200, 0.3, 'iron.jpg'),
    ('TV', 'Samsung LA40C550', 'Samsung', 110, 220, 'A', 13, 40, 4, 'tv.jpg'),
    ('COMPUTER', 'Gaming PC RGB', 'Custom', 450, 220, 'B', 9, 32, 6, 'computer.jpg'),
    ('AIRCON', 'Panasonic CS-C10', 'Panasonic', 900, 220, 'A++', 9, 25, 6, 'aircon.jpg'),
    ('HEATER', 'Ballu Classic 9', 'Ballu', 2000, 220, 'C', 11, 20, 5, 'heater.jpg'),
    ('FAN', 'AEG Retro VL', 'AEG', 45, 220, 'A', 3, 10, 5, 'fan.jpg'),
    ('LAMP', 'Philips LED E27', 'Philips', 10, 220, 'A++', 0.05, 806, 6, 'lamp.jpg'),
]

# «aru» клиентінің демо-пәтері: бөлме -> [(түрі, розеткаға қосулы ма)]
SEED_APARTMENT = {
    'Ас үй': [('KETTLE', 1), ('FRIDGE', 1), ('MICROWAVE', 0)],
    'Қонақ бөлме': [('TV', 1), ('AIRCON', 0), ('LAMP', 1), ('COMPUTER', 0), ('VACUUM', 0)],
    'Жатын бөлме': [('HEATER', 0), ('FAN', 0), ('LAMP', 0)],
    'Жуынатын бөлме': [('WASHER', 0), ('IRON', 0)],
}


def database_path(demo):
    return DB.with_name(DB.stem + '-demo.db') if demo else DB


@contextmanager
def db(demo=False):
    """Дерекқорға қосылу: сыртқы кілттер қосулы, транзакция соңында commit."""
    c = sqlite3.connect(database_path(demo), timeout=10)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys = ON')
    c.create_function('kz_lower', 1, kz_lower, deterministic=True)
    try:
        yield c
        c.commit()
    except BaseException:
        c.rollback()
        raise
    finally:
        c.close()


def rows(c, sql, args=()):
    return [dict(r) for r in c.execute(sql, args)]


def one(c, sql, args=()):
    r = c.execute(sql, args).fetchone()
    return dict(r) if r else None


def value(c, sql, args=()):
    r = c.execute(sql, args).fetchone()
    return r[0] if r else None


def type_rows():
    """appliance_types анықтамалық кестесі Python кластарынан толтырылады."""
    for cls in APPLIANCE_CLASSES:
        group = cls.group()
        heating = issubclass(cls, Heating)
        yield (cls.TYPE, cls.__name__, cls.KZ, group.__name__, group.KZ, cls.EXTRA_LABEL, cls.EXTRA_UNIT,
               int(heating), cls().max_temperature() if heating else None)


def init_db():
    for demo in (False, True):
        with LOCK, db(demo) as c:
            init_database(c, demo)


LAYOUT_COUNTS = {'studio': 1, 'one': 1, 'two': 2}


def init_layout_schema(c):
    c.execute('BEGIN IMMEDIATE')
    legacy = any(col['name'] == 'room_count' for col in c.execute('PRAGMA table_info(apartment_layouts)'))
    if legacy:
        c.execute('DROP VIEW IF EXISTS layout_rooms')
        c.execute('DROP VIEW IF EXISTS layout_room_map')
        c.execute('ALTER TABLE apartment_layouts RENAME TO apartment_layouts_v1')
    c.execute("""CREATE TABLE IF NOT EXISTS apartment_layouts (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('studio','one','two')))""")
    if legacy:
        c.execute("""INSERT INTO apartment_layouts SELECT user_id,
            CASE room_count WHEN 1 THEN 'one' ELSE 'two' END FROM apartment_layouts_v1""")
        c.execute('DROP TABLE apartment_layouts_v1')
    # Floor plans group existing circuits. Appliances keep their original circuit when walls change.
    c.execute("""CREATE VIEW IF NOT EXISTS layout_room_map AS
        SELECT r.id AS circuit_id, COALESCE(living.id, r.id) AS room_id, r.user_id,
               r.sockets, r.position AS circuit_position
        FROM rooms r LEFT JOIN apartment_layouts l ON l.user_id=r.user_id
        LEFT JOIN rooms living ON living.user_id=r.user_id AND living.position=1 AND
            ((r.position=2 AND l.kind IN ('one','studio')) OR (r.position=0 AND l.kind='studio'))""")
    c.execute("""CREATE VIEW IF NOT EXISTS layout_rooms AS
        SELECT r.id, r.user_id, CASE WHEN l.kind='studio' AND r.position=1
               THEN 'Ас үй мен қонақ бөлме' ELSE r.name END AS name, r.position, SUM(m.sockets) AS sockets
        FROM layout_room_map m JOIN rooms r ON r.id=m.room_id
        LEFT JOIN apartment_layouts l ON l.user_id=r.user_id GROUP BY r.id""")


def init_database(c, demo):
    c.executescript(SCHEMA)
    init_layout_schema(c)
    c.executemany(
        'INSERT INTO appliance_types VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET '
        'class_name=excluded.class_name, name_kz=excluded.name_kz, category=excluded.category, '
        'category_kz=excluded.category_kz, extra_label=excluded.extra_label, extra_unit=excluded.extra_unit, '
        'heating=excluded.heating, max_temp=excluded.max_temp', list(type_rows()))
    for k, v in DEFAULT_SETTINGS.items():
        c.execute('INSERT OR IGNORE INTO settings(key, value) VALUES (?, ?)', (k, str(v)))
    if not value(c, 'SELECT 1 FROM catalog LIMIT 1') and not value(c, 'SELECT 1 FROM users LIMIT 1'):
        seed(c, demo)
    if demo:
        return
    if value(c, 'PRAGMA user_version') == 0:
        # Legacy administrator grants came from a publicly shared demo login.
        c.execute("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role='ADMIN' OR login='aru')")
        c.execute("UPDATE users SET role='CLIENT' WHERE role='ADMIN'")
        c.execute('PRAGMA user_version=1')
    password = os.environ.get('ELECTROUI_ADMIN_PASSWORD')
    if password and not value(c, 'SELECT 1 FROM users WHERE login=?', (SECTOR_LOGIN,)):
        check_password_rules(password)
        create_user(c, SECTOR_LOGIN, 'Энергия мониторингі', '', password, 'ADMIN')


def create_user(c, login, full_name, email, password, role='CLIENT'):
    salt, pw_hash = hash_password(password)
    cur = c.execute('INSERT INTO users(login, full_name, email, salt, password_hash, role) VALUES (?,?,?,?,?,?)',
                    (login, full_name, email, salt, pw_hash, role))
    user_id = cur.lastrowid
    for pos, (name, sockets) in enumerate(DEFAULT_ROOMS):
        c.execute('INSERT INTO rooms(user_id, name, sockets, position) VALUES (?,?,?,?)', (user_id, name, sockets, pos))
    return user_id


def notify(c, user_id, title, body='', kind='INFO'):
    cur = c.execute('INSERT INTO notifications(user_id, title, body, kind) VALUES (?,?,?,?)',
                    (user_id, title, body, kind))
    return one(c, 'SELECT * FROM notifications WHERE id=?', (cur.lastrowid,))


def event(c, user_id, action, appliance_id=None, details='', power=0):
    c.execute('INSERT INTO events(user_id, appliance_id, action, details, power) VALUES (?,?,?,?,?)',
              (user_id, appliance_id, action, details, power))


def seed(c, demo):
    c.executemany('INSERT INTO catalog(type, name, brand, power, voltage, energy_class, weight, extra, '
                  'hours_per_day, image) VALUES (?,?,?,?,?,?,?,?,?,?)', SEED_CATALOG)
    if not demo:
        return
    admin_id = create_user(c, 'admin', 'Сектор әкімшісі', 'admin@electroui.kz', 'Admin123!', 'ADMIN')
    notify(c, admin_id, 'Әкімші панеліне қош келдіңіз',
           'Пайдаланушылар, каталог, жалпы статистика және тариф баптаулары сол жақ мәзірдегі «Әкімші» бөлімінде.',
           'INFO')
    aru_id = create_user(c, 'aru', 'Ару Серікқызы', 'aru@electroui.kz', 'Aru12345!', 'CLIENT')
    furnish(c, aru_id, SEED_APARTMENT)
    c.execute("INSERT INTO apartment_layouts VALUES (?, 'studio')", (aru_id,))
    for login, label, layout in [
        ('demo_esil', 'Есіл үлгісі', {'Ас үй': [('FRIDGE', 1), ('KETTLE', 0)], 'Қонақ бөлме': [('COMPUTER', 1)]}),
        ('demo_saryarka', 'Сарыарқа үлгісі', {'Жуынатын бөлме': [('WASHER', 1)], 'Жатын бөлме': [('LAMP', 1)]}),
    ]:
        uid = create_user(c, login, label, '', secrets.token_urlsafe(32))
        furnish(c, uid, layout)
        if login == 'demo_esil':
            c.execute("INSERT INTO apartment_layouts VALUES (?, 'one')", (uid,))
    for login, (lat_cell, lon_cell) in SAMPLE_PLACES.items():
        c.execute('INSERT INTO apartment_locations SELECT id, ?, ? FROM users WHERE login=?',
                  (lat_cell, lon_cell, login))
    notify(c, aru_id, 'ЭлектроҮй-ге қош келдіңіз!',
           'Студияңыз дайын. «Менің пәтерім» бетінде жоспарды ауыстырып, құралдарды '
           'розеткаға қосып көріңіз.', 'SUCCESS')
    notify(c, aru_id, 'Кеңес: қуат шегі',
           'Пәтердің жалпы шегі 7 000 Вт (32 А × 220 В). Шектен асқанда ескерту хабарламасы келеді.', 'INFO')


def furnish(c, user_id, layout):
    catalog = {r['type']: r for r in rows(c, 'SELECT * FROM catalog')}
    rooms = {r['name']: r['id'] for r in rows(c, 'SELECT id, name FROM rooms WHERE user_id=?', (user_id,))}
    for room_name, items in layout.items():
        for type_code, plugged in items:
            t = catalog[type_code]
            cur = c.execute(
                'INSERT INTO appliances(user_id, room_id, catalog_id, type, name, brand, power, voltage, energy_class, '
                'weight, extra, hours_per_day, image, plugged) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                (user_id, rooms[room_name], t['id'], t['type'], t['name'], t['brand'], t['power'], t['voltage'],
                 t['energy_class'], t['weight'], t['extra'], t['hours_per_day'], t['image'], plugged))
            event(c, user_id, 'ADD', cur.lastrowid, f'{t["name"]} → {room_name}', t['power'])
            if plugged:
                event(c, user_id, 'PLUG', cur.lastrowid, f'{t["name"]} розеткаға қосылды', t['power'])


def get_settings(c):
    s = dict(DEFAULT_SETTINGS)
    for r in rows(c, 'SELECT key, value FROM settings'):
        try:
            s[r['key']] = float(r['value'])
        except ValueError:
            pass
    return s


def load_apartment(c, user_id):
    """SQL-дан пәтерді ООП объектілеріне жүктеу (Room + ElectricAppliance ұрпақтары)."""
    rooms = [Room(r['id'], r['name'], r['sockets'])
             for r in rows(c, 'SELECT id, name, sockets FROM layout_rooms WHERE user_id=? ORDER BY position, id', (user_id,))]
    by_id = {r.id: r for r in rooms}
    for row in rows(c, 'SELECT a.*, m.room_id AS layout_room_id, m.circuit_position FROM appliances a '
                       'JOIN layout_room_map m ON m.circuit_id=a.room_id WHERE a.user_id=? ORDER BY a.id', (user_id,)):
        a = create_appliance(row)
        a.circuit_position = row['circuit_position']
        room = by_id.get(row['layout_room_id'])
        if room:
            a.room = room
            room.appliances.append(a)
    return Apartment(rooms, get_settings(c))


def settings_json(s):
    return {'tariff': s['tariff'], 'apartmentLimit': s['apartment_limit'], 'roomLimit': s['room_limit']}


def public_user(u):
    parts = [p for p in re.split(r'\s+', u['full_name'].strip()) if p]
    initials = ''.join(p[0] for p in parts[:2]).upper() or u['login'][:2].upper()
    return {'id': u['id'], 'login': u['login'], 'fullName': u['full_name'], 'email': u['email'], 'role': u['role'],
            'blocked': bool(u['blocked']), 'createdAt': u['created_at'], 'initials': initials,
            'demo': u['login'].lower() in DEMO_LOGINS}


def state(c, user):
    return dict(apartment_state(c, user['id']), me=public_user(user),
                unread=value(c, 'SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0', (user['id'],)))


def apartment_state(c, user_id):
    """Клиентке керекті толық күй: бөлмелер, құралдар, жиынтық есеп."""
    apt = load_apartment(c, user_id)
    rooms = []
    for r in apt.rooms:
        rooms.append({'id': r.id, 'name': r.name, 'sockets': r.sockets, 'used': r.used_sockets(),
                      'free': r.free_sockets(), 'power': r.power(), 'count': len(r.appliances),
                      'kwhDay': round(sum(a.daily_kwh() for a in r.appliances if a.is_plugged_in()), 3),
                      'overload': r.power() > apt.room_limit})
    total = apt.total_power()
    layout = value(c, 'SELECT kind FROM apartment_layouts WHERE user_id=?', (user_id,)) or 'two'
    return {
        'settings': settings_json(get_settings(c)),
        'layout': layout, 'roomCount': LAYOUT_COUNTS[layout],
        'rooms': rooms,
        'appliances': [a.to_json(apt.tariff) for a in apt.appliances()],
        'totals': {
            'count': len(apt.appliances()), 'plugged': len(apt.plugged()), 'power': total,
            'current': round(apt.total_current(), 3), 'kwhDay': round(apt.daily_kwh(), 3),
            'costMonth': round(apt.monthly_cost(), 2), 'loadPct': round(apt.load_percent(), 1),
            'overload': total > apt.limit or any(r['overload'] for r in rooms),
            'apartmentOverload': total > apt.limit,
        },
    }


def check_overload(c, user_id, room_id):
    """Қосқаннан кейін шектен асу болса — ескерту хабарламасын жазады."""
    s = get_settings(c)
    out = []
    total = value(c, 'SELECT COALESCE(SUM(power), 0) FROM appliances WHERE user_id=? AND plugged=1', (user_id,))
    if total > s['apartment_limit']:
        out.append(notify(
            c, user_id, 'Пәтер желісі шамадан тыс жүктелді!',
            f'Жалпы қуат {num(total)} Вт — рұқсат етілген {num(s["apartment_limit"])} Вт-тан '
            f'{num(total - s["apartment_limit"])} Вт артық ({num(total / s["apartment_limit"] * 100, 0)}%). '
            f'Автомат ажырап кетуі мүмкін, кейбір құралдарды өшіріңіз.', 'WARNING'))
    room = one(c, 'SELECT r.name, COALESCE(SUM(a.power), 0) AS power FROM layout_rooms r '
                  'JOIN layout_room_map m ON m.room_id=r.id '
                  'LEFT JOIN appliances a ON a.room_id=m.circuit_id AND a.plugged=1 WHERE r.id=? GROUP BY r.id', (room_id,))
    if room and room['power'] > s['room_limit']:
        out.append(notify(
            c, user_id, f'«{room["name"]}» желісі шамадан тыс жүктелді',
            f'Бөлмедегі қосулы құралдар қуаты {num(room["power"])} Вт, бір желінің шегі '
            f'{num(s["room_limit"])} Вт.', 'WARNING'))
    return out


# ============================================================================
# 3. ҚАУІПСІЗДІК: PBKDF2 хэш, сессиялар, логин құлпы
# ============================================================================

def hash_password(password, salt_hex=None):
    """PBKDF2-HMAC-SHA256: 16 байт кездейсоқ тұз, 120 000 итерация, нәтиже hex түрінде."""
    salt = bytes.fromhex(salt_hex) if salt_hex else secrets.token_bytes(SALT_BYTES)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, PBKDF2_ITERATIONS)
    return salt.hex(), dk.hex()


def verify_password(password, salt_hex, hash_hex):
    """Тұрақты уақытта салыстыру (hmac.compare_digest) — тайминг шабуылынан қорғаныс."""
    _, candidate = hash_password(password, salt_hex)
    return hmac.compare_digest(candidate, hash_hex)


def token_hash(token):
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def new_session(c, user_id, demo=False):
    token = ('demo.' if demo else '') + secrets.token_urlsafe(32)
    now = int(time.time())
    c.execute('DELETE FROM sessions WHERE expires_at < ?', (now,))
    c.execute('INSERT INTO sessions(token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)',
              (token_hash(token), user_id, now, now + SESSION_TTL))
    secure = '; Secure' if os.environ.get('RENDER') == 'true' else ''
    return f'{COOKIE}={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={SESSION_TTL}{secure}'


def clear_cookie():
    return f'{COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'


def check_password_rules(p):
    require(isinstance(p, str) and len(p) >= 8, 'Құпиясөз кемінде 8 таңбадан тұруы керек.')
    require(len(p) <= 128, 'Құпиясөз тым ұзын.')
    require(any(ch.isalpha() for ch in p), 'Құпиясөзде кемінде бір әріп болуы керек.')
    require(any(ch.isdigit() for ch in p), 'Құпиясөзде кемінде бір цифр болуы керек.')


def lock_left(login):
    rec = FAILS.get(login.lower())
    if rec and rec[1] > time.time():
        return math.ceil(rec[1] - time.time())
    return 0


def register_fail(login):
    key = login.lower()
    rec = FAILS.get(key)
    if not rec or (rec[1] and rec[1] <= time.time()):
        rec = FAILS[key] = [0, 0]
    rec[0] += 1
    if rec[0] >= MAX_FAILS:
        rec[0], rec[1] = 0, time.time() + LOCK_SECONDS
        return 0
    return MAX_FAILS - rec[0]


# ============================================================================
# 4. API ӘРЕКЕТТЕРІ
# ============================================================================

def text(d, key, label, lo=1, hi=80):
    v = str(d.get(key) or '').strip()
    require(lo <= len(v) <= hi, f'«{label}» өрісі {lo}–{hi} таңба болуы керек.')
    return v


def number(d, key, label, lo, hi):
    try:
        v = float(d.get(key))
    except (TypeError, ValueError):
        raise Fail(f'«{label}» өрісіне сан енгізіңіз.')
    require(math.isfinite(v) and lo <= v <= hi, f'«{label}» мәні {num(lo)} мен {num(hi)} аралығында болуы керек.')
    return v


def as_int(v, label='id'):
    try:
        return int(v)
    except (TypeError, ValueError):
        raise Fail(f'{label} қате.')


def list_images():
    return sorted(p.name for p in MEDIA.glob('*.jpg'))


def appliance_fields(d):
    t = str(d.get('type') or '')
    require(t in BY_TYPE, 'Құрал түрін таңдаңыз.')
    ec = str(d.get('energyClass') or '')
    require(ec in ENERGY_CLASSES, 'Энергия класын таңдаңыз.')
    image = str(d.get('image') or '')
    require(image == '' or image in list_images(), 'Сурет файлы табылмады.')
    return {
        'type': t, 'name': text(d, 'name', 'Атауы', 2, 60), 'brand': text(d, 'brand', 'Бренді', 1, 40),
        'power': number(d, 'power', 'Қуаты (Вт)', 1, 10000), 'voltage': number(d, 'voltage', 'Кернеуі (В)', 1, 1000),
        'energy_class': ec, 'weight': number(d, 'weight', 'Салмағы (кг)', 0, 1000),
        'extra': number(d, 'extra', BY_TYPE[t].EXTRA_LABEL, 0, 100000),
        'hours_per_day': number(d, 'hoursPerDay', 'Тәулігіне жұмыс уақыты', 0, 24), 'image': image,
    }


def own_room(c, user, room_id):
    room = one(c, 'SELECT * FROM layout_rooms WHERE id=? AND user_id=?', (as_int(room_id, 'Бөлме'), user['id']))
    require(room, 'Бөлмені таңдаңыз.')
    return room


def own_appliance(c, user, appliance_id):
    a = one(c, 'SELECT a.*, m.room_id AS layout_room_id FROM appliances a JOIN layout_room_map m ON m.circuit_id=a.room_id '
               'WHERE a.id=? AND a.user_id=?', (as_int(appliance_id), user['id']))
    require(a, 'Құрал табылмады.')
    return a


def choose_circuit(c, room_id, plugged, appliance=None, appliance_type=None):
    appliance_type = appliance_type or (appliance['type'] if appliance else None)
    kitchen = appliance_type is not None and issubclass(BY_TYPE[appliance_type], KitchenAppliance)
    circuit = value(c, '''
        SELECT m.circuit_id FROM layout_room_map m
        LEFT JOIN appliances a ON a.room_id=m.circuit_id AND a.plugged=1 AND a.id!=?
        WHERE m.room_id=? GROUP BY m.circuit_id, m.room_id, m.sockets
        HAVING ?=0 OR COUNT(a.id)<m.sockets
        ORDER BY (m.circuit_id=?) DESC, (m.circuit_position=0 AND ?) DESC,
                 (m.circuit_id=m.room_id) DESC, m.circuit_id LIMIT 1
    ''', (appliance['id'] if appliance else -1, room_id, int(plugged), appliance['room_id'] if appliance else -1, kitchen))
    require(circuit is not None, 'Бұл бөлмеде бос розетка жоқ')
    return circuit


# ---------- Публикалық әрекеттер ----------

def do_register(c, user, d):
    full_name = text(d, 'fullName', 'Аты-жөні', 2, 60)
    login = str(d.get('login') or '').strip()
    require(login.lower() not in DEMO_LOGINS, 'Бұл логин үлгі аккаунтына тиесілі.')
    require(LOGIN_RE.fullmatch(login), 'Логин 3–20 таңба: латын әріптері, цифрлар және _ ғана.')
    email = str(d.get('email') or '').strip()
    require(EMAIL_RE.match(email) and len(email) <= 80, 'Email форматы қате (мысалы: name@mail.kz).')
    password = d.get('password') or ''
    check_password_rules(password)
    require(password == d.get('confirm'), 'Құпиясөздер сәйкес келмейді.')
    require(not value(c, 'SELECT 1 FROM users WHERE login=?', (login,)), 'Бұл логин бос емес, басқасын таңдаңыз.')
    user_id = create_user(c, login, full_name, email, password, 'CLIENT')
    notify(c, user_id, f'Қош келдіңіз, {full_name}!',
           'Аккаунт сәтті жасалды. Сіз үшін 4 бөлме дайын: Ас үй, Қонақ бөлме, Жатын бөлме, Жуынатын бөлме. '
           '«Менің пәтерім» бетінде каталогтан құрал қосыңыз.', 'SUCCESS')
    log(f'REGISTER: жаңа клиент «{login}»')
    u = one(c, 'SELECT * FROM users WHERE id=?', (user_id,))
    return {'user': public_user(u), '_cookie': new_session(c, user_id)}


def do_login(c, user, d):
    login = str(d.get('login') or '').strip()
    password = str(d.get('password') or '')
    require(login and password, 'Логин мен құпиясөзді енгізіңіз.')
    left = lock_left(login)
    if left:
        raise Fail(f'Тым көп қате әрекет. {left} секундтан кейін қайталаңыз.', 429, {'retryAfter': left})
    u = one(c, 'SELECT * FROM users WHERE login=?', (login,))
    ok = verify_password(password, u['salt'], u['password_hash']) if u else (hash_password(password) and False)
    if not ok:
        remain = register_fail(login)
        log(f'LOGIN FAIL: «{login}»')
        if remain == 0:
            raise Fail(f'Логин немесе құпиясөз қате. Кіру {LOCK_SECONDS} секундқа бұғатталды.', 429,
                       {'retryAfter': LOCK_SECONDS})
        raise Fail(f'Логин немесе құпиясөз қате. Қалған әрекет: {remain}.', 401, {'attemptsLeft': remain})
    require(not u['blocked'], 'Аккаунтыңыз әкімші тарапынан бұғатталған.', 403)
    FAILS.pop(login.lower(), None)
    log(f'LOGIN: «{u["login"]}» ({u["role"]}) жүйеге кірді')
    return {'user': public_user(u), '_cookie': new_session(c, u['id'], login.lower() in DEMO_LOGINS)}


def get_me(c, user, q):
    return {'user': public_user(user) if user else None}


def get_meta(c, user, q):
    return {
        'energyClasses': ENERGY_CLASSES,
        'types': [dict(r) for r in rows(c, 'SELECT * FROM appliance_types ORDER BY rowid')],
        'groups': [{'name': g.__name__, 'kz': g.KZ} for g in GROUP_CLASSES],
        'images': list_images(),
        'passwordPolicy': {'iterations': PBKDF2_ITERATIONS, 'saltBytes': SALT_BYTES, 'maxFails': MAX_FAILS,
                           'lockSeconds': LOCK_SECONDS},
    }


# ---------- Клиент әрекеттері ----------

def get_state(c, user, q):
    return state(c, user)


def set_apartment_layout(c, user, data):
    require(user['role'] == 'CLIENT', 'Пәтер түрін оның иесі таңдайды.', 403)
    if set(data) == {'roomCount'} and type(data['roomCount']) is int:
        layout = {1: 'one', 2: 'two'}.get(data['roomCount'])
    else:
        layout = data.get('layout') if set(data) == {'layout'} else None
    require(isinstance(layout, str) and layout in LAYOUT_COUNTS, 'Пәтер жоспарын таңдаңыз.')
    c.execute('INSERT INTO apartment_layouts(user_id,kind) VALUES (?,?) '
              'ON CONFLICT(user_id) DO UPDATE SET kind=excluded.kind', (user['id'], layout))
    return {'state': state(c, user)}


def get_apartments(c, user, q):
    # A resident's query never loads another household's records.
    scope = '' if user['role'] == 'ADMIN' else 'AND u.id = ?'
    args = () if user['role'] == 'ADMIN' else (user['id'],)
    records = rows(c, f"""
        SELECT u.id, u.login, l.lat_cell, l.lon_cell, COALESCE(layout.kind,'two') AS layout,
               COALESCE(SUM(CASE WHEN a.plugged THEN a.power END), 0) AS power,
               COALESCE(SUM(CASE WHEN a.plugged THEN a.power * a.hours_per_day END), 0) / 1000.0 AS kwh
        FROM users u LEFT JOIN apartment_locations l ON l.user_id=u.id
        LEFT JOIN apartment_layouts layout ON layout.user_id=u.id
        LEFT JOIN appliances a ON a.user_id=u.id
        WHERE (u.role='CLIENT' OR l.user_id IS NOT NULL OR a.id IS NOT NULL) {scope}
        GROUP BY u.id ORDER BY l.lat_cell IS NULL, u.id""", args)
    sample_names = {'aru': 'Арудың үлгі пәтері', 'demo_esil': 'Есілдегі үлгі пәтер',
                    'demo_saryarka': 'Сарыарқадағы үлгі пәтер'}
    items = []
    for r in records:
        point = None if r['lat_cell'] is None else [r['lat_cell'] / 100, r['lon_cell'] / 100]
        label = f"Пәтер №{r['id']}"
        if user['login'].lower() in DEMO_LOGINS:
            label = sample_names.get(r['login'], label)
        items.append({'id': r['id'], 'label': label, 'point': point, 'power': r['power'],
                      'kwhDay': round(r['kwh'], 3), 'layout': r['layout'], 'roomCount': LAYOUT_COUNTS[r['layout']]})
    return {'items': items}


def get_apartment_view(c, user, q):
    uid = as_int(q.get('id'))
    require(uid == user['id'] or user['role'] == 'ADMIN', 'Тек өз пәтеріңізді көре аласыз.', 403)
    require(value(c, 'SELECT 1 FROM users WHERE id=?', (uid,)), 'Пәтер табылмады.', 404)
    return apartment_state(c, uid)


def require_file_owner(user):
    require(user is not None, 'Жүйеге кіріңіз.', 401)
    require(user['role'] == 'CLIENT' and user['login'].lower() not in DEMO_LOGINS,
            'Файлды тек жеке пәтердің иесі қарай алады.', 403)


def get_file_info(c, user, q):
    require_file_owner(user)
    require(not q, 'Жеке пәтердің файлын ашыңыз.')
    return {'file': one(c, 'SELECT version, mime, length(content) AS size FROM apartment_files WHERE user_id=?',
                        (user['id'],))}


def remove_file(c, user, data):
    require_file_owner(user)
    require(set(data) == {'version'} and isinstance(data['version'], str), 'Файл нұсқасын таңдаңыз.')
    removed = c.execute('DELETE FROM apartment_files WHERE user_id=? AND version=?',
                        (user['id'], data['version'])).rowcount
    require(removed, 'Файл өзгерді. Карточканы жаңартыңыз.', 409)
    return {'file': None}


def set_apartment_location(c, user, data):
    require(user['role'] == 'CLIENT', 'Орынды пәтер иесі таңдайды.', 403)
    if data == {'remove': True}:
        c.execute('DELETE FROM apartment_locations WHERE user_id=?', (user['id'],))
    else:
        require(set(data) == {'latCell', 'lonCell'}, 'Картадан бір орынды таңдаңыз.')
        lat, lon = data['latCell'], data['lonCell']
        require(type(lat) is int and type(lon) is int and -8500 <= lat <= 8500 and -18000 <= lon <= 18000,
                'Картадағы орын жарамсыз.')
        if user['login'].lower() in DEMO_LOGINS:
            require((lat, lon) in SAMPLE_PLACES.values(), 'Демо режимінде тек үлгі орындар қолданылады.', 403)
        c.execute("""INSERT INTO apartment_locations(user_id, lat_cell, lon_cell) VALUES (?,?,?)
                     ON CONFLICT(user_id) DO UPDATE SET lat_cell=excluded.lat_cell, lon_cell=excluded.lon_cell""",
                  (user['id'], lat, lon))
    return get_apartments(c, user, {})


def get_catalog(c, user, q):
    return {'items': rows(c, 'SELECT c.*, t.name_kz, t.category, t.category_kz, t.extra_label, t.extra_unit '
                             'FROM catalog c JOIN appliance_types t ON t.code = c.type ORDER BY c.id')}


def do_appliance_add(c, user, d):
    room = own_room(c, user, d.get('roomId'))
    if d.get('catalogId'):
        t = one(c, 'SELECT * FROM catalog WHERE id=?', (as_int(d['catalogId']),))
        require(t, 'Каталогта мұндай құрал жоқ.')
        f = {k: t[k] for k in ('type', 'name', 'brand', 'power', 'voltage', 'energy_class', 'weight', 'extra',
                               'hours_per_day', 'image')}
        catalog_id = t['id']
    else:
        f = appliance_fields(d)
        catalog_id = None
    plugged = 1 if d.get('plugged') else 0
    circuit = choose_circuit(c, room['id'], plugged, appliance_type=f['type'])
    cur = c.execute(
        'INSERT INTO appliances(user_id, room_id, catalog_id, type, name, brand, power, voltage, energy_class, weight, '
        'extra, hours_per_day, image, plugged) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        (user['id'], circuit, catalog_id, f['type'], f['name'], f['brand'], f['power'], f['voltage'],
         f['energy_class'], f['weight'], f['extra'], f['hours_per_day'], f['image'], plugged))
    event(c, user['id'], 'ADD', cur.lastrowid, f'{f["name"]} → {room["name"]}', f['power'])
    new = []
    if plugged:
        event(c, user['id'], 'PLUG', cur.lastrowid, f'{f["name"]} розеткаға қосылды', f['power'])
        new = check_overload(c, user['id'], room['id'])
    return {'state': state(c, user), 'notifications': new, 'id': cur.lastrowid}


def do_appliance_update(c, user, d):
    a = own_appliance(c, user, d.get('id'))
    room = own_room(c, user, d.get('roomId', a['layout_room_id']))
    f = appliance_fields(d)
    circuit = choose_circuit(c, room['id'], a['plugged'], a, f['type'])
    c.execute('UPDATE appliances SET room_id=?, type=?, name=?, brand=?, power=?, voltage=?, energy_class=?, weight=?, '
              'extra=?, hours_per_day=?, image=? WHERE id=? AND user_id=?',
              (circuit, f['type'], f['name'], f['brand'], f['power'], f['voltage'], f['energy_class'], f['weight'],
               f['extra'], f['hours_per_day'], f['image'], a['id'], user['id']))
    event(c, user['id'], 'EDIT', a['id'], f'{f["name"]} өзгертілді', f['power'])
    new = check_overload(c, user['id'], room['id']) if a['plugged'] and f['power'] > a['power'] else []
    return {'state': state(c, user), 'notifications': new}


def do_appliance_delete(c, user, d):
    a = own_appliance(c, user, d.get('id'))
    event(c, user['id'], 'DELETE', a['id'], f'{a["name"]} жойылды', a['power'])
    c.execute('DELETE FROM appliances WHERE id=? AND user_id=?', (a['id'], user['id']))
    return {'state': state(c, user)}


def do_plug(c, user, d):
    """Розеткаға қосу / ажырату — ООП объектілері арқылы (Room.plug, ElectricAppliance.unplug)."""
    apt = load_apartment(c, user['id'])
    a = apt.find_appliance(as_int(d.get('id')))
    want = bool(d.get('plugged'))
    new = []
    if want and not a.is_plugged_in():
        a.room.plug(a)                       # бос розетка жоқ болса -> Fail
        circuit = choose_circuit(c, a.room.id, True, own_appliance(c, user, a.id))
        c.execute('UPDATE appliances SET plugged=1, room_id=? WHERE id=? AND user_id=?', (circuit, a.id, user['id']))
        event(c, user['id'], 'PLUG', a.id, f'{a.name} розеткаға қосылды ({a.room.name})', a.power)
        new = check_overload(c, user['id'], a.room.id)
    elif not want and a.is_plugged_in():
        a.unplug()
        c.execute('UPDATE appliances SET plugged=0 WHERE id=? AND user_id=?', (a.id, user['id']))
        event(c, user['id'], 'UNPLUG', a.id, f'{a.name} розеткадан ажыратылды ({a.room.name})', a.power)
    return {'state': state(c, user), 'notifications': new}


def do_unplug_all(c, user, d):
    count = value(c, 'SELECT COUNT(*) FROM appliances WHERE user_id=? AND plugged=1', (user['id'],))
    power = value(c, 'SELECT COALESCE(SUM(power),0) FROM appliances WHERE user_id=? AND plugged=1', (user['id'],))
    c.execute('UPDATE appliances SET plugged=0 WHERE user_id=? AND plugged=1', (user['id'],))
    new = []
    if count:
        event(c, user['id'], 'UNPLUG_ALL', None, f'{count} құрал өшірілді', power)
        new.append(notify(c, user['id'], 'Барлық құралдар өшірілді',
                          f'{count} құрал розеткадан ажыратылды, {num(power)} Вт жүктеме алынды.', 'SUCCESS'))
    return {'state': state(c, user), 'notifications': new, 'count': count}


SORT_KEYS = {
    # кілт: (атауы, Python key-функциясы, Python кодындағы өрнек, Java Comparator, SQL ORDER BY өрнегі)
    'power': ('Қуаты (Вт)', lambda a: a.power, 'a.power',
              'Comparator.comparingDouble(ElectricAppliance::getPower)', 'a.power'),
    'name': ('Атауы', lambda a: a.name.lower(), 'a.name.lower()',
             'Comparator.comparing(ElectricAppliance::getName, String.CASE_INSENSITIVE_ORDER)', 'kz_lower(a.name)'),
    'energy': ('Энергия класы', lambda a: ENERGY_CLASSES.index(a.energy_class),
               'ENERGY_CLASSES.index(a.energy_class)', 'Comparator.comparing(ElectricAppliance::getEnergyClass)',
               "CASE a.energy_class WHEN 'A+++' THEN 0 WHEN 'A++' THEN 1 WHEN 'A+' THEN 2 WHEN 'A' THEN 3 "
               "WHEN 'B' THEN 4 WHEN 'C' THEN 5 ELSE 6 END"),
    'kwh': ('Тәуліктік шығын (кВт·сағ)', lambda a: a.daily_kwh(), 'a.daily_kwh()',
            'Comparator.comparingDouble(ElectricAppliance::dailyKwh)', 'a.power * a.hours_per_day / 1000.0'),
}


def get_sort(c, user, q):
    """Сұрыптау Python-да ООП объектілерімен орындалады (sorted + key)."""
    by = q.get('by', 'power')
    require(by in SORT_KEYS, 'Сұрыптау кілті қате.')
    desc = q.get('dir', 'desc') != 'asc'
    plugged_only = q.get('plugged') == '1'
    label, key, expr, java, sql_expr = SORT_KEYS[by]
    apt = load_apartment(c, user['id'])
    t0 = time.perf_counter()
    items = apt.sorted_by(key, reverse=desc, plugged_only=plugged_only)
    ms = (time.perf_counter() - t0) * 1000
    java_cmp = java + ('.reversed()' if desc else '')
    return {
        'by': by, 'dir': 'desc' if desc else 'asc', 'label': label, 'ms': round(ms, 3),
        'items': [a.to_json(apt.tariff) for a in items],
        'code': {
            'python': f'sorted(apartment.appliances(), key=lambda a: {expr}, reverse={desc})',
            'java': f'appliances.sort({java_cmp});',
            'sql': ('SELECT a.name, a.power, a.energy_class, a.hours_per_day\nFROM appliances a\n'
                    f'WHERE a.user_id = ?{" AND a.plugged = 1" if plugged_only else ""}\n'
                    f'ORDER BY {sql_expr} {"DESC" if desc else "ASC"};'),
        },
    }


SEARCH_RANGES = [
    # параметр, баған, атауы, әдепкі min, әдепкі max
    ('power', 'a.power', 'Қуаты', 0, 10000),
    ('voltage', 'a.voltage', 'Кернеуі', 0, 1000),
    ('weight', 'a.weight', 'Салмағы', 0, 1000),
    ('hours', 'a.hours_per_day', 'Жұмыс уақыты', 0, 24),
]


def get_search(c, user, q):
    """Параметрлер аралығы бойынша іздеу: параметрленген SQL + BETWEEN."""
    where = ['a.user_id = ?']
    params = [user['id']]
    for key, col, label, lo_def, hi_def in SEARCH_RANGES:
        lo = q.get(key + '_min', '')
        hi = q.get(key + '_max', '')
        try:
            lo = float(lo) if str(lo).strip() != '' else lo_def
            hi = float(hi) if str(hi).strip() != '' else hi_def
        except ValueError:
            raise Fail(f'«{label}» аралығына сан енгізіңіз.')
        require(lo <= hi, f'«{label}»: минимум максимумнан үлкен болмауы керек.')
        where.append(f'{col} BETWEEN ? AND ?')
        params += [lo, hi]
    classes = [x for x in (q.get('classes') or '').split(',') if x]
    if classes:
        require(all(x in ENERGY_CLASSES for x in classes), 'Энергия класы қате.')
        where.append(f'a.energy_class IN ({", ".join("?" * len(classes))})')
        params += classes
    group = q.get('group') or ''
    if group:
        require(group in GROUP_NAMES, 'Санат қате.')
        where.append('t.category = ?')
        params.append(group)
    type_code = q.get('type') or ''
    if type_code:
        require(type_code in BY_TYPE, 'Түрі қате.')
        where.append('a.type = ?')
        params.append(type_code)
    if q.get('room'):
        where.append('r.id = ?')
        params.append(as_int(q['room'], 'Бөлме'))
    if q.get('plugged') == '1':
        where.append('a.plugged = 1')
    name = (q.get('q') or '').strip()
    if name:
        like = '%' + kz_lower(name).replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'
        where.append("(kz_lower(a.name) LIKE ? ESCAPE '\\' OR kz_lower(a.brand) LIKE ? ESCAPE '\\')")
        params += [like, like]
    sql = ('SELECT a.*, r.name AS room_name, t.name_kz, t.category_kz\n'
           'FROM appliances a\n'
           'JOIN layout_room_map m ON m.circuit_id = a.room_id\n'
           'JOIN layout_rooms r ON r.id = m.room_id\n'
           'JOIN appliance_types t ON t.code = a.type\n'
           'WHERE ' + '\n  AND '.join(where) + '\n'
           'ORDER BY a.power DESC;')
    t0 = time.perf_counter()
    found = rows(c, sql, params)
    ms = (time.perf_counter() - t0) * 1000
    apt = load_apartment(c, user['id'])
    by_id = {a.id: a for a in apt.appliances()}
    items = [by_id[r['id']].to_json(apt.tariff) for r in found if r['id'] in by_id]
    return {'sql': sql, 'params': params, 'items': items, 'count': len(items), 'ms': round(ms, 3)}


def get_notifications(c, user, q):
    return {'items': rows(c, 'SELECT id, title, body, kind, is_read, created_at FROM notifications '
                             'WHERE user_id=? ORDER BY id DESC LIMIT 100', (user['id'],)),
            'unread': value(c, 'SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0', (user['id'],))}


def do_notif_read(c, user, d):
    if d.get('all'):
        c.execute('UPDATE notifications SET is_read=1 WHERE user_id=?', (user['id'],))
    else:
        c.execute('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?', (as_int(d.get('id')), user['id']))
    return get_notifications(c, user, {})


def do_notif_delete(c, user, d):
    if d.get('read'):
        c.execute('DELETE FROM notifications WHERE user_id=? AND is_read=1', (user['id'],))
    else:
        c.execute('DELETE FROM notifications WHERE id=? AND user_id=?', (as_int(d.get('id')), user['id']))
    return get_notifications(c, user, {})


def get_events(c, user, q):
    return {'items': rows(c, 'SELECT e.id, e.action, e.details, e.power, e.created_at, e.appliance_id '
                             'FROM events e WHERE e.user_id=? ORDER BY e.id DESC LIMIT 100', (user['id'],))}


def get_media(c, user, q):
    data = json.loads((MEDIA / 'credits.json').read_text('utf-8'))
    for v in data.get('videos', []):
        p = MEDIA / v['file']
        v['available'] = p.is_file() and p.stat().st_size > 10_000   # < 10 КБ — бұл қате беті, видео емес
        v['size'] = p.stat().st_size if p.is_file() else 0
    for img in data.get('images', []):
        img['available'] = (MEDIA / img['file']).is_file()
    return data


def do_profile(c, user, d):
    require(user['login'].lower() not in DEMO_LOGINS, 'Жеке деректер үшін өз аккаунтыңызға кіріңіз.', 403)
    full_name = text(d, 'fullName', 'Аты-жөні', 2, 60)
    email = str(d.get('email') or '').strip()
    require(EMAIL_RE.match(email) and len(email) <= 80, 'Email форматы қате.')
    c.execute('UPDATE users SET full_name=?, email=? WHERE id=?', (full_name, email, user['id']))
    return {'user': public_user(one(c, 'SELECT * FROM users WHERE id=?', (user['id'],)))}


def do_password(c, user, d):
    require(user['login'].lower() not in DEMO_LOGINS, 'Ортақ демо-аккаунттың құпиясөзі бекітілген.', 403)
    old = str(d.get('old') or '')
    new = str(d.get('new') or '')
    require(verify_password(old, user['salt'], user['password_hash']), 'Ағымдағы құпиясөз қате.')
    check_password_rules(new)
    require(new == d.get('confirm'), 'Жаңа құпиясөздер сәйкес келмейді.')
    require(new != old, 'Жаңа құпиясөз ескісінен өзгеше болуы керек.')
    salt, pw_hash = hash_password(new)
    c.execute('UPDATE users SET salt=?, password_hash=? WHERE id=?', (salt, pw_hash, user['id']))
    n = notify(c, user['id'], 'Құпиясөз өзгертілді',
               'Жаңа құпиясөз PBKDF2-HMAC-SHA256 арқылы жаңа тұзбен хэштелді.', 'SUCCESS')
    log(f'PASSWORD: «{user["login"]}» құпиясөзін өзгертті')
    return {'notifications': [n]}


# ---------- Әкімші әрекеттері (/api/admin/...) — тек ADMIN ----------

def get_admin_users(c, user, q):
    return {'items': rows(c, """
        SELECT u.id, u.login, u.full_name, u.email, u.role, u.blocked, u.created_at,
               COUNT(a.id) AS appliances,
               COALESCE(SUM(CASE WHEN a.plugged = 1 THEN a.power END), 0) AS plugged_power
        FROM users u LEFT JOIN appliances a ON a.user_id = u.id
        GROUP BY u.id ORDER BY u.id""")}


def target_user(c, user, d, self_error):
    uid = as_int(d.get('id'))
    t = one(c, 'SELECT * FROM users WHERE id=?', (uid,))
    require(t, 'Пайдаланушы табылмады.', 404)
    require(uid != user['id'], self_error)
    require(t['login'].lower() not in DEMO_LOGINS | {SECTOR_LOGIN}, 'Бұл қызметтік аккаунт қорғалған.', 403)
    return t


def do_admin_role(c, user, d):
    t = target_user(c, user, d, 'Өз рөліңізді өзгерте алмайсыз.')
    role = d.get('role')
    require(role in ('ADMIN', 'CLIENT'), 'Рөл қате.')
    c.execute('UPDATE users SET role=? WHERE id=?', (role, t['id']))
    notify(c, t['id'], 'Рөліңіз өзгертілді', f'Әкімші сізге {role} рөлін берді.', 'INFO')
    log(f'ADMIN: «{t["login"]}» рөлі → {role}')
    return get_admin_users(c, user, {})


def do_admin_block(c, user, d):
    t = target_user(c, user, d, 'Өзіңізді бұғаттай алмайсыз.')
    blocked = 1 if d.get('blocked') else 0
    c.execute('UPDATE users SET blocked=? WHERE id=?', (blocked, t['id']))
    if blocked:
        c.execute('DELETE FROM sessions WHERE user_id=?', (t['id'],))
    log(f'ADMIN: «{t["login"]}» {"бұғатталды" if blocked else "бұғаттан шығарылды"}')
    return get_admin_users(c, user, {})


def do_admin_user_delete(c, user, d):
    t = target_user(c, user, d, 'Өз аккаунтыңызды жоя алмайсыз.')
    c.execute('DELETE FROM users WHERE id=?', (t['id'],))
    log(f'ADMIN: «{t["login"]}» жойылды')
    return get_admin_users(c, user, {})


def do_admin_catalog_save(c, user, d):
    f = appliance_fields(d)
    vals = (f['type'], f['name'], f['brand'], f['power'], f['voltage'], f['energy_class'], f['weight'], f['extra'],
            f['hours_per_day'], f['image'])
    if d.get('id'):
        cid = as_int(d['id'])
        require(value(c, 'SELECT 1 FROM catalog WHERE id=?', (cid,)), 'Үлгі табылмады.', 404)
        c.execute('UPDATE catalog SET type=?, name=?, brand=?, power=?, voltage=?, energy_class=?, weight=?, extra=?, '
                  'hours_per_day=?, image=? WHERE id=?', vals + (cid,))
    else:
        c.execute('INSERT INTO catalog(type, name, brand, power, voltage, energy_class, weight, extra, hours_per_day, '
                  'image) VALUES (?,?,?,?,?,?,?,?,?,?)', vals)
    return get_catalog(c, user, {})


def do_admin_catalog_delete(c, user, d):
    c.execute('DELETE FROM catalog WHERE id=?', (as_int(d.get('id')),))
    return get_catalog(c, user, {})


def do_admin_broadcast(c, user, d):
    title = text(d, 'title', 'Тақырыбы', 3, 80)
    body = text(d, 'body', 'Мәтіні', 3, 500)
    ids = [r['id'] for r in rows(c, "SELECT id FROM users WHERE role='CLIENT' AND blocked=0")]
    for uid in ids:
        notify(c, uid, title, body, 'BROADCAST')
    log(f'ADMIN: хабарлама {len(ids)} клиентке жіберілді')
    return {'count': len(ids), **get_admin_broadcasts(c, user, {})}


def get_admin_broadcasts(c, user, q):
    return {'history': rows(c, """
        SELECT title, body, created_at, COUNT(*) AS recipients, SUM(is_read) AS read_count
        FROM notifications WHERE kind = 'BROADCAST'
        GROUP BY title, body, created_at ORDER BY MAX(id) DESC LIMIT 20""")}


def get_admin_settings(c, user, q):
    return {'settings': settings_json(get_settings(c))}


def do_admin_settings(c, user, d):
    tariff = number(d, 'tariff', 'Тариф (₸/кВт·сағ)', 0.1, 1000)
    limit = number(d, 'apartmentLimit', 'Пәтер шегі (Вт)', 500, 100000)
    room_limit = number(d, 'roomLimit', 'Бөлме желісінің шегі (Вт)', 100, 100000)
    for k, v in (('tariff', tariff), ('apartment_limit', limit), ('room_limit', room_limit)):
        c.execute('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
                  (k, str(v)))
    log(f'ADMIN: тариф={tariff}, пәтер шегі={limit}, бөлме шегі={room_limit}')
    return get_admin_settings(c, user, {})


REPORTS = [
    ('Санаттар бойынша: COUNT, SUM, AVG, MAX (JOIN + GROUP BY)',
     """SELECT t.category_kz AS санат,
       COUNT(a.id)              AS құрал_саны,
       SUM(a.power)             AS жалпы_қуат_Вт,
       ROUND(AVG(a.power), 1)   AS орташа_қуат_Вт,
       MAX(a.power)             AS ең_қуатты_Вт
FROM appliances a
JOIN appliance_types t ON t.code = a.type
GROUP BY t.category
ORDER BY жалпы_қуат_Вт DESC"""),
    ('Ең қуатты 10 құрал (3 кесте JOIN + ORDER BY + LIMIT)',
     """SELECT a.name AS құрал, a.power AS қуат_Вт, u.login AS иесі, r.name AS бөлме,
       CASE a.plugged WHEN 1 THEN 'қосулы' ELSE 'өшірулі' END AS күйі
FROM appliances a
JOIN users u ON u.id = a.user_id
JOIN layout_room_map m ON m.circuit_id=a.room_id
JOIN layout_rooms r ON r.id=m.room_id
ORDER BY a.power DESC
LIMIT 10"""),
    ('Клиенттер қосулы қуат бойынша (LEFT JOIN + COALESCE)',
     """SELECT u.login, u.full_name AS аты_жөні,
       COUNT(a.id)                AS қосулы_саны,
       COALESCE(SUM(a.power), 0)  AS қосулы_қуат_Вт,
       ROUND(COALESCE(SUM(a.power), 0) * 100.0 /
             (SELECT CAST(value AS REAL) FROM settings WHERE key = 'apartment_limit'), 1) AS жүктеме_пайыз
FROM users u
LEFT JOIN appliances a ON a.user_id = u.id AND a.plugged = 1
WHERE u.role = 'CLIENT'
GROUP BY u.id
ORDER BY қосулы_қуат_Вт DESC"""),
    ('Құралы 3-тен көп бөлмелер (GROUP BY + HAVING)',
     """SELECT u.login, r.name AS бөлме, r.sockets AS розетка,
       COUNT(a.id) AS құрал_саны, SUM(a.power) AS жалпы_қуат_Вт
FROM layout_rooms r
JOIN users u ON u.id = r.user_id
JOIN layout_room_map m ON m.room_id=r.id
JOIN appliances a ON a.room_id=m.circuit_id
GROUP BY r.id
HAVING COUNT(a.id) >= 3
ORDER BY жалпы_қуат_Вт DESC"""),
    ('Айлық төлем бойынша клиенттер (ішкі сұраныс + тариф)',
     """SELECT u.login,
       ROUND(SUM(a.power * a.hours_per_day / 1000.0), 2) AS кВт_сағ_тәулік,
       ROUND(SUM(a.power * a.hours_per_day / 1000.0) * 30 *
             (SELECT CAST(value AS REAL) FROM settings WHERE key = 'tariff')) AS теңге_ай
FROM users u
JOIN appliances a ON a.user_id = u.id AND a.plugged = 1
GROUP BY u.id
ORDER BY теңге_ай DESC"""),
    ('Энергия класы бойынша бөлу (GROUP BY + CASE)',
     """SELECT a.energy_class AS класс, COUNT(*) AS саны, ROUND(AVG(a.power)) AS орташа_қуат_Вт
FROM appliances a
GROUP BY a.energy_class
ORDER BY CASE a.energy_class WHEN 'A+++' THEN 0 WHEN 'A++' THEN 1 WHEN 'A+' THEN 2
         WHEN 'A' THEN 3 WHEN 'B' THEN 4 WHEN 'C' THEN 5 ELSE 6 END"""),
    ('Қыздырғыш элементі бар құралдар (Heating интерфейсі, WHERE + JOIN)',
     """SELECT t.class_name AS класс, t.name_kz AS түрі, t.max_temp AS макс_темп_C,
       COUNT(a.id) AS саны, COALESCE(SUM(a.power), 0) AS жалпы_қуат_Вт
FROM appliance_types t
LEFT JOIN appliances a ON a.type = t.code
WHERE t.heating = 1
GROUP BY t.code
ORDER BY t.max_temp DESC"""),
    ('Орташадан қуатты құралдар (ішкі сұраныс AVG)',
     """SELECT DISTINCT a.name AS құрал, a.power AS қуат_Вт
FROM appliances a
WHERE a.power > (SELECT AVG(power) FROM appliances)
ORDER BY a.power DESC"""),
    ('Каталог үлгілерінің қолданылуы (LEFT JOIN + COUNT)',
     """SELECT c.name AS үлгі, c.type AS түрі, COUNT(a.id) AS пәтерлерде
FROM catalog c
LEFT JOIN appliances a ON a.catalog_id = c.id
GROUP BY c.id
ORDER BY пәтерлерде DESC, c.name"""),
    ('Оқиғалар тарихы әрекет бойынша (GROUP BY)',
     """SELECT e.action AS әрекет, COUNT(*) AS саны, ROUND(SUM(e.power)) AS қуат_Вт
FROM events e
GROUP BY e.action
ORDER BY саны DESC"""),
]


def get_admin_stats(c, user, q):
    summary = one(c, """
        SELECT (SELECT COUNT(*) FROM users) AS users,
               (SELECT COUNT(*) FROM users WHERE role = 'CLIENT') AS clients,
               (SELECT COUNT(*) FROM users WHERE blocked = 1) AS blocked,
               (SELECT COUNT(*) FROM appliances) AS appliances,
               (SELECT COUNT(*) FROM appliances WHERE plugged = 1) AS plugged,
               (SELECT COALESCE(SUM(power), 0) FROM appliances WHERE plugged = 1) AS plugged_power,
               (SELECT COUNT(*) FROM catalog) AS catalog,
               (SELECT COUNT(*) FROM events) AS events""")
    reports = []
    for title, sql in REPORTS:
        cur = c.execute(sql)
        cols = [d[0] for d in cur.description]
        reports.append({'title': title, 'sql': sql, 'columns': cols, 'rows': [list(r) for r in cur.fetchall()]})
    return {'summary': summary, 'reports': reports}


GET_ACTIONS = {
    'apartments': (get_apartments, 'user'), 'apartment-view': (get_apartment_view, 'user'),
    'apartment-file-info': (get_file_info, 'user'),
    'me': (get_me, 'public'), 'meta': (get_meta, 'public'),
    'state': (get_state, 'user'), 'catalog': (get_catalog, 'user'), 'sort': (get_sort, 'user'),
    'search': (get_search, 'user'), 'notifications': (get_notifications, 'user'),
    'events': (get_events, 'user'), 'media': (get_media, 'user'),
    'admin/users': (get_admin_users, 'admin'), 'admin/stats': (get_admin_stats, 'admin'),
    'admin/settings': (get_admin_settings, 'admin'), 'admin/broadcasts': (get_admin_broadcasts, 'admin'),
}
POST_ACTIONS = {
    'apartment-layout': (set_apartment_layout, 'user'),
    'apartment-location': (set_apartment_location, 'user'),
    'apartment-file-remove': (remove_file, 'user'),
    'register': (do_register, 'public'), 'login': (do_login, 'public'),
    'appliance_add': (do_appliance_add, 'user'), 'appliance_update': (do_appliance_update, 'user'),
    'appliance_delete': (do_appliance_delete, 'user'), 'plug': (do_plug, 'user'),
    'unplug_all': (do_unplug_all, 'user'), 'notif_read': (do_notif_read, 'user'),
    'notif_delete': (do_notif_delete, 'user'), 'profile': (do_profile, 'user'), 'password': (do_password, 'user'),
    'admin/role': (do_admin_role, 'admin'), 'admin/block': (do_admin_block, 'admin'),
    'admin/user_delete': (do_admin_user_delete, 'admin'), 'admin/catalog_save': (do_admin_catalog_save, 'admin'),
    'admin/catalog_delete': (do_admin_catalog_delete, 'admin'), 'admin/broadcast': (do_admin_broadcast, 'admin'),
    'admin/settings': (do_admin_settings, 'admin'),
}


# ============================================================================
# 5. HTTP ӨҢДЕУШІ
# ============================================================================

class Handler(BaseHTTPRequestHandler):
    server_version = 'ElectroUi/1.0'
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):
        pass

    def token(self):
        raw = self.headers.get('Cookie')
        if not raw:
            return None
        jar = SimpleCookie()
        try:
            jar.load(raw)
        except CookieError:
            return None
        m = jar.get(COOKIE)
        return m.value if m and m.value else None

    def session_user(self, c, token):
        if not token:
            return None
        u = one(c, 'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id '
                   'WHERE s.token_hash = ? AND s.expires_at > ?', (token_hash(token), int(time.time())))
        if u and u['blocked']:
            return None
        return u

    def send_json(self, code, data, cookie=None):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def send_static(self, base, rel):
        base = base.resolve()
        path = (base / unquote(rel)).resolve()
        if not path.is_relative_to(base) or not path.is_file():
            return self.send_json(404, {'error': 'Файл табылмады.'})
        ctype = TYPES.get(path.suffix.lower(), 'application/octet-stream')
        size = path.stat().st_size
        start, end, status = 0, size - 1, 200
        rng = self.headers.get('Range')
        if rng and size:
            m = re.match(r'^bytes=(\d*)-(\d*)$', rng.strip())
            if m and (m.group(1) or m.group(2)):
                if m.group(1):
                    start = int(m.group(1))
                    end = int(m.group(2)) if m.group(2) else size - 1
                else:
                    start, end = max(0, size - int(m.group(2))), size - 1
                if start >= size or start > end:
                    self.send_response(416)
                    self.send_header('Content-Range', f'bytes */{size}')
                    self.send_header('Content-Length', '0')
                    self.end_headers()
                    return
                end = min(end, size - 1)
                status = 206
        length = end - start + 1 if size else 0
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(length))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Cache-Control', 'public, max-age=3600' if base == MEDIA.resolve() else 'no-cache')
        if status == 206:
            self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.end_headers()
        if self.command == 'HEAD' or not length:
            return
        with open(path, 'rb') as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(256 * 1024, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)

    def do_GET(self):
        self.route('GET')

    def do_HEAD(self):
        self.route('GET')

    def do_POST(self):
        self.route('POST')

    def apartment_file(self, method, url):
        token = self.token()
        if method == 'POST':
            self.close_connection = True
        query = parse_qs(url.query, keep_blank_values=True)
        with db(bool(token and token.startswith('demo.'))) as c:
            user = self.session_user(c, token)
            require_file_owner(user)
            require(set(query) == {'v'} and len(query['v']) == 1, 'Файл нұсқасын таңдаңыз.')
            version = query['v'][0]
            if method == 'GET':
                record = one(c, 'SELECT mime, content FROM apartment_files WHERE user_id=? AND version=?',
                             (user['id'], version))
        if method == 'GET':
            require(record is not None, 'Файл табылмады.', 404)
            content, mime = record['content'], record['mime']
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'private, no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Cross-Origin-Resource-Policy', 'same-origin')
            self.send_header('Content-Security-Policy', "sandbox; default-src 'none'")
            if mime == 'application/pdf':
                self.send_header('Content-Disposition', 'attachment; filename="apartment-plan.pdf"')
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(content)
            return
        mime = self.headers.get_content_type()
        require(mime in ('image/png', 'application/pdf'), 'Фотоны немесе PDF жоспарын таңдаңыз.', 415)
        length = self.headers.get('Content-Length', '')
        require(re.fullmatch(r'[0-9]{1,10}', length) and int(length) > 0, 'Бос файлды жүктеу мүмкін емес.')
        length = int(length)
        require(length <= apartment_files.MAX_BYTES, 'Файл 8 МБ-тан аспауы керек.', 413)
        raw = self.rfile.read(length)
        require(len(raw) == length, 'Файл толық жүктелмеді.')
        try:
            content = apartment_files.normalize(mime, raw)
        except ValueError:
            raise Fail('Файл ашылмады. Басқа суретті немесе PDF жоспарын таңдаңыз.', 415)
        # Recheck the session after receiving the file. A failed or stale upload leaves the old file intact.
        with LOCK, db() as c:
            user = self.session_user(c, token)
            require_file_owner(user)
            current = value(c, 'SELECT version FROM apartment_files WHERE user_id=?', (user['id'],))
            require(version == (current or 'new'), 'Файл өзгерді. Карточканы жаңартыңыз.', 409)
            new_version = secrets.token_hex(12)
            c.execute('INSERT INTO apartment_files(user_id,version,mime,content) VALUES (?,?,?,?) '
                      'ON CONFLICT(user_id) DO UPDATE SET version=excluded.version, mime=excluded.mime, content=excluded.content',
                      (user['id'], new_version, mime, content))
        self.send_json(200, {'ok': True, 'file': {'version': new_version, 'mime': mime, 'size': len(content)}})

    def route(self, method):
        url = urlparse(self.path)
        path = url.path
        try:
            if path.startswith('/api/'):
                return self.api(method, path[5:].strip('/'), url)
            if method != 'GET':
                return self.send_json(405, {'error': 'Әдіс рұқсат етілмеген.'})
            if path in ('/', '/index.html'):
                return self.send_static(ROOT, 'index.html')
            if path == '/favicon.ico':
                return self.send_static(STATIC, 'icon.svg')
            if path.startswith('/static/'):
                return self.send_static(STATIC, path[len('/static/'):])
            if path.startswith('/media/'):
                return self.send_static(MEDIA, path[len('/media/'):])
            self.send_json(404, {'error': 'Бет табылмады.'})
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def api(self, method, name, url):
        cookie = None
        login = '-'
        code = 200
        try:
            if name == 'apartment-file':
                return self.apartment_file(method, url)
            data = {}
            if method == 'POST':
                length = int(self.headers.get('Content-Length') or 0)
                require(length <= 1_000_000, 'Сұрау тым үлкен.', 413)
                raw = self.rfile.read(length) if length else b''
                try:
                    data = json.loads(raw.decode('utf-8') or '{}')
                except (ValueError, UnicodeDecodeError):
                    raise Fail('JSON форматы қате.')
                require(isinstance(data, dict), 'JSON объект күтілді.')
            query = {k: v[-1] for k, v in parse_qs(url.query).items()}
            table = POST_ACTIONS if method == 'POST' else GET_ACTIONS
            token = self.token()
            demo = bool(token and token.startswith('demo.'))
            if method == 'POST' and name == 'login':
                demo = str(data.get('login') or '').strip().lower() in DEMO_LOGINS
            elif method == 'POST' and name == 'register':
                demo = False
            with LOCK, db(demo) as c:
                user = self.session_user(c, token)
                login = user['login'] if user else '-'
                if method == 'POST' and name == 'logout':
                    if token:
                        c.execute('DELETE FROM sessions WHERE token_hash=?', (token_hash(token),))
                    log(f'LOGOUT: «{login}»')
                    return self.send_json(200, {'ok': True}, clear_cookie())
                require(name in table, 'API әрекеті табылмады.', 404)
                func, access = table[name]
                if access != 'public':
                    require(user is not None, 'Жүйеге кіріңіз.', 401)
                if access == 'admin':
                    require(user['role'] == 'ADMIN', 'Бұл бөлімге тек әкімші (ADMIN) кіре алады.', 403)
                result = func(c, user, data if method == 'POST' else query) or {}
            cookie = result.pop('_cookie', None)
            self.send_json(200, dict(ok=True, **result), cookie)
        except Fail as e:
            code = e.code
            self.send_json(e.code, dict(ok=False, error=str(e), **e.extra))
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        except Exception as e:  # noqa: BLE001
            code = 500
            log(f'ERROR {method} {self.path}: {e!r}')
            self.send_json(500, {'ok': False, 'error': 'Сервер қатесі.'})
        finally:
            if method == 'POST' or code >= 400:
                log(f'{method} /api/{name} [{login}] → {code}')


class Server(ThreadingHTTPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):
        # Браузер keep-alive байланысын үзсе (видео, бетті жабу) — бұл қате емес, логқа шығармаймыз.
        if isinstance(sys.exc_info()[1], (ConnectionError, TimeoutError)):
            return
        super().handle_error(request, client_address)


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None


def main():
    # Windows консолі UTF-8 болмаса да қазақ әріптері серверді құлатпауы үшін
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding='utf-8', errors='replace')
        except (AttributeError, ValueError):
            pass
    if '--reset' in sys.argv:
        for demo in (False, True):
            path = database_path(demo)
            if path.exists():
                path.unlink()
                print(f' {path.name} жойылды — бастапқы деректермен қайта жасалады.')
    init_db()
    try:
        server = Server(('0.0.0.0', PORT), Handler)
    except OSError:
        print(f' {PORT} порты бос емес: сервер бұрыннан іске қосылған болуы мүмкін.')
        print(' Басқа сервер терезесін жауып, start.bat-ты қайта іске қосыңыз.', flush=True)
        return
    ip = lan_ip()
    print('=' * 60)
    print(' ЭлектроҮй — «Үйдегі электр құралдары» сервері іске қосылды')
    print('=' * 60)
    print(f' Компьютерде:        http://localhost:{PORT}')
    if ip:
        print(f' Телефонда (Wi-Fi):  http://{ip}:{PORT}')
    print(' Әкімші:  admin / Admin123!      Клиент:  aru / Aru12345!')
    print(' Тоқтату: Ctrl+C')
    print('=' * 60, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
