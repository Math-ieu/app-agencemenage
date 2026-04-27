import { useEffect, useMemo, useState } from 'react';
import { Megaphone, Ticket, TrendingUp, Plus, Trash2, Pencil, Send, Copy } from 'lucide-react';
import { TYPES_GESTE, CANAUX_CAMPAGNE, CIBLES_CAMPAGNE, STATUTS_CAMPAGNE, SEGMENTS_CLIENT } from '@/lib/marketing-constants';
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
  segment: SegmentLabel;
  validFrom: string;
  validUntil: string;
  status: 'active' | 'inactive';
  customerStatus: 'Tous les clients' | 'Nouveaux clients';
  uses: number;
  generatedRevenue: number;
}

interface CommercialGestureItem {
  id: number;
  date: string;
  commercial: string;
  client: string;
  gestureType: string;
  reductionMad: number;
  netToPayMad: number;
  agencyShareMad: number;
  profileShareMad: number;
  status: 'en_cours' | 'termine';
}

interface CampaignItem {
  id: number;
  date: string;
  title: string;
  target: 'Profil' | 'Client';
  segment: SegmentLabel;
  channel: string;
  city: string;
  broadcastDate: string;
  perDayDest: number;
  status: 'programmee' | 'envoyee' | 'brouillon';
}

interface MarketingStore {
  promoCodes: PromoCodeItem[];
  gestures: CommercialGestureItem[];
  campaigns: CampaignItem[];
}

const STORAGE_KEY = 'marketing_data_v2';

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

export default function Marketing() {
  const [activeTab, setActiveTab] = useState<MarketingTab>('codes');

  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [gestures, setGestures] = useState<CommercialGestureItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);

  const [showCreatePromo, setShowCreatePromo] = useState(false);
  const [showCreateGesture, setShowCreateGesture] = useState(false);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);

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
    client_nom: '',
    client_telephone: '',
    ville: '',
    quartier: '',
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
    cree_par: '',
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

  const [gesteCommercialFilter, setGesteCommercialFilter] = useState('');
  const [gesteTypeFilter, setGesteTypeFilter] = useState('Tous les types');
  const [gesteDateFrom, setGesteDateFrom] = useState('');
  const [gesteDateTo, setGesteDateTo] = useState('');

  const [campagneCibleFilter, setCampagneCibleFilter] = useState('Toutes les cibles');
  const [campagneDateFrom, setCampagneDateFrom] = useState('');
  const [campagneDateTo, setCampagneDateTo] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as MarketingStore;
      setPromoCodes(Array.isArray(parsed.promoCodes) ? parsed.promoCodes : []);
      setGestures(Array.isArray(parsed.gestures) ? parsed.gestures : []);
      setCampaigns(Array.isArray(parsed.campaigns) ? parsed.campaigns : []);
    } catch {
      // ignore invalid local storage payload
    }
  }, []);

  useEffect(() => {
    const data: MarketingStore = { promoCodes, gestures, campaigns };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [promoCodes, gestures, campaigns]);

  useEffect(() => {
    setShowCreatePromo(false);
    setShowCreateGesture(false);
    setShowCreateCampaign(false);
  }, [activeTab]);

  const dashboardStats = useMemo(() => {
    const promoUsed = promoCodes.reduce((sum, item) => sum + item.uses, 0);
    const revenue = promoCodes.reduce((sum, item) => sum + item.generatedRevenue, 0);
    return { promoUsed, revenue };
  }, [promoCodes]);

  const filteredCodes = useMemo(() => {
    return promoCodes.filter((item) => {
      if (codeSegmentFilter !== 'Tous' && segmentLabel(item.segment) !== codeSegmentFilter.toLowerCase()) return false;
      if (codeStatusFilter !== 'Tous') {
        const statusLabel = item.status === 'active' ? 'Actif' : 'Inactif';
        if (statusLabel !== codeStatusFilter) return false;
      }
      if (codeDateFrom && item.validFrom && item.validFrom < codeDateFrom) return false;
      if (codeDateTo && item.validFrom && item.validFrom > codeDateTo) return false;
      return true;
    });
  }, [promoCodes, codeSegmentFilter, codeStatusFilter, codeDateFrom, codeDateTo]);

  const filteredGestes = useMemo(() => {
    return gestures.filter((item) => {
      if (gesteCommercialFilter && !item.commercial.toLowerCase().includes(gesteCommercialFilter.toLowerCase())) return false;
      if (gesteTypeFilter !== 'Tous les types' && item.gestureType !== gesteTypeFilter) return false;
      if (gesteDateFrom && item.date < gesteDateFrom) return false;
      if (gesteDateTo && item.date > gesteDateTo) return false;
      return true;
    });
  }, [gestures, gesteCommercialFilter, gesteTypeFilter, gesteDateFrom, gesteDateTo]);

  const filteredCampagnes = useMemo(() => {
    return campaigns.filter((item) => {
      if (campagneCibleFilter !== 'Toutes les cibles' && item.target !== campagneCibleFilter.replace('Toutes les cibles', '')) return false;
      if (campagneDateFrom && item.date < campagneDateFrom) return false;
      if (campagneDateTo && item.date > campagneDateTo) return false;
      return true;
    });
  }, [campaigns, campagneCibleFilter, campagneDateFrom, campagneDateTo]);

  const createPromo = () => {
    if (!promoForm.nom.trim() || !promoForm.code_promo.trim()) return;
    const valeur = Number(promoForm.valeur_reduction || 0);

    const item: PromoCodeItem = {
      id: Date.now(),
      name: promoForm.nom.trim(),
      code: promoForm.code_promo.trim().toUpperCase(),
      reduction: promoForm.type_reduction === 'pourcentage' ? valeur : 0,
      segment: promoForm.segment_client as SegmentLabel,
      validFrom: promoForm.date_debut,
      validUntil: promoForm.date_indeterminee ? '' : promoForm.date_fin,
      status: promoForm.statut === 'active' ? 'active' : 'inactive',
      customerStatus: promoForm.statut_client === 'nouveau' ? 'Nouveaux clients' : 'Tous les clients',
      uses: 0,
      generatedRevenue: 0,
    };

    setPromoCodes((prev) => [item, ...prev]);
    setPromoForm({
      nom: '', statut: 'brouillon', code_promo: '', type_reduction: 'pourcentage',
      valeur_reduction: '', segment_client: 'particulier', statut_client: 'tous',
      services: [], canaux: [], message_promotionnel: '',
      date_debut: toInputDate(new Date()), date_fin: '', date_indeterminee: false,
    });
    setShowCreatePromo(false);
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
    const typeLabel = TYPES_GESTE.find((t) => t.value === gestureForm.type_geste)?.label || gestureForm.type_geste;

    const item: CommercialGestureItem = {
      id: Date.now(),
      date: gestureForm.date_geste,
      commercial: gestureForm.cree_par.trim() || '—',
      client: gestureForm.client_nom.trim(),
      gestureType: typeLabel,
      reductionMad: reductionAmount,
      netToPayMad: totalAPayer,
      agencyShareMad: Number(gestureForm.part_agence || 0),
      profileShareMad: Number(gestureForm.part_profil || 0),
      status: 'en_cours',
    };

    setGestures((prev) => [item, ...prev]);
    setGestureForm({
      client_nom: '', client_telephone: '', ville: '', quartier: '',
      date_geste: toInputDate(new Date()), statut_geste: 'en_attente',
      type_geste: 'reduction_tarif', montant_ht: '', tva_active: false,
      reduction_type: 'montant', reduction_valeur: '',
      part_profil: '', part_agence: '', motif: '',
      envoyer_message: false, message_client: '', canal_diffusion: [], cree_par: '',
    });
    setShowCreateGesture(false);
  };

  const createCampaign = () => {
    if (!campaignForm.nom.trim()) return;

    const cibleLabel = CIBLES_CAMPAGNE.find((c) => c.value === campaignForm.cible)?.label || campaignForm.cible;
    const canalLabel = campaignForm.canal.map((c) => CANAUX_CAMPAGNE.find((x) => x.value === c)?.label || c).join(', ');
    const statutLabel = STATUTS_CAMPAGNE.find((s) => s.value === campaignForm.statut);

    const item: CampaignItem = {
      id: Date.now(),
      date: campaignForm.date_diffusion || toInputDate(new Date()),
      title: campaignForm.nom.trim(),
      target: cibleLabel as 'Profil' | 'Client',
      segment: (campaignForm.segment_cible || 'tous') as SegmentLabel,
      channel: canalLabel,
      city: campaignForm.ville_ciblage,
      broadcastDate: campaignForm.date_diffusion,
      perDayDest: Number(campaignForm.nombre_destinataires_jour || 0),
      status: (campaignForm.statut || 'brouillon') as CampaignItem['status'],
    };

    setCampaigns((prev) => [item, ...prev]);
    setCampaignForm({
      nom: '', message: '', statut: 'brouillon', cible: 'client',
      segment_cible: 'tous', critere_ciblage: 'tous', canal: [],
      ville_ciblage: 'Casablanca', heure_debut: '', heure_fin: '',
      date_diffusion: '', nombre_destinataires_jour: '',
    });
    setShowCreateCampaign(false);
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

  const onCreateClick = () => {
    if (activeTab === 'codes') setShowCreatePromo(true);
    if (activeTab === 'gestes') setShowCreateGesture(true);
    if (activeTab === 'campagnes') setShowCreateCampaign(true);
  };

  const closeModals = () => {
    setShowCreatePromo(false);
    setShowCreateGesture(false);
    setShowCreateCampaign(false);
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
        <button type="button" className="btn btn-primary" onClick={onCreateClick}>
          <Plus size={16} /> {createLabel}
        </button>
      </div>

      {activeTab === 'codes' && (
        <>
          <div className="mk-filters-row">
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
              </select>
            </label>
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
                    <td>{fmtDate(item.validFrom)}</td>
                    <td>{item.name}</td>
                    <td>
                      <button className="mk-code-chip" onClick={() => copyCode(item.code)}>
                        {item.code} <Copy size={12} />
                      </button>
                    </td>
                    <td>-{item.reduction}%</td>
                    <td>{segmentLabel(item.segment)}</td>
                    <td>{item.customerStatus}</td>
                    <td>{fmtDate(item.validFrom)} {'->'} {fmtDate(item.validUntil)}</td>
                    <td>
                      <span className={`mk-status-chip ${item.status === 'active' ? 'mk-status-green' : ''}`}>
                        {item.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button className="icon-btn" title="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button className="icon-btn" title="Supprimer" onClick={() => setPromoCodes((prev) => prev.filter((x) => x.id !== item.id))}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCodes.length === 0 && (
                  <tr>
                    <td colSpan={9} className="empty-row">Aucune offre créée</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'gestes' && (
        <>
          <div className="mk-filters-row mk-filters-row-gestes">
            <label>
              <input type="text" placeholder="Filtrer par commercial..." value={gesteCommercialFilter} onChange={(e) => setGesteCommercialFilter(e.target.value)} />
            </label>
            <label>
              <select value={gesteTypeFilter} onChange={(e) => setGesteTypeFilter(e.target.value)}>
                <option>Tous les types</option>
                {TYPES_GESTE.map((t) => (
                  <option key={t.value} value={t.label}>{t.label}</option>
                ))}
              </select>
            </label>
            <label>
              <input type="date" value={gesteDateFrom} onChange={(e) => setGesteDateFrom(e.target.value)} />
            </label>
            <label>
              <input type="date" value={gesteDateTo} onChange={(e) => setGesteDateTo(e.target.value)} />
            </label>
          </div>

          <div className="table-wrapper mk-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Commercial</th>
                  <th>Client</th>
                  <th>Type geste</th>
                  <th>Réduction</th>
                  <th>Net à payer</th>
                  <th>Part agence</th>
                  <th>Part profil</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGestes.map((item) => (
                  <tr key={item.id}>
                    <td>{fmtDate(item.date)}</td>
                    <td>{item.commercial}</td>
                    <td>{item.client}</td>
                    <td>{item.gestureType}</td>
                    <td>{money(item.reductionMad)}</td>
                    <td>{money(item.netToPayMad)}</td>
                    <td>{money(item.agencyShareMad)}</td>
                    <td>{money(item.profileShareMad)}</td>
                    <td><span className="mk-status-chip mk-status-blue">En cours</span></td>
                    <td>
                      <button className="icon-btn" title="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button className="icon-btn" title="Supprimer" onClick={() => setGestures((prev) => prev.filter((x) => x.id !== item.id))}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredGestes.length === 0 && (
                  <tr>
                    <td colSpan={10} className="empty-row">Aucun geste commercial</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'campagnes' && (
        <>
          <div className="mk-filters-row mk-filters-row-campagnes">
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
                    <td>{fmtDate(item.date)}</td>
                    <td>{item.title}</td>
                    <td>{item.target}</td>
                    <td>{segmentLabel(item.segment)}</td>
                    <td>{item.channel}</td>
                    <td>{item.city}</td>
                    <td>{fmtDate(item.broadcastDate)}</td>
                    <td>{item.perDayDest}</td>
                    <td><span className="mk-status-chip">{item.status === 'programmee' ? 'Programmée' : item.status}</span></td>
                    <td>
                      <button className="icon-btn" title="Modifier">
                        <Pencil size={14} />
                      </button>
                      <button className="icon-btn" title="Envoyer">
                        <Send size={14} />
                      </button>
                      <button className="icon-btn" title="Supprimer" onClick={() => setCampaigns((prev) => prev.filter((x) => x.id !== item.id))}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCampagnes.length === 0 && (
                  <tr>
                    <td colSpan={10} className="empty-row">Aucune campagne</td>
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
          onSubmit={createCampaign}
        />
      )}
    </div>
  );
}
