import { useEffect, useState, useCallback } from 'react';
import { getDemandes } from '../api/client';
import { useNotificationStore } from '../store/auth';
import {
  Search, Plus, ChevronDown, RefreshCw,
  CheckCircle, XCircle, PhoneOff, UserPlus, Edit, Download
} from 'lucide-react';
import {
  validerDemande, annulerDemande, nrpDemande
} from '../api/client';

interface Demande {
  id: number;
  service: string;
  segment: string;
  statut: string;
  source: string;
  frequency: string;
  date_intervention: string;
  prix: string;
  is_devis: boolean;
  client_name: string;
  client_phone: string;
  assigned_to_name: string;
  nrp_count: number;
  created_at: string;
}

const SEGMENT_COLORS: Record<string, string> = {
  particulier: 'badge-blue',
  entreprise: 'badge-purple',
};

export default function DemandesEnAttente() {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('');
  const { setPendingCount } = useNotificationStore();

  const fetchDemandes = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { statut: 'en_attente' };
      if (search) params.search = search;
      if (segment) params.segment = segment;
      const { data } = await getDemandes(params);
      const results = data.results || data;
      setDemandes(results);
      setPendingCount(results.length);
    } finally {
      setLoading(false);
    }
  }, [search, segment, setPendingCount]);

  useEffect(() => { fetchDemandes(); }, [fetchDemandes]);

  const handleValider = async (id: number) => {
    await validerDemande(id);
    fetchDemandes();
  };

  const handleNRP = async (id: number) => {
    await nrpDemande(id);
    fetchDemandes();
  };

  const handleAnnuler = async (id: number) => {
    const avis = prompt('Motif d\'annulation :') ?? '';
    await annulerDemande(id, avis);
    fetchDemandes();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Demandes en attente
            {demandes.length > 0 && (
              <span className="badge badge-orange ml-2">{demandes.length} demande(s)</span>
            )}
          </h1>
          <p className="page-subtitle">Gérez les demandes clients en attente de traitement</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={fetchDemandes}>
            <RefreshCw size={16} />
            Actualiser
          </button>
          <div className="dropdown">
            <button className="btn btn-primary">
              <Plus size={16} />
              Nouveau
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par nom, téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <select
          className="filter-select"
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
        >
          <option value="">Tous les segments</option>
          <option value="particulier">Particulier</option>
          <option value="entreprise">Entreprise</option>
        </select>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Chargement des demandes...</p>
        </div>
      ) : demandes.length === 0 ? (
        <div className="empty-state">
          <CheckCircle size={48} className="text-green" />
          <h3>Aucune demande en attente</h3>
          <p>Toutes les demandes ont été traitées.</p>
        </div>
      ) : (
        <div className="demandes-grid">
          {demandes.map((d) => (
            <div key={d.id} className="demande-card">
              <div className="demande-card-header">
                <div>
                  <h3 className="demande-service">{d.service}</h3>
                  <div className="demande-meta">
                    <span className={`badge ${SEGMENT_COLORS[d.segment]}`}>
                      {d.segment === 'particulier' ? 'SPP' : 'SPE'}
                    </span>
                    <span className="badge badge-gray">{d.frequency === 'oneshot' ? 'Une fois' : 'Abonnement'}</span>
                    {d.source === 'site' && <span className="badge badge-teal">Site web</span>}
                  </div>
                </div>
                <div className="demande-price">
                  {d.is_devis ? (
                    <span className="price-devis">Sur devis</span>
                  ) : (
                    <span className="price-amount">{d.prix ? `${d.prix} MAD` : '—'}</span>
                  )}
                </div>
              </div>

              <div className="demande-client">
                <p className="client-name">{d.client_name}</p>
                <p className="client-phone">{d.client_phone}</p>
                {d.date_intervention && (
                  <p className="client-date">📅 {new Date(d.date_intervention).toLocaleDateString('fr-FR')}</p>
                )}
                {d.nrp_count > 0 && (
                  <span className="nrp-indicator">🔴 {d.nrp_count} NRP</span>
                )}
              </div>

              <div className="demande-footer">
                <p className="demande-date">
                  {new Date(d.created_at).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
                {d.assigned_to_name && (
                  <p className="demande-assigned">👤 {d.assigned_to_name}</p>
                )}
              </div>

              <div className="demande-actions">
                <button
                  className="action-btn action-btn-success"
                  onClick={() => handleValider(d.id)}
                  title="Valider la demande"
                >
                  <CheckCircle size={16} />
                  Valider
                </button>
                <button
                  className="action-btn action-btn-warning"
                  onClick={() => handleNRP(d.id)}
                  title="NRP — Client sans réponse"
                >
                  <PhoneOff size={16} />
                  NRP
                </button>
                <button
                  className="action-btn action-btn-danger"
                  onClick={() => handleAnnuler(d.id)}
                  title="Annuler la demande"
                >
                  <XCircle size={16} />
                  Annuler
                </button>
                <button className="action-btn action-btn-secondary" title="Modifier">
                  <Edit size={16} />
                </button>
                <button className="action-btn action-btn-secondary" title="Affecter">
                  <UserPlus size={16} />
                </button>
                <button className="action-btn action-btn-secondary" title="Télécharger">
                  <Download size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
