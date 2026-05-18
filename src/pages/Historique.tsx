import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDemandesHistorique } from '../api/client';
import { Search, CalendarDays, History as HistoryIcon } from 'lucide-react';
import { encodeId } from '../utils/obfuscation';
import { renderStatusBadge, renderPaymentStatusBadge } from '../utils/statusUtils';

interface Demande {
  id: number;
  client: number | null;
  profil_id?: number | null;
  service: string;
  segment: string;
  statut: string;
  statut_besoin_label: string;
  statut_paiement: string;
  statut_paiement_label: string;
  statut_paiement_ui?: string;
  client_name: string;
  created_at: string;
  profil_name: string;
  motif: string;
  cao?: boolean;
}

const getSegmentLabel = (segment: string): string => {
  if (segment === 'particulier') return 'PARTICULIER';
  if (segment === 'entreprise') return 'ENTREPRISE';
  return segment || '—';
};

const getStatutBesoinBadge = (demande: Demande) => {
  return renderStatusBadge(demande.statut, demande.cao);
};

const getStatutPaiementBadge = (demande: Demande) => {
  return renderPaymentStatusBadge(demande.statut_paiement_ui, demande.statut_paiement);
};

const formatCreationDate = (value: string): string => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR');
};

export default function Historique() {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const getRowClass = (d: Demande) => {
    if (d.statut_paiement === 'integral' || d.statut === 'termine') return 'row-status-paye';
    if (d.statut_paiement === 'partiel') return 'row-status-partielle';
    if (d.statut === 'annule') return 'row-status-annulee';
    if (d.statut === 'en_attente') return 'row-status-encours';
    return '';
  };

  const fetchHistorique = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (dateFilter) params.date = dateFilter;
      const { data } = await getDemandesHistorique(params);
      setDemandes(data.results || data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchHistorique();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search, dateFilter]);

  return (
    <div className="page">
      <div className="flex items-center gap-2 mb-6">
        <HistoryIcon size={22} className="text-teal-800" />
        <h1 className="text-2xl fw-bold text-teal-800">Historique</h1>
      </div>

      <div className="flex flex-wrap gap-3 mb-6" style={{ maxWidth: '900px', alignItems: 'center' }}>
        <div className="search-box" style={{ flex: 1, minWidth: '300px', maxWidth: '420px' }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par client, service ou réf #..."
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="relative" style={{ position: 'relative' }}>
            <button 
              className="btn btn-secondary" 
              style={{ minWidth: '220px', justifyContent: 'flex-start', cursor: 'pointer', position: 'relative' }}
              onClick={() => (document.getElementById('history-date-picker') as HTMLInputElement)?.showPicker?.()}
            >
              <CalendarDays size={16} />
              <span>{dateFilter ? new Date(dateFilter).toLocaleDateString('fr-FR') : 'Filtrer par date'}</span>
              <input
                id="history-date-picker"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer', width: '100%', height: '100%' }}
              />
            </button>
            {dateFilter && (
              <button 
                onClick={() => setDateFilter('')}
                style={{ 
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '20px', height: '20px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  fontSize: '14px', color: '#64748b', fontWeight: 'bold'
                }}
                title="Effacer la date"
              >
                &times;
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Réf</th>
                <th>Date création</th>
                <th>Nom client</th>
                <th>Type de service</th>
                <th>Segment</th>
                <th>Profil</th>
                <th>Statut besoin</th>
                <th>Statut paiement</th>
                <th>Motif</th>
              </tr>
            </thead>
            <tbody>
              {demandes.map((d) => (
                <tr key={d.id} className={getRowClass(d)}>
                  <td className="text-sm">#{d.id}</td>
                  <td>{formatCreationDate(d.created_at)}</td>
                  <td className="fw-medium">
                    {d.client ? (
                      <Link to={`/clients/${encodeId(d.client)}`} className="text-teal-700 fw-semibold" style={{ textDecoration: 'none' }}>
                        {d.client_name || 'Client'}
                      </Link>
                    ) : (
                      d.client_name || 'Client'
                    )}
                  </td>
                  <td>{d.service}</td>
                  <td>
                    <span className={`badge ${d.segment === 'particulier' ? 'badge-spp' : 'badge-spe'}`}>
                      {getSegmentLabel(d.segment)}
                    </span>
                  </td>
                  <td>
                    {d.profil_id ? (
                      <Link to={`/profils/${encodeId(d.profil_id)}`} className="text-teal-700 fw-semibold" style={{ textDecoration: 'none' }}>
                        {d.profil_name || '—'}
                      </Link>
                    ) : (d.profil_name || '—')}
                  </td>
                  <td>{getStatutBesoinBadge(d)}</td>
                  <td>{getStatutPaiementBadge(d)}</td>
                  <td>
                    {d.motif || '—'}
                  </td>
                </tr>
              ))}
              {demandes.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-row">Aucun historique trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
