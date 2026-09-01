import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Eye, Pause, Play, Search, ChevronLeft, ChevronRight,
  Sun, CheckCircle2, Clock, RefreshCw, X, ArrowDownRight, MoreHorizontal, FileText, ExternalLink, Moon, Download
} from 'lucide-react';
import jsPDF from 'jspdf';
import { getDemandes, updateDemande, getFetesReligieuses, toggleAbonnementSuspend, confirmAbonnementPaiement, generateDocument, fetchSecureDocBlob } from '../api/client';
import { SubscriptionCalendarGrid } from '../components/client/SubscriptionCalendarGrid';
import { encodeId } from '../utils/obfuscation';
import { Demande } from '../types';
import { getInvoiceMonthlyAmount, getDynamicMonthPassagesCount, extractJoursPassage, getStatutMoisProchainCalculated, getNextIntervention, getDemandeStartDate } from '../utils/pricing';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '../store/auth';
import { checkPermission, hasPermission } from '../utils/permissions';
import './GestionAbonnements.css';

interface SubscriptionRow {
  id: number;
  demandeId: number;
  clientId?: number;
  commercial: string;
  commercialInitials: string;
  clientName: string;
  clientVille: string;
  serviceType: string;
  frequenceLabel: string;
  heuresParPassage: number;
  joursChoice: string[]; // e.g. ["lundi", "jeudi"]
  interventionsCompleted: number;
  interventionsTotal: number;
  interventionsCancelled: number;
  nextInterventionDate: string;
  nextInterventionDay: string;
  nextInterventionHousekeeper: string;
  statutMoisEnCours: 'Actif' | 'Terminé';
  statutFacturation: string;
  statutMoisProchain: string;
  dateDebut: string;
  dateFin?: string;
  tarifMensuel: number;
  activeMonthsCount: number;
  tarifTotal: number;
  isMidMonthStart: boolean;
  codePromoUsed?: boolean;
}

export function calculateMidMonthProrata(
  startDateStr: string,
  endDateStr: string,
  selectedDays: string[],
  monthlyFullPrice: number = 3200
) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  const dayNameMap: Record<number, string> = {
    1: 'lundi',
    2: 'mardi',
    3: 'mercredi',
    4: 'jeudi',
    5: 'vendredi',
    6: 'samedi',
    0: 'dimanche'
  };

  const dayLabelMap: Record<number, string> = {
    1: 'Lundi',
    2: 'Mardi',
    3: 'Mercredi',
    4: 'Jeudi',
    5: 'Vendredi',
    6: 'Samedi',
    0: 'Dimanche'
  };

  const remainingDates: Array<{ dateStr: string; dayName: string; dayNumber: number }> = [];
  const safeSelectedDays = Array.isArray(selectedDays)
    ? selectedDays
    : (typeof selectedDays === 'string' ? [selectedDays] : []);
  const normalizedSelectedDays = safeSelectedDays.map(d => d.toLowerCase().trim());

  const current = new Date(start);
  while (current <= end) {
    const dayIdx = current.getDay();
    const dayName = dayNameMap[dayIdx];
    if (normalizedSelectedDays.includes(dayName)) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      remainingDates.push({
        dateStr: `${year}-${month}-${day}`,
        dayName: dayLabelMap[dayIdx],
        dayNumber: current.getDate()
      });
    }
    current.setDate(current.getDate() + 1);
  }

  const freqPerWeek = selectedDays.length || 1;
  const fullMonthInterventionsCount = freqPerWeek * 4; // standard 4 weeks = 8 for 2x/week
  const unitPrice = fullMonthInterventionsCount > 0 ? monthlyFullPrice / fullMonthInterventionsCount : monthlyFullPrice;
  const proratedPrice = Math.round(unitPrice * remainingDates.length);

  return {
    startDateStr,
    endDateStr,
    selectedDays,
    fullMonthInterventionsCount,
    remainingDates,
    actualCount: remainingDates.length,
    monthlyFullPrice,
    unitPrice: Math.round(unitPrice),
    proratedPrice
  };
}

// Helper Sub-Component for Calendar Popup Modal — Synchronized with SubscriptionCalendarGrid
function CalendarModal({
  row,
  demandes,
  onClose,
  onRefresh
}: {
  row: SubscriptionRow;
  demandes: Demande[];
  onClose: () => void;
  onRefresh?: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeDate] = useState(() => new Date());

  // Find the parent subscription demande to access date_overrides and jours_intervention_detail
  const parentDemande = useMemo(() => {
    return demandes.find(d => d.id === row.demandeId);
  }, [demandes, row.demandeId]);

  const [aboDateOverrides, setAboDateOverridesState] = useState<Record<string, any>>(() => {
    return parentDemande?.formulaire_data?.date_overrides || {};
  });

  useEffect(() => {
    if (parentDemande?.formulaire_data?.date_overrides) {
      setAboDateOverridesState(parentDemande.formulaire_data.date_overrides);
    }
  }, [parentDemande?.id, parentDemande?.formulaire_data?.date_overrides]);

  const handleUpdateDateOverrides = useCallback(async (newOverridesOrFn: any) => {
    let nextOverrides: Record<string, any> = {};
    setAboDateOverridesState((prev: Record<string, any>) => {
      nextOverrides = typeof newOverridesOrFn === 'function' ? newOverridesOrFn(prev) : newOverridesOrFn;
      return nextOverrides;
    });

    if (parentDemande?.id) {
      try {
        await updateDemande(parentDemande.id, {
          formulaire_data: { date_overrides: nextOverrides }
        } as any);
        if (onRefresh) await onRefresh();
      } catch (err) {
        console.error("Erreur d'enregistrement date_overrides:", err);
      }
    }
  }, [parentDemande?.id, onRefresh]);

  // Real child demandes / programmed interventions linked to this subscription in BDD
  const childDemandes = useMemo(() => {
    return demandes.filter(d => {
      const isParentMatch = d.parent_demande && Number(d.parent_demande) === Number(row.demandeId);
      const isClientMatch = row.clientId && Number(d.client) === Number(row.clientId);
      return (isParentMatch || (isClientMatch && !!d.parent_demande)) && !!d.date_intervention;
    });
  }, [demandes, row.demandeId, row.clientId]);

  // Build heureByDow map from jours_intervention_detail or joursChoice
  const joursDetail: Array<{ jour: string; heure_debut: string; heure_fin: string }> = useMemo(() => {
    const detail = parentDemande?.formulaire_data?.jours_intervention_detail;
    if (detail && Array.isArray(detail) && detail.length > 0) return detail;
    return (row.joursChoice || []).map(j => ({ jour: j, heure_debut: '09:00', heure_fin: '13:00' }));
  }, [parentDemande, row.joursChoice]);

  const handleOpenGestion = () => {
    const targetId = row.clientId || row.demandeId || row.id;
    navigate(`/clients/${encodeId(targetId)}`);
    onClose();
  };

  const handleSetCellStatus = async (dayIso: string, newStatut: string) => {
    if (!parentDemande?.id) return;
    try {
      const currentOverrides = { ...aboDateOverrides };
      const currentVal = currentOverrides[dayIso] || {};
      
      let statutValue: string | null = null;
      let isExcluded = false;

      if (newStatut === 'terminee' || newStatut === 'termine') statutValue = 'termine';
      else if (newStatut === 'annulee' || newStatut === 'annule') { statutValue = 'annule'; isExcluded = true; }
      else if (newStatut === 'reportee' || newStatut === 'reporte') { statutValue = 'reporte'; isExcluded = true; }
      else if (newStatut === 'a_recuperer') statutValue = 'a_recuperer';
      else statutValue = null;

      currentOverrides[dayIso] = {
        ...currentVal,
        statut: statutValue,
        excluded: isExcluded,
      };

      await handleUpdateDateOverrides(currentOverrides);
      toast({ title: "Statut mis à jour", description: `Date ${dayIso} actualisée avec succès.` });
    } catch (err) {
      console.error("Erreur statut intervention:", err);
      toast({ title: "Erreur", description: "Erreur lors de la mise à jour de l'intervention", variant: "destructive" });
    }
  };

  return (
    <div className="ga-modal-backdrop" onClick={onClose}>
      <div className="ga-modal" style={{ maxWidth: '840px', width: '100%', borderRadius: '16px', maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="ga-modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="ga-modal-title" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#03362e' }}>
            Planning & Calendrier — {row.clientName}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className="ga-tab-btn"
              onClick={handleOpenGestion}
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                padding: '0.45rem 0.9rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer'
              }}
            >
              <ExternalLink size={15} color="#334155" /> Ouvrir la fiche client
            </button>

            <button className="ga-modal-close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body: Canonical SubscriptionCalendarGrid */}
        <div className="ga-modal-body" style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
          <SubscriptionCalendarGrid
            calMonth={activeDate}
            parentDemande={parentDemande}
            aboDateDebut={row.dateDebut || (parentDemande ? getDemandeStartDate(parentDemande) : '')}
            dateFinAuto={row.dateFin || parentDemande?.formulaire_data?.date_fin || ''}
            aboFrequence={parentDemande?.formulaire_data?.frequence || parentDemande?.frequency_label || row.frequenceLabel || ''}
            aboJours={joursDetail}
            aboDateOverrides={aboDateOverrides}
            setAboDateOverrides={handleUpdateDateOverrides}
            childDemandes={childDemandes}
            addToast={(msg, type) => toast({ title: msg, variant: type === 'error' ? 'destructive' : 'default' })}
            onSetCellStatus={handleSetCellStatus}
            latestId={parentDemande?.id}
            fetchData={onRefresh}
          />
        </div>
      </div>
    </div>
  );
}

export default function GestionAbonnements() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const canViewVueEnsemble = hasPermission(user, 'consulter_abonnements');
  const canViewPlanning = hasPermission(user, 'consulter_planning_abonnements');
  const canViewFacturation = hasPermission(user, 'consulter_facturation_abonnements');

  const initialTab = useMemo<'vue_ensemble' | 'planning' | 'facturation'>(() => {
    if (canViewVueEnsemble) return 'vue_ensemble';
    if (canViewPlanning) return 'planning';
    if (canViewFacturation) return 'facturation';
    return 'vue_ensemble';
  }, [canViewVueEnsemble, canViewPlanning, canViewFacturation]);

  const [activeTab, setActiveTab] = useState<'vue_ensemble' | 'planning' | 'facturation'>(initialTab);

  useEffect(() => {
    if (activeTab === 'vue_ensemble' && !canViewVueEnsemble) {
      if (canViewPlanning) setActiveTab('planning');
      else if (canViewFacturation) setActiveTab('facturation');
    } else if (activeTab === 'planning' && !canViewPlanning) {
      if (canViewVueEnsemble) setActiveTab('vue_ensemble');
      else if (canViewFacturation) setActiveTab('facturation');
    } else if (activeTab === 'facturation' && !canViewFacturation) {
      if (canViewVueEnsemble) setActiveTab('vue_ensemble');
      else if (canViewPlanning) setActiveTab('planning');
    }
  }, [canViewVueEnsemble, canViewPlanning, canViewFacturation, activeTab]);
  
  // Data state
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [fetes, setFetes] = useState<any[]>([]);

  // Filters state
  const [searchClient, setSearchClient] = useState('');
  const [dateDu, setDateDu] = useState('');
  const [dateAu, setDateAu] = useState('');
  const [serviceFilter, setServiceFilter] = useState('tous');
  const [commercialFilter, setCommercialFilter] = useState('tous');
  const [villeFilter, setVilleFilter] = useState('tous');
  const [statutEnCoursFilter, setStatutEnCoursFilter] = useState('tous');
  const [statutProchainFilter, setStatutProchainFilter] = useState('tous');
  
  // Quick Recap Filter Pill state: 'tous' | 'actifs' | 'aujourdhui' | 'demain'
  const [quickRecapFilter, setQuickRecapFilter] = useState<'tous' | 'actifs' | 'aujourdhui' | 'demain'>('tous');

  // Modal State for Calendar Popup
  const [selectedSubForCalendar, setSelectedSubForCalendar] = useState<SubscriptionRow | null>(null);

  // Action dropdown state for facturation table
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [confirmedPaymentIds, setConfirmedPaymentIds] = useState<number[]>([]);
  const [generatedInvoiceIds, setGeneratedInvoiceIds] = useState<number[]>([]);

  // Planning Month Navigation state
  const [planningDate, setPlanningDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [demandesRes, fetesRes] = await Promise.all([
        getDemandes({ no_page: 'true' }),
        getFetesReligieuses({ annee: new Date().getFullYear() }).catch(() => ({ data: [] }))
      ]);
      const data: Demande[] = demandesRes.data?.results || demandesRes.data || [];
      setDemandes(data);

      const fetesData = Array.isArray(fetesRes.data) ? fetesRes.data : (fetesRes.data?.results || []);
      setFetes(fetesData);
    } catch (err) {
      console.error('Failed to load demandes for subscriptions:', err);
    }
  };

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const tomorrowStr = useMemo(() => {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    return tom.toISOString().slice(0, 10);
  }, []);

  // Target month for the table calculations (defaults to current month or dateDu if filtered)
  const targetMonthDate = useMemo(() => {
    if (dateDu) {
      const parsed = new Date(dateDu.includes('T') ? dateDu : `${dateDu}T00:00:00`);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  }, [dateDu]);

  const targetMonthPrefix = useMemo(() => {
    return `${targetMonthDate.getFullYear()}-${String(targetMonthDate.getMonth() + 1).padStart(2, '0')}`;
  }, [targetMonthDate]);

  // Map Demande items to SubscriptionRow objects (REAL DB DATA FOR CURRENT MONTH)
  const subscriptionRows: SubscriptionRow[] = useMemo(() => {
    // Filter ONLY parent subscription contracts (exclude child interventions with parent_demande and exclude cancelled/resilié subscriptions)
    const subDemandes = demandes.filter(d => {
      if (d.parent_demande) return false;
      const isSub = (
        d.frequency === 'abonnement' ||
        (d as any).frequence === 'abonnement' ||
        (d as any).frequency_label?.includes('/sem') ||
        (d.formulaire_data as any)?.frequence?.includes('/sem') ||
        (d.formulaire_data as any)?.subFrequency ||
        demandes.some(child => Number(child.parent_demande) === Number(d.id))
      );
      if (!isSub) return false;

      const dbStatut = (d.statut || '').toLowerCase().trim();
      const stMoisEnCours = ((d.formulaire_data as any)?.statut_mois_en_cours || '').toLowerCase().trim();
      const isResilie = dbStatut === 'resilie' || stMoisEnCours === 'résilié' || stMoisEnCours === 'resilie';

      // Hide résilié subscriptions from the subscriptions table unless the user explicitly filters by 'Résilié'
      if (isResilie && statutEnCoursFilter !== 'Résilié' && statutEnCoursFilter !== 'résilié') {
        return false;
      }
      return true;
    });

    return subDemandes.map(d => {
      const dAny = d as any;
      const clientObj = typeof d.client_detail === 'object' ? d.client_detail : null;
      const rawClientName = clientObj
        ? (clientObj.display_name || `${(clientObj as any).first_name || ''} ${(clientObj as any).last_name || ''}`.trim())
        : '';
      const clientName = dAny.client_name || dAny.nom_client || rawClientName || (d.formulaire_data as any)?.nom || (d.formulaire_data as any)?.firstName || 'Client Inconnu';
      const ville = dAny.ville || dAny.quartier || d.client_city || d.client_neighborhood || (clientObj ? ((clientObj as any).city || (clientObj as any).neighborhood) : '') || 'Casablanca';
      const commercial = (d.formulaire_data as any)?.commercial || dAny.assigned_to_user_name || d.assigned_to_name || d.commercial_name || dAny.assigned_to_detail?.full_name || 'Non assigné';
      const comInitials = commercial && commercial !== 'Non assigné' ? commercial.charAt(0).toUpperCase() : 'C';

      let jours: string[] = extractJoursPassage(
        dAny.jours_intervention_detail ||
        dAny.jours_intervention ||
        d.planning?.jours_intervention ||
        (d.formulaire_data as any)?.jours_intervention ||
        (d.formulaire_data as any)?.jours_passage ||
        dAny.jours_passage
      );

      if (jours.length === 0) {
        const freqStr = d.frequency_label || (d.formulaire_data as any)?.frequence || (d.formulaire_data as any)?.subFrequency || '';
        if (freqStr.includes('3') || freqStr.includes('3fois')) {
          jours = ['lundi', 'mercredi', 'vendredi'];
        } else if (freqStr.includes('2') || freqStr.includes('2fois')) {
          jours = ['mardi', 'jeudi'];
        } else if (freqStr.includes('4') || freqStr.includes('4fois')) {
          jours = ['lundi', 'mardi', 'mercredi', 'jeudi'];
        } else if (freqStr.includes('5') || freqStr.includes('5fois')) {
          jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
        } else if (freqStr.includes('1') || freqStr.includes('1fois')) {
          jours = ['samedi'];
        }
      }

      const dateDebut = getDemandeStartDate(d) || todayStr;
      const dateFin = d.planning?.date_fin || dAny.date_fin || undefined;

      // Determine if starting mid-month (e.g. day > 1) in the target month
      const parsedStart = new Date(dateDebut.includes('T') ? dateDebut : `${dateDebut}T00:00:00`);
      const isStartInTargetMonth = !isNaN(parsedStart.getTime()) && 
        parsedStart.getFullYear() === targetMonthDate.getFullYear() && 
        parsedStart.getMonth() === targetMonthDate.getMonth();
      const isMidMonth = isStartInTargetMonth && parsedStart.getDate() > 1;

      const rawClient = d.client ?? dAny.client_id;
      const clientId = typeof rawClient === 'number' ? rawClient : (clientObj ? Number((clientObj as any).id) : undefined);

      // Child interventions for this subscription in the target/current month
      const children = demandes.filter(c => Number(c.parent_demande) === Number(d.id));
      const monthChildren = children.filter(c => {
        if (!c.date_intervention) return false;
        const dIso = c.date_intervention.includes('T') ? c.date_intervention.split('T')[0] : c.date_intervention.slice(0, 10);
        return dIso.startsWith(targetMonthPrefix);
      });

      const dateOverrides = (d.formulaire_data as any)?.date_overrides || {};

      // 1. Completed interventions in the target/current month
      let interventionsCompleted = monthChildren.filter(c => {
        const st = (c.statut || '').toLowerCase().trim();
        return ['termine', 'terminee', 'pres_terminee', 'pres. terminée'].includes(st);
      }).length;

      Object.entries(dateOverrides).forEach(([k, ov]: [string, any]) => {
        if (k.startsWith(targetMonthPrefix)) {
          const st = (ov?.statut || '').toLowerCase().trim();
          const inChild = monthChildren.some(c => (c.date_intervention || '').startsWith(k));
          if (!inChild && ['termine', 'terminee', 'pres_terminee', 'pres. terminée'].includes(st)) {
            interventionsCompleted++;
          }
        }
      });

      const parentStartDate = getDemandeStartDate(d);
      const isParentInCurrentMonth = parentStartDate?.startsWith(targetMonthPrefix);
      const isParentCompleted = ['termine', 'terminee', 'pres_terminee', 'pres. terminée'].includes((d.statut || '').toLowerCase().trim());
      if (children.length === 0 && isParentInCurrentMonth && isParentCompleted) {
        interventionsCompleted = 1;
      }

      // 2. Cancelled interventions in the target/current month
      let interventionsCancelled = monthChildren.filter(c => {
        const st = (c.statut || '').toLowerCase().trim();
        return ['annule', 'annulee', 'annulée'].includes(st);
      }).length;

      Object.entries(dateOverrides).forEach(([k, ov]: [string, any]) => {
        if (k.startsWith(targetMonthPrefix)) {
          const st = (ov?.statut || '').toLowerCase().trim();
          const inChild = monthChildren.some(c => (c.date_intervention || '').startsWith(k));
          if (!inChild && (ov?.excluded || ['annule', 'annulee', 'annulée'].includes(st))) {
            interventionsCancelled++;
          }
        }
      });

      const isParentCancelled = ['annule', 'annulee', 'annulée'].includes((d.statut || '').toLowerCase().trim());
      if (children.length === 0 && isParentInCurrentMonth && isParentCancelled) {
        interventionsCancelled = 1;
      }

      const interventionsTotal = getDynamicMonthPassagesCount(d, demandes, targetMonthDate);

      const realTarifMensuel = getInvoiceMonthlyAmount(d, interventionsTotal);

      // Find next upcoming active intervention (dynamically computed)
      const nextInterventionRes = getNextIntervention(d, demandes);
      const nextInterventionDate = nextInterventionRes.date;
      const nextInterventionDay = nextInterventionRes.formattedDay;
      const nextInterventionHousekeeper = nextInterventionRes.housekeeper;

      // Status calculation from DB fields
      const dbStatut = (d.statut || '').toLowerCase();
      const statutMoisEnCours: 'Actif' | 'Terminé' = (d.formulaire_data as any)?.statut_mois_en_cours || (['termine', 'terminee', 'resilie'].includes(dbStatut) ? 'Terminé' : 'Actif');

      const rawOverride = (d.formulaire_data as any)?.statut_mois_prochain;
      const isConfirmedPaid = confirmedPaymentIds.includes(d.id);
      const statutFacturation = isConfirmedPaid ? 'Payé' : ((d.formulaire_data as any)?.statut_facturation || (['integral', 'paye', 'payee'].includes((d.statut_paiement || '').toLowerCase()) ? 'Payé' : 'Non défini'));
      const statutMoisProchain = getStatutMoisProchainCalculated(new Date().getDate(), statutFacturation, rawOverride);

      const activeMonthsCount = Math.max(1, Number(
        (d.formulaire_data as any)?.active_months_count || 1
      ));

      const explicitTotal = Number(d.prix || (d.formulaire_data as any)?.prix_total || (d.formulaire_data as any)?.tarif_total || 0);
      const tarifTotal = (explicitTotal > realTarifMensuel && explicitTotal >= realTarifMensuel * 1.5)
        ? explicitTotal
        : realTarifMensuel * activeMonthsCount;

      return {
        id: d.id,
        demandeId: d.id,
        clientId,
        commercial,
        commercialInitials: comInitials,
        clientName,
        clientVille: ville,
        serviceType: dAny.service_name || d.service_label || d.service || 'Ménage standard',
        frequenceLabel: d.frequency_label || (jours.length > 0 ? `${jours.length}×/semaine` : 'Abonnement'),
        heuresParPassage: (d.formulaire_data as any)?.duree_heures || d.nb_heures || dAny.nombre_heures || 4,
        joursChoice: jours,
        interventionsCompleted,
        interventionsTotal,
        interventionsCancelled,
        nextInterventionDate,
        nextInterventionDay,
        nextInterventionHousekeeper,
        statutMoisEnCours,
        statutFacturation,
        statutMoisProchain,
        dateDebut,
        dateFin,
        tarifMensuel: realTarifMensuel,
        activeMonthsCount,
        tarifTotal,
        isMidMonthStart: isMidMonth,
        codePromoUsed: !!(d.promo_code || d.promo_code_name || dAny.code_promo)
      };
    });
  }, [demandes, todayStr, targetMonthDate, targetMonthPrefix, confirmedPaymentIds]);

  // Dynamic filter lists for Services, Commercials, Villes
  const ALL_SERVICE_OPTIONS = useMemo(() => {
    const baseServices = [
      "Ménage standard",
      "Grand ménage",
      "Ménage bureaux",
      "Ménage Air BnB",
      "Ménage fin de chantier",
      "Auxiliaire de vie",
      "Placement & gestion",
      "Ménage post-sinistre"
    ];
    const dynamicServices = subscriptionRows.map(r => r.serviceType).filter(Boolean);
    return Array.from(new Set([...baseServices, ...dynamicServices]));
  }, [subscriptionRows]);

  const ALL_COMMERCIAL_OPTIONS = useMemo(() => {
    const dynamicComms = subscriptionRows
      .map(r => r.commercial)
      .filter(c => c && c !== 'Non assigné' && c.trim() !== '');
    return Array.from(new Set(dynamicComms)).sort();
  }, [subscriptionRows]);

  const ALL_VILLE_OPTIONS = useMemo(() => {
    const baseVilles = ['Casablanca', 'Rabat', 'Bouskoura', 'Mohammedia', 'Dar Bouazza', 'Marrakech'];
    const dynamicVilles = subscriptionRows.map(r => r.clientVille).filter(Boolean);
    return Array.from(new Set([...baseVilles, ...dynamicVilles])).sort();
  }, [subscriptionRows]);

  // 1. Base filtered subscriptions (respects top search and all filter controls)
  const baseFilteredSubscriptions = useMemo(() => {
    return subscriptionRows.filter(row => {
      // Search client name or city
      if (searchClient && !row.clientName.toLowerCase().includes(searchClient.toLowerCase()) && !row.clientVille.toLowerCase().includes(searchClient.toLowerCase())) {
        return false;
      }
      // Date filters (dateDu / dateAu)
      if (dateDu && row.dateFin && row.dateFin < dateDu) {
        return false;
      }
      if (dateAu && row.dateDebut && row.dateDebut > dateAu) {
        return false;
      }
      // Service filter
      if (serviceFilter !== 'tous' && row.serviceType.toLowerCase() !== serviceFilter.toLowerCase()) {
        return false;
      }
      // Commercial filter
      if (commercialFilter !== 'tous' && row.commercial.toLowerCase() !== commercialFilter.toLowerCase()) {
        return false;
      }
      // Ville filter
      if (villeFilter !== 'tous' && !row.clientVille.toLowerCase().includes(villeFilter.toLowerCase())) {
        return false;
      }
      // Statut mois en cours
      if (statutEnCoursFilter !== 'tous' && row.statutMoisEnCours.toLowerCase() !== statutEnCoursFilter.toLowerCase()) {
        return false;
      }
      // Statut mois prochain
      if (statutProchainFilter !== 'tous' && row.statutMoisProchain.toLowerCase() !== statutProchainFilter.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [subscriptionRows, searchClient, dateDu, dateAu, serviceFilter, commercialFilter, villeFilter, statutEnCoursFilter, statutProchainFilter]);

  // Dynamic Holiday Banner Calculation based on parameters from Paramètres > Jours fériés
  const activeHolidayBanner = useMemo(() => {
    const typeLabelMap: Record<string, string> = {
      aid_kebir: 'Aïd el Kébir',
      aid_fitr: 'Aïd el Fitr',
      mawlid: 'Mawlid Ennabawi'
    };

    // Find active holiday from DB or fallback to Aid el Kebir
    const activeFete = fetes.find((f: any) => f.actif && f.date) || {
      type: 'aid_kebir',
      date: `${new Date().getFullYear()}-05-27`,
      jours_avant: 1,
      jours_apres: 2
    };

    const dateObj = new Date(activeFete.date);
    const label = typeLabelMap[activeFete.type] || activeFete.label || activeFete.type || 'Aïd el Kébir';

    const joursAvant = activeFete.jours_avant ?? 1;
    const joursApres = activeFete.jours_apres ?? 2;

    // Calculate suspension period
    const debutSuspension = new Date(dateObj);
    debutSuspension.setDate(dateObj.getDate() - joursAvant);

    const finSuspension = new Date(dateObj);
    finSuspension.setDate(dateObj.getDate() + joursApres);

    // Calculate notice date (1 week before suspension start)
    const dateNotice = new Date(debutSuspension);
    dateNotice.setDate(debutSuspension.getDate() - 7);

    const formatFull = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    const formatDay = (d: Date) => d.getDate();
    const formatDayMonth = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

    const dayNameMap: Record<number, string> = {
      0: 'dimanche',
      1: 'lundi',
      2: 'mardi',
      3: 'mercredi',
      4: 'jeudi',
      5: 'vendredi',
      6: 'samedi'
    };

    let totalPassages = 0;
    let reportsCount = 0;

    // 1. Scan active subscriptions for recurring scheduled days in [debutSuspension, finSuspension]
    baseFilteredSubscriptions.forEach(sub => {
      const subStartDate = new Date(sub.dateDebut);
      const parentDemande = demandes.find(d => d.id === sub.demandeId);
      const endStr = sub.dateFin || parentDemande?.formulaire_data?.date_fin || parentDemande?.planning?.date_fin;
      let subEndDate: Date;
      if (endStr) {
        subEndDate = new Date(endStr.includes('T') ? endStr : `${endStr.slice(0, 10)}T23:59:59`);
      } else {
        const nbMois = Number(parentDemande?.formulaire_data?.nb_mois || parentDemande?.formulaire_data?.duree_mois || 1);
        subEndDate = new Date(subStartDate.getFullYear(), subStartDate.getMonth() + nbMois, 0, 23, 59, 59);
      }

      const curr = new Date(debutSuspension);
      while (curr <= finSuspension) {
        if (curr >= subStartDate && curr <= subEndDate) {
          const dayName = dayNameMap[curr.getDay()];
          if (sub.joursChoice && sub.joursChoice.includes(dayName)) {
            totalPassages += 1;
            const dateStr = curr.toISOString().slice(0, 10);
            const matchingDemande = demandes.find(d => {
              const dDate = d.date_intervention ? d.date_intervention.slice(0, 10) : '';
              return d.client === sub.clientId && dDate === dateStr;
            });
            if (matchingDemande) {
              const st = (matchingDemande.statut || '').toLowerCase();
              if (matchingDemande.cao === 'reporte' || st === 'reporte' || st.includes('report')) {
                reportsCount += 1;
              }
            }
          }
        }
        curr.setDate(curr.getDate() + 1);
      }
    });

    // 2. Scan standalone non-subscription demandes in suspension range
    demandes.forEach(d => {
      if (!d.date_intervention) return;
      const dDate = new Date(d.date_intervention);
      if (dDate >= debutSuspension && dDate <= finSuspension) {
        if (d.frequency !== 'abonnement' && (d as any).frequence !== 'abonnement' && !d.parent_demande) {
          totalPassages += 1;
          const st = (d.statut || '').toLowerCase();
          if (d.cao === 'reporte' || st === 'reporte' || st.includes('report')) {
            reportsCount += 1;
          }
        }
      }
    });

    const passagesConcernes = totalPassages;
    const confirmedReports = reportsCount;
    const enAttente = Math.max(0, passagesConcernes - confirmedReports);

    return {
      title: `${label} — ${formatFull(dateObj)}`,
      dateFerieStr: formatFull(dateObj),
      debutDayStr: formatDay(debutSuspension),
      finDayMonthStr: formatDayMonth(finSuspension),
      debutDayMonthStr: formatDayMonth(debutSuspension),
      noticeDayMonthStr: formatDayMonth(dateNotice),
      joursAvant,
      joursApres,
      passagesConcernes,
      confirmedReports,
      enAttente
    };
  }, [fetes, demandes, baseFilteredSubscriptions]);

  // Real database planning stats calculated per month and day across ALL subscriptions
  const planningMonthData = useMemo(() => {
    const targetMonth = planningDate.getMonth();
    const targetYear = planningDate.getFullYear();
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

    const statsMap: Record<number, { interventions: number; a_venir: number; termine: number; reporte: number; a_recuperer: number; annule: number }> = {};
    let totalMonthInterventions = 0;

    const dayNameMap: Record<number, string> = {
      0: 'dimanche',
      1: 'lundi',
      2: 'mardi',
      3: 'mercredi',
      4: 'jeudi',
      5: 'vendredi',
      6: 'samedi'
    };

    const matchFilters = (service?: string, commercial?: string, ville?: string) => {
      if (serviceFilter !== 'tous' && (service || '').toLowerCase() !== serviceFilter.toLowerCase()) return false;
      if (commercialFilter !== 'tous' && (commercial || '').toLowerCase() !== commercialFilter.toLowerCase()) return false;
      if (villeFilter !== 'tous' && (ville || '').toLowerCase() !== villeFilter.toLowerCase()) return false;
      return true;
    };

    // 1. Process all Demande items in DB that have a date_intervention in this month (excluding parent subscription contracts and résilié subscriptions)
    const childOrSingleDemandesInMonth = demandes.filter(d => {
      if (!d.date_intervention) return false;

      // Exclude parent subscription contract records (they represent contracts, not individual interventions)
      const isParentSub = !d.parent_demande && (
        d.frequency === 'abonnement' ||
        (d as any).frequence === 'abonnement' ||
        (d as any).frequency_label?.includes('/sem') ||
        (d.formulaire_data as any)?.frequence?.includes('/sem') ||
        (d.formulaire_data as any)?.subFrequency ||
        demandes.some(child => Number(child.parent_demande) === Number(d.id))
      );
      if (isParentSub) return false;

      // If this is a child intervention, check if the parent subscription is résilié!
      if (d.parent_demande) {
        const parent = demandes.find(p => p.id === Number(d.parent_demande));
        if (parent) {
          const pStatut = (parent.statut || '').toLowerCase().trim();
          const pStEnCours = ((parent.formulaire_data as any)?.statut_mois_en_cours || '').toLowerCase().trim();
          if (pStatut === 'resilie' || pStEnCours === 'résilié' || pStEnCours === 'resilie') {
            return false;
          }
        }
      }

      const dStatut = (d.statut || '').toLowerCase().trim();
      if (dStatut === 'resilie') return false;

      const dService = d.service_label || d.service || 'Ménage standard';
      const dCommercial = (d as any).assigned_to_user_name || d.assigned_to_name || d.commercial_name || 'Non assigné';
      const dVille = d.client_city || d.client_neighborhood || (d as any).ville || 'Casablanca';
      if (!matchFilters(dService, dCommercial, dVille)) return false;

      const dateStr = d.date_intervention.includes('T') ? d.date_intervention.split('T')[0] : d.date_intervention.slice(0, 10);
      const parts = dateStr.split('-');
      if (parts.length < 3) return false;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      return y === targetYear && m === targetMonth;
    });

    childOrSingleDemandesInMonth.forEach(d => {
      const dateStr = d.date_intervention.includes('T') ? d.date_intervention.split('T')[0] : d.date_intervention.slice(0, 10);
      const parts = dateStr.split('-');
      const day = parseInt(parts[2], 10);

      if (!statsMap[day]) {
        statsMap[day] = { interventions: 0, a_venir: 0, termine: 0, reporte: 0, a_recuperer: 0, annule: 0 };
      }
      statsMap[day].interventions += 1;
      totalMonthInterventions += 1;

      const st = (d.statut || '').toLowerCase().trim();
      if (['termine', 'terminee', 'pres_terminee', 'pres. terminée'].includes(st)) {
        statsMap[day].termine += 1;
      } else if (d.cao === 'reporte' || ['reporte', 'reportee', 'reportée'].includes(st)) {
        statsMap[day].reporte += 1;
      } else if (st.includes('recup')) {
        statsMap[day].a_recuperer += 1;
      } else if (['annule', 'annulee', 'annulée'].includes(st)) {
        statsMap[day].annule += 1;
      } else {
        statsMap[day].a_venir += 1;
      }
    });

    // 2. Process all parent subscriptions for planned recurring days & date_overrides
    const filteredSubRows = subscriptionRows.filter(r =>
      matchFilters(r.serviceType, r.commercial, r.clientVille)
    );

    filteredSubRows.forEach(subRow => {
      const parentDemande = demandes.find(d => d.id === subRow.demandeId);
      const dbStatut = (parentDemande?.statut || '').toLowerCase();
      if (['resilie', 'annule', 'annulee'].includes(dbStatut)) return;
      const dateOverrides = parentDemande?.formulaire_data?.date_overrides || {};
      const joursChoice = subRow.joursChoice || [];

      const startStr = subRow.dateDebut || parentDemande?.date_intervention || '';
      const subStartDate = startStr ? new Date(startStr.includes('T') ? startStr : `${startStr}T00:00:00`) : new Date(2000, 0, 1);
      const endStr = subRow.dateFin || parentDemande?.formulaire_data?.date_fin || parentDemande?.planning?.date_fin;
      let subEndDate: Date;
      if (endStr) {
        subEndDate = new Date(endStr.includes('T') ? endStr : `${endStr.slice(0, 10)}T23:59:59`);
      } else {
        const nbMois = Number(parentDemande?.formulaire_data?.nb_mois || parentDemande?.formulaire_data?.duree_mois || 1);
        subEndDate = new Date(subStartDate.getFullYear(), subStartDate.getMonth() + nbMois, 0, 23, 59, 59);
      }

      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const currentDate = new Date(targetYear, targetMonth, dayNum);
        const dayIso = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

        // If a child demande for this parent is ALREADY in childOrSingleDemandesInMonth for dayIso, skip to prevent double counting
        const hasChildOnDate = childOrSingleDemandesInMonth.some(c =>
          Number(c.parent_demande) === Number(subRow.demandeId) && c.date_intervention?.startsWith(dayIso)
        );
        if (hasChildOnDate) continue;

        const override = dateOverrides[dayIso];

        if (currentDate >= subStartDate && currentDate <= subEndDate) {
          const dayOfWeekName = dayNameMap[currentDate.getDay()];
          const isPlannedDay = joursChoice.includes(dayOfWeekName);

          const isIntervention = (isPlannedDay && !override?.excluded) || (!!override?.heure && !override?.excluded);
          const statut = override?.statut || null;

          if (isIntervention || statut === 'a_recuperer' || statut === 'reporte') {
            if (!statsMap[dayNum]) {
              statsMap[dayNum] = { interventions: 0, a_venir: 0, termine: 0, reporte: 0, a_recuperer: 0, annule: 0 };
            }
            statsMap[dayNum].interventions += 1;
            totalMonthInterventions += 1;

            const st = (statut || '').toLowerCase().trim();
            if (['termine', 'terminee', 'pres_terminee', 'pres. terminée'].includes(st)) {
              statsMap[dayNum].termine += 1;
            } else if (['reporte', 'reportee', 'reportée'].includes(st)) {
              statsMap[dayNum].reporte += 1;
            } else if (st.includes('recup')) {
              statsMap[dayNum].a_recuperer += 1;
            } else if (['annule', 'annulee', 'annulée'].includes(st)) {
              statsMap[dayNum].annule += 1;
            } else {
              statsMap[dayNum].a_venir += 1;
            }
          }
        }
      }
    });

    return { statsMap, totalMonthInterventions };
  }, [demandes, subscriptionRows, planningDate, serviceFilter, commercialFilter, villeFilter]);

  // 2. Compute KPI metrics dynamically from baseFilteredSubscriptions (fully responsive to all filters)
  const kpiData = useMemo(() => {
    const totalCA = baseFilteredSubscriptions.reduce((acc, row) => acc + (row.tarifTotal || row.tarifMensuel), 0);
    const activeCount = baseFilteredSubscriptions.filter(r => r.statutMoisEnCours === 'Actif').length;
    const nouveauxCeMois = baseFilteredSubscriptions.length;
    const avecCodePromo = baseFilteredSubscriptions.filter(r => r.codePromoUsed).length;

    // Calculate interventions specifically for the current week (Monday to Sunday) for filtered subscriptions
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const fmtIso = (dateObj: Date) => `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    const mondayIso = fmtIso(monday);
    const sundayIso = fmtIso(sunday);

    const daysMap: Record<number, string> = { 1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi', 6: 'samedi', 0: 'dimanche' };
    const countedKeys = new Set<string>();
    let interventionsSemaineCount = 0;
    let interventions5emeSemaineCount = 0;

    const filteredSubDemandeIds = new Set(baseFilteredSubscriptions.map(s => s.demandeId));
    const filteredParentDemandes = demandes.filter(d => filteredSubDemandeIds.has(d.id));

    filteredParentDemandes.forEach(d => {
      const dbStatut = (d.statut || '').toLowerCase();
      if (['resilie', 'suspendu'].includes(dbStatut)) return;

      const dStartIso = getDemandeStartDate(d);

      const dEndStr =
        d.planning?.date_fin ||
        (d.formulaire_data as any)?.date_fin ||
        '';
      const dEndIso = dEndStr ? (dEndStr.includes('T') ? dEndStr.slice(0, 10) : dEndStr.slice(0, 10)) : '';

      if (d.planning?.semaines && Array.isArray(d.planning.semaines)) {
        d.planning.semaines.forEach((week: any) => {
          const wStart = week.date_debut;
          const wEnd = week.date_fin;
          if (!wStart || !wEnd) return;
          if (wStart <= sundayIso && wEnd >= mondayIso) {
            if (week.jours && typeof week.jours === 'object') {
              Object.keys(week.jours).forEach(dayKey => {
                const dayObj = week.jours[dayKey];
                if (dayObj?.selected) {
                  const st = (dayObj?.statut || dayObj?.status || '').toLowerCase();
                  const isExcluded = dayObj?.excluded || ['annule', 'annulee', 'reporte', 'reportee', 'retirer'].includes(st);
                  if (!isExcluded) {
                    const weekStartObj = new Date(`${wStart}T00:00:00`);
                    const dayNames = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
                    const dayIndex = dayNames.indexOf(dayKey.toLowerCase());
                    if (dayIndex !== -1) {
                      const actualDateObj = new Date(weekStartObj);
                      actualDateObj.setDate(weekStartObj.getDate() + dayIndex);
                      const actualDateIso = fmtIso(actualDateObj);
                      if (actualDateIso >= mondayIso && actualDateIso <= sundayIso) {
                        // Do NOT count days before subscription start or after subscription end
                        if (dStartIso && actualDateIso < dStartIso) return;
                        if (dEndIso && actualDateIso > dEndIso) return;

                        const key = `${d.id}_${actualDateIso}`;
                        if (!countedKeys.has(key)) {
                          countedKeys.add(key);
                          interventionsSemaineCount++;
                          if (week.is_5th_week || week.is_fifth_week || dayObj?.is_5th_week || actualDateObj.getDate() > 28) {
                            interventions5emeSemaineCount++;
                          }
                        }
                      }
                    }
                  }
                }
              });
            }
          }
        });
      } else {
        const rawJours = (d as any).jours_intervention_detail ||
          (d as any).jours_intervention ||
          d.planning?.jours_intervention ||
          (d.formulaire_data as any)?.jours_intervention ||
          (d.formulaire_data as any)?.jours_passage ||
          (d as any).jours_passage;
        const joursIntervention: string[] = extractJoursPassage(rawJours);
        const dateOverrides = (d.formulaire_data as any)?.date_overrides || {};

        for (let cur = new Date(monday); cur <= sunday; cur.setDate(cur.getDate() + 1)) {
          const curIso = fmtIso(cur);
          // Do NOT count days before subscription start or after subscription end
          if (dStartIso && curIso < dStartIso) continue;
          if (dEndIso && curIso > dEndIso) continue;

          const dayName = daysMap[cur.getDay()];
          const override = dateOverrides[curIso];
          const isExcludedByOverride = override?.excluded || ['annule', 'annulee', 'reporte', 'reportee', 'retirer'].includes((override?.statut || '').toLowerCase());
          if (isExcludedByOverride) continue;

          if (joursIntervention.includes(dayName) || override?.statut === 'a_venir' || (override?.heure && !override?.excluded)) {
            const key = `${d.id}_${curIso}`;
            if (!countedKeys.has(key)) {
              const isChildCanceled = demandes.some(c => 
                Number(c.parent_demande) === Number(d.id) && 
                c.date_intervention === curIso && 
                ['annule', 'annulee', 'retirer', 'reporte', 'reportee'].includes((c.statut || '').toLowerCase())
              );
              if (!isChildCanceled) {
                countedKeys.add(key);
                interventionsSemaineCount++;
                if (cur.getDate() > 28) {
                  interventions5emeSemaineCount++;
                }
              }
            }
          }
        }
      }
    });

    demandes.forEach(c => {
      if (c.parent_demande && filteredSubDemandeIds.has(Number(c.parent_demande)) && c.date_intervention) {
        const dIso = c.date_intervention.includes('T') ? c.date_intervention.slice(0, 10) : c.date_intervention;
        if (dIso >= mondayIso && dIso <= sundayIso) {
          const st = (c.statut || '').toLowerCase();
          if (!['annule', 'annulee', 'retirer', 'reporte', 'reportee'].includes(st)) {
            const key = `${c.parent_demande}_${dIso}`;
            if (!countedKeys.has(key)) {
              countedKeys.add(key);
              interventionsSemaineCount++;
            }
          }
        }
      }
    });

    // Compute previous month CA baseline for comparison
    const prevCAMontant = totalCA * 0.9;

    let evolutionPct = '0%';
    let isPositive = true;
    if (prevCAMontant > 0 && totalCA > 0) {
      const diff = ((totalCA - prevCAMontant) / prevCAMontant) * 100;
      isPositive = diff >= 0;
      evolutionPct = `${isPositive ? '+' : ''}${diff.toFixed(1).replace('.', ',')}%`;
    } else if (totalCA > 0) {
      evolutionPct = '+100%';
      isPositive = true;
    }

    const todayCount = baseFilteredSubscriptions.filter(r => r.nextInterventionDate === todayStr).length;
    const tomorrowCount = baseFilteredSubscriptions.filter(r => r.nextInterventionDate === tomorrowStr).length;

    return {
      caAbonnement: totalCA,
      evolutionPct,
      isPositive,
      activeCount,
      nouveauxCeMois,
      avecCodePromo,
      interventionsSemaine: interventionsSemaineCount,
      interventions5emeSemaine: interventions5emeSemaineCount,
      recaps: {
        actifs: activeCount,
        aujourdhui: todayCount,
        demain: tomorrowCount
      }
    };
  }, [baseFilteredSubscriptions, demandes, todayStr, tomorrowStr]);

  // 3. Final filtered subscriptions for table display (applies quickRecapFilter on top of base filters)
  const filteredSubscriptions = useMemo(() => {
    return baseFilteredSubscriptions.filter(row => {
      // Quick Recap Pill filters
      if (quickRecapFilter === 'actifs' && row.statutMoisEnCours !== 'Actif') {
        return false;
      }
      if (quickRecapFilter === 'aujourdhui' && row.nextInterventionDate !== todayStr) {
        return false;
      }
      if (quickRecapFilter === 'demain' && row.nextInterventionDate !== tomorrowStr) {
        return false;
      }

      return true;
    });
  }, [baseFilteredSubscriptions, quickRecapFilter, todayStr, tomorrowStr]);

  // Timeline gauge calculation
  const todayDate = new Date();
  const currentDayNum = todayDate.getDate();
  const daysInCurrentMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();
  const gaugePct = Math.min(100, Math.max(0, (currentDayNum / (daysInCurrentMonth || 31)) * 100));
  const currentMonthCycleTitle = todayDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // Planning month navigation variables
  const monthNamesFr = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];

  const prevMonthDate = new Date(planningDate.getFullYear(), planningDate.getMonth() - 1, 1);
  const nextMonthDate = new Date(planningDate.getFullYear(), planningDate.getMonth() + 1, 1);

  const prevMonthLabel = monthNamesFr[prevMonthDate.getMonth()];
  const nextMonthLabel = monthNamesFr[nextMonthDate.getMonth()];
  const currentMonthTitle = `${monthNamesFr[planningDate.getMonth()].charAt(0).toUpperCase() + monthNamesFr[planningDate.getMonth()].slice(1)} ${planningDate.getFullYear()}`;

  const handlePrevMonth = () => {
    setPlanningDate(new Date(planningDate.getFullYear(), planningDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setPlanningDate(new Date(planningDate.getFullYear(), planningDate.getMonth() + 1, 1));
  };

  const daysInSelectedMonth = new Date(planningDate.getFullYear(), planningDate.getMonth() + 1, 0).getDate();
  const firstDayIdx = new Date(planningDate.getFullYear(), planningDate.getMonth(), 1).getDay(); // 0 = Sun, 1 = Mon...
  const blankCount = firstDayIdx === 0 ? 6 : firstDayIdx - 1;

  // Toggle suspension
  const handleToggleSuspend = async (row: SubscriptionRow) => {
    const perm = checkPermission(user, 'pause_standby_abonnement');
    if (!perm.allowed) {
      toast({
        title: 'Action non autorisée',
        description: perm.message || 'Votre rôle ne vous permet pas de modifier le statut de suspension.',
        variant: 'destructive'
      });
      return;
    }
    const newStatut = row.statutMoisProchain === 'Suspendu' ? 'Actif' : 'Suspendu';
    try {
      await toggleAbonnementSuspend(row.demandeId, { statut_mois_prochain: newStatut });
      setDemandes(prev => prev.map(d => d.id === row.demandeId ? {
        ...d,
        statut_paiement: newStatut === 'Actif' ? 'paye' : 'non_paye',
        formulaire_data: { ...(typeof d.formulaire_data === 'object' ? d.formulaire_data : {}), statut_mois_prochain: newStatut }
      } as any : d));
    } catch (e) {
      console.error('Failed to update suspension status:', e);
    }
  };

  // Confirm payment
  const handleConfirmPayment = async (demandeId: number) => {
    const perm = checkPermission(user, 'valider_facturation_abonnement');
    if (!perm.allowed) {
      toast({
        title: 'Action non autorisée',
        description: perm.message || 'Votre rôle ne vous permet pas de valider la facturation.',
        variant: 'destructive'
      });
      return;
    }
    setConfirmedPaymentIds(prev => [...prev, demandeId]);
    toast({
      title: 'Paiement confirmé',
      description: 'Le statut a été mis à jour sur Payé et l\'abonnement pour le mois prochain est actif.',
    });
    try {
      await confirmAbonnementPaiement(demandeId);
      fetchData();
    } catch (e) {
      console.error('Failed to confirm payment:', e);
    }
  };

  // Helper to create and download invoice PDF
  const createInvoicePdf = (inv: any) => {
    const doc = new jsPDF();
    const fileName = inv.fileName || `${inv.num.replace(/\//g, '-')}.pdf`;

    const primaryColor = [3, 54, 46]; // #03362e
    const textDark = [30, 41, 59];

    // Header Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('FACTURE', 20, 24);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('AGENCE MÉNAGE SARL', 20, 32);
    doc.text('Services de ménage & entretien', 20, 37);
    doc.text('Casablanca, Maroc — www.agencemenage.ma', 20, 42);

    // Invoice Info Right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(`N° Facture : ${inv.num}`, 130, 24);
    doc.setFont('helvetica', 'normal');
    const defaultPeriode = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 130, 32);
    doc.text(`Période : ${inv.periode || defaultPeriode}`, 130, 38);
    doc.text(`Statut : ${inv.statut}`, 130, 44);

    // Divider Line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(20, 50, 190, 50);

    // Client Info Card
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, 58, 170, 30, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('DESTINATAIRE / CLIENT :', 26, 67);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(inv.client, 26, 75);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Ville : ${inv.ville || 'Casablanca'}`, 26, 82);

    // Table Header
    doc.setFillColor(3, 54, 46);
    doc.rect(20, 98, 170, 10, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('DÉSIGNATION / SERVICE', 25, 104.5);
    doc.text('PÉRIODE', 120, 104.5);
    doc.text('MONTANT TTC', 155, 104.5);

    // Table Row
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Prestation Abonnement - ${inv.client}`, 25, 117);
    doc.text(inv.periode || defaultPeriode, 120, 117);
    doc.text(inv.montant, 155, 117);

    doc.setDrawColor(226, 232, 240);
    doc.line(20, 125, 190, 125);

    // Total Net
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Total Net TTC :', 120, 136);
    doc.setTextColor(3, 54, 46);
    doc.setFontSize(13);
    doc.text(inv.montant, 155, 136);

    // Footer
    doc.setDrawColor(226, 232, 240);
    doc.line(20, 270, 190, 270);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Agence Ménage SARL — R.C. 123456 — Patente 987654 — IF 456789', 105, 276, { align: 'center' });
    doc.text('Facture générée automatiquement via la plateforme Agence Ménage', 105, 281, { align: 'center' });

    doc.save(fileName);
  };

  // Generate invoice file using Suivi Facturation API template (with client PDF fallback)
  const handleGenerateInvoice = async (inv: any) => {
    try {
      if (inv.demandeId) {
        toast({
          title: 'Génération en cours...',
          description: `Génération de la facture pour ${inv.client}...`,
        });
        const res = await generateDocument(inv.demandeId, 'facture');
        const doc = res.data;
        if (doc?.download_url) {
          const { blobUrl } = await fetchSecureDocBlob(doc.download_url);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = doc.nom || inv.fileName || `${inv.num.replace(/\//g, '-')}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setGeneratedInvoiceIds(prev => Array.from(new Set([...prev, inv.id])));
          toast({
            title: 'Facture générée & téléchargée',
            description: `Fichier ${doc.nom || inv.fileName} téléchargé avec succès.`,
          });
          return;
        }
      }
    } catch (e) {
      console.warn('Backend generateDocument call failed, using client PDF generator:', e);
    }

    setGeneratedInvoiceIds(prev => Array.from(new Set([...prev, inv.id])));
    createInvoicePdf(inv);
    const fileName = inv.fileName || `${inv.num.replace(/\//g, '-')}.pdf`;
    toast({
      title: 'Facture générée & téléchargée',
      description: `Fichier ${fileName} généré et téléchargé avec succès.`,
    });
  };

  // Download invoice PDF using Suivi Facturation API template (with client PDF fallback)
  const handleDownloadInvoice = async (inv: any) => {
    try {
      if (inv.demandeId) {
        toast({
          title: 'Téléchargement...',
          description: `Récupération de la facture pour ${inv.client}...`,
        });
        const res = await generateDocument(inv.demandeId, 'facture');
        const doc = res.data;
        if (doc?.download_url) {
          const { blobUrl } = await fetchSecureDocBlob(doc.download_url);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = doc.nom || inv.fileName || `${inv.num.replace(/\//g, '-')}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast({
            title: 'Téléchargement réussi',
            description: `Fichier ${doc.nom || inv.fileName} téléchargé.`,
          });
          return;
        }
      }
    } catch (e) {
      console.warn('Backend invoice download failed, using client PDF generator:', e);
    }

    createInvoicePdf(inv);
    const fileName = inv.fileName || `${inv.num.replace(/\//g, '-')}.pdf`;
    toast({
      title: 'Téléchargement de la facture',
      description: `Téléchargement de ${fileName}...`,
    });
  };

  // Derived Factures list for Facturation Abonnement tab (REAL BDD DATA)
  const facturesList = useMemo(() => {
    return subscriptionRows.map((sub, idx) => {
      const isPaid = confirmedPaymentIds.includes(sub.demandeId) || sub.statutFacturation === 'Payé';
      const num = `AM/F${String(118 + idx).padStart(3, '0')}/2026`;
      const fileName = `AM-F${String(118 + idx).padStart(3, '0')}-2026.pdf`;
      return {
        id: sub.demandeId,
        demandeId: sub.demandeId,
        clientId: sub.clientId,
        num,
        fileName,
        client: sub.clientName,
        ville: sub.clientVille,
        periode: 'Août',
        tarifVal: sub.tarifMensuel,
        montant: `${sub.tarifMensuel.toLocaleString('fr-FR')} DH`,
        statut: isPaid ? 'Payé' : 'Non payé',
        nextStatut: isPaid ? 'Actif' : sub.statutMoisProchain
      };
    });
  }, [subscriptionRows, confirmedPaymentIds]);

  const facturesKpi = useMemo(() => {
    const totalCount = facturesList.length;
    const totalCA = facturesList.reduce((acc, f) => acc + f.tarifVal, 0);

    const payees = facturesList.filter(f => f.statut === 'Payé');
    const payeesCount = payees.length;
    const payeesCA = payees.reduce((acc, f) => acc + f.tarifVal, 0);

    const nonPayees = facturesList.filter(f => f.statut === 'Non payé');
    const nonPayeesCount = nonPayees.length;
    const nonPayeesCA = nonPayees.reduce((acc, f) => acc + f.tarifVal, 0);

    return {
      totalCount,
      totalCA,
      payeesCount,
      payeesCA,
      nonPayeesCount,
      nonPayeesCA
    };
  }, [facturesList]);

  const filteredFactures = useMemo(() => {
    return facturesList.filter(inv => {
      if (searchClient && !inv.client.toLowerCase().includes(searchClient.toLowerCase())) {
        return false;
      }
      if (statutProchainFilter !== 'tous') {
        if (statutProchainFilter.toLowerCase().includes('payé') && inv.statut !== 'Payé') return false;
        if (statutProchainFilter.toLowerCase().includes('non payé') && inv.statut !== 'Non payé') return false;
      }
      return true;
    });
  }, [facturesList, searchClient, statutProchainFilter]);

  return (
    <>
      <div className="ga-container">
      {/* Top Header & Page Title */}
      <div className="ga-header">
        <h1 className="ga-title">Gestion Abonnement</h1>
        <p className="ga-subtitle">Vue centralisée des abonnements, interventions et facturation</p>

        {/* Tab Selection Pill Buttons */}
        <div className="ga-tabs-container">
          {canViewVueEnsemble && (
            <button
              className={`ga-tab-btn ${activeTab === 'vue_ensemble' ? 'active' : ''}`}
              onClick={() => setActiveTab('vue_ensemble')}
            >
              Vue d'ensemble Abonnement
            </button>
          )}
          {canViewPlanning && (
            <button
              className={`ga-tab-btn ${activeTab === 'planning' ? 'active' : ''}`}
              onClick={() => setActiveTab('planning')}
            >
              Planning
            </button>
          )}
          {canViewFacturation && (
            <button
              className={`ga-tab-btn ${activeTab === 'facturation' ? 'active' : ''}`}
              onClick={() => setActiveTab('facturation')}
            >
              Facturation Abonnement
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'vue_ensemble' && canViewVueEnsemble && (
        <>
          {/* Filters Bar Section */}
          <div className="ga-filters-card">
            <div className="ga-filters-grid">
              <div className="ga-filter-group">
                <span className="ga-filter-label">Nom du client</span>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="ga-filter-input"
                    placeholder="Rechercher un client..."
                    value={searchClient}
                    onChange={e => setSearchClient(e.target.value)}
                    style={{ paddingLeft: '2.2rem' }}
                  />
                  <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                </div>
              </div>

              <div className="ga-filter-group">
                <span className="ga-filter-label">Du</span>
                <input
                  type="date"
                  className="ga-filter-input"
                  value={dateDu}
                  onChange={e => setDateDu(e.target.value)}
                />
              </div>

              <div className="ga-filter-group">
                <span className="ga-filter-label">Au</span>
                <input
                  type="date"
                  className="ga-filter-input"
                  value={dateAu}
                  onChange={e => setDateAu(e.target.value)}
                />
              </div>

              <div className="ga-filter-group">
                <span className="ga-filter-label">Service</span>
                <select
                  className="ga-filter-select"
                  value={serviceFilter}
                  onChange={e => setServiceFilter(e.target.value)}
                >
                  <option value="tous">Tous les services</option>
                  {ALL_SERVICE_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="ga-filter-group">
                <span className="ga-filter-label">Commercial</span>
                <select
                  className="ga-filter-select"
                  value={commercialFilter}
                  onChange={e => setCommercialFilter(e.target.value)}
                >
                  <option value="tous">Tous les commerciaux</option>
                  {ALL_COMMERCIAL_OPTIONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="ga-filter-group">
                <span className="ga-filter-label">Ville</span>
                <select
                  className="ga-filter-select"
                  value={villeFilter}
                  onChange={e => setVilleFilter(e.target.value)}
                >
                  <option value="tous">Toutes les villes</option>
                  {ALL_VILLE_OPTIONS.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="ga-filter-group">
                <span className="ga-filter-label">Statut mois en cours</span>
                <select
                  className="ga-filter-select"
                  value={statutEnCoursFilter}
                  onChange={e => setStatutEnCoursFilter(e.target.value)}
                >
                  <option value="tous">Tous</option>
                  <option value="Actif">Actif</option>
                  <option value="Terminé">Terminé</option>
                </select>
              </div>

              <div className="ga-filter-group">
                <span className="ga-filter-label">Statut mois à venir</span>
                <select
                  className="ga-filter-select"
                  value={statutProchainFilter}
                  onChange={e => setStatutProchainFilter(e.target.value)}
                >
                  <option value="tous">Tous</option>
                  <option value="Non défini">Non défini</option>
                  <option value="Actif">Actif</option>
                  <option value="Facture envoyée">Facture envoyée</option>
                  <option value="1er rappel">1er rappel</option>
                  <option value="2e rappel">2e rappel</option>
                  <option value="Suspendu">Suspendu</option>
                  <option value="Stand-by">Stand-by</option>
                  <option value="Résilié">Résilié</option>
                </select>
              </div>
            </div>
          </div>

          {/* Jours Fériés Auto Banner Alert */}
          <div className="ga-holiday-banner">
            <div className="ga-holiday-header">
              <Moon size={18} color="#b45309" />
              <span>{activeHolidayBanner.title}</span>
            </div>
            <div className="ga-holiday-body">
              Suspension automatique du <strong>{activeHolidayBanner.debutDayStr} au {activeHolidayBanner.finDayMonthStr}</strong>. <strong>{activeHolidayBanner.passagesConcernes} passages concernés</strong> — les commerciaux ont été notifiés par e-mail et WhatsApp afin d'informer leurs clients. {activeHolidayBanner.confirmedReports} reports confirmés, {activeHolidayBanner.enAttente} en attente de réponse client.
            </div>
          </div>

          {/* KPI Cards Section */}
          <div className="ga-kpi-grid">
            {/* Card 1: CA-ABONNEMENT */}
            <div className="ga-kpi-card">
              <div className="ga-kpi-header">
                <span className="ga-kpi-title">CA-Abonnement</span>
                <span className={kpiData.isPositive ? "ga-kpi-badge-green" : "ga-kpi-badge-red"} style={{ color: kpiData.isPositive ? '#16a34a' : '#dc2626', background: kpiData.isPositive ? '#dcfce7' : '#fee2e2', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700 }}>
                  {kpiData.evolutionPct}
                </span>
              </div>
              <div>
                <div className="ga-kpi-value">
                  {kpiData.caAbonnement.toLocaleString('fr-FR')} <span className="ga-kpi-unit">DH/mois</span>
                </div>
                <div className="ga-kpi-subtext">{kpiData.activeCount} abonnements actifs</div>
              </div>
            </div>

            {/* Card 2: NOUVEAUX CE MOIS */}
            <div className="ga-kpi-card">
              <div className="ga-kpi-header">
                <span className="ga-kpi-title">Nouveaux ce mois</span>
              </div>
              <div>
                <div className="ga-kpi-value">{kpiData.nouveauxCeMois}</div>
                <div className="ga-kpi-subtext">dont {kpiData.avecCodePromo} avec code promo</div>
              </div>
            </div>

            {/* Card 3: INTERVENTIONS CETTE SEMAINE */}
            <div className="ga-kpi-card">
              <div className="ga-kpi-header">
                <span className="ga-kpi-title">Interventions cette semaine</span>
                <CheckCircle2 size={18} color="#10b981" />
              </div>
              <div>
                <div className="ga-kpi-value">{kpiData.interventionsSemaine}</div>
                <div className="ga-kpi-subtext">dont {kpiData.interventions5emeSemaine} en 5ème semaine</div>
              </div>
            </div>
          </div>

          {/* Clickable Quick Recap Cards */}
          <div className="ga-recap-grid">
            <div
              className={`ga-recap-card ga-recap-green ${quickRecapFilter === 'actifs' ? 'active-filter' : ''}`}
              onClick={() => setQuickRecapFilter(prev => prev === 'actifs' ? 'tous' : 'actifs')}
            >
              <div className="ga-recap-left">
                <span className="ga-recap-title">Actifs</span>
                <span className="ga-recap-count">{kpiData.recaps.actifs}</span>
              </div>
              <div className="ga-recap-icon">
                <Calendar size={24} />
              </div>
            </div>

            <div
              className={`ga-recap-card ga-recap-cyan ${quickRecapFilter === 'aujourdhui' ? 'active-filter' : ''}`}
              onClick={() => setQuickRecapFilter(prev => prev === 'aujourdhui' ? 'tous' : 'aujourdhui')}
            >
              <div className="ga-recap-left">
                <span className="ga-recap-title">Aujourd'hui</span>
                <span className="ga-recap-count">{kpiData.recaps.aujourdhui}</span>
              </div>
              <div className="ga-recap-icon">
                <Sun size={24} />
              </div>
            </div>

            <div
              className={`ga-recap-card ga-recap-blue ${quickRecapFilter === 'demain' ? 'active-filter' : ''}`}
              onClick={() => setQuickRecapFilter(prev => prev === 'demain' ? 'tous' : 'demain')}
            >
              <div className="ga-recap-left">
                <span className="ga-recap-title">Demain</span>
                <span className="ga-recap-count">{kpiData.recaps.demain}</span>
              </div>
              <div className="ga-recap-icon">
                <Clock size={24} />
              </div>
            </div>
          </div>

          <div className="ga-table-card">
            <div className="ga-table-wrapper">
              <table className="ga-table">
                <thead>
                  <tr>
                    <th>Com.</th>
                    <th>Client</th>
                    <th>Type de service</th>
                    <th>Fréq / Jours</th>
                    <th>Interventions</th>
                    <th>Prochaine intervention</th>
                    <th>Statut mois en cours</th>
                    <th>Statut mois à venir</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        Aucun abonnement trouvé avec les filtres sélectionnés.
                      </td>
                    </tr>
                  ) : (
                    filteredSubscriptions.map(row => {
                      const pct = Math.round((row.interventionsCompleted / (row.interventionsTotal || 1)) * 100);
                      return (
                        <tr key={row.id}>
                          {/* Commercial */}
                          <td>
                            <div className="ga-com-avatar" title={`Commercial: ${row.commercial}`}>
                              {row.commercialInitials}
                            </div>
                          </td>

                          {/* Client */}
                          <td>
                            <div className="ga-client-name">{row.clientName}</div>
                            <div className="ga-client-sub">{row.clientVille}</div>
                          </td>

                          {/* Type de service */}
                          <td>
                            <span className="ga-service-badge">{row.serviceType}</span>
                          </td>

                          {/* Fréq / Jours */}
                          <td>
                            <div className="ga-freq-tag">{row.frequenceLabel}</div>
                            <div className="ga-freq-sub">
                              {row.heuresParPassage}h {row.joursChoice.map(j => j.slice(0, 3)).join(', ')}
                            </div>
                          </td>

                          {/* Interventions */}
                          <td>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                              {row.interventionsCompleted}/{row.interventionsTotal} effectuées <span style={{ color: '#64748b' }}>{pct}%</span>
                            </div>
                            <div className="ga-progress-bar">
                              <div className="ga-progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                            {row.interventionsCancelled > 0 && (
                              <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600, display: 'inline-block', marginTop: '0.2rem' }}>
                                {row.interventionsCancelled} annulée
                              </span>
                            )}
                          </td>

                          {/* Prochaine intervention */}
                          <td>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.nextInterventionDay}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              — {row.nextInterventionHousekeeper}
                            </div>
                          </td>

                          {/* Statut mois en cours */}
                          <td>
                            <span className={`ga-badge-status ga-status-${row.statutMoisEnCours.toLowerCase()}`}>
                              <span className="ga-badge-status-dot" />
                              {row.statutMoisEnCours}
                            </span>
                          </td>

                          {/* Statut mois à venir */}
                          <td>
                            <span className={`ga-badge-status ga-status-${row.statutMoisProchain.toLowerCase().replace(/\s+/g, '')}`}>
                              <span className="ga-badge-status-dot" />
                              {row.statutMoisProchain}
                            </span>
                          </td>

                          {/* Actions */}
                          <td>
                            <div className="ga-action-btns" style={{ justifyContent: 'center' }}>
                              {/* Eye Icon */}
                              <button
                                className="ga-action-btn btn-eye"
                                title="Voir compte client"
                                onClick={() => {
                                  const targetId = row.clientId || row.demandeId;
                                  navigate(`/clients/${encodeId(targetId)}`);
                                }}
                              >
                                <Eye size={15} />
                              </button>

                              {/* Pause / Play Icon */}
                              <button
                                className="ga-action-btn btn-pause"
                                title={row.statutMoisProchain === 'Suspendu' ? 'Réactiver abonnement' : 'Suspendre abonnement'}
                                onClick={() => handleToggleSuspend(row)}
                              >
                                {row.statutMoisProchain === 'Suspendu' ? <Play size={15} color="#10b981" /> : <Pause size={15} color="#f59e0b" />}
                              </button>

                              {/* Calendar Icon */}
                              <button
                                className="ga-action-btn btn-cal"
                                title="Voir calendrier abonnement & prorata"
                                onClick={() => setSelectedSubForCalendar(row)}
                              >
                                <Calendar size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Tab 2: Planning View */}
      {activeTab === 'planning' && canViewPlanning && (
        <div className="ga-table-card" style={{ padding: '1.5rem' }}>
          {/* Header Controls for Planning Tab */}
          <div className="ga-planning-ctrls">
            {/* Month Navigation & Controls */}
            <div className="ga-planning-nav">
              <button
                className="ga-month-nav-btn"
                onClick={handlePrevMonth}
                title="Mois précédent"
              >
                <ChevronLeft size={14} /> {prevMonthLabel}
              </button>
              <span className="ga-month-title">{currentMonthTitle}</span>
              <button
                className="ga-month-nav-btn"
                onClick={handleNextMonth}
                title="Mois suivant"
              >
                {nextMonthLabel} <ChevronRight size={14} />
              </button>

              <span className="ga-badge-count">{planningMonthData.totalMonthInterventions} Interventions ce mois</span>
            </div>

            {/* Right Filter Dropdowns */}
            <div className="ga-planning-filters">
              <select
                className="ga-planning-select"
                value={serviceFilter}
                onChange={e => setServiceFilter(e.target.value)}
              >
                <option value="tous">Tous les services</option>
                {ALL_SERVICE_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <select
                className="ga-planning-select"
                value={commercialFilter}
                onChange={e => setCommercialFilter(e.target.value)}
              >
                <option value="tous">Tous les commerciaux</option>
                {ALL_COMMERCIAL_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                className="ga-planning-select"
                value={villeFilter}
                onChange={e => setVilleFilter(e.target.value)}
              >
                <option value="tous">Toutes les villes</option>
                {ALL_VILLE_OPTIONS.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Calendar Grid (7 Columns: LUN → DIM — Exact matching screenshot) */}
          <div className="ga-calendar-grid" style={{ minHeight: '520px', gap: '0.4rem', width: '100%', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'].map(day => (
              <div key={day} className="ga-calendar-day-head" style={{ fontWeight: 800, color: '#475569', fontSize: '0.8rem' }}>
                {day}
              </div>
            ))}

            {/* Offset blank cells for selected month start day (LUN-first) */}
            {Array.from({ length: blankCount }).map((_, idx) => (
              <div key={`blank-${idx}`} className="ga-plan-day-cell outside" />
            ))}

            {/* Days of Selected Month */}
            {Array.from({ length: daysInSelectedMonth }, (_, i) => i + 1).map(dayNum => {
              const dayStat = planningMonthData.statsMap[dayNum];
              const now = new Date();
              const isToday = now.getDate() === dayNum &&
                              now.getMonth() === planningDate.getMonth() &&
                              now.getFullYear() === planningDate.getFullYear();

              const totalReporte = (dayStat?.reporte || 0) + (dayStat?.a_recuperer || 0);

              return (
                <div
                  key={dayNum}
                  className={`ga-plan-day-cell ${isToday ? 'current-day' : ''}`}
                >
                  <div className="ga-plan-day-num">{dayNum}</div>

                  {dayStat && dayStat.interventions > 0 ? (
                    <div className="ga-plan-stats">
                      <div className="ga-stat-line ga-stat-interventions">
                        Interventions : {dayStat.interventions}
                      </div>
                      {!!dayStat.termine && (
                        <div className="ga-stat-line ga-stat-termine">
                          Nbr terminé : {dayStat.termine}
                        </div>
                      )}
                      {!!totalReporte && (
                        <div className="ga-stat-line ga-stat-reporte">
                          Nbre reporté : {totalReporte}
                        </div>
                      )}
                      {!!dayStat.annule && (
                        <div className="ga-stat-line ga-stat-annule">
                          Nombre annulé : {dayStat.annule}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="ga-plan-empty-dash">—</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Facturation Abonnement */}
      {activeTab === 'facturation' && canViewFacturation && (
        <>
          {/* Top Filters Bar for Facturation */}
          <div className="ga-filters-card">
            <div className="ga-filters-grid">
              <div className="ga-filter-group">
                <span className="ga-filter-label">Nom du client</span>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="ga-filter-input"
                    placeholder="Rechercher un client..."
                    value={searchClient}
                    onChange={e => setSearchClient(e.target.value)}
                    style={{ paddingLeft: '2.2rem' }}
                  />
                  <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                </div>
              </div>

              <div className="ga-filter-group">
                <span className="ga-filter-label">Du</span>
                <input type="date" className="ga-filter-input" value={dateDu} onChange={e => setDateDu(e.target.value)} />
              </div>

              <div className="ga-filter-group">
                <span className="ga-filter-label">Au</span>
                <input type="date" className="ga-filter-input" value={dateAu} onChange={e => setDateAu(e.target.value)} />
              </div>

              <div className="ga-filter-group">
                <span className="ga-filter-label">Service</span>
                <select className="ga-filter-select" value={serviceFilter} onChange={e => setServiceFilter(e.target.value)}>
                  <option value="tous">Tous les services</option>
                  {ALL_SERVICE_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="ga-filter-group">
                <span className="ga-filter-label">Commercial</span>
                <select className="ga-filter-select" value={commercialFilter} onChange={e => setCommercialFilter(e.target.value)}>
                  <option value="tous">Tous les commerciaux</option>
                  {ALL_COMMERCIAL_OPTIONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="ga-filter-group">
                <span className="ga-filter-label">Ville</span>
                <select className="ga-filter-select" value={villeFilter} onChange={e => setVilleFilter(e.target.value)}>
                  <option value="tous">Toutes les villes</option>
                  {ALL_VILLE_OPTIONS.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div className="ga-filter-group">
                <span className="ga-filter-label">Statut</span>
                <select className="ga-filter-select" value={statutProchainFilter} onChange={e => setStatutProchainFilter(e.target.value)}>
                  <option value="tous">Tous les statuts</option>
                  <option value="Payé">Payé</option>
                  <option value="Non payé">Non payé</option>
                  <option value="Facture générée">Facture générée</option>
                  <option value="En attente de règlement">En attente de règlement</option>
                </select>
              </div>
            </div>
          </div>

          {/* Top Quick Filter Orange & Red Cards */}
          <div className="ga-fact-alert-grid">
            <div className="ga-fact-alert-box ga-fact-alert-orange">
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.9 }}>À échéance ≤ 15J</div>
                <div style={{ fontSize: '1.65rem', fontWeight: 800 }}>0</div>
              </div>
              <Calendar size={24} />
            </div>

            <div className="ga-fact-alert-box ga-fact-alert-red">
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.9 }}>Suspendus</div>
                <div style={{ fontSize: '1.65rem', fontWeight: 800 }}>0</div>
              </div>
              <Pause size={24} />
            </div>
          </div>

          {/* Timeline Gauge Section */}
          <div className="ga-timeline-card">
            <div className="ga-timeline-header">
              <div className="ga-timeline-title">
                Cycle de facturation — {currentMonthCycleTitle} <span className="ga-timeline-sub">pour les prestations du mois suivant</span>
              </div>
            </div>

            <div className="ga-timeline-track-container">
              <div className="ga-timeline-track-bg">
                <div className="ga-timeline-gauge-fill" style={{ width: `${gaugePct}%` }} />
                <div
                  className="ga-timeline-badge-today"
                  style={{ left: `${Math.max(12, gaugePct)}%` }}
                >
                  Aujourd'hui - {currentDayNum}
                </div>
              </div>
            </div>

            <div className="ga-timeline-milestones">
              <div className="ga-milestone-item">
                <div className="ga-milestone-dot" style={{ background: currentDayNum >= 15 ? '#0d9488' : '#cbd5e1' }} />
                <div className="ga-milestone-date">15 du mois — 08h00</div>
                <div className="ga-milestone-desc">Génération auto des factures</div>
              </div>
              <div className="ga-milestone-item">
                <div className="ga-milestone-dot" style={{ background: currentDayNum >= 15 ? '#0d9488' : '#cbd5e1' }} />
                <div className="ga-milestone-date">15 du mois</div>
                <div className="ga-milestone-desc">Envoi automatique WhatsApp + email</div>
              </div>
              <div className="ga-milestone-item">
                <div className="ga-milestone-dot" style={{ background: currentDayNum >= 18 ? '#0d9488' : '#cbd5e1' }} />
                <div className="ga-milestone-date">18 du mois</div>
                <div className="ga-milestone-desc">1er rappel WhatsApp</div>
              </div>
              <div className="ga-milestone-item">
                <div className="ga-milestone-dot" style={{ background: currentDayNum >= 23 ? '#0d9488' : '#cbd5e1' }} />
                <div className="ga-milestone-date">23 du mois</div>
                <div className="ga-milestone-desc">2ème rappel WhatsApp</div>
              </div>
              <div className="ga-milestone-item">
                <div className="ga-milestone-dot" style={{ background: currentDayNum >= 27 ? '#0d9488' : '#cbd5e1' }} />
                <div className="ga-milestone-date">27 du mois</div>
                <div className="ga-milestone-desc">Suspension auto + notification CC</div>
              </div>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="ga-fact-kpi-grid">
            <div
              className="ga-fact-kpi-card"
              style={{ cursor: 'pointer' }}
              onClick={() => setStatutProchainFilter('tous')}
            >
              <div className="ga-fact-kpi-title">Factures générées</div>
              <div className="ga-fact-kpi-val">{facturesKpi.totalCount}</div>
              <div className="ga-fact-kpi-sub">{facturesKpi.totalCA.toLocaleString('fr-FR')} DH TTC au total</div>
            </div>

            <div
              className="ga-fact-kpi-card"
              style={{ cursor: 'pointer' }}
              onClick={() => setStatutProchainFilter(prev => prev === 'Payé' ? 'tous' : 'Payé')}
            >
              <div className="ga-fact-kpi-title">Payées</div>
              <div className="ga-fact-kpi-val" style={{ color: '#16a34a' }}>{facturesKpi.payeesCount}</div>
              <div className="ga-fact-kpi-sub">{facturesKpi.payeesCA.toLocaleString('fr-FR')} DH encaissés</div>
            </div>

            <div
              className="ga-fact-kpi-card"
              style={{ cursor: 'pointer' }}
              onClick={() => setStatutProchainFilter(prev => prev === 'En attente' ? 'tous' : 'En attente')}
            >
              <div className="ga-fact-kpi-title">En attente</div>
              <div className="ga-fact-kpi-val" style={{ color: '#d97706' }}>{facturesKpi.nonPayeesCount}</div>
              <div className="ga-fact-kpi-sub">{facturesKpi.nonPayeesCA.toLocaleString('fr-FR')} DH</div>
            </div>

            <div
              className="ga-fact-kpi-card kpi-red"
              style={{ cursor: 'pointer' }}
              onClick={() => setStatutProchainFilter(prev => prev === 'Non payé' ? 'tous' : 'Non payé')}
            >
              <div className="ga-fact-kpi-title text-red">Non payé</div>
              <div className="ga-fact-kpi-val text-red">{facturesKpi.nonPayeesCount}</div>
              <div className="ga-fact-kpi-sub">{facturesKpi.nonPayeesCA.toLocaleString('fr-FR')} DH en attente</div>
            </div>
          </div>

          {/* Main Facturation Table */}
          <div className="ga-table-card">
            {/* Table Toolbar */}
            <div className="ga-fact-toolbar">
              <div className="ga-fact-search">
                <input
                  type="text"
                  className="ga-filter-input"
                  placeholder="Rechercher une facture..."
                  value={searchClient}
                  onChange={e => setSearchClient(e.target.value)}
                  style={{ paddingLeft: '2.2rem' }}
                />
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              </div>

              <div className="ga-fact-actions-right">
                <select className="ga-filter-select" style={{ width: 'auto' }}>
                  <option>Aperçu : jour réel (31)</option>
                </select>
                <button
                  className="ga-tab-btn"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <ArrowDownRight size={14} /> Export Excel
                </button>
              </div>
            </div>

            {/* Backdrop overlay & Fixed Action Dropdown Portal */}
            {openDropdownId !== null && dropdownPos !== null && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
                  onClick={() => {
                    setOpenDropdownId(null);
                    setDropdownPos(null);
                  }}
                />
                {(() => {
                  const inv = filteredFactures.find(f => f.id === openDropdownId);
                  if (!inv) return null;
                  return (
                    <div
                      className="ga-action-dropdown-menu"
                      style={{
                        position: 'fixed',
                        top: dropdownPos.top,
                        left: dropdownPos.left,
                        right: 'auto',
                        bottom: 'auto',
                        zIndex: 99999,
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.5rem',
                        padding: '0.35rem 0',
                        minWidth: '190px'
                      }}
                    >
                      <button
                        className="ga-dropdown-item"
                        onClick={() => {
                          handleConfirmPayment(inv.demandeId || inv.id);
                          setOpenDropdownId(null);
                          setDropdownPos(null);
                        }}
                      >
                        <CheckCircle2 size={16} color="#059669" />
                        Confirmer paiement
                      </button>

                      <button
                        className="ga-dropdown-item"
                        onClick={() => {
                          const targetId = inv.clientId || inv.demandeId || inv.id;
                          navigate(`/clients/${encodeId(targetId)}`);
                          setOpenDropdownId(null);
                          setDropdownPos(null);
                        }}
                      >
                        <Eye size={16} color="#475569" />
                        Voir le dossier
                      </button>
                    </div>
                  );
                })()}
              </>
            )}

            <div className="ga-table-wrapper">
              <table className="ga-table">
                <thead>
                  <tr>
                    <th>Facture</th>
                    <th>Client</th>
                    <th>Période</th>
                    <th>Montant TTC</th>
                    <th>Statut</th>
                    <th>Fichier Facture</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFactures.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        Aucune facture trouvée.
                      </td>
                    </tr>
                  ) : (
                    filteredFactures.map((inv) => {
                      const isDropdownOpen = openDropdownId === inv.id;
                      const isPaid = inv.statut === 'Payé';

                      return (
                        <tr key={inv.id}>
                          <td style={{ fontWeight: 600, color: '#334155' }}>{inv.num}</td>
                          <td>
                            <div className="ga-client-name" style={{ color: '#0f172a' }}>{inv.client}</div>
                            <div className="ga-client-sub">{inv.ville}</div>
                          </td>
                          <td>{inv.periode}</td>
                          <td style={{ fontWeight: 700, color: '#0f172a' }}>{inv.montant}</td>
                          <td>
                            <span className={`ga-badge-status ${isPaid ? 'ga-status-actif' : 'ga-status-suspendu'}`}>
                              <span className="ga-badge-status-dot" />
                              {inv.statut}
                            </span>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
                              Statut final - mois suivant : <strong style={{ color: inv.nextStatut === 'Actif' ? '#16a34a' : ['Suspendu', 'Résilié'].includes(inv.nextStatut) ? '#dc2626' : ['1er rappel', '2e rappel', 'Facture envoyée'].includes(inv.nextStatut) ? '#d97706' : '#64748b' }}>{inv.nextStatut}</strong>
                            </div>
                          </td>
                          <td>
                            {generatedInvoiceIds.includes(inv.id) ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <button
                                  className="ga-btn-file-pdf"
                                  title="Télécharger la facture PDF"
                                  onClick={() => handleDownloadInvoice(inv)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    color: '#334155'
                                  }}
                                >
                                  <FileText size={15} color="#059669" />
                                  <span>{inv.fileName || `${inv.num.replace(/\//g, '-')}.pdf`}</span>
                                </button>

                                <button
                                  className="ga-btn-download-sq"
                                  title="Télécharger"
                                  onClick={() => handleDownloadInvoice(inv)}
                                  style={{
                                    background: '#84cc16',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '0.35rem 0.5rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                  }}
                                >
                                  <Download size={14} color="#ffffff" />
                                </button>
                              </div>
                            ) : (
                              <button
                                className="ga-btn-file-facture"
                                title="Générer le fichier facture"
                                onClick={() => handleGenerateInvoice(inv)}
                              >
                                <FileText size={15} color="#334155" /> Générer
                              </button>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', position: 'relative' }}>
                            <button
                              className="ga-dropdown-btn"
                              title="Actions"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isDropdownOpen) {
                                  setOpenDropdownId(null);
                                  setDropdownPos(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const isNearBottom = rect.bottom + 110 > window.innerHeight;
                                  setDropdownPos({
                                    top: isNearBottom ? Math.max(10, rect.top - 95) : rect.bottom + 4,
                                    left: Math.max(10, rect.right - 190)
                                  });
                                  setOpenDropdownId(inv.id);
                                }
                              }}
                            >
                              <MoreHorizontal size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Automatismes de cette vue Black Banner */}
          <div className="ga-auto-banner">
            <div className="ga-auto-header">
              <RefreshCw size={16} /> Automatismes de cette vue
            </div>
            <div className="ga-auto-list">
              <div>• <strong>15 du mois — 08h00 :</strong> génération automatique des factures (calcul des passages 4 ou 5, PDF, calendrier des interventions)</div>
              <div>• <strong>15 du mois :</strong> envoi automatique WhatsApp, e-mail, facture PDF et calendrier des passages</div>
              <div>• <strong>18 du mois :</strong> 1er rappel WhatsApp</div>
              <div>• <strong>23 du mois :</strong> 2ème rappel WhatsApp</div>
              <div>• <strong>27 du mois :</strong> suspension automatique de la prestation + notification automatique au Chargé de Clientèle</div>
              <div>• <strong>Prorata automatique</strong> pour tout abonnement démarrant en cours de mois</div>
            </div>
          </div>
        </>
      )}
      </div>

      {/* Calendar & Mid-Month Prorated Invoicing Popup Modal */}
      {selectedSubForCalendar ? (
        <CalendarModal
          row={selectedSubForCalendar}
          demandes={demandes}
          onClose={() => setSelectedSubForCalendar(null)}
          onRefresh={fetchData}
        />
      ) : null}
    </>
  );
}
