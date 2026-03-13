import { useEffect, useState } from 'react';
import { getDemandes } from '../api/client';
import { RefreshCw, ClipboardCheck, Clock, Users, Building2 } from 'lucide-react';

interface DashboardStats {
  total: number;
  en_cours: number;
  particulier: number;
  entreprise: number;
  en_attente: number;
}

interface Demande {
  id: number;
  service: string;
  segment: string;
  statut: string;
  client_name: string;
  client_phone: string;
  prix: string;
  is_devis: boolean;
  date_intervention: string;
  frequency: string;
  mode_paiement: string;
  statut_paiement: string;
  assigned_to_name: string;
  nrp_count: number;
  cao: boolean;
  created_at: string;
}

const STATUT_COLORS: Record<string, string> = {
  en_cours: 'badge-green',
  en_attente: 'badge-orange',
  annule: 'badge-red',
  termine: 'badge-gray',
};

const STATUT_LABELS: Record<string, string> = {
  en_cours: 'En cours',
  en_attente: 'En attente',
  annule: 'Annulé',
  termine: 'Terminé',
};

export default function Dashboard() {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ total: 0, en_cours: 0, particulier: 0, entreprise: 0, en_attente: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'besoins' | 'abonnements'>('besoins');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await getDemandes({ statut: 'en_cours' });
      const results: Demande[] = data.results || data;
      setDemandes(results);
      const attente = await getDemandes({ statut: 'en_attente' });
      const attenteCount = (attente.data.results || attente.data).length;
      setStats({
        total: results.length,
        en_cours: results.filter((d) => d.statut === 'en_cours').length,
        particulier: results.filter((d) => d.segment === 'particulier').length,
        entreprise: results.filter((d) => d.segment === 'entreprise').length,
        en_attente: attenteCount,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = activeTab === 'abonnements'
    ? demandes.filter((d) => d.frequency === 'abonnement')
    : demandes.filter((d) => d.frequency !== 'abonnement');

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">Vue d'ensemble des besoins clients validés</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchData}>
          <RefreshCw size={16} />
          Actualiser
        </button>
      </div>

      {/* Stats cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon stat-icon-teal"><ClipboardCheck size={22} /></div>
          <div>
            <p className="stat-label">En cours</p>
            <p className="stat-value">{stats.en_cours}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-gold"><Clock size={22} /></div>
          <div>
            <p className="stat-label">En attente</p>
            <p className="stat-value">{stats.en_attente}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><Users size={22} /></div>
          <div>
            <p className="stat-label">Particuliers</p>
            <p className="stat-value">{stats.particulier}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-purple"><Building2 size={22} /></div>
          <div>
            <p className="stat-label">Entreprises</p>
            <p className="stat-value">{stats.entreprise}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'besoins' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('besoins')}
        >
          Besoins ({demandes.filter((d) => d.frequency !== 'abonnement').length})
        </button>
        <button
          className={`tab ${activeTab === 'abonnements' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('abonnements')}
        >
          Abonnements ({demandes.filter((d) => d.frequency === 'abonnement').length})
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Service</th>
                <th>Segment</th>
                <th>Date intervention</th>
                <th>Tarif</th>
                <th>Mode paiement</th>
                <th>Statut paiement</th>
                <th>Commercial</th>
                <th>CAO</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td>
                    <p className="fw-medium">{d.client_name}</p>
                    <p className="text-muted text-sm">{d.client_phone}</p>
                  </td>
                  <td>{d.service}</td>
                  <td>
                    <span className={`badge ${d.segment === 'particulier' ? 'badge-blue' : 'badge-purple'}`}>
                      {d.segment === 'particulier' ? 'SPP' : 'SPE'}
                    </span>
                  </td>
                  <td>{d.date_intervention ? new Date(d.date_intervention).toLocaleDateString('fr-FR') : '—'}</td>
                  <td>{d.is_devis ? 'Sur devis' : d.prix ? `${d.prix} MAD` : '—'}</td>
                  <td>{d.mode_paiement || '—'}</td>
                  <td>
                    <span className={`badge ${d.statut_paiement === 'paye' ? 'badge-green' : d.statut_paiement === 'en_attente_paiement' ? 'badge-orange' : 'badge-red'}`}>
                      {d.statut_paiement === 'paye' ? 'Payé' : d.statut_paiement === 'en_attente_paiement' ? 'En attente' : 'Non payé'}
                    </span>
                  </td>
                  <td>{d.assigned_to_name || '—'}</td>
                  <td>
                    {d.cao
                      ? <span className="badge badge-green">Oui</span>
                      : <span className="badge badge-red">Non</span>}
                  </td>
                  <td>
                    <span className={`badge ${STATUT_COLORS[d.statut] || 'badge-gray'}`}>
                      {STATUT_LABELS[d.statut] || d.statut}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty-row">Aucun besoin en cours.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
