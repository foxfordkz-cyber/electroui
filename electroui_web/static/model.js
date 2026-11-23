/* =============================================================================
   model.js — «Үйдегі электр құралдары» класс иерархиясы (JavaScript ES2022 кластары)

   Бұл файл тапсырманың 1-бөлімі: электр құралдарының класс иерархиясы.
   Дәл осындай иерархия:
     • server.py ішінде Python кластары ретінде (сервер есептеулері мен сұрыптау),
     • Android қосымшасында Java кластары ретінде жазылған.

   ElectricAppliance (абстрактілі)  ── implements Pluggable
     ├─ KitchenAppliance     → Kettle (Heating), Refrigerator, Microwave (Heating)
     ├─ HouseholdAppliance   → WashingMachine, VacuumCleaner, Iron (Heating)
     ├─ MultimediaAppliance  → Television, Computer
     ├─ ClimateAppliance     → AirConditioner, Heater (Heating), Fan
     └─ LightingAppliance    → Lamp
   ============================================================================= */
'use strict';

const ENERGY_CLASSES = ['A+++', 'A++', 'A+', 'A', 'B', 'C', 'D'];

/** Қазақша сан форматы: 12 345,5 (бос орын — мыңдықтарды бөлгіш, үтір — ондық бөлгіш). */
function fmtNum(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(+value)) return '—';
  const n = +value;
  const fixed = Math.abs(n).toFixed(digits);
  let [int, frac = ''] = fixed.split('.');
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  frac = frac.replace(/0+$/, '');
  return (n < 0 && +fixed !== 0 ? '−' : '') + int + (frac ? ',' + frac : '');
}

/* ---------------------------------------------------------------------------
   Интерфейстер. JavaScript-те interface кілт сөзі жоқ, сондықтан интерфейсті
   «келісім» объектісі ретінде сипаттап, класс оны static INTERFACES арқылы
   «іске асырады». implementsInterface() әдістердің бар екенін тексереді.
   --------------------------------------------------------------------------- */
const Pluggable = Object.freeze({
  name: 'Pluggable', kz: 'Розеткаға қосылатын',
  methods: ['plugIn', 'unplug', 'isPluggedIn'],
});
const Heating = Object.freeze({
  name: 'Heating', kz: 'Қыздырғыш элемент',
  methods: ['maxTemperature'],
});

function implementsInterface(obj, iface) {
  const list = obj.constructor.INTERFACES || [];
  return list.includes(iface) && iface.methods.every((m) => typeof obj[m] === 'function');
}

/* ---------------------------------------------------------------------------
   Абстрактілі ата-класс
   --------------------------------------------------------------------------- */
class ElectricAppliance {
  static KZ = 'Электр құралы';
  static TYPE = null;                     // абстрактілі кластарда TYPE жоқ
  static INTERFACES = [Pluggable];
  static EXTRA_LABEL = 'Қосымша параметр';
  static EXTRA_UNIT = '';
  static FIELDS = [
    ['id', 'long', 'Идентификатор'],
    ['name', 'String', 'Атауы'],
    ['brand', 'String', 'Бренді'],
    ['power', 'double', 'Қуаты P, Вт'],
    ['voltage', 'double', 'Кернеуі U, В'],
    ['energyClass', 'EnergyClass', 'Энергия класы (A+++ … D)'],
    ['weight', 'double', 'Салмағы, кг'],
    ['extra', 'double', 'Түріне тән параметр'],
    ['hoursPerDay', 'double', 'Тәулігіне жұмыс уақыты t, сағ'],
    ['pluggedIn', 'boolean', 'Розеткаға қосулы ма'],
    ['room', 'Room', 'Бөлме'],
  ];
  static METHODS = [
    ['plugIn()', 'void', 'Розеткаға қосу'],
    ['unplug()', 'void', 'Розеткадан ажырату'],
    ['isPluggedIn()', 'boolean', 'Қосулы ма?'],
    ['current()', 'double', 'Ток күші I = P / U, А'],
    ['dailyKwh()', 'double', 'Тәуліктік энергия E = P · t / 1000, кВт·сағ'],
    ['monthlyCost(tariff)', 'double', 'Айлық төлем = E · 30 · тариф, ₸'],
    ['describe()', 'String', 'Сипаттама — абстрактілі, полиморфты'],
  ];

  constructor(d = {}) {
    if (!new.target.TYPE) {
      throw new TypeError(`${new.target.name} — абстрактілі класс, одан объект жасауға болмайды`);
    }
    this.id = d.id ?? null;
    this.name = d.name ?? '';
    this.brand = d.brand ?? '';
    this.power = +d.power || 0;
    this.voltage = +d.voltage || 220;
    this.energyClass = d.energyClass ?? 'A';
    this.weight = +d.weight || 0;
    this.extra = +d.extra || 0;
    this.hoursPerDay = +d.hoursPerDay || 0;
    this.pluggedIn = !!d.pluggedIn;
    this.room = d.room ?? null;
    this.roomId = d.roomId ?? null;
    this.image = d.image ?? '';
    this.catalogId = d.catalogId ?? null;
  }

  /* --- Pluggable --- */
  plugIn() { this.pluggedIn = true; return this; }
  unplug() { this.pluggedIn = false; return this; }
  isPluggedIn() { return this.pluggedIn; }

  /* --- Есептеулер --- */
  current() { return this.voltage ? this.power / this.voltage : 0; }
  dailyKwh() { return (this.power * this.hoursPerDay) / 1000; }
  monthlyCost(tariff) { return this.dailyKwh() * 30 * tariff; }

  /* --- Көмекші --- */
  get type() { return this.constructor.TYPE; }
  get kz() { return this.constructor.KZ; }
  get group() { return Object.getPrototypeOf(this.constructor); }
  isHeating() { return implementsInterface(this, Heating); }
  extraText() {
    const C = this.constructor;
    return `${C.EXTRA_LABEL}: ${fmtNum(this.extra)} ${C.EXTRA_UNIT}`;
  }

  /** Абстрактілі әдіс: әр ұрпақ класс өзінше жүзеге асырады (полиморфизм). */
  describe() { throw new Error('describe() — абстрактілі әдіс'); }
}

/* ---------------------------------------------------------------------------
   Санаттар — абстрактілі аралық кластар
   --------------------------------------------------------------------------- */
class KitchenAppliance extends ElectricAppliance {
  static KZ = 'Ас үй техникасы';
  static NOTE = 'Ас үйде тамақ дайындау және сақтау үшін қолданылатын құралдар.';
}
class HouseholdAppliance extends ElectricAppliance {
  static KZ = 'Тұрмыстық техника';
  static NOTE = 'Жуу, тазалау, үтіктеу сияқты үй шаруасына арналған құралдар.';
}
class MultimediaAppliance extends ElectricAppliance {
  static KZ = 'Мультимедиа техникасы';
  static NOTE = 'Ақпарат пен ойын-сауыққа арналған электроника.';
}
class ClimateAppliance extends ElectricAppliance {
  static KZ = 'Климаттық техника';
  static NOTE = 'Бөлменің температурасы мен ауасын реттейтін құралдар.';
}
class LightingAppliance extends ElectricAppliance {
  static KZ = 'Жарықтандыру';
  static NOTE = 'Бөлмені жарықтандыратын құралдар.';
}

/* ---------------------------------------------------------------------------
   Нақты кластар (объект жасауға болады)
   --------------------------------------------------------------------------- */
class Kettle extends KitchenAppliance {
  static TYPE = 'KETTLE'; static KZ = 'Электр шәйнек';
  static EXTRA_LABEL = 'Көлемі'; static EXTRA_UNIT = 'л';
  static INTERFACES = [Pluggable, Heating];
  maxTemperature() { return 100; }
  describe() {
    return `Электр шәйнек «${this.name}»: ${fmtNum(this.extra)} л суды ${this.maxTemperature()} °C-қа дейін қайнатады, қуаты ${fmtNum(this.power)} Вт.`;
  }
}
class Refrigerator extends KitchenAppliance {
  static TYPE = 'FRIDGE'; static KZ = 'Тоңазытқыш';
  static EXTRA_LABEL = 'Көлемі'; static EXTRA_UNIT = 'л';
  describe() {
    return `Тоңазытқыш «${this.name}»: ${fmtNum(this.extra)} л азықты салқындатады, тәулігіне ${fmtNum(this.hoursPerDay)} сағ компрессор жұмыс істейді.`;
  }
}
class Microwave extends KitchenAppliance {
  static TYPE = 'MICROWAVE'; static KZ = 'Микротолқынды пеш';
  static EXTRA_LABEL = 'Көлемі'; static EXTRA_UNIT = 'л';
  static INTERFACES = [Pluggable, Heating];
  maxTemperature() { return 250; }
  describe() {
    return `Микротолқынды пеш «${this.name}»: ${fmtNum(this.extra)} л камера, тағамды ${this.maxTemperature()} °C-қа дейін қыздырады.`;
  }
}
class WashingMachine extends HouseholdAppliance {
  static TYPE = 'WASHER'; static KZ = 'Кір жуғыш машина';
  static EXTRA_LABEL = 'Жүктемесі'; static EXTRA_UNIT = 'кг';
  describe() { return `Кір жуғыш машина «${this.name}»: бір жуғанда ${fmtNum(this.extra)} кг кір жуады.`; }
}
class VacuumCleaner extends HouseholdAppliance {
  static TYPE = 'VACUUM'; static KZ = 'Шаңсорғыш';
  static EXTRA_LABEL = 'Шаң ыдысы'; static EXTRA_UNIT = 'л';
  describe() { return `Шаңсорғыш «${this.name}»: ${fmtNum(this.extra)} л шаң ыдысы, сору қуаты ${fmtNum(this.power)} Вт.`; }
}
class Iron extends HouseholdAppliance {
  static TYPE = 'IRON'; static KZ = 'Үтік';
  static EXTRA_LABEL = 'Су ыдысы'; static EXTRA_UNIT = 'мл';
  static INTERFACES = [Pluggable, Heating];
  maxTemperature() { return 220; }
  describe() { return `Үтік «${this.name}»: табаны ${this.maxTemperature()} °C-қа дейін қызады, су ыдысы ${fmtNum(this.extra)} мл.`; }
}
class Television extends MultimediaAppliance {
  static TYPE = 'TV'; static KZ = 'Теледидар';
  static EXTRA_LABEL = 'Диагоналы'; static EXTRA_UNIT = 'дюйм';
  describe() { return `Теледидар «${this.name}»: экран диагоналы ${fmtNum(this.extra)} дюйм.`; }
}
class Computer extends MultimediaAppliance {
  static TYPE = 'COMPUTER'; static KZ = 'Компьютер';
  static EXTRA_LABEL = 'Жедел жады'; static EXTRA_UNIT = 'ГБ';
  describe() { return `Компьютер «${this.name}»: ${fmtNum(this.extra)} ГБ жедел жады, қоректендіру блогы ${fmtNum(this.power)} Вт.`; }
}
class AirConditioner extends ClimateAppliance {
  static TYPE = 'AIRCON'; static KZ = 'Кондиционер';
  static EXTRA_LABEL = 'Аудан'; static EXTRA_UNIT = 'м²';
  describe() { return `Кондиционер «${this.name}»: ${fmtNum(this.extra)} м² бөлмені салқындатады.`; }
}
class Heater extends ClimateAppliance {
  static TYPE = 'HEATER'; static KZ = 'Майлы жылытқыш';
  static EXTRA_LABEL = 'Аудан'; static EXTRA_UNIT = 'м²';
  static INTERFACES = [Pluggable, Heating];
  maxTemperature() { return 90; }
  describe() { return `Майлы жылытқыш «${this.name}»: ${fmtNum(this.extra)} м² бөлмені жылытады, майы ${this.maxTemperature()} °C-қа дейін қызады.`; }
}
class Fan extends ClimateAppliance {
  static TYPE = 'FAN'; static KZ = 'Желдеткіш';
  static EXTRA_LABEL = 'Аудан'; static EXTRA_UNIT = 'м²';
  describe() { return `Желдеткіш «${this.name}»: ${fmtNum(this.extra)} м² бөлмедегі ауаны айналдырады.`; }
}
class Lamp extends LightingAppliance {
  static TYPE = 'LAMP'; static KZ = 'Шам';
  static EXTRA_LABEL = 'Жарық ағыны'; static EXTRA_UNIT = 'лм';
  describe() {
    const eff = this.power ? this.extra / this.power : 0;
    return `Шам «${this.name}»: ${fmtNum(this.extra)} лм жарық береді, тиімділігі ${fmtNum(eff, 1)} лм/Вт.`;
  }
}

const GROUP_CLASSES = [KitchenAppliance, HouseholdAppliance, MultimediaAppliance, ClimateAppliance, LightingAppliance];
const APPLIANCE_CLASSES = [Kettle, Refrigerator, Microwave, WashingMachine, VacuumCleaner, Iron,
  Television, Computer, AirConditioner, Heater, Fan, Lamp];
const CLASS_BY_TYPE = Object.fromEntries(APPLIANCE_CLASSES.map((C) => [C.TYPE, C]));

/** Фабрика: JSON (сервер жауабы) → керекті класс объектісі. */
const ApplianceFactory = {
  create(data) {
    const C = CLASS_BY_TYPE[data.type];
    if (!C) throw new Error(`Белгісіз құрал түрі: ${data.type}`);
    return new C(data);
  },
};

/* ---------------------------------------------------------------------------
   Бөлме және Пәтер
   --------------------------------------------------------------------------- */
class Room {
  constructor({ id, name, sockets }) {
    this.id = id; this.name = name; this.sockets = sockets; this.appliances = [];
  }
  usedSockets() { return this.appliances.filter((a) => a.isPluggedIn()).length; }
  freeSockets() { return this.sockets - this.usedSockets(); }
  power() { return this.appliances.filter((a) => a.isPluggedIn()).reduce((s, a) => s + a.power, 0); }
  /** Тапсырманың 2-бөлімі: бос розетка болса ғана қосу. */
  plug(appliance) {
    if (appliance.isPluggedIn()) return;
    if (this.freeSockets() <= 0) throw new Error('Бұл бөлмеде бос розетка жоқ');
    appliance.plugIn();
  }
}

class Apartment {
  constructor(rooms, appliances, settings) {
    this.settings = settings;
    this.rooms = rooms.map((r) => new Room(r));
    const byId = new Map(this.rooms.map((r) => [r.id, r]));
    this.appliances = appliances.map((d) => {
      const a = ApplianceFactory.create(d);
      const room = byId.get(d.roomId);
      if (room) { a.room = room; room.appliances.push(a); }
      return a;
    });
  }
  plugged() { return this.appliances.filter((a) => a.isPluggedIn()); }
  /** Тапсырманың 3-бөлімі: тұтынылатын қуат. */
  totalPower() { return this.plugged().reduce((s, a) => s + a.power, 0); }
  totalCurrent() { return this.plugged().reduce((s, a) => s + a.current(), 0); }
  dailyKwh() { return this.plugged().reduce((s, a) => s + a.dailyKwh(), 0); }
  monthlyCost() { return this.plugged().reduce((s, a) => s + a.monthlyCost(this.settings.tariff), 0); }
  loadPercent() { return (this.totalPower() / this.settings.apartmentLimit) * 100; }
  isOverloaded() { return this.totalPower() > this.settings.apartmentLimit; }

  /** Тапсырманың 4-бөлімі: қуат бойынша сұрыптау (Comparator). */
  sortByPower(desc = false) {
    return [...this.appliances].sort((a, b) => (desc ? b.power - a.power : a.power - b.power));
  }

  /** Тапсырманың 5-бөлімі: параметрлер аралығына сәйкес құралды табу. */
  findInRange({ powerMin = 0, powerMax = Infinity, voltageMin = 0, voltageMax = Infinity } = {}) {
    return this.appliances.filter((a) => a.power >= powerMin && a.power <= powerMax
      && a.voltage >= voltageMin && a.voltage <= voltageMax);
  }
}

window.Electro = {
  ENERGY_CLASSES, fmtNum, Pluggable, Heating, implementsInterface,
  ElectricAppliance, KitchenAppliance, HouseholdAppliance, MultimediaAppliance, ClimateAppliance, LightingAppliance,
  Kettle, Refrigerator, Microwave, WashingMachine, VacuumCleaner, Iron, Television, Computer,
  AirConditioner, Heater, Fan, Lamp,
  GROUP_CLASSES, APPLIANCE_CLASSES, CLASS_BY_TYPE, ApplianceFactory, Room, Apartment,
};
