import { useEffect, useState } from 'react';
import { getDemandes } from '../api/client';
import { Search, Filter, History as HistoryIcon, Download } from 'lucide-react';

interface Demande {
  id: number;
  service: string;
  segment: string;
  statut: string;
  client_name: string;
  created_at: string;
  assigned_to_name: string;
}

export default function Historique() {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistorique = async () => {
      try {
        const { data } = await getDemandes(); // Fetch all initially
        setDemandes(data.results || data);
      } finally {
        setLoading(false);
      }
    };
    fetchHistorique();
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Historique des demandes</h1>
          <p className="page-subtitle">Retrouvez toutes les demandes passées, annulées ou terminées</p>
        </div>
        <button className="btn btn-secondary">
          <Download size={16} /> Exporter
        </button>
      </div>

      <div className="filters-bar">
        <div className="search-box" style={{ maxWidth: '400px' }}>
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Rechercher par numéro de demande, nom de client..." className="search-input" />
        </div>
        <button className="btn btn-secondary">
          <Filter size={16} /> Filtres avancés
        </button>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>Service</th>
                <th>Segment</th>
                <th>Date de création</th>
                <th>Géré par</th>
                <th>Statut final</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {demandes.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono text-sm text-muted">#{d.id.toString().padStart(4, '0')}</td>
                  <td className="fw-medium">{d.client_name}</td>
                  <td>{d.service}</td>
                  <td>
                    <span className={`badge ${d.segment === 'particulier' ? 'badge-blue' : 'badge-purple'}`}>
                      {d.segment === 'particulier' ? 'SPP' : 'SPE'}
                    </span>
                  </td>
                  <td>{new Date(d.created_at).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}</td>
                  <td>{d.assigned_to_name || '—'}</td>
                  <td>
                    <span className={`badge ${
                      d.statut === 'termine' ? 'badge-green' :
                      d.statut === 'annule' ? 'badge-red' : 'badge-gray'
                    }`}>
                      {d.statut}
                    </span>
                  </td>
                  <td className="text-right">
                    <button className="btn btn-secondary btn-sm" title="Voir l'historique complet">
                      <HistoryIcon size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {demandes.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-row">Aucun historique trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
