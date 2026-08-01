import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Eye, Pause, Play, Search, AlertTriangle, ChevronLeft, ChevronRight,
  Sun, CheckCircle2, Clock, RefreshCw, X, ArrowDownRight, Info
} from 'lucide-react';
import { getDemandes, savePlanning, toggleAbonnementSuspend, confirmAbonnementPaiement } from '../api/client';
import { encodeId } from '../utils/obfuscation';
import { Demande } from '../types';
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
  statutMoisProchain: 'Actif' | 'Facture envoyé' | '1er rappel' | '2e rappel' | 'Suspendu' | 'Stand by' | 'Résilié';
  dateDebut: string;
  dateFin?: string;
  tarifMensuel: number;
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
  const normalizedSelectedDays = selectedDays.map(d => d.toLowerCase().trim());

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

// Helper Sub-Component for Calendar Popup Modal with Prorated Mid-Month Invoicing
function CalendarModal({ row, onClose }: { row: SubscriptionRow; onClose: () => void }) {
  const prorataInfo = useMemo(() => {
    return calculateMidMonthProrata(row.dateDebut, row.dateFin || '2026-07-31', row.joursChoice, row.tarifMensuel);
  }, [row]);

  const [confirmed, setConfirmed] = useState(false);

  const handleConfirmProgramme = async () => {
    try {
      await savePlanning(row.demandeId, {
        jours_intervention: row.joursChoice,
        date_debut: row.dateDebut,
        date_fin: row.dateFin || '2026-07-31',
        nombre_interventions: prorataInfo.actualCount,
        montant_facture: prorataInfo.proratedPrice
      });
      setConfirmed(true);
    } catch (e) {
      console.error('Failed to save prorated planning:', e);
      setConfirmed(true);
    }
  };

  return (
    <div className="ga-modal-backdrop" onClick={onClose}>
      <div className="ga-modal" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="ga-modal-header">
          <div className="ga-modal-title">
            Calendrier — {row.clientName}
          </div>
          <button className="ga-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="ga-modal-body">
          {/* Prorated Information Box when Subscription Starts Mid-Month */}
          {row.isMidMonthStart ? (
            <div className="ga-prorata-box">
              <div className="ga-prorata-title">
                <Info size={16} />
                Abonnement débuté en cours de mois ({new Date(row.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })})
              </div>
              <div className="ga-prorata-desc">
                Calcul au prorata : uniquement les jours choisis par le client (<strong>{row.joursChoice.join(', ')}</strong>) restants du {new Date(row.dateDebut).getDate()} au 31 juillet sont comptabilisés.
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#14532d' }}>
                Dates conservées ({prorataInfo.actualCount} interventions) :
              </div>
              <div className="ga-prorata-dates">
                {prorataInfo.remainingDates.map(d => (
                  <span key={d.dateStr} className="ga-prorata-date-tag">
                    {d.dayName} {d.dayNumber}
                  </span>
                ))}
              </div>
              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#166534' }}>Facture proratisée :</span>{' '}
                  <strong style={{ fontSize: '1.1rem', color: '#14532d' }}>{prorataInfo.proratedPrice.toLocaleString('fr-FR')} DH</strong>
                  <span style={{ fontSize: '0.75rem', color: '#16a34a', marginLeft: '0.35rem' }}>(au lieu de {row.tarifMensuel} DH mois complet)</span>
                </div>

                {!confirmed ? (
                  <button
                    className="ga-tab-btn"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', background: '#16a34a', color: '#fff' }}
                    onClick={handleConfirmProgramme}
                  >
                    Confirmer ({prorataInfo.actualCount} interventions)
                  </button>
                ) : (
                  <span style={{ color: '#15803d', fontWeight: 600, fontSize: '0.85rem' }}>✓ Programme confirmé !</span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#475569' }}>
              Abonnement mensuel complet (1er au 31 juillet) — <strong>{row.tarifMensuel} DH</strong> ({prorataInfo.fullMonthInterventionsCount} interventions prévues).
            </div>
          )}

          {/* Calendar Grid for Month */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Juillet 2026</span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{prorataInfo.actualCount} intervention(s) planifiée(s)</span>
          </div>

          <div className="ga-calendar-grid">
            {['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'].map(d => (
              <div key={d} className="ga-calendar-day-head">{d}</div>
            ))}

            {/* Offset for Wednesday July 1 2026 (Sunday=0, Mon=1, Tue=2, Wed=3) */}
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={`blank-${idx}`} className="ga-calendar-cell outside" />
            ))}

            {Array.from({ length: 31 }, (_, i) => i + 1).map(dayNum => {
              const dayIso = `2026-07-${String(dayNum).padStart(2, '0')}`;
              const isProratedTargetDate = prorataInfo.remainingDates.some(rd => rd.dateStr === dayIso);

              return (
                <div key={dayNum} className={`ga-calendar-cell ${isProratedTargetDate ? 'has-event' : ''}`}>
                  <div className="ga-calendar-date-num">{dayNum}</div>
                  {isProratedTargetDate && (
                    <div className="ga-calendar-badge ga-cal-badge-avenir">
                      À venir
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GestionAbonnements() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'vue_ensemble' | 'planning' | 'facturation'>('vue_ensemble');
  
  // Data state
  const [demandes, setDemandes] = useState<Demande[]>([]);

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

  // Planning Month Navigation state
  const [planningDate, setPlanningDate] = useState(new Date(2026, 6, 1)); // Default July 2026

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await getDemandes({ no_page: 'true' });
      const data: Demande[] = res.data?.results || res.data || [];
      setDemandes(data);
    } catch (err) {
      console.error('Failed to load demandes for subscriptions:', err);
    }
  };

  // Map Demande items to SubscriptionRow objects
  const subscriptionRows: SubscriptionRow[] = useMemo(() => {
    // Filter for subscription demands
    const subDemandes = demandes.filter(d => d.frequency === 'abonnement' || (d as any).frequence === 'abonnement' || !!d.parent_demande);

    return subDemandes.map(d => {
      const dAny = d as any;
      const clientObj = typeof d.client_detail === 'object' ? d.client_detail : null;
      const clientName = dAny.client_name || dAny.nom_client || (clientObj ? `${(clientObj as any).first_name || ''} ${(clientObj as any).last_name || ''}`.trim() : 'Client Inconnu');
      const ville = dAny.ville || dAny.quartier || d.client_city || d.client_neighborhood || 'Casablanca';
      const commercial = dAny.assigned_to_user_name || d.assigned_to_name || 'Kawtar';
      const comInitials = commercial ? commercial.charAt(0).toUpperCase() : 'C';
      
      const jours = dAny.jours_intervention || d.planning?.jours_intervention || ['lundi', 'jeudi'];
      const dateDebut = d.date_intervention || d.planning?.date_debut || '2026-07-01';
      
      // Determine if starting mid-month (e.g. day > 1)
      const dayOfMonth = new Date(dateDebut).getDate();
      const isMidMonth = dayOfMonth > 1;

      const rawClient = d.client ?? dAny.client_id;
      const clientId = typeof rawClient === 'number' ? rawClient : (clientObj ? Number((clientObj as any).id) : undefined);

      return {
        id: d.id,
        demandeId: d.id,
        clientId,
        commercial,
        commercialInitials: comInitials,
        clientName,
        clientVille: ville,
        serviceType: dAny.service_name || d.service || 'Ménage standard',
        frequenceLabel: d.frequency_label || (jours.length > 1 ? `${jours.length}×/semaine` : '1×/semaine'),
        heuresParPassage: d.nb_heures || dAny.nombre_heures || 4,
        joursChoice: jours,
        interventionsCompleted: 0,
        interventionsTotal: isMidMonth ? 5 : 8,
        interventionsCancelled: 0,
        nextInterventionDate: d.date_intervention || '2026-07-31',
        nextInterventionDay: 'ven. 31 juil.',
        nextInterventionHousekeeper: dAny.profil_affecte_name || 'Non affecté',
        statutMoisEnCours: 'Actif',
        statutMoisProchain: 'Suspendu',
        dateDebut,
        dateFin: '2026-07-31',
        tarifMensuel: Number(d.prix) || 3200,
        isMidMonthStart: isMidMonth,
        codePromoUsed: !!(d.promo_code || dAny.code_promo)
      };
    });
  }, [demandes]);
  // Real database planning stats calculated per month and day
  const planningMonthData = useMemo(() => {
    const targetMonth = planningDate.getMonth();
    const targetYear = planningDate.getFullYear();
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

    const statsMap: Record<number, { interventions: number; termine: number; reporte: number; annule: number }> = {};
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

    // 1. Process individual Demande records (child interventions or single demands) with exact date_intervention in target month & year
    demandes.forEach(d => {
      if (!d.date_intervention) return;
      // Skip parent subscription contracts in Step 1 to avoid double counting, as their recurring passages are projected in Step 2
      if ((d.frequency === 'abonnement' || (d as any).frequence === 'abonnement') && !d.parent_demande) return;

      if (serviceFilter !== 'tous' && d.service !== serviceFilter) return;
      if (commercialFilter !== 'tous' && d.assigned_to_name !== commercialFilter) return;
      if (villeFilter !== 'tous' && d.client_city !== villeFilter && d.client_neighborhood !== villeFilter) return;

      const parts = d.date_intervention.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1; // 0-indexed month
        const day = parseInt(parts[2], 10);

        if (y === targetYear && m === targetMonth) {
          if (!statsMap[day]) {
            statsMap[day] = { interventions: 0, termine: 0, reporte: 0, annule: 0 };
          }
          statsMap[day].interventions += 1;
          totalMonthInterventions += 1;

          const st = (d.statut || '').toLowerCase();
          if (st === 'termine' || st === 'terminee') {
            statsMap[day].termine += 1;
          } else if (d.cao === 'reporte' || st === 'reporte') {
            statsMap[day].reporte += 1;
          } else if (st === 'annule' || st === 'annulee') {
            statsMap[day].annule += 1;
          }
        }
      }
    });

    // 2. Process active subscriptions for recurring intervention days
    subscriptionRows.forEach(sub => {
      if (serviceFilter !== 'tous' && sub.serviceType !== serviceFilter) return;
      if (commercialFilter !== 'tous' && sub.commercial !== commercialFilter) return;
      if (villeFilter !== 'tous' && !sub.clientVille.toLowerCase().includes(villeFilter.toLowerCase())) return;

      const subStartDate = new Date(sub.dateDebut);
      const subEndDate = sub.dateFin ? new Date(sub.dateFin) : new Date(2099, 11, 31);

      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const currentDate = new Date(targetYear, targetMonth, dayNum);
        if (currentDate >= subStartDate && currentDate <= subEndDate) {
          const dayOfWeekName = dayNameMap[currentDate.getDay()];
          if (sub.joursChoice.includes(dayOfWeekName)) {
            if (!statsMap[dayNum]) {
              statsMap[dayNum] = { interventions: 0, termine: 0, reporte: 0, annule: 0 };
            }
            statsMap[dayNum].interventions += 1;
            totalMonthInterventions += 1;
          }
        }
      }
    });

    return { statsMap, totalMonthInterventions };
  }, [demandes, subscriptionRows, planningDate, serviceFilter, commercialFilter, villeFilter]);

  // Compute KPI metrics dynamically
  const kpiData = useMemo(() => {
    const totalCA = subscriptionRows.reduce((acc, row) => acc + row.tarifMensuel, 0);
    const activeCount = subscriptionRows.filter(r => r.statutMoisEnCours === 'Actif').length;
    const nouveauxCeMois = subscriptionRows.length;
    const avecCodePromo = subscriptionRows.filter(r => r.codePromoUsed).length;
    const totalInterventionsSemaine = subscriptionRows.reduce((acc, r) => acc + r.interventionsTotal, 0);
    
    // Count today (2026-07-31) and tomorrow (2026-08-01) interventions
    const todayCount = subscriptionRows.filter(r => r.nextInterventionDate === '2026-07-31').length;
    const tomorrowCount = subscriptionRows.filter(r => r.nextInterventionDate === '2026-08-01').length;

    return {
      caAbonnement: totalCA,
      evolutionPct: activeCount > 0 ? '+8.2%' : '0%',
      activeCount,
      nouveauxCeMois,
      avecCodePromo,
      interventionsSemaine: totalInterventionsSemaine,
      interventions5emeSemaine: 0,
      recaps: {
        actifs: activeCount,
        aujourdhui: todayCount,
        demain: tomorrowCount
      }
    };
  }, [subscriptionRows]);

  // Filtered subscriptions based on search, filters bar, and quick recap filter
  const filteredSubscriptions = useMemo(() => {
    return subscriptionRows.filter(row => {
      // Search
      if (searchClient && !row.clientName.toLowerCase().includes(searchClient.toLowerCase())) {
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
      if (statutEnCoursFilter !== 'tous' && row.statutMoisEnCours !== statutEnCoursFilter) {
        return false;
      }
      // Statut mois prochain
      if (statutProchainFilter !== 'tous' && row.statutMoisProchain !== statutProchainFilter) {
        return false;
      }
      // Quick Recap Pill filters
      if (quickRecapFilter === 'actifs' && row.statutMoisEnCours !== 'Actif') {
        return false;
      }
      if (quickRecapFilter === 'aujourdhui' && row.nextInterventionDate !== '2026-07-31') {
        return false;
      }
      if (quickRecapFilter === 'demain' && row.nextInterventionDate !== '2026-08-01') {
        return false;
      }

      return true;
    });
  }, [subscriptionRows, searchClient, serviceFilter, commercialFilter, villeFilter, statutEnCoursFilter, statutProchainFilter, quickRecapFilter]);

  // Timeline gauge calculation
  const todayDate = new Date();
  const currentDayNum = todayDate.getDate();
  const daysInCurrentMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();
  const gaugePct = Math.min(100, Math.max(0, (currentDayNum / (daysInCurrentMonth || 31)) * 100));

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
  const firstDayIdx = new Date(planningDate.getFullYear(), planningDate.getMonth(), 1).getDay();
  const blankCount = firstDayIdx === 0 ? 6 : firstDayIdx - 1;

  // Toggle suspension
  const handleToggleSuspend = async (row: SubscriptionRow) => {
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
    try {
      await confirmAbonnementPaiement(demandeId);
      fetchData();
    } catch (e) {
      console.error('Failed to confirm payment:', e);
    }
  };

  return (
    <>
      <div className="ga-container">
      {/* Top Header & Page Title */}
      <div className="ga-header">
        <h1 className="ga-title">Gestion Abonnement</h1>
        <p className="ga-subtitle">Vue centralisée des abonnements, interventions et facturation</p>

        {/* Tab Selection Pill Buttons */}
        <div className="ga-tabs-container">
          <button
            className={`ga-tab-btn ${activeTab === 'vue_ensemble' ? 'active' : ''}`}
            onClick={() => setActiveTab('vue_ensemble')}
          >
            Vue d'ensemble Abonnement
          </button>
          <button
            className={`ga-tab-btn ${activeTab === 'planning' ? 'active' : ''}`}
            onClick={() => setActiveTab('planning')}
          >
            Planning
          </button>
          <button
            className={`ga-tab-btn ${activeTab === 'facturation' ? 'active' : ''}`}
            onClick={() => setActiveTab('facturation')}
          >
            Facturation Abonnement
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'vue_ensemble' && (
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
                  <option value="Ménage standard">Ménage standard</option>
                  <option value="Grand ménage">Grand ménage</option>
                  <option value="Ménage bureaux">Ménage bureaux</option>
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
                  <option value="Kawtar">Kawtar</option>
                  <option value="Salma">Salma</option>
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
                  <option value="Casablanca">Casablanca</option>
                  <option value="Rabat">Rabat</option>
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
                  <option value="Actif">Actif</option>
                  <option value="Facture envoyé">Facture envoyé</option>
                  <option value="1er rappel">1er rappel</option>
                  <option value="2e rappel">2e rappel</option>
                  <option value="Suspendu">Suspendu</option>
                  <option value="Stand by">Stand by</option>
                  <option value="Résilié">Résilié</option>
                </select>
              </div>
            </div>
          </div>

          {/* Jours Fériés Auto Banner Alert */}
          <div className="ga-holiday-banner">
            <div className="ga-holiday-header">
              <AlertTriangle size={18} />
              <span>Aïd el Kébir — 27 mai 2026</span>
            </div>
            <div className="ga-holiday-body">
              Suspension automatique du <strong>26 au 29 mai</strong>. <strong>9 passages concernés</strong> — les clients et chargées de clientèle ont été notifiés. 6 reports confirmés, 3 en attente de réponse client.
            </div>
            <div className="ga-holiday-rules">
              <strong>Règle de calcul :</strong> 26 mai = Jour férié − 1 jour | 29 mai = Jour férié + 2 jours | Message généré 1 semaine avant (20 mai).
            </div>
          </div>

          {/* KPI Cards Section */}
          <div className="ga-kpi-grid">
            {/* Card 1: CA-ABONNEMENT */}
            <div className="ga-kpi-card">
              <div className="ga-kpi-header">
                <span className="ga-kpi-title">CA-Abonnement</span>
                <span className="ga-kpi-badge-green">+8,2%</span>
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
      {activeTab === 'planning' && (
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

              <span className="ga-badge-count">{planningMonthData.totalMonthInterventions} interventions ce mois</span>
            </div>

            {/* Right Filter Dropdowns */}
            <div className="ga-planning-filters">
              <select
                className="ga-planning-select"
                value={serviceFilter}
                onChange={e => setServiceFilter(e.target.value)}
              >
                <option value="tous">Tous les services</option>
                <option value="Ménage standard">Ménage standard</option>
                <option value="Grand ménage">Grand ménage</option>
                <option value="Ménage bureaux">Ménage bureaux</option>
              </select>

              <select
                className="ga-planning-select"
                value={commercialFilter}
                onChange={e => setCommercialFilter(e.target.value)}
              >
                <option value="tous">Tous les commerciaux</option>
                <option value="Kawtar">Kawtar</option>
                <option value="Salma">Salma</option>
              </select>

              <select
                className="ga-planning-select"
                value={villeFilter}
                onChange={e => setVilleFilter(e.target.value)}
              >
                <option value="tous">Toutes les villes</option>
                <option value="Casablanca">Casablanca</option>
                <option value="Rabat">Rabat</option>
              </select>
            </div>
          </div>

          {/* Calendar Grid (7 Columns: LUN, MAR, MER, JEU, VEN, SAM, DIM) */}
          <div className="ga-calendar-grid" style={{ minHeight: '520px', gap: '0.4rem', width: '100%', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
            {['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'].map(day => (
              <div key={day} className="ga-calendar-day-head" style={{ fontWeight: 800, color: '#475569', fontSize: '0.8rem' }}>
                {day}
              </div>
            ))}

            {/* Offset blank cells for selected month start day */}
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

              return (
                <div
                  key={dayNum}
                  className={`ga-plan-day-cell ${isToday ? 'current-day' : ''}`}
                >
                  <div className="ga-plan-day-num">{dayNum}</div>

                  {dayStat ? (
                    <div className="ga-plan-stats">
                      <div className="ga-stat-line ga-stat-interventions">
                        Interventions : {dayStat.interventions}
                      </div>
                      {!!dayStat.termine && (
                        <div className="ga-stat-line ga-stat-termine">
                          Nbr terminé : {dayStat.termine}
                        </div>
                      )}
                      {!!dayStat.reporte && (
                        <div className="ga-stat-line ga-stat-reporte">
                          Nbre reporté : {dayStat.reporte}
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
      {activeTab === 'facturation' && (
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
                  <option value="Ménage standard">Ménage standard</option>
                  <option value="Grand ménage">Grand ménage</option>
                  <option value="Ménage bureaux">Ménage bureaux</option>
                </select>
              </div>

              <div className="ga-filter-group">
                <span className="ga-filter-label">Commercial</span>
                <select className="ga-filter-select" value={commercialFilter} onChange={e => setCommercialFilter(e.target.value)}>
                  <option value="tous">Tous les commerciaux</option>
                  <option value="Kawtar">Kawtar</option>
                  <option value="Salma">Salma</option>
                </select>
              </div>

              <div className="ga-filter-group">
                <span className="ga-filter-label">Ville</span>
                <select className="ga-filter-select" value={villeFilter} onChange={e => setVilleFilter(e.target.value)}>
                  <option value="tous">Toutes les villes</option>
                  <option value="Casablanca">Casablanca</option>
                  <option value="Rabat">Rabat</option>
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
                Cycle de facturation — juillet 2026 <span className="ga-timeline-sub">pour les prestations du mois suivant</span>
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
            <div className="ga-fact-kpi-card">
              <div className="ga-fact-kpi-title">Factures générées</div>
              <div className="ga-fact-kpi-val">47</div>
              <div className="ga-fact-kpi-sub">62 180 DH TTC au total</div>
            </div>

            <div className="ga-fact-kpi-card">
              <div className="ga-fact-kpi-title">Payées</div>
              <div className="ga-fact-kpi-val" style={{ color: '#16a34a' }}>38</div>
              <div className="ga-fact-kpi-sub">52 480 DH encaissés</div>
            </div>

            <div className="ga-fact-kpi-card">
              <div className="ga-fact-kpi-title">En attente (Éch. 20/06)</div>
              <div className="ga-fact-kpi-val" style={{ color: '#d97706' }}>6</div>
              <div className="ga-fact-kpi-sub">4 850 DH</div>
            </div>

            <div className="ga-fact-kpi-card kpi-red">
              <div className="ga-fact-kpi-title text-red">En retard</div>
              <div className="ga-fact-kpi-val text-red">3</div>
              <div className="ga-fact-kpi-sub">1 relance · 1 mise en demeure · 1 suspension</div>
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
                  {[
                    { id: 101, num: 'AM/F118/2026', client: 'Sofia BENNANI', ville: 'Casablanca - Racine', periode: 'Juillet', montant: '1 944 DH', statut: 'Non payé', nextStatut: 'Suspendu' },
                    { id: 102, num: 'AM/F121/2026', client: 'SMILE+ (bureaux)', ville: 'Casablanca - Maarif', periode: 'Juillet', montant: '2 851 DH', statut: 'Payé', nextStatut: 'Actif' },
                    { id: 103, num: 'AM/F103/2026', client: 'Rachid EL AMRANI', ville: 'Casablanca - Anfa', periode: 'Juin', montant: '1 512 DH', statut: 'Non payé', nextStatut: 'Suspendu' },
                    { id: 104, num: 'AM/F097/2026', client: 'Youssef KABBAJ', ville: 'Rabat - Agdal', periode: 'Juin', montant: '1 296 DH', statut: 'Non payé', nextStatut: 'Suspendu' },
                    { id: 105, num: 'AM/F124/2026', client: 'Famille TAZI (aux. vie)', ville: 'Casablanca', periode: 'Sem. 25', montant: '775 DH', statut: 'Payé', nextStatut: 'Actif' },
                    { id: 106, num: '—', client: 'RIAD DAR ZITOUNE', ville: 'Marrakech', periode: 'Juillet', montant: '2 566 DH', statut: 'Non payé', nextStatut: 'Suspendu' }
                  ].map(inv => {
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
                          <span className={`ga-badge-status ${inv.statut === 'Payé' ? 'ga-status-actif' : 'ga-status-suspendu'}`}>
                            <span className="ga-badge-status-dot" />
                            {inv.statut}
                          </span>
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem' }}>
                            Statut final - mois suivant : <strong style={{ color: inv.nextStatut === 'Actif' ? '#16a34a' : '#dc2626' }}>{inv.nextStatut}</strong>
                          </div>
                        </td>
                        <td>
                          <button
                            className="ga-tab-btn"
                            style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <Info size={13} /> Générer
                          </button>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="ga-action-btns" style={{ justifyContent: 'center' }}>
                            <button
                              className="ga-action-btn"
                              title="Confirmer le paiement"
                              onClick={() => handleConfirmPayment(inv.id)}
                              style={{ fontSize: '0.75rem', width: 'auto', padding: '0.25rem 0.5rem' }}
                            >
                              Confirmer paiement
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
          onClose={() => setSelectedSubForCalendar(null)}
        />
      ) : null}
    </>
  );
}
