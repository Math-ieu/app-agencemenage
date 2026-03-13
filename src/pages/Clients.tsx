import { useEffect, useState } from 'react';
import { getClients } from '../api/client';
import { Search, Plus, Filter, Mail, Phone } from 'lucide-react';

interface Client {
  id: number;
  display_name: string;
  first_name: string;
  last_name: string;
  entity_name: string;
  phone: string;
  email: string;
  segment: string;
  city: string;
  neighborhood: string;
  created_at: string;
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = {};
        if (search) params.search = search;
        const { data } = await getClients(params);
        setClients(data.results || data);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [search]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Listing Clients</h1>
          <p className="page-subtitle">Gérez la base de données de vos clients particuliers et entreprises</p>
        </div>
        <button className="btn btn-primary">
          <Plus size={16} />
          Nouveau Client
        </button>
      </div>

      <div className="filters-bar">
        <div className="search-box" style={{ maxWidth: '400px' }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par nom, entreprise, téléphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
        <button className="btn btn-secondary">
          <Filter size={16} /> Filtres
        </button>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Segment</th>
                <th>Contact</th>
                <th>Localisation</th>
                <th>Date d'inscription</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="avatar-circle">
                        {c.display_name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="fw-medium">{c.display_name}</p>
                        {c.segment === 'entreprise' && c.first_name && (
                          <p className="text-sm text-muted">Contact: {c.first_name} {c.last_name}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${c.segment === 'particulier' ? 'badge-blue' : 'badge-purple'}`}>
                      {c.segment === 'particulier' ? 'Particulier' : 'Entreprise'}
                    </span>
                  </td>
                  <td>
                    <div className="flex flex-col gap-1 text-sm text-muted">
                      <span className="flex items-center gap-1"><Phone size={12} /> {c.phone}</span>
                      {c.email && <span className="flex items-center gap-1"><Mail size={12} /> {c.email}</span>}
                    </div>
                  </td>
                  <td>
                    <p className="text-sm">{c.city || '—'}</p>
                    <p className="text-xs text-muted">{c.neighborhood}</p>
                  </td>
                  <td>{new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
                  <td className="text-right">
                    <button className="btn btn-secondary btn-sm">Voir fiche</button>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">Aucun client trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
