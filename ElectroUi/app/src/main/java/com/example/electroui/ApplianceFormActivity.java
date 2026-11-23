package com.example.electroui;

import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.ImageView;
import android.widget.TextView;

import com.example.electroui.data.ApplianceRepository;
import com.example.electroui.data.Session;
import com.example.electroui.model.AppNotification;
import com.example.electroui.model.ApplianceType;
import com.example.electroui.model.ElectricAppliance;
import com.example.electroui.model.Room;
import com.example.electroui.model.User;
import com.example.electroui.util.Alerts;
import com.example.electroui.util.Fmt;
import com.example.electroui.util.Images;
import com.example.electroui.util.UiUtil;
import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.textfield.MaterialAutoCompleteTextView;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Құрал қосу / өзгерту. Әкімші үшін — каталог үлгісін қосу / өзгерту. */
public class ApplianceFormActivity extends BaseActivity {
    public static final String EXTRA_ID = "appliance_id";
    public static final String EXTRA_ROOM = "room_id";
    public static final String EXTRA_CATALOG_MODE = "catalog_mode";
    public static final String EXTRA_CATALOG_ID = "catalog_id";

    private ApplianceRepository repo;
    private User user;
    private boolean catalogMode;
    private long editId, catalogEditId;
    private ElectricAppliance editing;
    private ApplianceType type = ApplianceType.KETTLE;
    private List<Room> rooms = new ArrayList<>();
    private List<ElectricAppliance> catalog = new ArrayList<>();
    private long roomId;
    private String energy = "A";

    private ImageView preview;
    private TextView previewType, previewPath;
    private MaterialAutoCompleteTextView inCatalog, inType, inEnergy, inRoom;
    private TextInputEditText inName, inBrand, inPower, inVoltage, inWeight, inExtra, inHours;
    private TextInputLayout lName, lPower, lVoltage, lWeight, lExtra, lHours, lRoom;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        user = Session.user(this);
        if (user == null) {
            finish();
            return;
        }
        setContentView(R.layout.activity_appliance_form);
        UiUtil.insets(findViewById(R.id.appbar), true, false);
        UiUtil.insets(findViewById(R.id.scroll), false, true);
        repo = new ApplianceRepository(this);

        catalogEditId = getIntent().getLongExtra(EXTRA_CATALOG_ID, 0);
        catalogMode = (getIntent().getBooleanExtra(EXTRA_CATALOG_MODE, false) || catalogEditId != 0) && user.isAdmin();
        editId = getIntent().getLongExtra(EXTRA_ID, 0);
        roomId = getIntent().getLongExtra(EXTRA_ROOM, 0);

        MaterialToolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());
        toolbar.setTitle(catalogMode ? (catalogEditId != 0 ? "Каталог үлгісін өзгерту" : "Каталогқа үлгі қосу")
                : (editId != 0 ? "Құралды өзгерту" : "Пәтерге құрал қосу"));

        bindViews();
        setupDropdowns();

        if (editId != 0) {
            editing = repo.get(editId);
            if (editing == null) {
                finish();
                return;
            }
            fill(editing);
            roomId = editing.getRoomId();
        } else if (catalogEditId != 0) {
            ElectricAppliance c = repo.catalogItem(catalogEditId);
            if (c != null) fill(c);
        } else {
            fill(type.create());
            inName.setText("");
        }
        selectRoom(roomId);
        findViewById(R.id.btn_save).setOnClickListener(v -> save());
    }

    private void bindViews() {
        preview = findViewById(R.id.preview);
        previewType = findViewById(R.id.preview_type);
        previewPath = findViewById(R.id.preview_path);
        inCatalog = findViewById(R.id.input_catalog);
        inType = findViewById(R.id.input_type);
        inEnergy = findViewById(R.id.input_energy);
        inRoom = findViewById(R.id.input_room);
        inName = findViewById(R.id.input_name);
        inBrand = findViewById(R.id.input_brand);
        inPower = findViewById(R.id.input_power);
        inVoltage = findViewById(R.id.input_voltage);
        inWeight = findViewById(R.id.input_weight);
        inExtra = findViewById(R.id.input_extra);
        inHours = findViewById(R.id.input_hours);
        lName = findViewById(R.id.name_layout);
        lPower = findViewById(R.id.power_layout);
        lVoltage = findViewById(R.id.voltage_layout);
        lWeight = findViewById(R.id.weight_layout);
        lExtra = findViewById(R.id.extra_layout);
        lHours = findViewById(R.id.hours_layout);
        lRoom = findViewById(R.id.room_layout);
    }

    private void setupDropdowns() {
        List<String> types = new ArrayList<>();
        for (ApplianceType t : ApplianceType.values())
            types.add(t.title() + "  ·  " + t.sample().getClass().getSimpleName());
        inType.setSimpleItems(types.toArray(new String[0]));
        inType.setOnItemClickListener((p, v, pos, id) -> {
            type = ApplianceType.values()[pos];
            updateTypeUi();
            if (text(inHours).isEmpty()) inHours.setText(Fmt.num(type.sample().defaultHours()).replace(',', '.'));
        });

        inEnergy.setSimpleItems(ElectricAppliance.ENERGY_CLASSES.toArray(new String[0]));
        inEnergy.setOnItemClickListener((p, v, pos, id) -> energy = ElectricAppliance.ENERGY_CLASSES.get(pos));

        if (catalogMode) {
            findViewById(R.id.catalog_layout).setVisibility(View.GONE);
            lRoom.setVisibility(View.GONE);
        } else {
            catalog = repo.catalog();
            List<String> names = new ArrayList<>();
            for (ElectricAppliance c : catalog) names.add(c.getName() + " — " + Fmt.watts(c.getPower()));
            inCatalog.setSimpleItems(names.toArray(new String[0]));
            inCatalog.setOnItemClickListener((p, v, pos, id) -> {
                fill(catalog.get(pos));
                UiUtil.pulse(preview);
            });
            rooms = repo.rooms(user.id);
            List<String> roomNames = new ArrayList<>();
            for (Room r : rooms) roomNames.add(r.getName() + " (" + r.getSockets() + " розетка)");
            inRoom.setSimpleItems(roomNames.toArray(new String[0]));
            inRoom.setOnItemClickListener((p, v, pos, id) -> roomId = rooms.get(pos).getId());
        }
    }

    private void selectRoom(long id) {
        if (catalogMode || rooms.isEmpty()) return;
        int index = 0;
        for (int i = 0; i < rooms.size(); i++) if (rooms.get(i).getId() == id) index = i;
        roomId = rooms.get(index).getId();
        inRoom.setText(rooms.get(index).getName() + " (" + rooms.get(index).getSockets() + " розетка)", false);
    }

    private void fill(ElectricAppliance a) {
        type = a.type();
        inType.setText(type.title() + "  ·  " + a.getClass().getSimpleName(), false);
        inName.setText(a.getName());
        inBrand.setText(a.getBrand());
        inPower.setText(a.getPower() == 0 ? "" : String.valueOf(a.getPower()));
        inVoltage.setText(String.valueOf(a.getVoltage()));
        energy = a.getEnergyClass();
        inEnergy.setText(energy, false);
        inWeight.setText(a.getWeight() == 0 ? "" : plain(a.getWeight()));
        inExtra.setText(a.getExtra() == 0 ? "" : plain(a.getExtra()));
        inHours.setText(plain(a.getHoursPerDay()));
        updateTypeUi();
    }

    private void updateTypeUi() {
        ElectricAppliance s = type.sample();
        preview.setImageResource(Images.forType(type));
        previewType.setText(s.typeName() + " · " + s.category().title);
        previewPath.setText(String.join(" → ", s.hierarchyPath()));
        lExtra.setHint(s.extraLabel());
        lExtra.setSuffixText(s.extraUnit());
    }

    private static String plain(double v) {
        if (v == Math.rint(v)) return String.valueOf((long) v);
        return String.format(Locale.US, "%.2f", v).replaceAll("0+$", "");
    }

    private static String text(TextInputEditText e) {
        return e.getText() == null ? "" : e.getText().toString().trim();
    }

    private Double number(TextInputEditText e, TextInputLayout l, double min, double max, String msg) {
        try {
            double v = Double.parseDouble(text(e).replace(',', '.'));
            if (v < min || v > max) throw new NumberFormatException();
            return v;
        } catch (NumberFormatException ex) {
            l.setError(msg);
            return null;
        }
    }

    private void save() {
        for (TextInputLayout l : new TextInputLayout[]{lName, lPower, lVoltage, lWeight, lExtra, lHours, lRoom}) l.setError(null);
        String name = text(inName);
        if (name.length() < 2) lName.setError("Атауын жазыңыз");
        Double power = number(inPower, lPower, 1, 10000, "1 – 10 000 Вт");
        Double voltage = number(inVoltage, lVoltage, 1, 400, "1 – 400 В");
        Double weight = text(inWeight).isEmpty() ? Double.valueOf(0) : number(inWeight, lWeight, 0, 500, "0 – 500 кг");
        Double extra = text(inExtra).isEmpty() ? Double.valueOf(0) : number(inExtra, lExtra, 0, 100000, "Теріс болмауы керек");
        Double hours = number(inHours, lHours, 0, 24, "0 – 24 сағ");
        if (!catalogMode && roomId == 0) lRoom.setError("Бөлмені таңдаңыз");
        if (name.length() < 2 || power == null || voltage == null || weight == null || extra == null || hours == null
                || (!catalogMode && roomId == 0)) {
            UiUtil.shake(findViewById(R.id.btn_save));
            return;
        }

        ElectricAppliance a = type.create(); // фабрика: таңдалған түр → нақты класс
        a.setName(name);
        a.setBrand(text(inBrand).isEmpty() ? "—" : text(inBrand));
        a.setPower((int) Math.round(power));
        a.setVoltage((int) Math.round(voltage));
        a.setEnergyClass(energy);
        a.setWeight(weight);
        a.setExtra(extra);
        a.setHoursPerDay(hours);

        if (catalogMode) {
            if (catalogEditId != 0) {
                a.setId(catalogEditId);
                repo.updateCatalog(a);
            } else repo.addCatalog(a);
            Alerts.push(this, user.id, "Каталог жаңартылды", "«" + a.getName() + "» үлгісі сақталды.", AppNotification.INFO, false);
        } else if (editing != null) {
            a.setId(editing.getId());
            a.setRoomId(roomId);
            if (editing.isPluggedIn() && editing.getRoomId() != roomId) repo.setPlugged(user.id, editing.getId(), false);
            repo.update(a);
            Alerts.push(this, user.id, "Құрал өзгертілді", "«" + a.getName() + "» деректері жаңартылды.", AppNotification.INFO, false);
        } else {
            a.setRoomId(roomId);
            repo.add(user.id, a);
            Alerts.push(this, user.id, "Жаңа құрал қосылды",
                    a.typeName() + " «" + a.getName() + "» (" + Fmt.watts(a.getPower()) + ") пәтерге қосылды. Енді оны розеткаға қоса аласыз.",
                    AppNotification.SUCCESS, false);
        }
        finish();
    }
}
