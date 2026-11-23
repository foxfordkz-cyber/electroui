package com.example.electroui.model;

/** 3-деңгей: шаңсорғыш. */
public class VacuumCleaner extends HouseholdAppliance {
    @Override public ApplianceType type() { return ApplianceType.VACUUM; }
    @Override public String typeName() { return "Шаңсорғыш"; }
    @Override public String extraLabel() { return "Шаң ыдысы"; }
    @Override public String extraUnit() { return "л"; }
    @Override public double defaultHours() { return 0.3; }

    @Override
    public String describe() {
        return typeName() + " «" + getName() + "» — " + getPower() + " Вт, шаң ыдысы " + number(getExtra())
                + " л. Жұмыс кезінде ғана розеткаға қосылады.";
    }
}
