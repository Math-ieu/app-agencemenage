import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Megaphone, Ticket, TrendingUp, Plus, Trash2, Pencil, Send, Copy, Archive, ArchiveRestore } from 'lucide-react';
import { TYPES_GESTE, SEGMENTS_CLIENT } from '@/lib/marketing-constants';
import { getDemandes, getPromoCodes, createPromoCode, deletePromoCode, updatePromoCode, getCommercialGestures, createCommercialGesture, deleteCommercialGesture, updateCommercialGesture, getCampaigns, createCampaign, deleteCampaign, updateCampaign, getUsers } from '@/api/client';
import { useAuthStore } from '../store/auth';
import { useToastStore } from '../store/toast';
import { hasPermission } from '../utils/permissions';
import type { Demande } from '@/types';
import { CreateOffreModal, type PromoFormState } from './marketing/CreateOffreModal';
import { CreateGesteModal, type GesteFormState } from './marketing/CreateGesteModal';
import { CreateCampagneModal, type CampagneFormState } from './marketing/CreateCampagneModal';
import './Marketing.css';

type MarketingTab = 'codes' | 'gestes' | 'campagnes';
type SegmentLabel = 'tous' | 'particulier' | 'entreprise' | 'nouveaux';

interface PromoCodeItem {
  id: number;
  name: string;
  code: string;
  reduction: number;
  reduction_type: 'pourcentage' | 'montant_fixe';
  segment: SegmentLabel;
  created_at: string;
  valid_from: string;
  valid_until: string;
  status: 'brouillon' | 'active' | 'desactivee' | 'expiree';
  customer_status: string;
  uses: number;
  generated_revenue: number;
  archived: boolean;
}

interface CommercialGestureItem {
  id: number;
  date: string;
  demande_id: number | null;
  commercial_name: string;
  cree_par?: number | null;
  client_name: string;
  gesture_type: string;
  status: 'en_attente' | 'en_cours' | 'cloture';
  montant_ht: number;
  tva_active: boolean;
  reduction_type: string;
  reduction_value: number;
  total_a_payer: number;
  part_agence: number;
  part_profil: number;
  motif: string;
  envoyer_message: boolean;
  message_client: string;
  canal_diffusion: string[];
  archived: boolean;
  created_at: string;
}

interface CampaignItem {
  id: number;
  date: string;
  title: string;
  message: string;
  target: 'profil' | 'client';
  segment: SegmentLabel;
  criteria: string;
  channel: string | string[];
  city: string;
  broadcast_time_start: string;
  broadcast_time_end: string;
  broadcast_date: string;
  per_day_dest: number;
  status: 'programmee' | 'envoyee' | 'brouillon' | 'annulee';
  archived: boolean;
  created_at: string;
}

const money = (value: number): string => `${new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(value)} MAD`;

const toInputDate = (value: Date): string => value.toISOString().slice(0, 10);
const fmtDate = (value: string): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('fr-FR');
};

const segmentLabel = (segment: SegmentLabel): string => {
  if (segment === 'particulier') return 'particulier';
  if (segment === 'entreprise') return 'entreprise';
  if (segment === 'nouveaux') return 'nouveaux';
  return 'tous';
};

const STATUTS_CLIENT_MAP: Record<string, string> = {
  tous: 'Tous les clients',
  nouveau: 'Nouveau client',
  inactif: 'Client inactif',
  regulier: 'Client r\u00e9gulier',
  abonne: 'Client abonn\u00e9',
};

const statusChipClass = (status: string): string => {
  if (status === 'active') return 'mk-status-green';
  if (status === 'brouillon') return 'mk-status-grey';
  if (status === 'expiree') return 'mk-status-red';
  return '';
};

const statusLabel = (status: string): string => {
  const map: Record<string, string> = { brouillon: 'Brouillon', active: 'Actif', desactivee: 'Inactif', expiree: 'Expir\u00e9' };
  return map[status] || status;
};


export default function Marketing() {
  const { addToast } = useToastStore();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<MarketingTab>(() => {
    const state = location.state as { tab?: MarketingTab } | null;
    if (state && state.tab) {
      return state.tab;
    }
    return 'codes';
  });

  useEffect(() => {
    const state = location.state as { tab?: MarketingTab } | null;
    if (state && state.tab) {
      setActiveTab(state.tab);
    }
  }, [location.state]);

  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [gestures, setGestures] = useState<CommercialGestureItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);

  const [showCreatePromo, setShowCreatePromo] = useState(false);
  const [showCreateGesture, setShowCreateGesture] = useState(false);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [commerciaux, setCommerciaux] = useState<any[]>([]);
  const { user } = useAuthStore();

  const [editingPromoId, setEditingPromoId] = useState<number | null>(null);
  const [editingGesteId, setEditingGesteId] = useState<number | null>(null);
  const [editingCampagneId, setEditingCampagneId] = useState<number | null>(null);

  useEffect(() => {
    getDemandes().then(res => {
      setDemandes(res.data.results || res.data);
    }).catch(console.error);

    getUsers({ role: 'commercial' }).then(res => {
      setCommerciaux(res.data?.results || res.data || []);
    }).catch(console.error);
  }, []);

  const [promoForm, setPromoForm] = useState<PromoFormState>({
    nom: '',
    statut: 'brouillon',
    code_promo: '',
    type_reduction: 'pourcentage',
    valeur_reduction: '',
    segment_client: 'particulier',
    statut_client: 'tous',
    services: [],
    canaux: [],
    message_promotionnel: '',
    date_debut: toInputDate(new Date()),
    date_fin: '',
    date_indeterminee: false,
  });

  const [gestureForm, setGestureForm] = useState<GesteFormState>({
    demande_id: '',
    client_nom: '',
    client_telephone: '',
    ville: '',
    quartier: '',
    fidelite: 'Nouveau client',
    frequence: 'Une seule fois',
    date_geste: toInputDate(new Date()),
    statut_geste: 'en_attente',
    type_geste: 'reduction_tarif',
    montant_ht: '',
    tva_active: false,
    reduction_type: 'montant',
    reduction_valeur: '',
    part_profil: '',
    part_agence: '',
    motif: '',
    envoyer_message: false,
    message_client: '',
    canal_diffusion: [],
    cree_par: user?.id ? String(user.id) : '',
  });

  const [campaignForm, setCampaignForm] = useState<CampagneFormState>({
    nom: '',
    message: '',
    statut: 'brouillon',
    cible: 'client',
    segment_cible: 'tous',
    critere_ciblage: 'tous',
    canal: [],
    ville_ciblage: 'Casablanca',
    heure_debut: '',
    heure_fin: '',
    date_diffusion: '',
    nombre_destinataires_jour: '',
  });

  const [codeDateFrom, setCodeDateFrom] = useState('');
  const [codeDateTo, setCodeDateTo] = useState('');
  const [codeSegmentFilter, setCodeSegmentFilter] = useState('Tous');
  const [codeStatusFilter, setCodeStatusFilter] = useState('Tous');
  const [showArchived, setShowArchived] = useState(false);

  const [gesteCommercialFilter, setGesteCommercialFilter] = useState('');
  const [gesteTypeFilter, setGesteTypeFilter] = useState('Tous les types');
  const [gesteDateFrom, setGesteDateFrom] = useState('');
  const [gesteDateTo, setGesteDateTo] = useState('');

  const [campagneCibleFilter, setCampagneCibleFilter] = useState('Toutes les cibles');
  const [campagneDateFrom, setCampagneDateFrom] = useState('');
  const [campagneDateTo, setCampagneDateTo] = useState('');

  useEffect(() => {
    // Initial fetch
    Promise.all([
      getPromoCodes(),
      getCommercialGestures(),
      getCampaigns()
    ]).then(([promosRes, gesturesRes, campaignsRes]) => {
      setPromoCodes(promosRes.data.results || promosRes.data);
      setGestures(gesturesRes.data.results || gesturesRes.data);
      setCampaigns(campaignsRes.data.results || campaignsRes.data);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    setShowCreatePromo(false);
    setShowCreateGesture(false);
    setShowCreateCampaign(false);
  }, [activeTab]);

  const dashboardStats = useMemo(() => {
    const promoUsed = promoCodes.reduce((sum, item) => sum + (item.uses || 0), 0);
    const revenue = promoCodes.reduce((sum, item) => sum + Number(item.generated_revenue || 0), 0);
    return { promoUsed, revenue };
  }, [promoCodes]);

  const filteredCodes = useMemo(() => {
    return promoCodes.filter((item) => {
      // Archive filter
      if (showArchived && !item.archived) return false;
      if (!showArchived && item.archived) return false;
      if (codeSegmentFilter !== 'Tous' && segmentLabel(item.segment) !== codeSegmentFilter.toLowerCase()) return false;
      if (codeStatusFilter !== 'Tous') {
        const statusMap: Record<string, string> = { 'brouillon': 'Brouillon', 'active': 'Actif', 'desactivee': 'Inactif', 'expiree': 'Expiré' };
        const statusLabel = statusMap[item.status] || item.status;
        if (statusLabel !== codeStatusFilter) return false;
      }
      const dateRef = item.created_at || item.valid_from;
      if (codeDateFrom && dateRef && dateRef < codeDateFrom) return false;
      if (codeDateTo && dateRef && dateRef > codeDateTo) return false;
      return true;
    });
  }, [promoCodes, codeSegmentFilter, codeStatusFilter, codeDateFrom, codeDateTo, showArchived]);

  const filteredGestes = useMemo(() => {
    return gestures.filter((item) => {
      // Archive filter
      if (showArchived && !item.archived) return false;
      if (!showArchived && item.archived) return false;
      if (gesteCommercialFilter && !item.commercial_name?.toLowerCase().includes(gesteCommercialFilter.toLowerCase())) return false;
      if (gesteTypeFilter !== 'Tous les types' && item.gesture_type !== gesteTypeFilter) return false;
      if (gesteDateFrom && item.date < gesteDateFrom) return false;
      if (gesteDateTo && item.date > gesteDateTo) return false;
      return true;
    });
  }, [gestures, gesteCommercialFilter, gesteTypeFilter, gesteDateFrom, gesteDateTo, showArchived]);

  const filteredCampagnes = useMemo(() => {
    return campaigns.filter((item) => {
      // Archive filter
      if (showArchived && !item.archived) return false;
      if (!showArchived && item.archived) return false;
      if (campagneCibleFilter !== 'Toutes les cibles' && item.target !== campagneCibleFilter.replace('Toutes les cibles', '')) return false;
      if (campagneDateFrom && item.date < campagneDateFrom) return false;
      if (campagneDateTo && item.date > campagneDateTo) return false;
      return true;
    });
  }, [campaigns, campagneCibleFilter, campagneDateFrom, campagneDateTo, showArchived]);

  const createPromo = () => {
    if (!promoForm.nom.trim() || !promoForm.code_promo.trim()) return;
    const codeUpper = promoForm.code_promo.trim().toUpperCase();
    const customerLabel = STATUTS_CLIENT_MAP[promoForm.statut_client] || promoForm.statut_client;

    const payload = {
      name: promoForm.nom.trim(),
      code: codeUpper,
      reduction: Number(promoForm.valeur_reduction || 0),
      reduction_type: promoForm.type_reduction,
      segment: promoForm.segment_client,
      valid_from: promoForm.date_debut,
      valid_until: promoForm.date_indeterminee ? null : promoForm.date_fin || null,
      status: promoForm.statut,
      customer_status: customerLabel,
      services: promoForm.services,
      canaux: promoForm.canaux,
      message_promotionnel: promoForm.message_promotionnel,
    };

    if (editingPromoId) {
      updatePromoCode(editingPromoId, payload).then((res) => {
        setPromoCodes((prev) => prev.map((x) => x.id === editingPromoId ? res.data : x));
        setPromoForm({
          nom: '', statut: 'brouillon', code_promo: '', type_reduction: 'pourcentage',
          valeur_reduction: '', segment_client: 'particulier', statut_client: 'tous',
          services: [], canaux: [], message_promotionnel: '',
          date_debut: toInputDate(new Date()), date_fin: '', date_indeterminee: false,
        });
        setEditingPromoId(null);
        setShowCreatePromo(false);
      }).catch(console.error);
    } else {
      createPromoCode(payload).then((res) => {
        setPromoCodes((prev) => [res.data, ...prev]);
        setPromoForm({
          nom: '', statut: 'brouillon', code_promo: '', type_reduction: 'pourcentage',
          valeur_reduction: '', segment_client: 'particulier', statut_client: 'tous',
          services: [], canaux: [], message_promotionnel: '',
          date_debut: toInputDate(new Date()), date_fin: '', date_indeterminee: false,
        });
        setShowCreatePromo(false);
      }).catch(console.error);
    }
  };

  const createGesture = () => {
    if (!gestureForm.client_nom.trim()) return;

    const montantHT = Number(gestureForm.montant_ht || 0);
    const tvaMontant = gestureForm.tva_active ? montantHT * 0.2 : 0;
    const montantTTC = montantHT + tvaMontant;
    const reductionAmount = gestureForm.reduction_type === 'pourcentage'
      ? montantTTC * (Number(gestureForm.reduction_valeur) || 0) / 100
      : Number(gestureForm.reduction_valeur) || 0;
    const isAnnulation = gestureForm.type_geste === 'facturation_annulee' || gestureForm.type_geste === 'intervention_gratuite';
    const totalAPayer = isAnnulation ? 0 : Math.max(0, montantTTC - reductionAmount);

    const payload = {
      demande: gestureForm.demande_id ? Number(gestureForm.demande_id) : null,
      date: gestureForm.date_geste,
      gesture_type: gestureForm.type_geste,
      status: gestureForm.statut_geste,
      montant_ht: montantHT,
      tva_active: gestureForm.tva_active,
      reduction_type: gestureForm.reduction_type,
      reduction_value: Number(gestureForm.reduction_valeur || 0),
      total_a_payer: totalAPayer,
      part_profil: Number(gestureForm.part_profil || 0),
      part_agence: Number(gestureForm.part_agence || 0),
      motif: gestureForm.motif,
      envoyer_message: gestureForm.envoyer_message,
      message_client: gestureForm.message_client,
      canal_diffusion: gestureForm.canal_diffusion,
      cree_par: gestureForm.cree_par ? Number(gestureForm.cree_par) : null,
    };

    const redStr = gestureForm.reduction_type === 'pourcentage'
      ? `-${gestureForm.reduction_valeur}%`
      : `-${gestureForm.reduction_valeur} dh`;
    const successMsg = gestureForm.type_geste === 'intervention_gratuite'
      ? `«Intervention gratuite appliquée sur cette demande.» source geste commercial`
      : `«${redStr} appliqué sur cette demande.» source geste commercial`;

    if (editingGesteId) {
      updateCommercialGesture(editingGesteId, payload).then((res) => {
        setGestures((prev) => prev.map((x) => x.id === editingGesteId ? res.data : x));
        addToast("Geste commercial modifié avec succès", "success");
        getDemandes().then(dRes => {
          setDemandes(dRes.data.results || dRes.data);
        }).catch(console.error);

        setGestureForm({
          demande_id: '', client_nom: '', client_telephone: '', ville: '', quartier: '',
          fidelite: 'Nouveau client', frequence: 'Une seule fois',
          date_geste: toInputDate(new Date()), statut_geste: 'en_attente',
          type_geste: 'reduction_tarif', montant_ht: '', tva_active: false,
          reduction_type: 'montant', reduction_valeur: '',
          part_profil: '', part_agence: '', motif: '',
          envoyer_message: false, message_client: '', canal_diffusion: [], cree_par: user?.id ? String(user.id) : '',
        });
        setEditingGesteId(null);
        setShowCreateGesture(false);
      }).catch(console.error);
    } else {
      createCommercialGesture(payload).then((res) => {
        setGestures((prev) => [res.data, ...prev]);
        addToast(successMsg, 'success');
        getDemandes().then(dRes => {
          setDemandes(dRes.data.results || dRes.data);
        }).catch(console.error);

        setGestureForm({
          demande_id: '', client_nom: '', client_telephone: '', ville: '', quartier: '',
          fidelite: 'Nouveau client', frequence: 'Une seule fois',
          date_geste: toInputDate(new Date()), statut_geste: 'en_attente',
          type_geste: 'reduction_tarif', montant_ht: '', tva_active: false,
          reduction_type: 'montant', reduction_valeur: '',
          part_profil: '', part_agence: '', motif: '',
          envoyer_message: false, message_client: '', canal_diffusion: [], cree_par: user?.id ? String(user.id) : '',
        });
        setShowCreateGesture(false);
      }).catch(console.error);
    }
  };

  const createCampaignFunc = () => {
    if (!campaignForm.nom.trim()) return;

    const payload = {
      title: campaignForm.nom.trim(),
      message: campaignForm.message,
      target: campaignForm.cible,
      segment: campaignForm.segment_cible,
      criteria: campaignForm.critere_ciblage,
      channel: campaignForm.canal,
      city: campaignForm.ville_ciblage,
      broadcast_time_start: campaignForm.heure_debut || null,
      broadcast_time_end: campaignForm.heure_fin || null,
      broadcast_date: campaignForm.date_diffusion || null,
      per_day_dest: Number(campaignForm.nombre_destinataires_jour || 0),
      status: campaignForm.statut,
    };

    if (editingCampagneId) {
      updateCampaign(editingCampagneId, payload).then((res) => {
        setCampaigns((prev) => prev.map((x) => x.id === editingCampagneId ? res.data : x));
        setCampaignForm({
          nom: '', message: '', statut: 'brouillon', cible: 'client',
          segment_cible: 'tous', critere_ciblage: 'tous', canal: [],
          ville_ciblage: 'Casablanca', heure_debut: '', heure_fin: '',
          date_diffusion: '', nombre_destinataires_jour: '',
        });
        setEditingCampagneId(null);
        setShowCreateCampaign(false);
      }).catch(console.error);
    } else {
      createCampaign(payload).then((res) => {
        setCampaigns((prev) => [res.data, ...prev]);
        setCampaignForm({
          nom: '', message: '', statut: 'brouillon', cible: 'client',
          segment_cible: 'tous', critere_ciblage: 'tous', canal: [],
          ville_ciblage: 'Casablanca', heure_debut: '', heure_fin: '',
          date_diffusion: '', nombre_destinataires_jour: '',
        });
        setShowCreateCampaign(false);
      }).catch(console.error);
    }
  };

  const tabTitle =
    activeTab === 'codes'
      ? 'Codes promo & Offres'
      : activeTab === 'gestes'
        ? 'Gestes commerciaux'
        : 'Campagnes marketing';

  const createLabel =
    activeTab === 'codes'
      ? 'Créer un code promo'
      : activeTab === 'gestes'
        ? 'Créer un geste commercial'
        : 'Créer une campagne';

  const canCreate = useMemo(() => {
    if (activeTab === 'codes') return hasPermission(user, 'creer_code_promo');
    if (activeTab === 'gestes') return hasPermission(user, 'creer_geste_commercial');
    if (activeTab === 'campagnes') return hasPermission(user, 'creer_campagne');
    return false;
  }, [activeTab, user]);

  const onCreateClick = () => {
    if (!canCreate) return;
    if (activeTab === 'codes') setShowCreatePromo(true);
    if (activeTab === 'gestes') setShowCreateGesture(true);
    if (activeTab === 'campagnes') setShowCreateCampaign(true);
  };

  const closeModals = () => {
    setShowCreatePromo(false);
    setShowCreateGesture(false);
    setShowCreateCampaign(false);
    setEditingPromoId(null);
    setEditingGesteId(null);
    setEditingCampagneId(null);
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // noop
    }
  };

  return (
    <div className="page mk-page">
      <div className="page-header mk-header">
        <div>
          <h1 className="page-title mk-title"><Megaphone size={20} /> Marketing & Actions Commerciales</h1>
          <p className="page-subtitle">Gérez vos promotions, gestes commerciaux et campagnes</p>
        </div>
      </div>

      <section className="mk-stats-grid">
        <article className="mk-stat-card tone-orange">
          <div className="mk-stat-icon"><Ticket size={16} /></div>
          <div>
            <p>Codes promo utilisés</p>
            <h3>{dashboardStats.promoUsed}</h3>
          </div>
        </article>
        <article className="mk-stat-card tone-cyan">
          <div className="mk-stat-icon"><TrendingUp size={16} /></div>
          <div>
            <p>CA généré par promos</p>
            <h3>{money(dashboardStats.revenue)}</h3>
          </div>
        </article>
      </section>

      <div className="mk-tabs">
        <button type="button" className={activeTab === 'codes' ? 'active active-codes' : ''} onClick={() => setActiveTab('codes')}>Codes promo</button>
        <button type="button" className={activeTab === 'gestes' ? 'active active-gestes' : ''} onClick={() => setActiveTab('gestes')}>Gestes commerciaux</button>
        <button type="button" className={activeTab === 'campagnes' ? 'active active-campagnes' : ''} onClick={() => setActiveTab('campagnes')}>Campagnes</button>
      </div>

      <div className="mk-section-head">
        <h2>{tabTitle}</h2>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={onCreateClick}>
            <Plus size={16} /> {createLabel}
          </button>
        )}
      </div>

      {activeTab === 'codes' && (
        <>
          <div className="mk-filters-row" style={{ alignItems: 'flex-end' }}>
            <label>Date du
              <input type="date" value={codeDateFrom} onChange={(e) => setCodeDateFrom(e.target.value)} />
            </label>
            <label>Au
              <input type="date" value={codeDateTo} onChange={(e) => setCodeDateTo(e.target.value)} />
            </label>
            <label>Segment
              <select value={codeSegmentFilter} onChange={(e) => setCodeSegmentFilter(e.target.value)}>
                <option>Tous</option>
                {SEGMENTS_CLIENT.map((s) => (
                  <option key={s.value} value={s.label}>{s.label}</option>
                ))}
              </select>
            </label>
            <label>Statut
              <select value={codeStatusFilter} onChange={(e) => setCodeStatusFilter(e.target.value)}>
                <option>Tous</option>
                <option>Actif</option>
                <option>Inactif</option>
                <option>Brouillon</option>
                <option>Expiré</option>
              </select>
            </label>
            <button
              type="button"
              className={`btn ${showArchived ? 'btn-primary' : 'btn-secondary'}`}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
              {showArchived ? 'Voir les actifs' : 'Archivés'}
            </button>
          </div>

          <div className="table-wrapper mk-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date création</th>
                  <th>Nom de la promo</th>
                  <th>Code</th>
                  <th>Réduction</th>
                  <th>Segment</th>
                  <th>Statut client</th>
                  <th>Validité</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCodes.map((item) => (
                  <tr key={item.id}>
                    <td>{fmtDate(item.created_at || item.valid_from)}</td>
                    <td>{item.name}</td>
                    <td>
                      <button className="mk-code-chip" onClick={() => copyCode(item.code)}>
                        {item.code} <Copy size={12} />
                      </button>
                    </td>
                    <td>{item.reduction_type === 'montant_fixe' ? `${item.reduction} MAD` : `-${item.reduction}%`}</td>
                    <td>{segmentLabel(item.segment)}</td>
                    <td>{item.customer_status}</td>
                    <td>{fmtDate(item.valid_from)} {'→'} {item.valid_until ? fmtDate(item.valid_until) : 'Indéterminée'}</td>
                    <td>
                      <span className={`mk-status-chip ${statusChipClass(item.status)}`}>
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {hasPermission(user, 'creer_code_promo') && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="icon-btn" title="Modifier" onClick={() => {
                            setPromoForm({
                              nom: item.name, statut: item.status, code_promo: item.code,
                              type_reduction: item.reduction_type || 'pourcentage',
                              valeur_reduction: String(item.reduction),
                              segment_client: item.segment,
                              statut_client: Object.entries(STATUTS_CLIENT_MAP).find(([, v]) => v === item.customer_status)?.[0] || 'tous',
                              services: [], canaux: [], message_promotionnel: '',
                              date_debut: item.valid_from, date_fin: item.valid_until, date_indeterminee: !item.valid_until,
                            });
                            setEditingPromoId(item.id);
                            setShowCreatePromo(true);
                          }}>
                            <Pencil size={14} />
                          </button>
                          <button className="icon-btn" title="Supprimer" onClick={() => {
                            if (window.confirm('Supprimer ce code promo ?')) {
                              deletePromoCode(item.id).then(() => {
                                setPromoCodes((prev) => prev.filter((x) => x.id !== item.id));
                              }).catch(console.error);
                            }
                          }}>
                            <Trash2 size={14} />
                          </button>
                          <button className="icon-btn" title={item.archived ? 'Désarchiver' : 'Archiver'} onClick={() => {
                            updatePromoCode(item.id, { archived: !item.archived }).then((res) => {
                              setPromoCodes((prev) => prev.map((x) => x.id === item.id ? res.data : x));
                            }).catch(console.error);
                          }}>
                            {item.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredCodes.length === 0 && (
                  <tr>
                    <td colSpan={9} className="empty-row">{showArchived ? 'Aucune offre archivée' : 'Aucune offre créée'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'gestes' && (
        <>
          <div className="mk-filters-row mk-filters-row-gestes" style={{ alignItems: 'flex-end' }}>
            <label> Commercial
              <input type="text" placeholder="Filtrer par commercial..." value={gesteCommercialFilter} onChange={(e) => setGesteCommercialFilter(e.target.value)} />
            </label>
            <label> Type de geste
              <select value={gesteTypeFilter} onChange={(e) => setGesteTypeFilter(e.target.value)}>
                <option>Tous les types</option>
                {TYPES_GESTE.map((t) => (
                  <option key={t.value} value={t.label}>{t.label}</option>
                ))}
              </select>
            </label>
            <label> Date du
              <input type="date" value={gesteDateFrom} onChange={(e) => setGesteDateFrom(e.target.value)} />
            </label>
            <label> Au
              <input type="date" value={gesteDateTo} onChange={(e) => setGesteDateTo(e.target.value)} />
            </label>
            <button
              type="button"
              className={`btn ${showArchived ? 'btn-primary' : 'btn-secondary'}`}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
              {showArchived ? 'Voir les actifs' : 'Archivés'}
            </button>
          </div>

          <div className="table-wrapper mk-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date création</th>
                  <th>Commercial</th>
                  <th>Client</th>
                  <th>Type de geste</th>
                  <th>Type réduction</th>
                  <th>Net à Payer</th>
                  <th>Part agence</th>
                  <th>Part profil</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGestes.map((item) => (
                  <tr key={item.id}>
                    <td>{fmtDate(item.created_at || item.date)}</td>
                    <td>{item.commercial_name || '—'}</td>
                    <td>{item.client_name || '—'}</td>
                    <td>{TYPES_GESTE.find(t => t.value === item.gesture_type)?.label || item.gesture_type}</td>
                    <td>{item.reduction_type === 'montant' ? `${item.reduction_value} MAD` : `${item.reduction_value}%`}</td>
                    <td style={{ fontWeight: 600 }}>{Number(item.total_a_payer || 0).toFixed(2)} MAD</td>
                    <td style={{ color: '#0f766e' }}>{Number(item.part_agence || 0).toFixed(2)} MAD</td>
                    <td style={{ color: '#0369a1' }}>{Number(item.part_profil || 0).toFixed(2)} MAD</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {hasPermission(user, 'creer_geste_commercial') && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="icon-btn" title="Modifier" onClick={() => {
                            setGestureForm({
                              demande_id: item.demande_id ? String(item.demande_id) : '',
                              client_nom: item.client_name, client_telephone: '', ville: '', quartier: '',
                              fidelite: 'Nouveau client', frequence: 'Une seule fois',
                              date_geste: item.date, statut_geste: item.status,
                              type_geste: item.gesture_type,
                              montant_ht: String(item.montant_ht), tva_active: item.tva_active,
                              reduction_type: item.reduction_type || 'montant', reduction_valeur: String(item.reduction_value),
                              part_profil: String(item.part_profil), part_agence: String(item.part_agence), motif: item.motif,
                              envoyer_message: item.envoyer_message, message_client: item.message_client, canal_diffusion: item.canal_diffusion || [], cree_par: item.cree_par ? String(item.cree_par) : '',
                            });
                            setEditingGesteId(item.id);
                            setShowCreateGesture(true);
                          }}>
                            <Pencil size={14} />
                          </button>
                          <button className="icon-btn" title="Supprimer" onClick={() => {
                            if (window.confirm('Supprimer ce geste commercial ?')) {
                              deleteCommercialGesture(item.id).then(() => {
                                setGestures((prev) => prev.filter((x) => x.id !== item.id));
                              }).catch(console.error);
                            }
                          }}>
                            <Trash2 size={14} />
                          </button>
                          <button className="icon-btn" title={item.archived ? 'Désarchiver' : 'Archiver'} onClick={() => {
                            updateCommercialGesture(item.id, { archived: !item.archived }).then((res) => {
                              setGestures((prev) => prev.map((x) => x.id === item.id ? res.data : x));
                            }).catch(console.error);
                          }}>
                            {item.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredGestes.length === 0 && (
                  <tr>
                    <td colSpan={9} className="empty-row">{showArchived ? 'Aucun geste commercial archivé' : 'Aucun geste commercial créé'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'campagnes' && (
        <>
          <div className="mk-filters-row mk-filters-row-campagnes" style={{ alignItems: 'flex-end' }}>
            <label>
              <select value={campagneCibleFilter} onChange={(e) => setCampagneCibleFilter(e.target.value)}>
                <option>Toutes les cibles</option>
                <option>Profil</option>
                <option>Client</option>
              </select>
            </label>
            <label>
              <input type="date" value={campagneDateFrom} onChange={(e) => setCampagneDateFrom(e.target.value)} />
            </label>
            <label>
              <input type="date" value={campagneDateTo} onChange={(e) => setCampagneDateTo(e.target.value)} />
            </label>
            <button
              type="button"
              className={`btn ${showArchived ? 'btn-primary' : 'btn-secondary'}`}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
              {showArchived ? 'Voir les actives' : 'Archivées'}
            </button>
          </div>

          <div className="table-wrapper mk-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Titre</th>
                  <th>Cible</th>
                  <th>Segment</th>
                  <th>Canal</th>
                  <th>Ville</th>
                  <th>Date diffusion</th>
                  <th>Dest./jour</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampagnes.map((item) => (
                  <tr key={item.id}>
                    <td>{fmtDate(item.created_at || item.date)}</td>
                    <td style={{ fontWeight: 600 }}>{item.title}</td>
                    <td style={{ textTransform: 'capitalize' }}>{item.target}</td>
                    <td>{item.target === 'client' ? segmentLabel(item.segment as any) : item.criteria}</td>
                    <td>{Array.isArray(item.channel) ? item.channel.join(',') : item.channel}</td>
                    <td>{item.city || '—'}</td>
                    <td>{fmtDate(item.broadcast_date)}</td>
                    <td>{item.per_day_dest}</td>
                    <td>
                      <span className={`mk-status-chip ${item.status === 'programmee' ? 'mk-status-blue' : item.status === 'envoyee' ? 'mk-status-green' : item.status === 'annulee' ? 'mk-status-red' : 'mk-status-grey'}`}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {hasPermission(user, 'creer_campagne') && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="icon-btn" title="Modifier" onClick={() => {
                            setCampaignForm({
                              nom: item.title, message: item.message || '', statut: item.status,
                              cible: item.target.toLowerCase(), segment_cible: item.segment, critere_ciblage: item.criteria || 'tous',
                              canal: Array.isArray(item.channel) ? item.channel : [item.channel], ville_ciblage: item.city || '',
                              heure_debut: item.broadcast_time_start || '', heure_fin: item.broadcast_time_end || '',
                              date_diffusion: item.broadcast_date || '', nombre_destinataires_jour: String(item.per_day_dest || 0),
                            });
                            setEditingCampagneId(item.id);
                            setShowCreateCampaign(true);
                          }}>
                            <Pencil size={14} />
                          </button>
                          <button className="icon-btn" title="Envoyer">
                            <Send size={14} />
                          </button>
                          <button className="icon-btn" title={item.archived ? 'Désarchiver' : 'Archiver'} onClick={() => {
                            updateCampaign(item.id, { archived: !item.archived }).then((res) => {
                              setCampaigns((prev) => prev.map((x) => x.id === item.id ? res.data : x));
                            }).catch(console.error);
                          }}>
                            {item.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                          </button>
                          <button className="icon-btn" title="Supprimer" onClick={() => {
                            if (window.confirm('Supprimer cette campagne ?')) {
                              deleteCampaign(item.id).then(() => {
                                setCampaigns((prev) => prev.filter((x) => x.id !== item.id));
                              }).catch(console.error);
                            }
                          }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredCampagnes.length === 0 && (
                  <tr>
                    <td colSpan={10} className="empty-row">{showArchived ? 'Aucune campagne archivée' : 'Aucune campagne'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showCreatePromo && (
        <CreateOffreModal
          form={promoForm}
          setForm={setPromoForm}
          onClose={closeModals}
          onSubmit={createPromo}
        />
      )}

      {showCreateGesture && (
        <CreateGesteModal
          demandes={demandes}
          commerciaux={commerciaux}
          form={gestureForm}
          setForm={setGestureForm}
          onClose={closeModals}
          onSubmit={createGesture}
        />
      )}

      {showCreateCampaign && (
        <CreateCampagneModal
          form={campaignForm}
          setForm={setCampaignForm}
          onClose={closeModals}
          onSubmit={createCampaignFunc}
        />
      )}
    </div>
  );
}
