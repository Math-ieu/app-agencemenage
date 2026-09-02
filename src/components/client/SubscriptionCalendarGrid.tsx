import React, { useState } from 'react';
import { format, parseISO, addDays, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, isSameDay, isSameMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Demande } from '../../types';
import { createPlanningIntervention, updateDemande, deleteDemande } from '../../api/client';
import { parseDateRobust, getDemandeStartDate } from '../../utils/pricing';

export interface DateOverrideItem {
  heure?: string;
  heure_fin?: string;
  excluded?: boolean;
  statut?: "termine" | "annule" | "a_recuperer" | "reporte" | null;
  reprogrammed_to?: string | null;
  reprogrammed_from?: string | null;
}

export interface SubscriptionCalendarGridProps {
  calMonth: Date;
  parentDemande?: Demande;
  aboDateDebut?: string;
  dateFinAuto?: string;
  aboFrequence?: string;
  aboJours?: Array<{ jour: string; heure_debut: string; heure_fin: string }>;
  aboDateOverrides?: Record<string, DateOverrideItem>;
  setAboDateOverrides?: (newOverrides: Record<string, DateOverrideItem> | ((prev: Record<string, DateOverrideItem>) => Record<string, DateOverrideItem>)) => Promise<void> | void;
  childDemandes?: Demande[];
  addToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
  onSetCellStatus?: (dayIso: string, newStatut: string) => Promise<void>;
  latestId?: number;
  fetchData?: () => Promise<void>;
}

const JOURS_SEMAINE = [
  { value: "lundi", label: "Lundi" },
  { value: "mardi", label: "Mardi" },
  { value: "mercredi", label: "Mercredi" },
  { value: "jeudi", label: "Jeudi" },
  { value: "vendredi", label: "Vendredi" },
  { value: "samedi", label: "Samedi" },
  { value: "dimanche", label: "Dimanche" },
] as const;

export const SubscriptionCalendarGrid: React.FC<SubscriptionCalendarGridProps> = ({
  calMonth,
  parentDemande,
  aboDateDebut = '',
  dateFinAuto = '',
  aboFrequence = '',
  aboJours = [],
  aboDateOverrides: externalOverrides,
  setAboDateOverrides: externalSetOverrides,
  childDemandes = [],
  addToast,
  onSetCellStatus,
  latestId,
  fetchData
}) => {
  const [internalOverrides, setInternalOverrides] = useState<Record<string, DateOverrideItem>>({});
  const aboDateOverrides = externalOverrides || internalOverrides;
  const setAboDateOverrides = externalSetOverrides || setInternalOverrides;

  const [internalJours, setInternalJours] = useState<Array<{ jour: string; heure_debut: string; heure_fin: string }>>(() => {
    if (aboJours && aboJours.length > 0) return aboJours;
    return [
      { jour: 'lundi', heure_debut: '09:00', heure_fin: '13:00' },
      { jour: 'jeudi', heure_debut: '09:00', heure_fin: '13:00' }
    ];
  });

  React.useEffect(() => {
    if (aboJours && aboJours.length > 0) {
      setInternalJours(aboJours);
    }
  }, [aboJours]);

  const currentJours = internalJours;

  const maxJours = React.useMemo(() => {
    const freqStr = (aboFrequence || '').toLowerCase();
    if (freqStr.includes('1_fois') || freqStr.includes('1/sem') || freqStr.includes('1 fois') || freqStr.includes('1 passage') || freqStr.includes('1/mois') || freqStr.startsWith('1')) return 1;
    if (freqStr.includes('2_fois') || freqStr.includes('2/sem') || freqStr.includes('2 fois') || freqStr.includes('2 passage') || freqStr.startsWith('2')) return 2;
    if (freqStr.includes('3_fois') || freqStr.includes('3/sem') || freqStr.includes('3 fois') || freqStr.includes('3 passage') || freqStr.startsWith('3')) return 3;
    if (freqStr.includes('4_fois') || freqStr.includes('4/sem') || freqStr.includes('4 fois') || freqStr.includes('4 passage') || freqStr.startsWith('4')) return 4;
    if (freqStr.includes('5_fois') || freqStr.includes('5/sem') || freqStr.includes('5 fois') || freqStr.includes('5 passage') || freqStr.startsWith('5')) return 5;
    return Math.max(currentJours.length, 2);
  }, [aboFrequence, currentJours.length]);

  const handleToggleJour = async (dayValue: string) => {
    let updated: Array<{ jour: string; heure_debut: string; heure_fin: string }>;
    const existing = currentJours.find(j => j.jour === dayValue);
    if (existing) {
      updated = currentJours.filter(j => j.jour !== dayValue);
    } else {
      if (currentJours.length >= maxJours) return;
      updated = [...currentJours, { jour: dayValue, heure_debut: '09:00', heure_fin: '13:00' }];
    }
    setInternalJours(updated);
    if (latestId) {
      try {
        await updateDemande(latestId, {
          formulaire_data: {
            jours_intervention: updated.map(j => j.jour),
            jours_intervention_detail: updated
          }
        } as any);
        if (addToast) addToast(`Jours d'intervention mis à jour (${updated.length}/${maxJours})`, "success");
        if (fetchData) await fetchData();
      } catch (err) {
        console.error("Erreur mise à jour jours d'intervention:", err);
      }
    }
  };

  const handleSetJourHeure = async (dayValue: string, field: 'heure_debut' | 'heure_fin', val: string) => {
    const updated = currentJours.map(j => {
      if (j.jour === dayValue) {
        return { ...j, [field]: val };
      }
      return j;
    });
    setInternalJours(updated);
    if (latestId) {
      try {
        await updateDemande(latestId, {
          formulaire_data: {
            jours_intervention: updated.map(j => j.jour),
            jours_intervention_detail: updated
          }
        } as any);
        if (fetchData) await fetchData();
      } catch (err) {
        console.error("Erreur mise à jour horaires d'intervention:", err);
      }
    }
  };

  const [reporteDraft, setReporteDraft] = useState<Record<string, { date: string; heure: string; heure_fin: string }>>({});
  const [reprogTarget, setReprogTarget] = useState<Record<string, string>>({});
  const [useCreditSource, setUseCreditSource] = useState<Record<string, string>>({});

  const dayMap: Record<string, number> = {
    dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
  };

  const heureByDow: Record<number, string> = {};
  const heureFinByDow: Record<number, string> = {};
  (aboJours || []).forEach((j) => {
    const dow = dayMap[j.jour?.toLowerCase()];
    if (dow !== undefined) {
      if (j.heure_debut) heureByDow[dow] = j.heure_debut;
      if (j.heure_fin) heureFinByDow[dow] = j.heure_fin;
    }
  });
  const selectedDows = (aboJours || []).map((j) => dayMap[j.jour?.toLowerCase()]).filter(v => v !== undefined);

  const parsedStart = parseDateRobust(aboDateDebut);
  let start = parsedStart ? new Date(parsedStart.getFullYear(), parsedStart.getMonth(), parsedStart.getDate(), 0, 0, 0, 0) : startOfMonth(calMonth);

  const calMonthEnd = endOfMonth(calMonth);
  const parsedEnd = parseDateRobust(dateFinAuto);
  let end = parsedEnd ? new Date(parsedEnd.getFullYear(), parsedEnd.getMonth(), parsedEnd.getDate(), 23, 59, 59, 999) : (calMonthEnd > start ? calMonthEnd : addMonths(start, 12));

  const startMs = start.getTime();
  const interventionSet = new Set<string>();
  const seenMonth = new Set<string>();

  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    if (!selectedDows.includes(d.getDay())) continue;
    if (aboFrequence === "bi_hebdomadaire") {
      const weekNo = Math.floor((d.getTime() - startMs) / (7 * 24 * 3600 * 1000));
      if (weekNo % 2 !== 0) continue;
    }
    if (aboFrequence === "1_fois_mois") {
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDay()}`;
      if (seenMonth.has(key)) continue;
      seenMonth.add(key);
    }
    interventionSet.add(format(d, "yyyy-MM-dd"));
  }

  childDemandes.forEach((cd) => {
    if (cd.date_intervention) {
      const dIso = cd.date_intervention.includes('T') ? cd.date_intervention.split('T')[0] : cd.date_intervention.slice(0, 10);
      interventionSet.add(dIso);
    }
  });

  const availableCreditSources = Object.entries(aboDateOverrides)
    .filter(([, v]) => v?.statut === "a_recuperer" && !v?.reprogrammed_to)
    .map(([k]) => k)
    .sort();

  const monthStart = startOfMonth(calMonth);
  const monthEnd = endOfMonth(calMonth);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay());
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const headers = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];
  const formattedMonthYearTitle = format(calMonth, "MMMM yyyy", { locale: fr });
  const capitalizedMonthTitle = formattedMonthYearTitle.charAt(0).toUpperCase() + formattedMonthYearTitle.slice(1);

  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 20, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
      
      {/* 1. JOURS D'INTERVENTION Section */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            JOURS D'INTERVENTION *
          </label>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
            {currentJours.length}/{maxJours} jour(s) sélectionné(s)
          </span>
        </div>

        {/* 7 Days Pills Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 16 }}>
          {JOURS_SEMAINE.map((j) => {
            const selected = currentJours.some((aj) => aj.jour === j.value);
            const disabled = !selected && currentJours.length >= maxJours;
            return (
              <button
                key={j.value}
                type="button"
                onClick={() => handleToggleJour(j.value)}
                disabled={disabled}
                style={{
                  fontSize: 13,
                  fontWeight: selected ? 600 : 500,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: selected ? '1px solid #037265' : '1px solid #e2e8f0',
                  background: selected ? '#037265' : (disabled ? '#f8fafc' : '#ffffff'),
                  color: selected ? '#ffffff' : (disabled ? '#cbd5e1' : '#64748b'),
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                {j.label}
              </button>
            );
          })}
        </div>

        {/* 2. Horaires par jour */}
        {currentJours.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
              Horaires par jour (début / fin)
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
              {currentJours.map((jd) => (
                <div key={jd.jour} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#ffffff' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', width: 70, flexShrink: 0, textTransform: 'capitalize' }}>
                    {JOURS_SEMAINE.find((j) => j.value === jd.jour)?.label || jd.jour}
                  </span>
                  <input
                    type="time"
                    value={jd.heure_debut || '09:00'}
                    onChange={(e) => handleSetJourHeure(jd.jour, 'heure_debut', e.target.value)}
                    style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1', outline: 'none', flex: 1 }}
                  />
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>→</span>
                  <input
                    type="time"
                    value={jd.heure_fin || '13:00'}
                    onChange={(e) => handleSetJourHeure(jd.jour, 'heure_fin', e.target.value)}
                    style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid #cbd5e1', outline: 'none', flex: 1 }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. CALENDRIER DES INTERVENTIONS Header */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          CALENDRIER DES INTERVENTIONS
        </label>
      </div>

      {/* Month Year Title */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#037265', margin: 0 }}>
          {capitalizedMonthTitle}
        </h3>
      </div>

      {/* Main Calendar Card Box (Scrollable on small devices) */}
      <div className="sub-calendar-wrapper" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ border: '1px solid #d0e3e0', borderRadius: 16, overflow: 'hidden', background: 'white', minWidth: 600 }}>
          
          {/* Header row (DIM, LUN, MAR...) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#e6f2f0', borderBottom: '1px solid #d0e3e0' }}>
          {headers.map((h) => (
            <div key={h} style={{ color: '#037265', fontWeight: 800, fontSize: 12, textAlign: 'center', padding: '12px 0', letterSpacing: '0.05em' }}>
              {h}
            </div>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: '#d0e3e0', gap: '1px' }}>
          {days.map((d, i) => {
            const key = format(d, "yyyy-MM-dd");
            const inMonth = isSameMonth(d, calMonth);

            const override = aboDateOverrides[key];
            const isPattern = interventionSet.has(key);
            const isIntervention = (isPattern && !override?.excluded) || (!!override?.heure && !override?.excluded);

            // Get child demande linked to this date if exists in BDD, or parent demande for its start date
            const parentStartDate = parentDemande ? getDemandeStartDate(parentDemande) : '';
            const isParentDate = parentStartDate === key;
            const realDemande = childDemandes?.find((cd: Demande) => {
              if (!cd?.date_intervention) return false;
              const dDate = cd.date_intervention.includes('T') ? cd.date_intervention.split('T')[0] : cd.date_intervention.slice(0, 10);
              return dDate === key;
            }) || (isParentDate ? parentDemande : undefined);

            // Determine effective status from BDD child demande or overrides
            let effectiveStatut = override?.statut || null;
            if (realDemande) {
              const st = (realDemande.statut || '').toLowerCase().trim();
              const isReported = realDemande.cao === 'reporte' || ['reporte', 'reportee', 'reportée'].includes(st);
              const isCancelled = ['annule', 'annulee', 'annulée'].includes(st);
              const isCompleted = ['termine', 'terminee', 'pres_terminee', 'pres. terminée'].includes(st);
              const isRecup = st.includes('recup');

              if (isCompleted) effectiveStatut = 'termine';
              else if (isCancelled) effectiveStatut = 'annule';
              else if (isReported) effectiveStatut = 'reporte';
              else if (isRecup) effectiveStatut = 'a_recuperer';
            }

            const heure = override?.heure || (realDemande?.heure_intervention ? realDemande.heure_intervention.slice(0, 5) : '') || (isPattern ? heureByDow[d.getDay()] : "");
            const heureFin = override?.heure_fin || (isPattern ? heureFinByDow[d.getDay()] : "");
            const isToday = isSameDay(d, new Date());

            let cellBg = 'white';
            let dateNumCol = '#0f172a';
            let badgeBg = '#64748b';
            let badgeText = 'À VENIR';

            const isCreatedInBdd = !!realDemande && !['annule', 'annulee', 'annulée', 'reporte', 'reportee', 'reportée'].includes((realDemande.statut || '').toLowerCase());

            if (!inMonth) {
              cellBg = '#f8fafc';
              dateNumCol = '#cbd5e1';
            } else if (isIntervention || effectiveStatut === 'a_recuperer' || effectiveStatut === 'reporte' || isCreatedInBdd) {
              if (effectiveStatut === 'termine') {
                cellBg = '#f0fdf4';
                dateNumCol = '#15803d';
                badgeBg = '#16a34a';
                badgeText = 'TERMINÉ';
              } else if (effectiveStatut === 'annule') {
                cellBg = '#fff1f2';
                dateNumCol = '#dc2626';
                badgeBg = '#dc2626';
                badgeText = 'ANNULÉ';
              } else if (effectiveStatut === 'a_recuperer') {
                cellBg = '#fffbeb';
                dateNumCol = '#d97706';
                badgeBg = '#d97706';
                badgeText = 'À RÉCUP.';
              } else if (effectiveStatut === 'reporte') {
                cellBg = '#f5f3ff';
                dateNumCol = '#7c3aed';
                badgeBg = '#7c3aed';
                badgeText = 'REPORTÉE';
              } else if (isCreatedInBdd) {
                cellBg = '#e6f2f0';
                dateNumCol = '#037265';
                badgeBg = '#0284c7';
                badgeText = 'CRÉÉE';
              } else {
                cellBg = '#f8fafc';
                dateNumCol = '#475569';
                badgeBg = '#64748b';
                badgeText = 'À VENIR';
              }
            }

            return (
              <Popover key={i}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    style={{
                      minHeight: 74,
                      background: cellBg,
                      padding: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      border: isToday ? '2px solid #facc15' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      outline: 'none',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: isToday ? 800 : 700, color: dateNumCol }}>
                      {format(d, "d")}
                    </span>

                    {(isIntervention || effectiveStatut === "a_recuperer" || effectiveStatut === "reporte") && inMonth && (
                      <div style={{ width: '100%', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{
                          display: 'block',
                          fontSize: 9,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          background: badgeBg,
                          color: 'white',
                          borderRadius: 4,
                          padding: '3px 4px',
                          textAlign: 'center',
                          letterSpacing: '0.03em',
                          textDecoration: effectiveStatut === 'annule' ? 'line-through' : 'none'
                        }}>
                          {badgeText}
                        </span>
                        {heure && (
                          <span style={{
                            display: 'block',
                            fontSize: 9,
                            fontWeight: 700,
                            background: '#0d9488',
                            color: 'white',
                            borderRadius: 4,
                            padding: '2px 4px',
                            textAlign: 'center',
                            letterSpacing: '0.02em',
                            whiteSpace: 'nowrap'
                          }}>
                            {heure.slice(0, 5)}{heureFin ? ` - ${heureFin.slice(0, 5)}` : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                </PopoverTrigger>

                {/* Popover Dialog Window */}
                <PopoverContent style={{ width: 340, padding: 18, borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,0.12)', border: '1px solid #cbd5e1', background: 'white' }} align="start">
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', textTransform: 'capitalize', marginBottom: 14 }}>
                    {format(d, "EEEE d MMMM yyyy", { locale: fr })}
                  </div>

                  {/* Inputs Heure début / fin */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    <div>
                      <Label style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4, display: 'block' }}>Heure début</Label>
                      <Input
                        type="time"
                        value={heure || ""}
                        onChange={(e) => setAboDateOverrides((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], heure: e.target.value, excluded: false },
                        }))}
                        style={{ height: 36, fontSize: 13, borderRadius: 8, borderColor: '#cbd5e1' }}
                      />
                    </div>
                    <div>
                      <Label style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4, display: 'block' }}>Heure fin</Label>
                      <Input
                        type="time"
                        value={heureFin}
                        onChange={(e) => setAboDateOverrides((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], heure_fin: e.target.value, excluded: false },
                        }))}
                        style={{ height: 36, fontSize: 13, borderRadius: 8, borderColor: '#cbd5e1' }}
                      />
                    </div>
                  </div>

                  {/* Section Statut */}
                  <div style={{ marginBottom: 14 }}>
                    <Label style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, display: 'block' }}>Statut</Label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {/* À venir */}
                      <button
                        type="button"
                        onClick={async () => {
                          await setAboDateOverrides((prev) => ({
                            ...prev, [key]: { ...prev[key], statut: null },
                          }));
                          if (onSetCellStatus) await onSetCellStatus(key, 'prestation_recue');
                        }}
                        style={{
                          height: 34,
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 8,
                          border: !effectiveStatut ? 'none' : '1px solid #cbd5e1',
                          background: !effectiveStatut ? '#037265' : '#f8fafc',
                          color: !effectiveStatut ? 'white' : '#334155',
                          cursor: 'pointer'
                        }}
                      >
                        À venir
                      </button>

                      {/* Terminé */}
                      <button
                        type="button"
                        onClick={async () => {
                          await setAboDateOverrides((prev) => ({
                            ...prev, [key]: { ...prev[key], statut: "termine", excluded: false },
                          }));
                          if (onSetCellStatus) await onSetCellStatus(key, 'termine');
                        }}
                        style={{
                          height: 34,
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 8,
                          border: effectiveStatut === "termine" ? 'none' : '1px solid #cbd5e1',
                          background: effectiveStatut === "termine" ? '#16a34a' : '#f8fafc',
                          color: effectiveStatut === "termine" ? 'white' : '#334155',
                          cursor: 'pointer'
                        }}
                      >
                        Terminé
                      </button>

                      {/* Annulé (perdu) */}
                      <button
                        type="button"
                        onClick={async () => {
                          await setAboDateOverrides((prev) => ({
                            ...prev, [key]: { ...prev[key], statut: "annule", excluded: false },
                          }));
                          if (onSetCellStatus) await onSetCellStatus(key, 'annule');
                        }}
                        style={{
                          height: 34,
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 8,
                          border: effectiveStatut === "annule" ? 'none' : '1px solid #cbd5e1',
                          background: effectiveStatut === "annule" ? '#dc2626' : '#f8fafc',
                          color: effectiveStatut === "annule" ? 'white' : '#334155',
                          cursor: 'pointer'
                        }}
                      >
                        Annulé (perdu)
                      </button>

                      {/* Annulé à récupérer */}
                      <button
                        type="button"
                        onClick={() => {
                          setAboDateOverrides((prev) => ({
                            ...prev, [key]: { ...prev[key], statut: "a_recuperer", excluded: false, reprogrammed_to: null },
                          }));
                          if (addToast) addToast("Marqué comme 'Annulé à récupérer'. Choisissez la date de reprogrammation ci-dessous.", "info");
                        }}
                        style={{
                          height: 34,
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 8,
                          border: effectiveStatut === "a_recuperer" ? 'none' : '1px solid #cbd5e1',
                          background: effectiveStatut === "a_recuperer" ? '#d97706' : '#f8fafc',
                          color: effectiveStatut === "a_recuperer" ? 'white' : '#334155',
                          cursor: 'pointer'
                        }}
                      >
                        Annulé à récupérer
                      </button>

                      {/* Reportée */}
                      <button
                        type="button"
                        onClick={() => setReporteDraft((prev) => ({
                          ...prev,
                          [key]: prev[key] || {
                            date: override?.reprogrammed_to || "",
                            heure: heure || heureByDow[d.getDay()] || "09:00",
                            heure_fin: heureFin || "",
                          },
                        }))}
                        style={{
                          height: 34,
                          fontSize: 12,
                          fontWeight: 700,
                          borderRadius: 8,
                          gridColumn: 'span 2',
                          border: effectiveStatut === "reporte" ? 'none' : '1px solid #cbd5e1',
                          background: effectiveStatut === "reporte" ? '#a3e635' : '#f8fafc',
                          color: effectiveStatut === "reporte" ? '#1e3a8a' : '#334155',
                          cursor: 'pointer'
                        }}
                      >
                        Reportée
                      </button>
                    </div>
                  </div>

                  {/* Sub-box : Reporter cette intervention */}
                  {reporteDraft[key] && (
                    <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 10, padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#3730a3' }}>Reporter cette intervention</div>
                      <Input
                        type="date"
                        value={reporteDraft[key].date}
                        onChange={(e) => setReporteDraft((prev) => ({ ...prev, [key]: { ...prev[key], date: e.target.value } }))}
                        style={{ height: 34, fontSize: 13, background: 'white', borderColor: '#cbd5e1' }}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <Input
                          type="time"
                          value={reporteDraft[key].heure}
                          onChange={(e) => setReporteDraft((prev) => ({ ...prev, [key]: { ...prev[key], heure: e.target.value } }))}
                          style={{ height: 34, fontSize: 13, background: 'white', borderColor: '#cbd5e1' }}
                        />
                        <Input
                          type="time"
                          value={reporteDraft[key].heure_fin}
                          onChange={(e) => setReporteDraft((prev) => ({ ...prev, [key]: { ...prev[key], heure_fin: e.target.value } }))}
                          style={{ height: 34, fontSize: 13, background: 'white', borderColor: '#cbd5e1' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                        <button
                          type="button"
                          disabled={!reporteDraft[key].date || reporteDraft[key].date === key || !reporteDraft[key].heure}
                          onClick={async () => {
                            const dr = reporteDraft[key];
                            const tom = new Date();
                            tom.setDate(tom.getDate() + 1);
                            const tomorrowIso = `${tom.getFullYear()}-${String(tom.getMonth() + 1).padStart(2, '0')}-${String(tom.getDate()).padStart(2, '0')}`;

                            // Local overrides update
                            setAboDateOverrides((prev) => ({
                              ...prev,
                              [key]: { ...prev[key], statut: "reporte", excluded: false, reprogrammed_to: dr.date },
                              [dr.date]: { ...prev[dr.date], heure: dr.heure, heure_fin: dr.heure_fin, statut: null, excluded: false, reprogrammed_from: key },
                            }));

                            if (latestId) {
                              try {
                                // Rule 2.2: Delete existing child demand for original date D1 if present
                                const existingD1 = childDemandes?.find((cd: Demande) => {
                                  const cDate = cd.date_intervention?.includes('T') ? cd.date_intervention.split('T')[0] : cd.date_intervention?.slice(0, 10);
                                  return cDate === key;
                                });
                                if (existingD1?.id) {
                                  await deleteDemande(existingD1.id);
                                }

                                // Rule 2.1: Only create child demand if new target date <= tomorrowIso
                                if (dr.date <= tomorrowIso) {
                                  await createPlanningIntervention(latestId, {
                                    date: dr.date,
                                    time: dr.heure || '09:00',
                                    week_id: 'w1',
                                    day_key: 'day'
                                  });
                                }
                              } catch (err) {
                                console.error("Error creating reported intervention:", err);
                              }
                            }
                            setReporteDraft((prev) => { const { [key]: _, ...rest } = prev; return rest; });
                            if (addToast) addToast(`Intervention reportée au ${format(parseISO(dr.date), "dd/MM/yyyy")}`, "success");
                            if (fetchData) await fetchData();
                          }}
                          style={{
                            height: 32,
                            fontSize: 12,
                            fontWeight: 700,
                            flex: 1,
                            background: '#818cf8',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer'
                          }}
                        >
                          Confirmer le report
                        </button>
                        <button
                          type="button"
                          onClick={() => setReporteDraft((prev) => { const { [key]: _, ...rest } = prev; return rest; })}
                          style={{
                            height: 32,
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '0 12px',
                            background: 'transparent',
                            color: '#475569',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sub-box 1 : Reprogrammer cette intervention (Annulé à récupérer) */}
                  {effectiveStatut === "a_recuperer" && !override?.reprogrammed_to && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>Reprogrammer cette intervention</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Input
                          type="date"
                          value={reprogTarget[key] || ""}
                          onChange={(e) => setReprogTarget((prev) => ({ ...prev, [key]: e.target.value }))}
                          style={{ height: 34, fontSize: 13, flex: 1, background: 'white', borderColor: '#cbd5e1' }}
                        />
                        <button
                          type="button"
                          disabled={!reprogTarget[key] || reprogTarget[key] === key}
                          onClick={async () => {
                            const target = reprogTarget[key];
                            if (!target) return;
                            const tom = new Date();
                            tom.setDate(tom.getDate() + 1);
                            const tomorrowIso = `${tom.getFullYear()}-${String(tom.getMonth() + 1).padStart(2, '0')}-${String(tom.getDate()).padStart(2, '0')}`;

                            const h = heure || heureByDow[d.getDay()] || "09:00";
                            const hf = heureFin || "";
                            setAboDateOverrides((prev) => ({
                              ...prev,
                              [key]: { ...prev[key], statut: "a_recuperer", reprogrammed_to: target, excluded: false },
                              [target]: { ...prev[target], heure: h, heure_fin: hf, statut: null, excluded: false, reprogrammed_from: key },
                            }));
                            if (latestId) {
                              try {
                                const existingD1 = childDemandes?.find((cd: Demande) => {
                                  const cDate = cd.date_intervention?.includes('T') ? cd.date_intervention.split('T')[0] : cd.date_intervention?.slice(0, 10);
                                  return cDate === key;
                                });
                                if (existingD1?.id) {
                                  await deleteDemande(existingD1.id);
                                }

                                if (target <= tomorrowIso) {
                                  await createPlanningIntervention(latestId, {
                                    date: target,
                                    time: h,
                                    week_id: 'w1',
                                    day_key: 'day'
                                  });
                                }
                              } catch (err) {
                                console.error("Error creating reprogrammed intervention:", err);
                              }
                            }
                            setReprogTarget((prev) => { const { [key]: _, ...rest } = prev; return rest; });
                            if (addToast) addToast(`Intervention reprogrammée au ${format(parseISO(target), "dd/MM/yyyy")}`, "success");
                            if (fetchData) await fetchData();
                          }}
                          style={{
                            height: 34,
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '0 12px',
                            background: '#eab308',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer'
                          }}
                        >
                          Reprogrammer
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sub-box 2 : Utiliser un crédit à récupérer */}
                  {!isIntervention && !override?.reprogrammed_from && availableCreditSources.length > 0 && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>Utiliser un crédit à récupérer</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select
                          value={useCreditSource[key] || ""}
                          onChange={(e) => setUseCreditSource((prev) => ({ ...prev, [key]: e.target.value }))}
                          style={{ height: 34, fontSize: 13, flex: 1, borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', padding: '0 8px' }}
                        >
                          <option value="">Choisir un crédit…</option>
                          {availableCreditSources.map((sk) => (
                            <option key={sk} value={sk}>{format(parseISO(sk), "dd/MM/yyyy")}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!useCreditSource[key]}
                          onClick={async () => {
                            const src = useCreditSource[key];
                            if (!src) return;
                            const tom = new Date();
                            tom.setDate(tom.getDate() + 1);
                            const tomorrowIso = `${tom.getFullYear()}-${String(tom.getMonth() + 1).padStart(2, '0')}-${String(tom.getDate()).padStart(2, '0')}`;

                            const h = heure || heureByDow[d.getDay()] || "09:00";
                            const hf = heureFin || "";
                            setAboDateOverrides((prev) => ({
                              ...prev,
                              [src]: { ...prev[src], statut: "a_recuperer", reprogrammed_to: key, excluded: false },
                              [key]: { ...prev[key], heure: h, heure_fin: hf, statut: null, excluded: false, reprogrammed_from: src },
                            }));
                            if (latestId) {
                              try {
                                const existingSrc = childDemandes?.find((cd: Demande) => {
                                  const cDate = cd.date_intervention?.includes('T') ? cd.date_intervention.split('T')[0] : cd.date_intervention?.slice(0, 10);
                                  return cDate === src;
                                });
                                if (existingSrc?.id) {
                                  await deleteDemande(existingSrc.id);
                                }

                                if (key <= tomorrowIso) {
                                  await createPlanningIntervention(latestId, {
                                    date: key,
                                    time: h,
                                    week_id: 'w1',
                                    day_key: 'day'
                                  });
                                }
                              } catch (err) {
                                console.error("Error applying credit intervention:", err);
                              }
                            }
                            setUseCreditSource((prev) => { const { [key]: _, ...rest } = prev; return rest; });
                            if (addToast) addToast(`Crédit du ${format(parseISO(src), "dd/MM/yyyy")} appliqué ici.`, "success");
                            if (fetchData) await fetchData();
                          }}
                          style={{
                            height: 34,
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '0 12px',
                            background: '#eab308',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer'
                          }}
                        >
                          Utiliser
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions bas : Ajouter / Reset */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        if (isIntervention) {
                          await setAboDateOverrides((prev) => ({
                            ...prev, [key]: { ...prev[key], excluded: true },
                          }));
                          if (onSetCellStatus) await onSetCellStatus(key, 'retirer');
                        } else {
                          await setAboDateOverrides((prev) => ({
                            ...prev,
                            [key]: { heure: prev[key]?.heure || heureByDow[d.getDay()] || "09:00", heure_fin: prev[key]?.heure_fin || "", excluded: false },
                          }));
                          if (onSetCellStatus) await onSetCellStatus(key, 'prestation_recue');
                        }
                      }}
                      style={{
                        height: 36,
                        fontSize: 13,
                        fontWeight: 700,
                        flex: 1,
                        background: '#f8fafc',
                        color: isIntervention ? '#dc2626' : '#037265',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        cursor: 'pointer'
                      }}
                    >
                      {isIntervention ? 'Retirer' : 'Ajouter'}
                    </button>

                    {aboDateOverrides[key] && (
                      <button
                        type="button"
                        onClick={async () => {
                          await setAboDateOverrides((prev) => {
                            const { [key]: _, ...rest } = prev; return rest;
                          });
                          if (fetchData) await fetchData();
                        }}
                        style={{
                          height: 36,
                          fontSize: 13,
                          fontWeight: 600,
                          padding: '0 14px',
                          background: 'transparent',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          borderRadius: 8,
                          cursor: 'pointer'
                        }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      </div>
    </div>

      {/* Exact Bottom Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginTop: 16, fontSize: 12, color: '#64748b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, border: '2px solid #037265', display: 'inline-block' }} />
          <span>Passage prévu</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, border: '2px solid #7c3aed', display: 'inline-block' }} />
          <span>5ème semaine (facturée en +)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, border: '2px solid #d97706', display: 'inline-block' }} />
          <span>Suspension fête religieuse</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, border: '2px solid #facc15', display: 'inline-block' }} />
          <span>Aujourd'hui</span>
        </div>
      </div>

    </div>
  );
};
