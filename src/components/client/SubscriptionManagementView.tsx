import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, XCircle, PlayCircle } from 'lucide-react';
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
import { extractJoursPassage, parseDateRobust, getStatutMoisProchainCalculated, getDemandeStartDate, getCleanAboFrequencyLabel } from '../../utils/pricing';
import { useAuthStore } from '../../store/auth';
import { checkPermission } from '../../utils/permissions';

export interface SubscriptionManagementViewProps {
  latest: Demande;
  client?: Client;
  demandes: Demande[];
  navigate: any;
  handleGenerateInvoice: (id: number) => Promise<void>;
  handleDownloadInvoice: (id: number, reference?: string) => void;
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
  navigate,
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

  const { user } = useAuthStore();
  const navigateHook = useNavigate();
  const [isBackHovered, setIsBackHovered] = useState(false);

  const handleGoToGestionAbonnement = () => {
    if (typeof navigate === 'function') {
      navigate('/gestion-abonnement');
    } else {
      navigateHook('/gestion-abonnement');
    }
  };

  const [localPlanningNotes, setLocalPlanningNotes] = useState<string>(() => {
    return latest?.formulaire_data?.planning_notes || latest?.planning?.notes || '';
  });

  const planningNotes = externalPlanningNotes !== undefined ? externalPlanningNotes : localPlanningNotes;
  const setPlanningNotes = externalSetPlanningNotes || setLocalPlanningNotes;

  // Sync local planning notes when latest prop changes
  React.useEffect(() => {
    const freshNotes = latest?.formulaire_data?.planning_notes || latest?.planning?.notes || '';
    setLocalPlanningNotes(freshNotes);
  }, [latest?.id, latest?.formulaire_data?.planning_notes, latest?.planning?.notes]);

  // Auto-save planning notes to database automatically
  React.useEffect(() => {
    if (!latest?.id || planningNotes === undefined) return;
    const timer = setTimeout(() => {
      const currentNotes = latest?.formulaire_data?.planning_notes || latest?.planning?.notes || '';
      if (planningNotes !== currentNotes) {
        updateDemande(latest.id, {
          formulaire_data: { planning_notes: planningNotes },
          planning: {
            ...(latest.planning || {}),
            notes: planningNotes
          }
        } as any).catch(err => console.error("Auto-save notes error:", err));
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [planningNotes, latest?.id]);

  const [monthTabs, setMonthTabs] = useState(() => {
    const count = Math.max(1, Math.min(24, Number(latest?.formulaire_data?.active_months_count || 1)));
    const tabs = [];
    for (let i = 1; i <= count; i++) {
      tabs.push({ id: `mois${i}`, label: `Mois ${i}` });
    }
    return tabs;
  });

  React.useEffect(() => {
    const count = Math.max(1, Math.min(24, Number(latest?.formulaire_data?.active_months_count || 1)));
    if (count !== monthTabs.length) {
      const tabs = [];
      for (let i = 1; i <= count; i++) {
        tabs.push({ id: `mois${i}`, label: `Mois ${i}` });
      }
      setMonthTabs(tabs);
      setActiveMonthTab(`mois${count}`);
    }
  }, [latest?.formulaire_data?.active_months_count]);

  const [activeMonthTab, setActiveMonthTab] = useState<string>(() => {
    const count = Math.max(1, Number(latest?.formulaire_data?.active_months_count || 1));
    return `mois${count}`;
  });
  const [showInvoiceFormModal, setShowInvoiceFormModal] = useState(false);
  const [isActivatingMonth, setIsActivatingMonth] = useState(false);

  const activeTabIndex = useMemo(() => {
    const idx = monthTabs.findIndex(t => t.id === activeMonthTab);
    return idx >= 0 ? idx : 0;
  }, [monthTabs, activeMonthTab]);

  const baseDate = useMemo(() => {
    const dStr = dateDebut || getDemandeStartDate(latest);
    if (dStr) {
      const parsed = parseDateRobust(dStr);
      if (parsed) return parsed;
    }
    return new Date();
  }, [dateDebut, latest]);

  const activeCalendarDate = useMemo(() => {
    return new Date(baseDate.getFullYear(), baseDate.getMonth() + activeTabIndex, 1);
  }, [baseDate, activeTabIndex]);

  const selectedDays = useMemo<string[]>(() => {
    const dayNames = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    let days: string[] = [];

    const detail = latest?.formulaire_data?.jours_intervention_detail;
    if (Array.isArray(detail) && detail.length > 0) {
      days = detail.map((item: any) => typeof item === 'string' ? item.toLowerCase() : item?.jour?.toLowerCase()).filter((j: string) => dayNames.includes(j));
    }

    if (days.length === 0) {
      const rawJours = (latest?.formulaire_data as any)?.jours_intervention || latest?.planning?.jours_intervention || [];
      days = extractJoursPassage(rawJours);
    }

    if (days.length === 0) {
      const rawJoursPassage = (latest?.formulaire_data as any)?.jours_passage || (latest as any)?.jours_passage;
      days = extractJoursPassage(rawJoursPassage);
    }

    if (days.length === 0 && Array.isArray(latest?.planning?.semaines)) {
      const foundDays = new Set<string>();
      latest.planning.semaines.forEach((w: any) => {
        if (w.jours && typeof w.jours === 'object') {
          Object.keys(w.jours).forEach((k: string) => {
            if (w.jours[k]?.selected && dayNames.includes(k.toLowerCase())) {
              foundDays.add(k.toLowerCase());
            }
          });
        }
      });
      if (foundDays.size > 0) days = Array.from(foundDays);
    }

    if (days.length === 0) {
      const freq = (frequencyLabel || latest?.frequency_label || latest?.formulaire_data?.frequence || '').toLowerCase();
      if (freq.includes('2')) days = ['lundi', 'jeudi'];
      else if (freq.includes('1')) days = ['samedi'];
      else if (freq.includes('4')) days = ['lundi', 'mardi', 'mercredi', 'jeudi'];
      else if (freq.includes('5')) days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
      else days = ['lundi', 'mercredi', 'vendredi'];
    }

    const freqStr = (frequencyLabel || latest?.frequency_label || latest?.formulaire_data?.frequence || '').toLowerCase();
    let maxJours = 5;
    if (freqStr.includes('1_fois') || freqStr.includes('1/sem') || freqStr.includes('1 fois') || freqStr.includes('1/mois') || freqStr.startsWith('1')) maxJours = 1;
    else if (freqStr.includes('2_fois') || freqStr.includes('2/sem') || freqStr.includes('2 fois') || freqStr.startsWith('2')) maxJours = 2;
    else if (freqStr.includes('3_fois') || freqStr.includes('3/sem') || freqStr.includes('3 fois') || freqStr.startsWith('3')) maxJours = 3;
    else if (freqStr.includes('4_fois') || freqStr.includes('4/sem') || freqStr.includes('4 fois') || freqStr.startsWith('4')) maxJours = 4;
    else if (freqStr.includes('bi_hebd') || freqStr.includes('mois')) maxJours = 1;

    return days.slice(0, maxJours);
  }, [latest, frequencyLabel]);

  const detailedAboJours = useMemo(() => {
    const detail = latest?.formulaire_data?.jours_intervention_detail;
    const isGrand = String(latest?.service || latest?.type_prestation || latest?.formulaire_data?.service || '').toLowerCase().includes('grand');
    const defaultDuree = Number(latest?.nb_heures || latest?.formulaire_data?.duree || (isGrand ? 6 : 4));

    const computeEndTime = (startStr: string, dur: number) => {
      if (!startStr) return '13:00';
      const parts = startStr.split(':');
      let h = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      if (isNaN(h)) h = 9;
      if (isNaN(m)) m = 0;
      const totalMin = h * 60 + m + Math.round(dur * 60);
      const endH = Math.floor(totalMin / 60) % 24;
      const endM = totalMin % 60;
      return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
    };

    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map((item: any) => {
        const jourKey = typeof item === 'string' ? item.toLowerCase() : item?.jour?.toLowerCase();
        const start = item?.heure_debut || latest?.formulaire_data?.heure || (latest as any)?.heure || '09:00';
        const end = item?.heure_fin || computeEndTime(start, defaultDuree);
        return {
          jour: jourKey,
          heure_debut: start,
          heure_fin: end
        };
      });
    }

    return selectedDays.map(d => {
      const start = latest?.formulaire_data?.heure || (latest as any)?.heure || '09:00';
      const end = computeEndTime(start, defaultDuree);
      return {
        jour: d.toLowerCase(),
        heure_debut: start,
        heure_fin: end
      };
    });
  }, [latest, selectedDays]);

  const year = activeCalendarDate.getFullYear();
  const month = activeCalendarDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthIsoPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthTitle = activeCalendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const capitalizedMonthTitle = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);

  const childDemandes = useMemo(() => {
    if (!demandes || !Array.isArray(demandes) || !latest?.id) return [];
    return demandes.filter((d: Demande) => {
      if (!d) return false;
      const isParentMatch = d.parent_demande && Number(d.parent_demande) === Number(latest.id);
      const isClientMatch = client?.id && Number(d.client) === Number(client.id);
      return (isParentMatch || (isClientMatch && !!d.parent_demande)) && !!d.date_intervention;
    });
  }, [demandes, latest?.id, client?.id]);

  const monthDemandes = useMemo(() => {
    const list = [...childDemandes];
    if (latest && latest.date_intervention) {
      const parentDate = getDemandeStartDate(latest);
      const exists = list.some((c: Demande) => {
        const dDate = c.date_intervention?.includes('T') ? c.date_intervention.split('T')[0] : c.date_intervention?.slice(0, 10);
        return dDate === parentDate;
      });
      if (!exists) {
        list.push(latest);
      }
    }
    return list.filter((c: Demande) => {
      if (!c.date_intervention) return false;
      const dDate = c.date_intervention.includes('T') ? c.date_intervention.split('T')[0] : c.date_intervention.slice(0, 10);
      return dDate.startsWith(monthIsoPrefix);
    });
  }, [childDemandes, latest, monthIsoPrefix]);

  const [aboDateOverrides, setAboDateOverridesState] = useState<Record<string, any>>(() => {
    return latest?.formulaire_data?.date_overrides || {};
  });

  React.useEffect(() => {
    if (latest?.formulaire_data?.date_overrides) {
      setAboDateOverridesState(latest.formulaire_data.date_overrides);
    }
  }, [latest?.id, latest?.formulaire_data?.date_overrides]);

  const handleUpdateDateOverrides = useCallback(async (newOverridesOrFn: any) => {
    let nextOverrides: Record<string, any> = {};
    setAboDateOverridesState((prev: Record<string, any>) => {
      nextOverrides = typeof newOverridesOrFn === 'function' ? newOverridesOrFn(prev) : newOverridesOrFn;
      return nextOverrides;
    });

    if (latest?.id) {
      try {
        // Send only the changed key — the backend merge handles the rest
        await updateDemande(latest.id, {
          formulaire_data: { date_overrides: nextOverrides }
        } as any);
      } catch (err) {
        console.error("Erreur d'enregistrement date_overrides:", err);
      }
    }
  }, [latest?.id]);

  const getMonthSpecificData = useCallback((tabKey: string) => {
    const formData = latest?.formulaire_data || {};
    const moisDataMap = formData.mois_data || {};
    const storedMonth = moisDataMap[tabKey];

    if (storedMonth) {
      return {
        statut_mois_en_cours: storedMonth.statut_mois_en_cours || 'Actif',
        statut_facturation: storedMonth.statut_facturation || 'Non défini',
        statut_mois_prochain: storedMonth.statut_mois_prochain || 'Non défini',
        date_overrides: storedMonth.date_overrides || {},
        facturation: storedMonth.facturation || {},
        taux_reduction: storedMonth.taux_reduction
      };
    }

    if (tabKey === 'mois1') {
      const dbStatut = (latest?.statut || '').toLowerCase();
      const curStatut = formData.statut_mois_en_cours || (dbStatut === 'resilie' ? 'Résilié' : (['termine', 'terminee'].includes(dbStatut) ? 'Terminé' : 'Actif'));
      const fact = formData.statut_facturation || (['integral', 'paye', 'payee'].includes((latest?.statut_paiement || '').toLowerCase()) ? 'Payé' : 'Non défini');
      const rawOverride = formData.statut_mois_prochain;
      const calcProchain = getStatutMoisProchainCalculated(new Date().getDate(), fact, rawOverride);
      return {
        statut_mois_en_cours: curStatut,
        statut_facturation: fact,
        statut_mois_prochain: calcProchain,
        date_overrides: formData.date_overrides || {},
        facturation: formData.facturation || {},
        taux_reduction: formData.taux_reduction ?? 10
      };
    }

    return {
      statut_mois_en_cours: 'Actif',
      statut_facturation: 'Non défini',
      statut_mois_prochain: 'Non défini',
      date_overrides: {},
      facturation: {},
      taux_reduction: 0
    };
  }, [latest]);

  const initialMonthData = getMonthSpecificData(activeMonthTab);
  const [statutMoisEnCours, setStatutMoisEnCours] = useState<string>(initialMonthData.statut_mois_en_cours);
  const [statutFacturation, setStatutFacturation] = useState<string>(initialMonthData.statut_facturation);
  const [statutMoisProchain, setStatutMoisProchain] = useState<string>(initialMonthData.statut_mois_prochain);

  // Keep statutMoisEnCours, statutFacturation and statutMoisProchain in sync with active tab and latest props
  React.useEffect(() => {
    if (!latest) return;
    const mData = getMonthSpecificData(activeMonthTab);
    setStatutMoisEnCours(mData.statut_mois_en_cours);
    setStatutFacturation(mData.statut_facturation);
    setStatutMoisProchain(mData.statut_mois_prochain);
  }, [activeMonthTab, latest?.id, latest?.statut, latest?.statut_paiement, latest?.formulaire_data?.mois_data, latest?.formulaire_data?.statut_facturation, latest?.formulaire_data?.statut_mois_prochain, latest?.formulaire_data?.statut_mois_en_cours, getMonthSpecificData]);

  const handleMoisProchainChange = async (newVal: string) => {
    const perm = checkPermission(user, 'pause_standby_abonnement');
    if (!perm.allowed) {
      addToast(perm.message || "Action non autorisée par votre rôle.", "error");
      return;
    }

    if (newVal === 'Actif' && statutFacturation !== 'Payé') {
      addToast(
        "Le mois prochain ne peut pas être marqué comme « Actif » tant que le statut de facturation n'est pas « Payé ».",
        "error"
      );
      return;
    }

    setStatutMoisProchain(newVal);

    if (!latest?.id) return;
    try {
      const existingMoisData = latest.formulaire_data?.mois_data || {};
      const updatedCurrentMonth = {
        ...(existingMoisData[activeMonthTab] || getMonthSpecificData(activeMonthTab)),
        statut_mois_prochain: newVal
      };

      const updatedMoisData = {
        ...existingMoisData,
        [activeMonthTab]: updatedCurrentMonth
      };

      const isLatestMonth = activeTabIndex === monthTabs.length - 1;

      await updateDemande(latest.id, {
        formulaire_data: {
          ...(latest.formulaire_data || {}),
          mois_data: updatedMoisData,
          ...(isLatestMonth ? {
            statut_mois_prochain: newVal
          } : {})
        }
      } as any);

      if (isLatestMonth) {
        await toggleAbonnementSuspend(latest.id, { statut_mois_prochain: newVal }).catch(() => {});
      }

      addToast(`Statut mois prochain mis à jour pour ${monthTabs[activeTabIndex]?.label || activeMonthTab} : ${newVal}`, "success");
      if (fetchData) await fetchData();
    } catch (err) {
      console.error("Erreur lors de la mise à jour du statut mois prochain:", err);
    }
  };

  const handleFacturationChange = async (newVal: string) => {
    const perm = checkPermission(user, 'valider_facturation_abonnement');
    if (!perm.allowed) {
      addToast(perm.message || "Action non autorisée par votre rôle.", "error");
      return;
    }
    setStatutFacturation(newVal);
    
    // Pass undefined for explicitOverride if clearing 'Actif' on non-paid status
    const updatedStatutProchain = getStatutMoisProchainCalculated(
      new Date().getDate(),
      newVal,
      statutMoisProchain === 'Actif' && newVal !== 'Payé' ? undefined : statutMoisProchain
    );
    setStatutMoisProchain(updatedStatutProchain);

    if (!latest?.id) return;
    try {
      const existingMoisData = latest.formulaire_data?.mois_data || {};
      const updatedCurrentMonth = {
        ...(existingMoisData[activeMonthTab] || getMonthSpecificData(activeMonthTab)),
        statut_facturation: newVal,
        statut_mois_prochain: updatedStatutProchain
      };

      const updatedMoisData = {
        ...existingMoisData,
        [activeMonthTab]: updatedCurrentMonth
      };

      const isLatestMonth = activeTabIndex === monthTabs.length - 1;

      const partialFormData: any = {
        mois_data: updatedMoisData,
        ...(isLatestMonth ? {
          statut_facturation: newVal,
          statut_mois_prochain: updatedStatutProchain
        } : {})
      };

      if (isLatestMonth && latest.formulaire_data?.facturation) {
        partialFormData.facturation = {
          ...latest.formulaire_data.facturation,
          statut_facturation: newVal,
          statut_paiement_ui: newVal === 'Payé' ? 'paye' : (newVal === 'Non payé' ? 'non_paye' : 'en_attente')
        };
      }

      if (newVal === 'Payé') {
        if (isLatestMonth) {
          await confirmAbonnementPaiement(latest.id).catch(() => {});
        }
        await updateDemande(latest.id, {
          ...(isLatestMonth ? { statut_paiement: 'integral' } : {}),
          formulaire_data: {
            ...(latest.formulaire_data || {}),
            ...partialFormData
          }
        } as any);
        addToast(`Paiement confirmé pour ${monthTabs[activeTabIndex]?.label || activeMonthTab}. Statut mis à jour sur Payé.`, "success");
      } else {
        await updateDemande(latest.id, {
          ...(isLatestMonth ? { statut_paiement: 'non_paye' } : {}),
          formulaire_data: {
            ...(latest.formulaire_data || {}),
            ...partialFormData
          }
        } as any);
        addToast(`Statut de facturation mis à jour pour ${monthTabs[activeTabIndex]?.label || activeMonthTab} : ${newVal}`, "info");
      }
      if (fetchData) await fetchData();
    } catch (err) {
      console.error("Erreur lors de la mise à jour du statut de facturation:", err);
    }
  };

  const handleSetCellStatus = async (dayIso: string, newStatut: string) => {
    if (!latest) return;
    const perm = checkPermission(user, 'modifier_abonnement');
    if (!perm.allowed) {
      addToast(perm.message || "Action non autorisée par votre rôle.", "error");
      return;
    }
    try {
      const existing = childDemandes.find((d: Demande) => {
        if (!d.date_intervention) return false;
        const dDate = d.date_intervention.includes('T') ? d.date_intervention.split('T')[0] : d.date_intervention.slice(0, 10);
        return dDate === dayIso;
      });

      const parentStartDate = getDemandeStartDate(latest);
      const isParentDate = parentStartDate === dayIso;

      const stLower = (newStatut || '').toLowerCase();
      const isRemovalOrReport = ['retirer', 'annule', 'annulee', 'reporte', 'reportee'].includes(stLower);

      if (existing) {
        if (isRemovalOrReport) {
          await deleteDemande(existing.id);
          addToast("Intervention retirée / mise à jour sur le planning", "info");
        } else {
          await updateDemande(existing.id, {
            statut: newStatut,
            heure_intervention: '09:00'
          });
          addToast("Statut mis à jour", "success");
        }
      } else if (isParentDate) {
        await updateDemande(latest.id, {
          statut: newStatut
        });
        addToast("Statut de la première intervention mis à jour", "success");
      } else if (!isRemovalOrReport) {
        const tom = new Date();
        tom.setDate(tom.getDate() + 1);
        const tomorrowIso = `${tom.getFullYear()}-${String(tom.getMonth() + 1).padStart(2, '0')}-${String(tom.getDate()).padStart(2, '0')}`;

        // Rule 2.1: Only instantiate child demand if dayIso <= tomorrowIso (J-1 / J rule)
        if (dayIso <= tomorrowIso) {
          await createPlanningIntervention(latest.id, {
            date: dayIso,
            time: '09:00',
            week_id: 'w1',
            day_key: 'day'
          });
          addToast("Intervention créée pour l'échéance J-1", "success");
        } else {
          addToast("Planning mis à jour (Création automatique prévue à J-1)", "info");
        }
      }
      if (fetchData) await fetchData();
    } catch (err) {
      console.error("Erreur statut intervention:", err);
      addToast("Erreur lors de la mise à jour de l'intervention", "error");
    }
  };

  const monthPassagesRealises = useMemo(() => {
    let count = 0;
    const countedSet = new Set<string>();

    Object.entries(aboDateOverrides).forEach(([k, ov]: [string, any]) => {
      if (k.startsWith(monthIsoPrefix)) {
        const st = (ov?.statut || '').toLowerCase().trim();
        if (['termine', 'terminee', 'pres_terminee', 'pres. terminée'].includes(st)) {
          countedSet.add(k);
          count++;
        }
      }
    });

    monthDemandes.forEach((c: Demande) => {
      if (c.date_intervention) {
        const dIso = c.date_intervention.includes('T') ? c.date_intervention.split('T')[0] : c.date_intervention.slice(0, 10);
        if (dIso.startsWith(monthIsoPrefix) && ['termine', 'terminee', 'pres_terminee', 'pres. terminée'].includes((c.statut || '').toLowerCase().trim())) {
          if (!countedSet.has(dIso)) {
            countedSet.add(dIso);
            count++;
          }
        }
      }
    });

    return count;
  }, [aboDateOverrides, monthDemandes, monthIsoPrefix]);

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
    const startStr = dateDebut || getDemandeStartDate(latest);
    const parsedStart = parseDateRobust(startStr);
    if (parsedStart) {
      const startNormalized = new Date(parsedStart.getFullYear(), parsedStart.getMonth(), parsedStart.getDate(), 0, 0, 0, 0);
      if (startNormalized > lastOfMonth) return 0;
      if (startNormalized >= firstOfMonth && startNormalized <= lastOfMonth) {
        start = startNormalized;
      }
    }

    let end = lastOfMonth;
    const isResilie = (latest?.statut || '').toLowerCase() === 'resilie';
    if (isResilie) {
      const endStr = dateFin || latest?.formulaire_data?.date_fin || latest?.planning?.date_fin;
      const parsedEnd = parseDateRobust(endStr);
      if (parsedEnd) {
        const endNormalized = new Date(parsedEnd.getFullYear(), parsedEnd.getMonth(), parsedEnd.getDate(), 23, 59, 59, 999);
        if (endNormalized < firstOfMonth) return 0;
        if (endNormalized >= firstOfMonth && endNormalized < lastOfMonth) {
          end = endNormalized;
        }
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

  // Auto-save nombre_passages_mois for current month planning in database
  React.useEffect(() => {
    if (!latest?.id || monthPassagesPlanifies === undefined || monthPassagesPlanifies === 0) return;
    const current = latest?.planning?.nombre_passages_mois || 0;
    if (monthPassagesPlanifies !== current) {
      updatePlanning(latest.id, { nombre_passages_mois: monthPassagesPlanifies })
        .catch(err => console.error('Auto-save nombre_passages_mois error:', err));
    }
  }, [monthPassagesPlanifies, latest?.id]);

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

  // ── Validation règle métier : activation du mois prochain ──
  const lastActiveTabKey = monthTabs[monthTabs.length - 1]?.id || activeMonthTab;
  const lastActiveMonthData = getMonthSpecificData(lastActiveTabKey);
  const lastMonthFacturationStatus = lastActiveMonthData?.statut_facturation || (activeTabIndex === monthTabs.length - 1 ? statutFacturation : 'Non défini');
  const isLastMonthPaid = (lastMonthFacturationStatus || '').toLowerCase() === 'payé' || (lastMonthFacturationStatus || '').toLowerCase() === 'paye';

  const canActivateNextMonth = isLastMonthPaid;
  const cannotActivateReason = !isLastMonthPaid
    ? `Le statut de facturation de ${monthTabs[monthTabs.length - 1]?.label || 'ce mois'} doit être « Payé » pour pouvoir activer le mois prochain (actuellement : « ${lastMonthFacturationStatus || 'Non défini'} »).`
    : undefined;

  const handleAddNextMonthTab = async () => {
    if (isActivatingMonth) return;

    // Règle stricte : la facturation du dernier mois actif doit impérativement être "Payé"
    if (!isLastMonthPaid) {
      addToast(
        `Impossible d'activer le mois prochain : le statut de facturation de ${monthTabs[monthTabs.length - 1]?.label || 'ce mois'} doit impérativement être « Payé » (actuellement : « ${lastMonthFacturationStatus || 'Non défini'} »).`,
        "error"
      );
      return;
    }

    const perm = checkPermission(user, 'creer_abonnement');
    if (!perm.allowed) {
      addToast(perm.message || "Action non autorisée par votre rôle.", "error");
      return;
    }

    setIsActivatingMonth(true);
    try {
      const nextTabNum = monthTabs.length + 1;

      const startStr = dateDebut || getDemandeStartDate(latest);
      let newDateFin = '';
      if (startStr) {
        const startDate = parseDateRobust(startStr);
        if (startDate) {
          const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + nextTabNum, 0);
          newDateFin = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
        }
      }

      if (latest?.id) {
        await updateDemande(latest.id, {
          formulaire_data: {
            ...(latest.formulaire_data || {}),
            active_months_count: nextTabNum,
            statut_mois_prochain: 'Actif',
            statut_mois_en_cours: 'Actif',
            ...(newDateFin ? { date_fin: newDateFin } : {})
          },
          planning: {
            ...(latest.planning || {}),
            ...(newDateFin ? { date_fin: newDateFin } : {})
          }
        } as any);

        if (fetchData) await fetchData();
        addToast(`Mois ${nextTabNum} activé avec succès !`, "success");
      }
    } catch (err) {
      console.error("Erreur lors de l'activation du nouveau mois:", err);
      addToast("Erreur lors de l'enregistrement du nouveau mois.", "error");
    } finally {
      setIsActivatingMonth(false);
    }
  };

  const isResilie = useMemo(() => {
    const dbStatut = (latest?.statut || '').toLowerCase().trim();
    const stEnCours = ((latest?.formulaire_data as any)?.statut_mois_en_cours || '').toLowerCase().trim();
    return dbStatut === 'resilie' || stEnCours === 'résilié' || stEnCours === 'resilie';
  }, [latest?.statut, latest?.formulaire_data]);

  const handleDirectReactiverAbonnement = async () => {
    if (!latest?.id) return;
    const perm = checkPermission(user, 'modifier_abonnement');
    if (!perm.allowed) {
      addToast(perm.message || "Action non autorisée par votre rôle.", "error");
      return;
    }
    try {
      await updateDemande(latest.id, {
        statut: 'en_cours',
        formulaire_data: {
          ...(latest.formulaire_data || {}),
          statut_mois_en_cours: 'Actif',
          statut_mois_prochain: 'Non défini',
          date_resiliation: null
        }
      } as any);
      addToast("Abonnement réactivé avec succès ! Il réapparaît désormais sur la gestion des abonnements et le planning.", "success");
      if (fetchData) await fetchData();
    } catch (err) {
      console.error("Erreur lors de la réactivation:", err);
      addToast("Erreur lors de la réactivation de l'abonnement.", "error");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 20 }}>
      {/* 0. Navigation back to Gestion Abonnement & Resiliation Alert */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <button
          type="button"
          onClick={handleGoToGestionAbonnement}
          onMouseEnter={() => setIsBackHovered(true)}
          onMouseLeave={() => setIsBackHovered(false)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 18px',
            backgroundColor: isBackHovered ? '#e6f4f1' : '#ffffff',
            color: isBackHovered ? '#037265' : '#475569',
            border: isBackHovered ? '1px solid #037265' : '1px solid #cbd5e1',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: isBackHovered
              ? '0 4px 14px rgba(3, 114, 101, 0.2)'
              : '0 1px 3px rgba(0, 0, 0, 0.05)',
            transform: isBackHovered ? 'translateY(-1px)' : 'translateY(0)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <ArrowLeft
            size={18}
            style={{
              color: isBackHovered ? '#037265' : '#64748b',
              transform: isBackHovered ? 'translateX(-4px)' : 'translateX(0)',
              transition: 'all 0.2s ease'
            }}
          />
          <span>Retour à Gestion Abonnement</span>
        </button>

        {isResilie && (
          <button
            type="button"
            onClick={handleDirectReactiverAbonnement}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 18px',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.3)',
              transition: 'all 0.15s ease'
            }}
          >
            <PlayCircle size={16} />
            <span>Réactiver / Relancer cet abonnement</span>
          </button>
        )}
      </div>

      {/* Resiliation Alert Banner */}
      {isResilie && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 12,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#dc2626',
                flexShrink: 0
              }}
            >
              <XCircle size={20} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#991b1b' }}>
                Cet abonnement est actuellement résilié
              </div>
              <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>
                Il n'apparaît plus sur la page de gestion des abonnements ni sur le planning. Le compte client reste intact et vous pouvez réactiver l'abonnement à tout moment.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. Month Tabs Navigation Header */}
      <SubscriptionMonthTabs
        monthTabs={monthTabs}
        activeMonthTab={activeMonthTab}
        onSelectTab={setActiveMonthTab}
        onAddNextMonthTab={handleAddNextMonthTab}
        canActivateNextMonth={canActivateNextMonth}
        disabledReason={cannotActivateReason}
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
      <div className="sub-view-layout-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Subscription Contract Parameters Card matching screenshot */}
          <SubscriptionParamsCard
            latest={latest}
            client={client}
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
            parentDemande={latest}
            aboDateDebut={dateDebut || getDemandeStartDate(latest)}
            dateFinAuto={latest?.formulaire_data?.date_fin || ''}
            aboFrequence={getCleanAboFrequencyLabel(latest, detailedAboJours.map(j => j.jour))}
            aboJours={detailedAboJours}
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
            monthPassagesPlanifies={monthPassagesPlanifies}
            onDownloadInvoice={(reference) => handleDownloadInvoice && handleDownloadInvoice(latest.id, reference)}
          />
        </div>

        {/* RIGHT SIDEBAR STACK */}
        <div className="sub-view-sidebar" style={{ width: 320, flexShrink: 0 }}>
          <SubscriptionSidebar
            latest={latest}
            client={client}
            childDemandes={childDemandes}
            onOpenInvoiceModal={() => setShowInvoiceFormModal(true)}
            addToast={addToast}
            fetchData={fetchData}
          />
        </div>
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
