package com.example.electroui.fragments;

import android.app.Dialog;
import android.net.Uri;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.MediaController;
import android.widget.TextView;
import android.widget.VideoView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.electroui.R;
import com.example.electroui.util.UiUtil;
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;

/** Видео (res/raw, VideoView) және суреттер галереясы (Wikimedia Commons). */
public class MediaFragment extends BaseFragment {
    /** {raw ресурсы, атауы, сипаттамасы, дереккөзі, постер} */
    private static final Object[][] VIDEOS = {
            {R.raw.video_iron_unplug, "Розеткадан ажырату", "Үтікпен жұмыс біткен соң оны міндетті түрде розеткадан ажыратыңыз — қыздырғыш элементі бар құралдарды (Heating) қараусыз қалдыруға болмайды.", "Видео: Mixkit (Mixkit Free License) — «Man's hand disconnecting the iron for safety»", R.drawable.img_iron},
            {R.raw.video_bulb_on, "Шамның жануы", "Шамды қосқанда желіден ток жүреді: 10 Вт LED шам I = 10 / 220 ≈ 0,05 А ғана алады.", "Видео: Mixkit (Mixkit Free License) — «Close-up of a light bulb being switched on»", R.drawable.img_lamp},
            {R.raw.video_kettle_pour, "Электр шәйнек", "Шәйнек — үйдегі ең қуатты құралдардың бірі (2 000–2 400 Вт). Керегінше ғана су қайнатыңыз.", "Видео: Mixkit (Mixkit Free License) — «Pouring hot water from a kettle»", R.drawable.img_kettle},
            {R.raw.video_power_lines, "Электр желілері", "Электр энергиясы электр станциясынан желілер арқылы үйдің электр щитіне, одан әрі розеткаларға жетеді.", "Видео: Mixkit (Mixkit Free License) — «Electric power lines in the field at sunset»", R.drawable.img_panel},
    };
    /** {сурет, атауы, авторы · лицензиясы} */
    private static final Object[][] PHOTOS = {
            {R.drawable.img_kettle, "Электр шәйнек", "Jacek Halicki · CC BY-SA 4.0"},
            {R.drawable.img_fridge, "Тоңазытқыш", "Dinkun Chen · CC BY-SA 4.0"},
            {R.drawable.img_microwave, "Микротолқынды пеш", "Dinkun Chen · CC BY-SA 4.0"},
            {R.drawable.img_washer, "Кір жуғыш машина", "Gb.select · CC BY-SA 4.0"},
            {R.drawable.img_vacuum, "Шаңсорғыш", "ミトン · CC BY-SA 4.0"},
            {R.drawable.img_iron, "Үтік", "Lombroso · CC BY-SA 4.0"},
            {R.drawable.img_tv, "Теледидар", "Dinkun Chen · CC BY-SA 4.0"},
            {R.drawable.img_computer, "Компьютер", "SankalpSasnur · CC0"},
            {R.drawable.img_aircon, "Кондиционер", "Dinkun Chen · CC BY-SA 4.0"},
            {R.drawable.img_heater, "Майлы жылытқыш", "Ashley Pomeroy · CC BY 3.0"},
            {R.drawable.img_fan, "Желдеткіш", "Berthold Werner · CC BY-SA 4.0"},
            {R.drawable.img_lamp, "LED шам", "Loadmaster (David R. Tribble) · CC BY-SA 4.0"},
            {R.drawable.img_panel, "Электр щиті", "Shixart1985 · CC BY 2.0"},
            {R.drawable.img_hero, "Заманауи ас үй", "Shixart1985 · CC BY 2.0"},
    };
    private static final String[][] TIPS = {
            {"Күту режимі", "Теледидар, компьютер, зарядтағыш өшірулі тұрса да 1–5 Вт тұтынады. Жылына бұл ~40 кВт·сағ."},
            {"LED шамдар", "10 Вт LED шам 75 Вт қыздыру шамымен бірдей жарық береді — 7 есе үнемді."},
            {"Энергия класы", "A+++ класты тоңазытқыш D класына қарағанда жылына 300 кВт·сағ-қа дейін аз жұмсайды."},
            {"Бір розетка — бір қуатты құрал", "Шәйнек (2 200 Вт) пен жылытқышты (2 000 Вт) бір желіге қоспаңыз: 4 200 Вт > 3 500 Вт шегі."},
            {"Кір жуу", "Толық жүктеп, 30–40 °C-та жуыңыз — энергияның 90%-ы суды қыздыруға кетеді."},
    };

    private VideoView video;
    private ImageView poster, play;
    private TextView caption, credit;
    private int current;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container, @Nullable Bundle state) {
        View v = inflater.inflate(R.layout.fragment_media, container, false);
        video = v.findViewById(R.id.video);
        poster = v.findViewById(R.id.poster);
        play = v.findViewById(R.id.play);
        caption = v.findViewById(R.id.video_caption);
        credit = v.findViewById(R.id.video_credit);

        MediaController controller = new MediaController(requireContext());
        controller.setAnchorView(v.findViewById(R.id.video_frame));
        video.setMediaController(controller);
        video.setOnPreparedListener(mp -> mp.setLooping(true));
        video.setOnErrorListener((mp, what, extra) -> {
            main().snack("Видеоны ойнату мүмкін болмады");
            showPoster();
            return true;
        });
        View.OnClickListener start = b -> startVideo();
        play.setOnClickListener(start);
        poster.setOnClickListener(start);

        ChipGroup chips = v.findViewById(R.id.videos);
        for (int i = 0; i < VIDEOS.length; i++) {
            Chip c = (Chip) inflater.inflate(R.layout.chip_filter, chips, false);
            c.setId(View.generateViewId());
            c.setText((String) VIDEOS[i][1]);
            c.setTag(i);
            chips.addView(c);
            if (i == 0) c.setChecked(true);
        }
        chips.setOnCheckedStateChangeListener((g, ids) -> {
            if (!ids.isEmpty()) select((Integer) g.findViewById(ids.get(0)).getTag(), true);
        });
        select(0, false);

        RecyclerView gallery = v.findViewById(R.id.gallery);
        gallery.setLayoutManager(new LinearLayoutManager(requireContext(), RecyclerView.HORIZONTAL, false));
        gallery.setAdapter(new RecyclerView.Adapter<RecyclerView.ViewHolder>() {
            @NonNull
            @Override
            public RecyclerView.ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int type) {
                return new RecyclerView.ViewHolder(LayoutInflater.from(parent.getContext()).inflate(R.layout.item_photo, parent, false)) { };
            }

            @Override
            public void onBindViewHolder(@NonNull RecyclerView.ViewHolder h, int pos) {
                Object[] p = PHOTOS[pos];
                ((ImageView) h.itemView.findViewById(R.id.photo)).setImageResource((Integer) p[0]);
                ((TextView) h.itemView.findViewById(R.id.photo_title)).setText((String) p[1]);
                ((TextView) h.itemView.findViewById(R.id.photo_credit)).setText((String) p[2]);
                h.itemView.setOnClickListener(x -> zoom(p));
            }

            @Override
            public int getItemCount() {
                return PHOTOS.length;
            }
        });

        LinearLayout tips = v.findViewById(R.id.tips);
        for (String[] t : TIPS) {
            View row = inflater.inflate(R.layout.item_tip, tips, false);
            ((TextView) row.findViewById(R.id.tip_title)).setText(t[0]);
            ((TextView) row.findViewById(R.id.tip_body)).setText(t[1]);
            tips.addView(row);
        }
        UiUtil.fadeUp(v.findViewById(R.id.video_card), 0);
        return v;
    }

    private void select(int index, boolean autoplay) {
        current = index;
        Object[] item = VIDEOS[index];
        caption.setText((String) item[2]);
        credit.setText((String) item[3]);
        poster.setImageResource((Integer) item[4]);
        showPoster();
        video.setVideoURI(Uri.parse("android.resource://" + requireContext().getPackageName() + "/" + item[0]));
        if (autoplay) startVideo();
    }

    /** Постер тек ойнату басталғанда жасырылады. */
    private void startVideo() {
        play.setVisibility(View.GONE);
        poster.animate().alpha(0f).setDuration(250).withEndAction(() -> poster.setVisibility(View.GONE)).start();
        video.start();
    }

    private void showPoster() {
        poster.animate().cancel();
        poster.setAlpha(1f);
        poster.setVisibility(View.VISIBLE);
        play.setVisibility(View.VISIBLE);
    }

    private void zoom(Object[] p) {
        View v = LayoutInflater.from(requireContext()).inflate(R.layout.item_photo, null, false);
        ImageView img = v.findViewById(R.id.photo);
        img.getLayoutParams().height = UiUtil.dp(requireContext(), 320);
        img.setScaleType(ImageView.ScaleType.FIT_CENTER);
        img.setBackgroundColor(0xFF000000);
        img.setImageResource((Integer) p[0]);
        ((TextView) v.findViewById(R.id.photo_title)).setText((String) p[1]);
        ((TextView) v.findViewById(R.id.photo_credit)).setText((String) p[2] + "\nДереккөзі: commons.wikimedia.org");
        v.getLayoutParams();
        Dialog d = new MaterialAlertDialogBuilder(requireContext()).setView(v).setPositiveButton("Жабу", null).create();
        d.show();
    }

    @Override
    public void onPause() {
        super.onPause();
        if (video.isPlaying()) video.pause();
        showPoster();
    }
}
