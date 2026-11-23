package com.example.electroui.fragments;

import android.content.Context;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.example.electroui.R;
import com.example.electroui.model.Apartment;
import com.example.electroui.model.ApplianceType;
import com.example.electroui.model.Category;
import com.example.electroui.model.ElectricAppliance;
import com.example.electroui.util.Images;
import com.example.electroui.util.UiUtil;
import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.google.android.material.card.MaterialCardView;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** 1-тапсырма: класс иерархиясын рефлексия арқылы ағаш түрінде көрсету. */
public class HierarchyFragment extends BaseFragment {
    private LinearLayout tree, poly;
    private TextView statClasses, statInterfaces;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle state) {
        View v = inflater.inflate(R.layout.fragment_hierarchy, container, false);
        tree = v.findViewById(R.id.tree);
        poly = v.findViewById(R.id.poly);
        statClasses = v.findViewById(R.id.stat_classes);
        statInterfaces = v.findViewById(R.id.stat_interfaces);
        UiUtil.fadeUp(v.findViewById(R.id.intro), 0);
        return v;
    }

    @Override
    protected void onDataChanged() {
        Apartment apartment = repo().load(uid());
        tree.removeAllViews();
        int primary = UiUtil.themeColor(requireContext(), androidx.appcompat.R.attr.colorPrimary);

        // Түбір: ElectricAppliance-ті кез келген нақты кластан жоғары жүріп табамыз
        Class<?> root = ApplianceType.KETTLE.sample().getClass();
        while (root.getSuperclass() != null && ElectricAppliance.class.isAssignableFrom(root.getSuperclass()))
            root = root.getSuperclass();
        tree.addView(node(root, "Электр құралы — түбір класс", primary, R.drawable.ic_bolt,
                apartment.getAppliances().size(), null, 0));

        LinearLayout level1 = branch(tree, primary);
        int delay = 1;
        for (Category c : Category.values()) {
            List<ApplianceType> types = ApplianceType.of(c);
            Class<?> middle = types.get(0).sample().getClass().getSuperclass();
            int inCategory = 0;
            for (ElectricAppliance a : apartment.getAppliances()) if (a.category() == c) inCategory++;
            level1.addView(node(middle, c.title, c.color, R.drawable.ic_category, inCategory, null, delay++));

            LinearLayout level2 = branch(level1, c.color);
            for (ApplianceType t : types) {
                ElectricAppliance sample = t.sample();
                int count = 0;
                for (ElectricAppliance a : apartment.getAppliances()) if (a.type() == t) count++;
                View leaf = node(sample.getClass(), sample.typeName(), c.color, 0, count, t, delay++);
                leaf.setOnClickListener(x -> classInfo(t));
                level2.addView(leaf);
            }
        }
        statClasses.setText("18 класс (6 абстракт)");
        statInterfaces.setText("2 интерфейс: Pluggable, Heating");

        poly.removeAllViews();
        List<ElectricAppliance> list = apartment.getAppliances();
        if (list.isEmpty()) poly.addView(line("Пәтерде құрал жоқ — «Розеткаға қосу» бөлімінде қосыңыз.", false));
        for (ElectricAppliance a : list) poly.addView(line("• [" + a.getClass().getSimpleName() + "] " + a.describe(), false));
    }

    /** Ағаштың тармағы: сол жақтағы тік сызық + ішкі түйіндер. */
    private LinearLayout branch(LinearLayout parent, int color) {
        Context c = requireContext();
        LinearLayout row = new LinearLayout(c);
        row.setOrientation(LinearLayout.HORIZONTAL);
        View rail = new View(c);
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setAlpha(110);
        g.setCornerRadius(4);
        rail.setBackground(g);
        LinearLayout.LayoutParams rp = new LinearLayout.LayoutParams(UiUtil.dp(c, 3), ViewGroup.LayoutParams.MATCH_PARENT);
        rp.setMarginStart(UiUtil.dp(c, 22));
        rp.bottomMargin = UiUtil.dp(c, 24);
        row.addView(rail, rp);
        LinearLayout children = new LinearLayout(c);
        children.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        cp.setMarginStart(UiUtil.dp(c, 10));
        row.addView(children, cp);
        parent.addView(row);
        return children;
    }

    private View node(Class<?> cls, String title, int color, int icon, int count, ApplianceType type, int order) {
        Context c = requireContext();
        MaterialCardView card = new MaterialCardView(c);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = UiUtil.dp(c, 6);
        lp.bottomMargin = UiUtil.dp(c, 4);
        card.setLayoutParams(lp);
        card.setRadius(UiUtil.dp(c, 16));
        card.setStrokeColor(color);
        card.setStrokeWidth(UiUtil.dp(c, Modifier.isAbstract(cls.getModifiers()) ? 0 : 1));

        LinearLayout row = new LinearLayout(c);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        int p = UiUtil.dp(c, 12);
        row.setPadding(p, p, p, p);

        ImageView img = new ImageView(c);
        int size = UiUtil.dp(c, type == null ? 40 : 46);
        LinearLayout.LayoutParams ip = new LinearLayout.LayoutParams(size, size);
        if (type != null) {
            img.setImageResource(Images.forType(type));
            img.setScaleType(ImageView.ScaleType.CENTER_CROP);
            img.setClipToOutline(true);
            GradientDrawable round = new GradientDrawable();
            round.setCornerRadius(UiUtil.dp(c, 12));
            img.setBackground(round);
        } else {
            GradientDrawable circle = new GradientDrawable();
            circle.setShape(GradientDrawable.OVAL);
            circle.setColor(color);
            img.setBackground(circle);
            img.setImageResource(icon);
            img.setColorFilter(0xFFFFFFFF);
            int ipad = UiUtil.dp(c, 9);
            img.setPadding(ipad, ipad, ipad, ipad);
        }
        row.addView(img, ip);

        LinearLayout texts = new LinearLayout(c);
        texts.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams tp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        tp.setMarginStart(UiUtil.dp(c, 12));
        TextView name = new TextView(c);
        boolean isAbstract = Modifier.isAbstract(cls.getModifiers());
        name.setText((isAbstract ? "abstract " : "") + "class " + cls.getSimpleName());
        name.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        name.setTextSize(13);
        name.setTextColor(color);
        TextView sub = new TextView(c);
        sub.setText(title);
        sub.setTextSize(15);
        sub.setTypeface(Typeface.DEFAULT_BOLD);
        sub.setTextColor(UiUtil.themeColor(c, com.google.android.material.R.attr.colorOnSurface));
        TextView meta = new TextView(c);
        StringBuilder m = new StringBuilder();
        if (cls.getSuperclass() != null && cls.getSuperclass() != Object.class)
            m.append("extends ").append(cls.getSuperclass().getSimpleName());
        for (Class<?> i : cls.getInterfaces()) m.append(m.length() > 0 ? " · " : "").append("implements ").append(i.getSimpleName());
        if (m.length() == 0) m.append("extends Object");
        meta.setText(m);
        meta.setTextSize(11);
        meta.setTypeface(Typeface.MONOSPACE);
        meta.setTextColor(UiUtil.themeColor(c, com.google.android.material.R.attr.colorOnSurfaceVariant));
        texts.addView(name);
        texts.addView(sub);
        texts.addView(meta);
        row.addView(texts, tp);

        TextView badge = new TextView(c);
        badge.setText(String.valueOf(count));
        badge.setTextColor(0xFFFFFFFF);
        badge.setTypeface(Typeface.DEFAULT_BOLD);
        badge.setGravity(Gravity.CENTER);
        badge.setMinWidth(UiUtil.dp(c, 28));
        badge.setPadding(UiUtil.dp(c, 6), UiUtil.dp(c, 2), UiUtil.dp(c, 6), UiUtil.dp(c, 2));
        GradientDrawable bb = new GradientDrawable();
        bb.setCornerRadius(100);
        bb.setColor(count > 0 ? color : 0xFF9AA6C2);
        badge.setBackground(bb);
        row.addView(badge);
        card.addView(row);
        card.setContentDescription(cls.getSimpleName() + ", пәтерде " + count);
        UiUtil.fadeUp(card, 40L * order);
        return card;
    }

    private TextView line(String text, boolean mono) {
        TextView t = new TextView(requireContext());
        t.setText(text);
        t.setTextSize(13);
        t.setPadding(0, UiUtil.dp(requireContext(), 4), 0, UiUtil.dp(requireContext(), 4));
        t.setTextColor(UiUtil.themeColor(requireContext(), com.google.android.material.R.attr.colorOnSurface));
        if (mono) t.setTypeface(Typeface.MONOSPACE);
        return t;
    }

    /** Нақты кластың рефлексиядан алынған ақпараты. */
    private void classInfo(ApplianceType type) {
        ElectricAppliance sample = null;
        for (ElectricAppliance a : repo().catalog()) if (a.type() == type) { sample = a; break; }
        if (sample == null) sample = type.create();
        Class<?> cls = sample.getClass();

        StringBuilder code = new StringBuilder();
        code.append("public class ").append(cls.getSimpleName()).append("\n    extends ").append(cls.getSuperclass().getSimpleName());
        if (cls.getInterfaces().length > 0) {
            code.append("\n    implements ");
            for (int i = 0; i < cls.getInterfaces().length; i++)
                code.append(i == 0 ? "" : ", ").append(cls.getInterfaces()[i].getSimpleName());
        }
        code.append(" {\n");
        List<String> methods = new ArrayList<>();
        for (Method m : cls.getDeclaredMethods()) {
            if (m.isSynthetic() || m.getName().contains("$")) continue;
            methods.add("    " + m.getReturnType().getSimpleName() + " " + m.getName() + "()");
        }
        Collections.sort(methods);
        for (String m : methods) code.append(m).append("\n");
        code.append("}\n\n// Ата-класынан мұраға алынған өрістер:\n");
        List<String> fields = new ArrayList<>();
        for (Field f : ElectricAppliance.class.getDeclaredFields())
            if (!Modifier.isStatic(f.getModifiers()) && !f.isSynthetic())
                fields.add(f.getType().getSimpleName() + " " + f.getName());
        code.append(String.join(", ", fields));

        Context c = requireContext();
        BottomSheetDialog d = new BottomSheetDialog(c);
        LinearLayout box = new LinearLayout(c);
        box.setOrientation(LinearLayout.VERTICAL);
        int p = UiUtil.dp(c, 20);
        box.setPadding(p, p, p, p);
        TextView title = new TextView(c);
        title.setText(sample.typeName() + " — " + cls.getSimpleName());
        title.setTextSize(20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextColor(UiUtil.themeColor(c, com.google.android.material.R.attr.colorOnSurface));
        box.addView(title);
        TextView path = line("Иерархия: " + String.join(" → ", sample.hierarchyPath()), false);
        box.addView(path);
        TextView codeView = new TextView(c);
        codeView.setText(code);
        codeView.setTypeface(Typeface.MONOSPACE);
        codeView.setTextSize(12);
        codeView.setTextColor(0xFFC7D2FE);
        codeView.setBackgroundResource(R.drawable.bg_code);
        int cp = UiUtil.dp(c, 12);
        codeView.setPadding(cp, cp, cp, cp);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.topMargin = UiUtil.dp(c, 10);
        box.addView(codeView, lp);
        box.addView(line("Қосымша параметр: " + sample.extraLabel() + ", " + sample.extraUnit(), false));
        box.addView(line("describe() нәтижесі (каталогтағы үлгі):\n" + sample.describe(), false));
        androidx.core.widget.NestedScrollView scroll = new androidx.core.widget.NestedScrollView(c);
        scroll.addView(box);
        d.setContentView(scroll);
        d.show();
    }
}
