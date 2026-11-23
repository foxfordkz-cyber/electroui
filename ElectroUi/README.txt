ЭлектроҮй — «Үйдегі электр құралдары» (Android, Java)
=====================================================

ТАПСЫРМА
3. Үйдегі электр құралдары. Электр құралдарының иерархиясын анықтау. Кейбірін
розеткаға қосу. Тұтынылатын қуатты есептеу. Пәтердегі құралдарды қуат бойынша
сұрыптау. Берілген параметрлер диапазонына сай құралды табу.

АШУ ЖӘНЕ ІСКЕ ҚОСУ
• Android Studio → Open → ElectroUi бумасы → Gradle синхрондалғанын күтіңіз → Run.
• Немесе дайын APK: ElectroUi.apk (Android 8.0 және жоғары).
• Командамен жинау: gradlew.bat assembleDebug → app\build\outputs\apk\debug\app-debug.apk
• Android SDK 36, Java 17, AGP 9.1.1, Material 3. Интернет қажет емес — бәрі телефонның ішінде.

ДЕМО АККАУНТТАР (кіру бетіндегі чипті басса, өзі толады)
• Әкімші: admin / Admin123!
• Клиент:  aru / Aru12345!  (пәтерде 13 құрал, 4-уі розеткада, 2 470 Вт)
• Жаңа аккаунт «Тіркелу» арқылы ашылады — ол әрқашан «Клиент» рөлімен ашылады.

ТАПСЫРМА ҚАЙ ЖЕРДЕ ОРЫНДАЛҒАН
1) Иерархия — бүйірлік мәзір → «1. Құралдар иерархиясы».
   Ағаш Java рефлексиясы арқылы (getSuperclass, getInterfaces) нақты кластардан салынады.
   ElectricAppliance (abstract, implements Pluggable)
     ├─ KitchenAppliance (abstract)    → Kettle (Heating), Refrigerator, Microwave
     ├─ HouseholdAppliance (abstract)  → WashingMachine, VacuumCleaner, Iron (Heating)
     ├─ MultimediaAppliance (abstract) → Television, Computer
     ├─ ClimateAppliance (abstract)    → AirConditioner, Heater (Heating), Fan
     └─ LightingAppliance (abstract)   → Lamp
   Барлығы 18 класс (6 абстракт) + 2 интерфейс. Әр класс describe() әдісін өзгертеді (полиморфизм).
   Код: app/src/main/java/com/example/electroui/model/
2) Розеткаға қосу — «2. Розеткаға қосу»: ауыстырғышты басыңыз.
   Әр бөлмеде розетка саны шектеулі (Ас үй 4, Қонақ бөлме 5, Жатын бөлме 3, Жуынатын бөлме 2).
   Бос розетка болмаса қосылмайды. 3D пәтерде құралды басып та қосуға болады.
3) Қуатты есептеу — «3. Қуатты есептеу»: P = ΣPᵢ, I = P/U, E = ΣPᵢ·tᵢ/1000, құны = E·30·тариф.
   Кесте, қадамдап есептеу және желі жүктемесі. Код: model/Apartment.java
4) Сұрыптау — «4. Қуат бойынша сұрыптау»: Comparator арқылы (↑/↓), қосымша критерийлер.
   Код: model/SortMode.java, Apartment.sort()
5) Диапазон бойынша іздеу — «5. Диапазон бойынша іздеу»: қуат, кернеу, салмақ, сағат
   сырғытпалары + энергия класы, санат, бөлме. SQLite-та BETWEEN сұранысы орындалады және
   экранда SQL мәтіні көрсетіледі. Код: model/SearchCriteria.java, data/ApplianceRepository.search()

ҚОСЫМША ТАЛАПТАР
• Тіркелу / кіру — LoginActivity, RegisterActivity (тексеру, құпиясөз беріктігі, 5 қате → 30 с бұғат).
• Хэштеу — data/PasswordHasher.java: PBKDF2-HMAC-SHA256, 60 000 итерация, 16 байт кездейсоқ тұз.
  Дерекқорда құпиясөз жоқ, тек salt + hash (Профиль бетінде көрсетіледі).
• Рөлдер — ADMIN және CLIENT. Әкімші панелі: пайдаланушылар (рөл беру, бұғаттау, жою,
  хабарлама), құралдар каталогы (CRUD), SQL статистика (COUNT, SUM, AVG, GROUP BY, HAVING,
  JOIN, ішкі сұраныс, CASE), барлық клиентке хабарлама жіберу, тариф пен қуат шектеулері.
• SQL дерекқоры — data/DbHelper.java (SQLiteOpenHelper), electroui.db:
  users, rooms, catalog, appliances, notifications, events, settings. FOREIGN KEY + ON DELETE CASCADE.
• Хабарламалар (Notification) — util/Notifier.java: 2 арна. Желі шамадан тыс жүктелгенде
  (7 000 Вт-тан көп немесе бір бөлмеде 3 500 Вт-тан көп) жүйелік ескерту шығады.
  Қосымша ішінде — «Хабарламалар» бөлімі және қоңыраудағы сан.
• Бүйірлік мәзір (sidebar) — DrawerLayout + NavigationView, тақырыпшада аватар, рөл, қосулы қуат.
• Фрагменттер — fragments/ бумасында 14 фрагмент, бәрі MainActivity ішінде ауысады.
• Activity-лер — SplashActivity, LoginActivity, RegisterActivity, MainActivity, ApplianceFormActivity.
• Тақырыптар — жарық / қараңғы / жүйелік + 4 акцент түс (Баптаулар). util/ThemeManager.java
• 3D — «3D пәтер»: WebView + three.js (assets/3d/index.html). JavaScript ↔ Java көпірі
  (window.Android.data / toggle / details) — 3D-да қосқан құрал дерекқорға жазылады.
  Сонымен қатар бастапқы экранда 3D айналатын белгі (ObjectAnimator rotationX/Y).
• Видео мен суреттер — «Видео мен суреттер»: VideoView (res/raw, 4 видео), галерея (14 сурет).

ФАЙЛДАР
model/      — кластар иерархиясы, Apartment, Room, SearchCriteria, SortMode, User
data/       — DbHelper, PasswordHasher, Session, *Repository (SQL сұраныстар)
fragments/  — экрандар (Home, Hierarchy, Apartment, Calculation, Sort, Search, 3D, Media,
              Notifications, Profile, Settings, AdminUsers, AdminCatalog, AdminStats)
ui/         — PowerGaugeView, BarChartView (өз диаграммалары), ApplianceAdapter, ApplianceSheet
util/       — Notifier, Alerts, ThemeManager, Fmt, DataBus, UiUtil
assets/3d/  — index.html (3D сахна) және three.min.js (MIT)

ДЕРЕККӨЗДЕР
• Суреттер: Wikimedia Commons (ашық лицензиялар) — IMAGE_SOURCES.txt
• Видеолар: Mixkit (Mixkit Free License)
• 3D кітапхана: three.js r149 (MIT)

ВЕБ-НҰСҚА
Сол тапсырманың сайты: ..\electroui_web (start.bat → http://localhost:8090).
Сайттағы «Видео мен суреттер» бетінен осы APK-ны жүктеп алуға болады.
