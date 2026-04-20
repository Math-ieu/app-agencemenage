import { useEffect, useMemo, useState } from 'react';
import { Megaphone, Ticket, TrendingUp, Users, BarChart3, Plus, Trash2, X } from 'lucide-react';
import { getClients } from '../api/client';
import type { Client } from '../types';
import './Marketing.css';

type MarketingTab = 'codes' | 'gestes' | 'campagnes' | 'segments';
type SegmentLabel = 'Tous' | 'Particulier' | 'Entreprise';

interface PromoCodeItem {
  id: number;
  name: string;
  code: string;
  reduction: number;
  segment: SegmentLabel;
  validUntil: string;
  uses: number;
  status: 'Actif' | 'Inactif';
  generatedRevenue: number;
  acquiredClients: number;
}

interface CommercialGestureItem {
  id: number;
  client: string;
  type: 'Remise' | 'Avoir' | 'Geste relationnel';
  amount: number;
  reason: string;
  date: string;
  createdBy: string;
}

interface CampaignItem {
  id: number;
  name: string;
  segment: SegmentLabel;
  channel: 'WhatsApp' | 'Email' | 'SMS';
  recipients: number;
  status: 'Brouillon' | 'Active' | 'Terminee';
  date: string;
}

interface SegmentItem {
  key: string;
  label: string;
  count: number;
  tone: 'blue' | 'green' | 'amber' | 'red' | 'rose' | 'purple' | 'cyan';
}

interface MarketingStore {
  promoCodes: PromoCodeItem[];
  gestures: CommercialGestureItem[];
  campaigns: CampaignItem[];
}

const STORAGE_KEY = 'marketing_data_v1';

const money = (value: number): string => `${new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(value)} MAD`;

const toInputDate = (value: Date): string => value.toISOString().slice(0, 10);

export default function Marketing() {
  const [activeTab, setActiveTab] = useState<MarketingTab>('codes');
  const [clients, setClients] = useState<Client[]>([]);

  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [gestures, setGestures] = useState<CommercialGestureItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);

  const [showCreatePromo, setShowCreatePromo] = useState(false);
  const [showCreateGesture, setShowCreateGesture] = useState(false);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);

  const [promoForm, setPromoForm] = useState({
    name: '',
    code: '',
    reduction: '10',
    segment: 'Tous' as SegmentLabel,
    validUntil: toInputDate(new Date(Date.now() + (14 * 24 * 60 * 60 * 1000))),
  });

  const [gestureForm, setGestureForm] = useState({
    client: '',
    type: 'Remise' as CommercialGestureItem['type'],
    amount: '0',
    reason: '',
  });

  const [campaignForm, setCampaignForm] = useState({
    name: '',
    segment: 'Tous' as SegmentLabel,
    channel: 'WhatsApp' as CampaignItem['channel'],
    recipients: '0',
    status: 'Brouillon' as CampaignItem['status'],
    date: toInputDate(new Date()),
  });

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
    const loadClients = async () => {
      const allClients: Client[] = [];
      let page = 1;

      while (true) {
        const response = await getClients({ page, ordering: '-created_at' });
        const data = response.data;
        const rows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
        allClients.push(...rows as Client[]);

        if (!data?.next || rows.length === 0) break;
        page += 1;
      }

      setClients(allClients);
    };

    void loadClients();
  }, []);

  useEffect(() => {
    setShowCreatePromo(false);
    setShowCreateGesture(false);
    setShowCreateCampaign(false);
  }, [activeTab]);

  const segmentStats = useMemo<SegmentItem[]>(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const nouveaux = clients.filter((c) => (now - new Date(c.created_at).getTime()) <= (30 * dayMs)).length;
    const reguliers = clients.filter((c) => (c.demandes_count ?? 0) >= 2).length;
    const vip = clients.filter((c) => (c.demandes_count ?? 0) >= 5).length;
    const inactifs30 = clients.filter((c) => (now - new Date(c.created_at).getTime()) > (30 * dayMs)).length;
    const inactifs60 = clients.filter((c) => (now - new Date(c.created_at).getTime()) > (60 * dayMs)).length;
    const entreprise = clients.filter((c) => c.segment === 'entreprise').length;
    const particulier = clients.filter((c) => c.segment === 'particulier').length;

    return [
      { key: 'new', label: 'Nouveaux clients', count: nouveaux, tone: 'blue' },
      { key: 'regular', label: 'Clients reguliers', count: reguliers, tone: 'green' },
      { key: 'vip', label: 'Clients VIP', count: vip, tone: 'amber' },
      { key: 'inactive30', label: 'Inactifs +30j', count: inactifs30, tone: 'rose' },
      { key: 'inactive60', label: 'Inactifs +60j', count: inactifs60, tone: 'red' },
      { key: 'enterprise', label: 'Clients entreprise', count: entreprise, tone: 'purple' },
      { key: 'particulier', label: 'Clients particulier', count: particulier, tone: 'cyan' },
    ];
  }, [clients]);

  const dashboardStats = useMemo(() => {
    const promoUsed = promoCodes.reduce((sum, item) => sum + item.uses, 0);
    const revenue = promoCodes.reduce((sum, item) => sum + item.generatedRevenue, 0);
    const acquired = promoCodes.reduce((sum, item) => sum + item.acquiredClients, 0);
    const activeCount = promoCodes.filter((item) => item.status === 'Actif').length;
    const usageRate = promoCodes.length === 0 ? 0 : Math.round((activeCount / promoCodes.length) * 100);

    return { promoUsed, revenue, acquired, usageRate };
  }, [promoCodes]);

  const createPromo = () => {
    const reduction = Number(promoForm.reduction || 0);
    if (!promoForm.name.trim() || !promoForm.code.trim()) return;

    const item: PromoCodeItem = {
      id: Date.now(),
      name: promoForm.name.trim(),
      code: promoForm.code.trim().toUpperCase(),
      reduction,
      segment: promoForm.segment,
      validUntil: promoForm.validUntil,
      uses: 0,
      status: 'Actif',
      generatedRevenue: 0,
      acquiredClients: 0,
    };

    setPromoCodes((prev) => [item, ...prev]);
    setPromoForm({
      name: '',
      code: '',
      reduction: '10',
      segment: 'Tous',
      validUntil: toInputDate(new Date(Date.now() + (14 * 24 * 60 * 60 * 1000))),
    });
    setShowCreatePromo(false);
  };

  const createGesture = () => {
    if (!gestureForm.client.trim() || !gestureForm.reason.trim()) return;

    const item: CommercialGestureItem = {
      id: Date.now(),
      client: gestureForm.client.trim(),
      type: gestureForm.type,
      amount: Number(gestureForm.amount || 0),
      reason: gestureForm.reason.trim(),
      date: toInputDate(new Date()),
      createdBy: 'Back Office',
    };

    setGestures((prev) => [item, ...prev]);
    setGestureForm({ client: '', type: 'Remise', amount: '0', reason: '' });
    setShowCreateGesture(false);
  };

  const createCampaign = () => {
    if (!campaignForm.name.trim()) return;

    const item: CampaignItem = {
      id: Date.now(),
      name: campaignForm.name.trim(),
      segment: campaignForm.segment,
      channel: campaignForm.channel,
      recipients: Number(campaignForm.recipients || 0),
      status: campaignForm.status,
      date: campaignForm.date,
    };

    setCampaigns((prev) => [item, ...prev]);
    setCampaignForm({
      name: '',
      segment: 'Tous',
      channel: 'WhatsApp',
      recipients: '0',
      status: 'Brouillon',
      date: toInputDate(new Date()),
    });
    setShowCreateCampaign(false);
  };

  const tabTitle =
    activeTab === 'codes'
      ? 'Codes promo & Offres'
      : activeTab === 'gestes'
        ? 'Gestes commerciaux'
        : activeTab === 'campagnes'
          ? 'Campagnes marketing'
          : 'Segmentation clients';

  const createLabel =
    activeTab === 'codes'
      ? 'Creer un code promo'
      : activeTab === 'gestes'
        ? 'Creer un geste commercial'
        : activeTab === 'campagnes'
          ? 'Creer une campagne'
          : '';

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

  return (
    <div className="page mk-page">
      <div className="page-header mk-header">
        <div>
          <h1 className="page-title mk-title"><Megaphone size={20} /> Marketing & Actions Commerciales</h1>
          <p className="page-subtitle">Gerez vos promotions, gestes commerciaux et campagnes</p>
        </div>
      </div>

      <section className="mk-stats-grid">
        <article className="mk-stat-card tone-orange">
          <div className="mk-stat-icon"><Ticket size={16} /></div>
          <div>
            <p>Codes promo utilises</p>
            <h3>{dashboardStats.promoUsed}</h3>
          </div>
        </article>
        <article className="mk-stat-card tone-cyan">
          <div className="mk-stat-icon"><TrendingUp size={16} /></div>
          <div>
            <p>CA genere par promos</p>
            <h3>{money(dashboardStats.revenue)}</h3>
          </div>
        </article>
        <article className="mk-stat-card tone-teal">
          <div className="mk-stat-icon"><Users size={16} /></div>
          <div>
            <p>Clients acquis via promo</p>
            <h3>{dashboardStats.acquired}</h3>
          </div>
        </article>
        <article className="mk-stat-card tone-yellow">
          <div className="mk-stat-icon"><BarChart3 size={16} /></div>
          <div>
            <p>Taux d'utilisation</p>
            <h3>{dashboardStats.usageRate}%</h3>
          </div>
        </article>
      </section>

      <div className="mk-tabs">
        <button type="button" className={activeTab === 'codes' ? 'active' : ''} onClick={() => setActiveTab('codes')}>Codes promo</button>
        <button type="button" className={activeTab === 'gestes' ? 'active' : ''} onClick={() => setActiveTab('gestes')}>Gestes commerciaux</button>
        <button type="button" className={activeTab === 'campagnes' ? 'active' : ''} onClick={() => setActiveTab('campagnes')}>Campagnes</button>
        <button type="button" className={activeTab === 'segments' ? 'active' : ''} onClick={() => setActiveTab('segments')}>Segments clients</button>
      </div>

      <div className="mk-section-head">
        <h2>{tabTitle}</h2>
        {activeTab !== 'segments' && (
          <button type="button" className="btn btn-primary" onClick={onCreateClick}>
            <Plus size={16} /> {createLabel}
          </button>
        )}
      </div>

      {activeTab === 'codes' && (
        <div className="table-wrapper mk-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Code</th>
                <th>Reduction</th>
                <th>Segment</th>
                <th>Validite</th>
                <th>Utilisations</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {promoCodes.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td className="fw-bold">{item.code}</td>
                  <td>{item.reduction}%</td>
                  <td>{item.segment}</td>
                  <td>{item.validUntil}</td>
                  <td>{item.uses}</td>
                  <td>{item.status}</td>
                  <td>
                    <button className="icon-btn" title="Supprimer" onClick={() => setPromoCodes((prev) => prev.filter((x) => x.id !== item.id))}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {promoCodes.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-row">Aucune offre creee</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'gestes' && (
        <div className="table-wrapper mk-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Type</th>
                <th>Montant</th>
                <th>Raison</th>
                <th>Date</th>
                <th>Cree par</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {gestures.map((item) => (
                <tr key={item.id}>
                  <td>{item.client}</td>
                  <td>{item.type}</td>
                  <td>{money(item.amount)}</td>
                  <td>{item.reason}</td>
                  <td>{item.date}</td>
                  <td>{item.createdBy}</td>
                  <td>
                    <button className="icon-btn" title="Supprimer" onClick={() => setGestures((prev) => prev.filter((x) => x.id !== item.id))}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {gestures.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">Aucun geste commercial</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'campagnes' && (
        <div className="table-wrapper mk-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Segment</th>
                <th>Canal</th>
                <th>Destinataires</th>
                <th>Statut</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.segment}</td>
                  <td>{item.channel}</td>
                  <td>{item.recipients}</td>
                  <td>{item.status}</td>
                  <td>{item.date}</td>
                  <td>
                    <button className="icon-btn" title="Supprimer" onClick={() => setCampaigns((prev) => prev.filter((x) => x.id !== item.id))}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-row">Aucune campagne</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'segments' && (
        <section className="mk-segments-grid">
          {segmentStats.map((item) => (
            <article key={item.key} className={`mk-segment-card tone-${item.tone}`}>
              <div className="mk-segment-chip">{item.label}</div>
              <p>{item.count}</p>
            </article>
          ))}
        </section>
      )}

      {showCreatePromo && (
        <div className="mk-modal-overlay" onClick={closeModals}>
          <section className="mk-modal" onClick={(e) => e.stopPropagation()}>
            <header className="mk-modal-header">
              <h3>Creer un code promo</h3>
              <button type="button" className="mk-modal-close" onClick={closeModals}><X size={16} /></button>
            </header>
            <div className="mk-create-form mk-create-form-modal">
              <label>Nom
                <input value={promoForm.name} onChange={(e) => setPromoForm((p) => ({ ...p, name: e.target.value }))} placeholder="Offre printemps" />
              </label>
              <label>Code
                <input value={promoForm.code} onChange={(e) => setPromoForm((p) => ({ ...p, code: e.target.value }))} placeholder="SPRING10" />
              </label>
              <label>Reduction (%)
                <input type="number" min={0} max={100} value={promoForm.reduction} onChange={(e) => setPromoForm((p) => ({ ...p, reduction: e.target.value }))} />
              </label>
              <label>Segment
                <select value={promoForm.segment} onChange={(e) => setPromoForm((p) => ({ ...p, segment: e.target.value as SegmentLabel }))}>
                  <option>Tous</option>
                  <option>Particulier</option>
                  <option>Entreprise</option>
                </select>
              </label>
              <label>Validite
                <input type="date" value={promoForm.validUntil} onChange={(e) => setPromoForm((p) => ({ ...p, validUntil: e.target.value }))} />
              </label>
            </div>
            <div className="mk-form-actions mk-form-actions-modal">
              <button type="button" className="btn btn-secondary" onClick={closeModals}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={createPromo}>Enregistrer</button>
            </div>
          </section>
        </div>
      )}

      {showCreateGesture && (
        <div className="mk-modal-overlay" onClick={closeModals}>
          <section className="mk-modal" onClick={(e) => e.stopPropagation()}>
            <header className="mk-modal-header">
              <h3>Creer un geste commercial</h3>
              <button type="button" className="mk-modal-close" onClick={closeModals}><X size={16} /></button>
            </header>
            <div className="mk-create-form mk-create-form-modal mk-create-form-compact">
              <label>Client
                <input value={gestureForm.client} onChange={(e) => setGestureForm((p) => ({ ...p, client: e.target.value }))} placeholder="Nom client" />
              </label>
              <label>Type
                <select value={gestureForm.type} onChange={(e) => setGestureForm((p) => ({ ...p, type: e.target.value as CommercialGestureItem['type'] }))}>
                  <option>Remise</option>
                  <option>Avoir</option>
                  <option>Geste relationnel</option>
                </select>
              </label>
              <label>Montant (MAD)
                <input type="number" min={0} value={gestureForm.amount} onChange={(e) => setGestureForm((p) => ({ ...p, amount: e.target.value }))} />
              </label>
              <label>Raison
                <input value={gestureForm.reason} onChange={(e) => setGestureForm((p) => ({ ...p, reason: e.target.value }))} placeholder="Retard de prestation" />
              </label>
            </div>
            <div className="mk-form-actions mk-form-actions-modal">
              <button type="button" className="btn btn-secondary" onClick={closeModals}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={createGesture}>Enregistrer</button>
            </div>
          </section>
        </div>
      )}

      {showCreateCampaign && (
        <div className="mk-modal-overlay" onClick={closeModals}>
          <section className="mk-modal" onClick={(e) => e.stopPropagation()}>
            <header className="mk-modal-header">
              <h3>Creer une campagne</h3>
              <button type="button" className="mk-modal-close" onClick={closeModals}><X size={16} /></button>
            </header>
            <div className="mk-create-form mk-create-form-modal">
              <label>Nom
                <input value={campaignForm.name} onChange={(e) => setCampaignForm((p) => ({ ...p, name: e.target.value }))} placeholder="Relance clients inactifs" />
              </label>
              <label>Segment
                <select value={campaignForm.segment} onChange={(e) => setCampaignForm((p) => ({ ...p, segment: e.target.value as SegmentLabel }))}>
                  <option>Tous</option>
                  <option>Particulier</option>
                  <option>Entreprise</option>
                </select>
              </label>
              <label>Canal
                <select value={campaignForm.channel} onChange={(e) => setCampaignForm((p) => ({ ...p, channel: e.target.value as CampaignItem['channel'] }))}>
                  <option>WhatsApp</option>
                  <option>Email</option>
                  <option>SMS</option>
                </select>
              </label>
              <label>Destinataires
                <input type="number" min={0} value={campaignForm.recipients} onChange={(e) => setCampaignForm((p) => ({ ...p, recipients: e.target.value }))} />
              </label>
              <label>Date
                <input type="date" value={campaignForm.date} onChange={(e) => setCampaignForm((p) => ({ ...p, date: e.target.value }))} />
              </label>
            </div>
            <div className="mk-form-actions mk-form-actions-modal">
              <button type="button" className="btn btn-secondary" onClick={closeModals}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={createCampaign}>Enregistrer</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
