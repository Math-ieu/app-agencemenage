import { useEffect, useState } from 'react';
import { getAgents } from '../api/client';
import { Search, Plus, MapPin, Briefcase } from 'lucide-react';

interface Agent {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  poste: string;
  statut: string;
  city: string;
  created_at: string;
}

const STATUT_COLORS: Record<string, string> = {
  actif: 'badge-green',
  inactif: 'badge-red',
  en_mission: 'badge-orange',
  disponible: 'badge-blue',
};

const STATUT_LABELS: Record<string, string> = {
  actif: 'Actif',
  inactif: 'Inactif',
  en_mission: 'En mission',
  disponible: 'Disponible',
};

export default function Profils() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await getAgents();
        setAgents(data.results || data);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Listing Profils</h1>
          <p className="page-subtitle">Gérez vos agents de ménage, gardes malades, et autres employés</p>
        </div>
        <button className="btn btn-primary">
          <Plus size={16} />
          Nouveau Profil
        </button>
      </div>

      <div className="filters-bar">
        <div className="search-box" style={{ maxWidth: '400px' }}>
          <Search size={16} className="search-icon" />
          <input type="text" placeholder="Rechercher par nom..." className="search-input" />
        </div>
        <select className="filter-select">
          <option value="">Tous les statuts</option>
          <option value="disponible">Disponible</option>
          <option value="en_mission">En mission</option>
          <option value="inactif">Inactif</option>
        </select>
        <select className="filter-select">
          <option value="">Tous les postes</option>
          <option value="agent_menage">Agent de ménage</option>
          <option value="garde_malade">Garde malade</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <div className="profils-grid">
          {agents.map((agent) => (
            <div key={agent.id} className="profil-card">
              <div className="profil-header">
                <div className="profil-avatar">
                  {agent.first_name?.[0]}{agent.last_name?.[0]}
                </div>
                <div className="profil-info">
                  <h3 className="profil-name">{agent.full_name}</h3>
                  <span className={`badge ${STATUT_COLORS[agent.statut]}`}>
                    {STATUT_LABELS[agent.statut] || agent.statut}
                  </span>
                </div>
              </div>

              <div className="profil-details">
                <p className="flex items-center gap-2 text-sm text-muted mb-2">
                  <Briefcase size={14} /> {agent.poste.replace('_', ' ')}
                </p>
                <p className="flex items-center gap-2 text-sm text-muted mb-2">
                  <MapPin size={14} /> {agent.city || 'Non spécifié'}
                </p>
                <p className="flex items-center gap-2 text-sm text-muted">
                  📞 {agent.phone}
                </p>
              </div>

              <div className="profil-actions">
                <button className="btn btn-secondary btn-sm flex-1">Voir fiche</button>
                <button className="btn btn-primary btn-sm flex-1">Affecter</button>
              </div>
            </div>
          ))}
          {agents.length === 0 && (
            <div className="empty-state">
              <p>Aucun profil trouvé.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
