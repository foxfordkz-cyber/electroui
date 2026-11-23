package com.example.electroui.util;

import android.content.Context;

import com.example.electroui.data.ApplianceRepository;
import com.example.electroui.data.NotificationRepository;
import com.example.electroui.data.Session;
import com.example.electroui.data.SettingsRepository;
import com.example.electroui.model.AppNotification;
import com.example.electroui.model.PlugResult;

/** Хабарлама: дерекқорға жазу + жүйелік Notification + экрандарды жаңарту. */
public final class Alerts {
    private Alerts() {
    }

    public static void push(Context c, long userId, String title, String body, String kind, boolean system) {
        new NotificationRepository(c).add(userId, title, body, kind);
        if (system && userId == Session.userId(c)) Notifier.show(c, title, body, kind);
        DataBus.changed();
    }

    /** Розеткаға қосу/ажырату + шамадан тыс жүктеме болса ескерту. Барлық экран осыны шақырады. */
    public static PlugResult plug(Context c, long userId, long applianceId, boolean plug) {
        PlugResult r = new ApplianceRepository(c).setPlugged(userId, applianceId, plug);
        if (r.ok && (r.apartmentOverload || r.roomOverload)) {
            SettingsRepository s = new SettingsRepository(c);
            String title, body;
            if (r.apartmentOverload) {
                title = "Желі шамадан тыс жүктелді!";
                body = "Пәтердегі қосулы қуат " + Fmt.watts(r.totalPower) + ", ал кіріс автоматының шегі "
                        + Fmt.watts(s.limit()) + ". Автомат сөнуі мүмкін — қуатты құралдың бірін ажыратыңыз.";
            } else {
                title = "Бөлме желісі қызып тұр";
                body = "Бір бөлмеде " + Fmt.watts(r.roomPower) + " қосулы, розетка желісінің шегі "
                        + Fmt.watts(s.roomLimit()) + " (16 А). Құралдарды басқа бөлмеге ауыстырыңыз.";
            }
            push(c, userId, title, body, AppNotification.WARNING, true);
        }
        DataBus.changed();
        return r;
    }
}
