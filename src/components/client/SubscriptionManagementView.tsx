import React, { useState, useMemo, useCallback } from 'react';
import { Client, Demande } from '../../types';
import {
  updateDemande, deleteDemande, createPlanningIntervention,
  sendWhatsApp, toggleAbonnementSuspend, confirmAbonnementPaiement,
  updatePlanning
} from '../../api/client';
import { SubscriptionHeaderCard } from './SubscriptionHeaderCard';
import { SubscriptionMonthTabs } from './SubscriptionMonthTabs';
import { SubscriptionStatusBar } from './SubscriptionStatusBar';
import { SubscriptionParamsCard } from './SubscriptionParamsCard';
import { SubscriptionCalendarGrid } from './SubscriptionCalendarGrid';
import { SubscriptionSidebar } from './SubscriptionSidebar';
import { FacturesReglementsCard } from './FacturesReglementsCard';
import { InvoiceFormModal } from './InvoiceFormModal';

export interface SubscriptionManagementViewProps {
  latest: Demande;
  client?: Client;
  demandes: Demande[];
  navigate: any;
  handleGenerateInvoice: (id: number) => Promise<void>;
  handleDownloadInvoice: (id: number) => void;
  handleSavePlanning: () => Promise<void>;
  savingPlanning: boolean;
  dateDebut?: string;
  setDateDebut?: (val: string) => void;
  dateFin?: string;
  setDateFin?: (val: string) => void;
  frequencyLabel?: string;
  setFrequencyLabel?: (val: string) => void;
  planningStatut?: string;
  setPlanningStatut?: (val: string) => void;
  planningNotes?: string;
  setPlanningNotes?: (val: string) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  fetchData?: () => Promise<void>;
}

export const SubscriptionManagementView: React.FC<SubscriptionManagementViewProps> = ({
  latest,
  client,
  demandes,
  handleGenerateInvoice,
  handleDownloadInvoice,
  handleSavePlanning,
  savingPlanning,
  dateDebut,
  dateFin,
  frequencyLabel,
  planningNotes: externalPlanningNotes,
  setPlanningNotes: externalSetPlanningNotes,
  addToast,
  fetchData
}) => {
  if (!latest) return null;

  const [localPlanningNotes, setLocalPlanningNotes] = useState<string>(() => {
    return latest?.formulaire_data?.planning_notes || latest?.planning?.notes || '';
  });

  const planningNotes = externalPlanningNotes !== undefined ? externalPlanningNotes : localPlanningNotes;
  const setPlanningNotes = externalSetPlanningNotes || setLocalPlanningNotes;

  // Auto-save planning notes to database automatically
  React.useEffect(() => {
    if (!latest?.id || planningNotes === undefined) return;
    const timer = setTimeout(() => {
      const currentNotes = latest?.formulaire_data?.planning_notes || latest?.planning?.notes || '';
      if (planningNotes !== currentNotes) {
        const updatedFormData = {
          ...(latest.formulaire_data || {}),
          planning_notes: planningNotes
        };
        const updatedPlanning = {
          ...(latest.planning || {}),
          notes: planningNotes
        };
        updateDemande(latest.id, {
          formulaire_data: updatedFormData,
          planning: updatedPlanning
        } as any).catch(err => console.error("Auto-save notes error:", err));
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [planningNotes, latest?.id]);

  const [activeMonthTab, setActiveMonthTab] = useState<string>('mois1');
  const [monthTabs, setMonthTabs] = useState([{ id: 'mois1', label: 'Mois 1' }]);
  const [showInvoiceFormModal, setShowInvoiceFormModal] = useState(false);

  const activeTabIndex = useMemo(() => {
    const idx = monthTabs.findIndex(t => t.id === activeMonthTab);
    return idx >= 0 ? idx : 0;
  }, [monthTabs, activeMonthTab]);

  const baseDate = useMemo(() => {
    const dStr = dateDebut || latest?.date_intervention || latest?.created_at;
    if (dStr) {
      const parsed = new Date(dStr.includes('T') ? dStr : `${dStr.slice(0, 10)}T00:00:00`);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  }, [dateDebut, latest]);

  const activeCalendarDate = useMemo(() => {
    return new Date(baseDate.getFullYear(), baseDate.getMonth() + activeTabIndex, 1);
  }, [baseDate, activeTabIndex]);

  const selectedDays = useMemo<string[]>(() => {
    const rawJours = latest?.formulaire_data?.jours_intervention || latest?.planning?.jours_intervention || [];
    let days: string[] = [];
    if (Array.isArray(rawJours) && rawJours.length > 0) {
      days = rawJours.map((item: any) => {
        if (typeof item === 'string') return item.toLowerCase();
        if (item && typeof item === 'object' && item.jour) return String(item.jour).toLowerCase();
        return String(item).toLowerCase();
      }).filter(Boolean);
    }

    if (days.length === 0) {
      const freq = frequencyLabel || latest?.frequency_label || latest?.formulaire_data?.frequence || '';
      if (freq.includes('2')) days = ['lundi', 'jeudi'];
      else days = ['lundi', 'mercredi', 'vendredi'];
    }

    const freqStr = (frequencyLabel || latest?.frequency_label || latest?.formulaire_data?.frequence || '').toLowerCase();
    let maxJours = 3;
    if (freqStr.includes('1_fois') || freqStr.includes('1/sem') || freqStr.includes('1 fois')) maxJours = 1;
    else if (freqStr.includes('2_fois') || freqStr.includes('2/sem') || freqStr.includes('2 fois')) maxJours = 2;
    else if (freqStr.includes('3_fois') || freqStr.includes('3/sem') || freqStr.includes('3 fois')) maxJours = 3;
    else if (freqStr.includes('bi_hebd') || freqStr.includes('mois')) maxJours = 1;

    return days.slice(0, maxJours);
  }, [latest, frequencyLabel]);

  const childDemandes = useMemo(() => {
    if (!demandes || !Array.isArray(demandes) || !latest?.id) return [];
    return demandes.filter((d: Demande) => {
      if (!d) return false;
      const isParentMatch = d.parent_demande && Number(d.parent_demande) === Number(latest.id);
      const isClientMatch = client?.id && Number(d.client) === Number(client.id);
      return (isParentMatch || (isClientMatch && !!d.parent_demande)) && !!d.date_intervention;
    });
  }, [demandes, latest?.id, client?.id]);

  const year = activeCalendarDate.getFullYear();
  const month = activeCalendarDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthIsoPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthTitle = activeCalendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const capitalizedMonthTitle = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);

  const monthDemandes = useMemo(() => {
    return childDemandes.filter((c: Demande) => {
      if (!c.date_intervention) return false;
      const dDate = c.date_intervention.includes('T') ? c.date_intervention.split('T')[0] : c.date_intervention.slice(0, 10);
      return dDate.startsWith(monthIsoPrefix);
    });
  }, [childDemandes, monthIsoPrefix]);

  const [aboDateOverrides, setAboDateOverridesState] = useState<Record<string, any>>(() => {
    return latest?.formulaire_data?.date_overrides || {};
  });

  const handleUpdateDateOverrides = useCallback(async (newOverridesOrFn: any) => {
    let nextOverrides: Record<string, any> = {};
    setAboDateOverridesState((prev: Record<string, any>) => {
      nextOverrides = typeof newOverridesOrFn === 'function' ? newOverridesOrFn(prev) : newOverridesOrFn;
      return nextOverrides;
    });

    if (latest?.id) {
      try {
        const updatedFormData = {
          ...(latest.formulaire_data || {}),
          date_overrides: nextOverrides
        };
        await updateDemande(latest.id, {
          formulaire_data: updatedFormData
        } as any);
      } catch (err) {
        console.error("Erreur d'enregistrement date_overrides:", err);
      }
    }
  }, [latest?.id, latest?.formulaire_data]);

  const [statutMoisEnCours] = useState<string>(() => {
    if (latest?.formulaire_data?.statut_mois_en_cours) {
      return latest.formulaire_data.statut_mois_en_cours;
    }
    const dbStatut = (latest?.statut || '').toLowerCase();
    return ['termine', 'terminee', 'resilie'].includes(dbStatut) ? 'Terminé' : 'Actif';
  });

  const [statutMoisProchain, setStatutMoisProchain] = useState<string>(() => {
    if (latest?.formulaire_data?.statut_mois_prochain) {
      return latest.formulaire_data.statut_mois_prochain;
    }
    if (latest?.statut_paiement === 'non_paye' || (latest?.statut || '').toLowerCase() === 'suspendu') {
      return 'Suspendu';
    }
    return 'Actif';
  });

  const [statutFacturation, setStatutFacturation] = useState<string>(() => {
    if (latest?.formulaire_data?.statut_facturation) {
      return latest.formulaire_data.statut_facturation;
    }
    const dbPaiement = (latest?.statut_paiement || '').toLowerCase();
    if (['integral', 'paye', 'payee'].includes(dbPaiement)) {
      return 'Payé';
    }
    return 'Non payé';
  });

  const handleMoisProchainChange = async (newVal: string) => {
    setStatutMoisProchain(newVal);
    if (!latest?.id) return;
    try {
      const updatedFormData = {
        ...(latest.formulaire_data || {}),
        statut_mois_prochain: newVal
      };
      await updateDemande(latest.id, {
        statut_mois_prochain: newVal,
        formulaire_data: updatedFormData
      } as any);
      await toggleAbonnementSuspend(latest.id, { statut_mois_prochain: newVal });
      addToast(`Statut mois prochain mis à jour : ${newVal}`, "success");
      if (fetchData) await fetchData();
    } catch (err) {
      console.error("Erreur lors de la mise à jour du statut mois prochain:", err);
    }
  };

  const handleFacturationChange = async (newVal: string) => {
    setStatutFacturation(newVal);
    if (!latest?.id) return;
    try {
      if (newVal === 'Payé') {
        await confirmAbonnementPaiement(latest.id);
        addToast("Paiement confirmé. Statut de facturation mis à jour sur Payé.", "success");
      } else {
        const updatedFormData = {
          ...(latest.formulaire_data || {}),
          statut_facturation: newVal
        };
        await updateDemande(latest.id, {
          statut_paiement: newVal === 'Payé' ? 'integral' : 'non_paye',
          statut_paiement_ui: newVal === 'Payé' ? 'paye' : 'non_paye',
          formulaire_data: updatedFormData
        } as any);
        addToast(`Statut de facturation mis à jour : ${newVal}`, "info");
      }
      if (fetchData) await fetchData();
    } catch (err) {
      console.error("Erreur lors de la mise à jour du statut de facturation:", err);
    }
  };

  const handleSetCellStatus = async (dayIso: string, newStatut: string) => {
    if (!latest) return;
    try {
      const existing = childDemandes.find((d: Demande) => {
        if (!d.date_intervention) return false;
        const dDate = d.date_intervention.includes('T') ? d.date_intervention.split('T')[0] : d.date_intervention.slice(0, 10);
        return dDate === dayIso;
      });

      if (existing) {
        if (newStatut === 'retirer') {
          await deleteDemande(existing.id);
          addToast("Intervention retirée", "info");
        } else {
          await updateDemande(existing.id, {
            statut: newStatut,
            heure_intervention: '09:00'
          });
          addToast("Statut mis à jour", "success");
        }
      } else if (newStatut !== 'retirer') {
        await createPlanningIntervention(latest.id, {
          date: dayIso,
          time: '09:00',
          week_id: 'w1',
          day_key: 'day'
        });
        addToast("Intervention créée", "success");
      }
      if (fetchData) await fetchData();
    } catch (err) {
      console.error("Erreur statut intervention:", err);
      addToast("Erreur lors de la mise à jour de l'intervention", "error");
    }
  };

  const monthPassagesRealises = useMemo(() => {
    return monthDemandes.filter((c: Demande) => ['termine', 'terminee'].includes((c.statut || '').toLowerCase())).length;
  }, [monthDemandes]);

  const monthPassagesAnnules = useMemo(() => {
    let count = 0;
    const countedSet = new Set<string>();

    Object.entries(aboDateOverrides).forEach(([k, ov]: [string, any]) => {
      if (k.startsWith(monthIsoPrefix)) {
        const st = (ov?.statut || '').toLowerCase();
        if (ov?.excluded || ['annule', 'annulee'].includes(st)) {
          countedSet.add(k);
          count++;
        }
      }
    });

    monthDemandes.forEach((c: Demande) => {
      if (c.date_intervention) {
        const dIso = c.date_intervention.includes('T') ? c.date_intervention.split('T')[0] : c.date_intervention.slice(0, 10);
        if (dIso.startsWith(monthIsoPrefix) && ['annule', 'annulee'].includes((c.statut || '').toLowerCase())) {
          if (!countedSet.has(dIso)) {
            countedSet.add(dIso);
            count++;
          }
        }
      }
    });

    return count;
  }, [aboDateOverrides, monthDemandes, monthIsoPrefix]);

  const monthPassagesReport = useMemo(() => {
    let count = 0;
    const countedSet = new Set<string>();

    Object.entries(aboDateOverrides).forEach(([k, ov]: [string, any]) => {
      if (k.startsWith(monthIsoPrefix)) {
        const st = (ov?.statut || '').toLowerCase();
        if (['reporte', 'reportee'].includes(st)) {
          countedSet.add(k);
          count++;
        }
      }
    });

    monthDemandes.forEach((c: Demande) => {
      if (c.date_intervention) {
        const dIso = c.date_intervention.includes('T') ? c.date_intervention.split('T')[0] : c.date_intervention.slice(0, 10);
        if (dIso.startsWith(monthIsoPrefix) && ['reporte', 'reportee'].includes((c.statut || '').toLowerCase())) {
          if (!countedSet.has(dIso)) {
            countedSet.add(dIso);
            count++;
          }
        }
      }
    });

    return count;
  }, [aboDateOverrides, monthDemandes, monthIsoPrefix]);

  const totalMonthsCount = useMemo(() => {
    const semaines = latest?.planning?.semaines || [];
    let maxM = 1;
    semaines.forEach((w: any) => {
      if (w.mois && typeof w.mois === 'number' && w.mois > maxM) {
        maxM = w.mois;
      }
    });
    if (monthTabs && monthTabs.length > maxM) {
      maxM = monthTabs.length;
    }
    return maxM;
  }, [latest?.planning?.semaines, monthTabs]);

  const getPassagesForMonth = useCallback((mIndex: number) => {
    const dayMap: Record<string, number> = {
      dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6
    };
    const selectedDows = selectedDays
      .map(d => typeof d === 'string' ? dayMap[d.toLowerCase()] : (d as any)?.jour ? dayMap[(d as any).jour.toLowerCase()] : undefined)
      .filter(v => v !== undefined) as number[];

    if (selectedDows.length === 0) return 0;

    const calDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + mIndex, 1);
    const y = calDate.getFullYear();
    const m = calDate.getMonth();
    const mPrefix = `${y}-${String(m + 1).padStart(2, '0')}`;

    const firstOfMonth = new Date(y, m, 1, 0, 0, 0, 0);
    const lastOfMonth = new Date(y, m + 1, 0, 23, 59, 59, 999);

    let start = firstOfMonth;
    const startStr = dateDebut || latest?.formulaire_data?.date_demarrage || latest?.formulaire_data?.date_debut || latest?.planning?.date_debut || latest?.date_intervention;
    if (startStr) {
      const parsedStart = new Date(startStr.includes('T') ? startStr : `${startStr.slice(0, 10)}T00:00:00`);
      if (!isNaN(parsedStart.getTime()) && parsedStart > firstOfMonth && parsedStart <= lastOfMonth) {
        start = parsedStart;
      }
    }

    let end = lastOfMonth;
    const endStr = dateFin || latest?.formulaire_data?.date_fin || latest?.planning?.date_fin;
    if (endStr) {
      const parsedEnd = new Date(endStr.includes('T') ? endStr : `${endStr.slice(0, 10)}T23:59:59`);
      if (!isNaN(parsedEnd.getTime()) && parsedEnd >= firstOfMonth && parsedEnd < lastOfMonth) {
        end = parsedEnd;
      }
    }

    const passageDatesSet = new Set<string>();

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (selectedDows.includes(d.getDay())) {
        const isoKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        passageDatesSet.add(isoKey);
      }
    }

    // Filter out calendar overrides marked as annulé, reporté, or excluded
    Object.entries(aboDateOverrides).forEach(([k, ov]: [string, any]) => {
      if (k.startsWith(mPrefix)) {
        const st = (ov?.statut || '').toLowerCase();
        const isExcluded = ov?.excluded || ['annule', 'annulee', 'reporte', 'reportee', 'retirer'].includes(st);
        if (isExcluded) {
          passageDatesSet.delete(k);
        } else if (ov?.heure && !isExcluded) {
          passageDatesSet.add(k);
        }
      }
    });

    // Also filter out child demandes BDD status if marked as annulé, reporté, or retirer
    childDemandes.forEach((cd: Demande) => {
      if (cd.date_intervention) {
        const dIso = cd.date_intervention.includes('T') ? cd.date_intervention.split('T')[0] : cd.date_intervention.slice(0, 10);
        if (dIso.startsWith(mPrefix)) {
          const st = (cd.statut || '').toLowerCase();
          if (['annule', 'annulee', 'reporte', 'reportee', 'retirer'].includes(st)) {
            passageDatesSet.delete(dIso);
          }
        }
      }
    });

    return passageDatesSet.size;
  }, [selectedDays, baseDate, dateDebut, dateFin, latest, aboDateOverrides, childDemandes]);

  const monthPassagesPlanifies = useMemo(() => {
    return getPassagesForMonth(activeTabIndex);
  }, [getPassagesForMonth, activeTabIndex]);

  const totalPassagesAllMonths = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < totalMonthsCount; i++) {
      sum += getPassagesForMonth(i);
    }
    return sum;
  }, [totalMonthsCount, getPassagesForMonth]);

  // Auto-save nombre_passages_mois (total passages sum across all months) to planning in database
  React.useEffect(() => {
    if (!latest?.id || totalPassagesAllMonths === undefined || totalPassagesAllMonths === 0) return;
    const current = latest?.planning?.nombre_passages_mois || 0;
    if (totalPassagesAllMonths !== current) {
      updatePlanning(latest.id, { nombre_passages_mois: totalPassagesAllMonths })
        .catch(err => console.error('Auto-save nombre_passages_mois error:', err));
    }
  }, [totalPassagesAllMonths, latest?.id]);

  const fifthWeekInfo = useMemo(() => {
    const dayCounts: Record<string, { count: number; dates: string[] }> = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const dayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'long' }).toLowerCase();
      if (selectedDays.includes(dayName)) {
        const dateIso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (!dayCounts[dayName]) dayCounts[dayName] = { count: 0, dates: [] };
        dayCounts[dayName].count++;
        dayCounts[dayName].dates.push(dateIso);
      }
    }
    for (const [dayName, info] of Object.entries(dayCounts)) {
      if (info.count >= 5) {
        const lastDate = info.dates[info.dates.length - 1];
        const parts = lastDate.split('-');
        const dateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
        return {
          fifthWeekDay: dayName.charAt(0).toUpperCase() + dayName.slice(1),
          fifthWeekDateStr: dateFormatted,
          fifthWeekIso: lastDate
        };
      }
    }
    return { fifthWeekDay: null, fifthWeekDateStr: null, fifthWeekIso: null };
  }, [year, month, daysInMonth, selectedDays]);

  const handleAddNextMonthTab = () => {
    if (statutFacturation !== 'Payé') {
      addToast("Le statut de facturation du mois doit être 'Payé' pour pouvoir activer le mois prochain.", "error");
      return;
    }
    const nextTabNum = monthTabs.length + 1;
    const newTabId = `mois${nextTabNum}`;
    const newTabLabel = `Mois ${nextTabNum}`;
    setMonthTabs(prev => [...prev, { id: newTabId, label: newTabLabel }]);
    setActiveMonthTab(newTabId);
    addToast(`Mois ${nextTabNum} activé avec succès.`, "success");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 20 }}>
      {/* 1. Month Tabs Navigation Header */}
      <SubscriptionMonthTabs
        monthTabs={monthTabs}
        activeMonthTab={activeMonthTab}
        onSelectTab={setActiveMonthTab}
        onAddNextMonthTab={handleAddNextMonthTab}
      />

      {/* 2. Status & Action Bar */}
      <SubscriptionStatusBar
        latest={latest}
        statutMoisEnCours={statutMoisEnCours}
        statutMoisProchain={statutMoisProchain}
        statutFacturation={statutFacturation}
        onMoisProchainChange={handleMoisProchainChange}
        onFacturationChange={handleFacturationChange}
        onGenerateInvoice={() => handleGenerateInvoice(latest.id)}
        onOpenInvoiceModal={() => setShowInvoiceFormModal(true)}
        onSendInvoice={async () => {
          if (!latest?.id) return;
          try {
            addToast("Envoi de la facture au commercial via WhatsApp...", "info");
            const res = await sendWhatsApp(latest.id, 'facture');
            addToast(res.data?.message || "Facture envoyée avec succès.", "success");
          } catch (err) {
            console.error(err);
            addToast("Erreur lors de l'envoi de la facture.", "error");
          }
        }}
        onSavePlanning={handleSavePlanning}
        savingPlanning={savingPlanning}
      />

      {/* 3. Dark Teal KPI Banner & 5th Week Alert */}
      <SubscriptionHeaderCard
        latest={latest}
        capitalizedMonthTitle={capitalizedMonthTitle}
        selectedDays={selectedDays}
        monthPassagesPlanifies={monthPassagesPlanifies}
        monthPassagesRealises={monthPassagesRealises}
        monthPassagesReport={monthPassagesReport}
        monthPassagesAnnules={monthPassagesAnnules}
        fifthWeekInfo={fifthWeekInfo}
      />

      {/* 4. Main 2 Columns Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Subscription Contract Parameters Card matching screenshot */}
          <SubscriptionParamsCard
            latest={latest}
            frequencyLabel={frequencyLabel}
            selectedDays={selectedDays}
            dateDebut={dateDebut}
            monthPassagesPlanifies={monthPassagesPlanifies}
            monthPassagesAnnules={monthPassagesAnnules}
            interventionsRecuperees={Object.values(aboDateOverrides).filter((v: any) => v?.statut === 'a_recuperer' && v?.reprogrammed_to).length}
            creditsEnAttente={Object.values(aboDateOverrides).filter((v: any) => v?.statut === 'a_recuperer' && !v?.reprogrammed_to).length}
            onOpenModifyModal={() => setShowInvoiceFormModal(true)}
          />

          {/* Interactive Monthly Calendar Grid matching clientCompte.tsx */}
          <SubscriptionCalendarGrid
            calMonth={activeCalendarDate}
            aboDateDebut={dateDebut || latest?.date_intervention || latest?.formulaire_data?.date_demarrage || ''}
            dateFinAuto={latest?.formulaire_data?.date_fin || ''}
            aboFrequence={latest?.formulaire_data?.frequence || latest?.frequency_label || frequencyLabel || ''}
            aboJours={selectedDays.map(d => ({ jour: d, heure_debut: '09:00', heure_fin: '13:00' }))}
            aboDateOverrides={aboDateOverrides}
            setAboDateOverrides={handleUpdateDateOverrides}
            childDemandes={childDemandes}
            addToast={addToast}
            onSetCellStatus={handleSetCellStatus}
            latestId={latest?.id}
            fetchData={fetchData}
          />

          {/* Section NOTES COMPLÉMENTAIRES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              NOTES COMPLÉMENTAIRES
            </label>
            <textarea
              value={planningNotes || ''}
              onChange={(e) => setPlanningNotes && setPlanningNotes(e.target.value)}
              rows={3}
              placeholder="Précisions sur l'abonnement..."
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                background: 'white'
              }}
            />
          </div>

          {/* Section Factures & règlements */}
          <FacturesReglementsCard
            latest={latest}
            onDownloadInvoice={() => handleDownloadInvoice && handleDownloadInvoice(latest.id)}
          />
        </div>

        {/* RIGHT SIDEBAR STACK */}
        <SubscriptionSidebar
          latest={latest}
          client={client}
          childDemandes={childDemandes}
          onOpenInvoiceModal={() => setShowInvoiceFormModal(true)}
          addToast={addToast}
        />
      </div>

      {/* Invoice Form Modal */}
      <InvoiceFormModal
        show={showInvoiceFormModal}
        onClose={() => setShowInvoiceFormModal(false)}
        latest={latest}
        client={client}
        monthDemandes={monthDemandes}
        selectedDays={selectedDays}
        activeTabIndex={activeTabIndex}
        capitalizedMonthTitle={capitalizedMonthTitle}
        frequencyLabel={frequencyLabel}
        dateDebut={dateDebut}
        monthPassagesPlanifies={monthPassagesPlanifies}
        addToast={addToast}
        fetchData={fetchData}
      />
    </div>
  );
};
