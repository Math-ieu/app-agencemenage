import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAgents, deleteAgent } from '../api/client';
import { Search, Plus, RotateCw, Calendar, User, XCircle, Trash2 } from 'lucide-react';
import { Agent } from '../types';
import { encodeId } from '../utils/obfuscation';
import AddProfileModal from './ProfilEditModal';
import { useToastStore } from '../store/toast';

const TABS = [
  { id: 'tout', label: 'Tout' },
  { id: 'grand_menage', label: 'Grand ménage' },
  { id: 'menage_chantier', label: 'Ménage chantier' },
  { id: 'nettoyage_vitres', label: 'Nettoyage de vitres' }
];

// ── Filter bar styles ────────────────────────────────────────────────────────
const filterBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'nowrap',
  overflowX: 'auto',
  padding: '12px 0',
};

const searchWrapStyle: React.CSSProperties = {
  position: 'relative',
  flex: '1 1 220px',
  minWidth: '180px',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  height: '38px',
  paddingLeft: '36px',
  paddingRight: '12px',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#374151',
  background: 'white',
  outline: 'none',
  boxSizing: 'border-box',
};

const searchIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: '10px',
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  color: '#94a3b8',
};

const dateWrapStyle: React.CSSProperties = {
  position: 'relative',
  flexShrink: 0,
};

const dateInputStyle: React.CSSProperties = {
  height: '38px',
  paddingLeft: '32px',
  paddingRight: '10px',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#374151',
  background: 'white',
  outline: 'none',
  width: '110px',
};

const calIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: '9px',
  top: '50%',
  transform: 'translateY(-50%)',
  pointerEvents: 'none',
  color: '#94a3b8',
};

const dividerStyle: React.CSSProperties = {
  width: '1px',
  height: '24px',
  background: '#e2e8f0',
  flexShrink: 0,
};
// ─────────────────────────────────────────────────────────────────────────────

export default function Profils() {
  const navigate = useNavigate();
  const { addToast } = useToastStore();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('tout');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const hasActiveFilters = Boolean(dateDebut || dateFin);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (activeTab !== 'tout') params.poste = activeTab;
      if (dateDebut) params.date_debut = dateDebut;
      if (dateFin) params.date_fin = dateFin;

      const { data } = await getAgents(params);
      setAgents(data.results || data);
    } catch (err) {
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [search, activeTab, dateDebut, dateFin]);

  const handleDeleteAgent = async (agent: Agent) => {
    const label = `${agent.first_name || ''} ${agent.last_name || ''}`.trim() || `#${agent.id}`;
    if (!window.confirm(`Archiver le profil ${label} ?`)) return;

    try {
      await deleteAgent(agent.id);
      addToast('Profil archivé avec succès', 'success');
      await fetchData();
    } catch (err) {
      console.error('Error deleting agent:', err);
      addToast('Erreur lors de l\'archivage du profil', 'error');
    }
  };

  const getInitials = (agent: Agent) =>
    `${agent.first_name?.[0] || ''}${agent.last_name?.[0] || ''}`.toUpperCase();

  const resetFilters = () => {
    setDateDebut('');
    setDateFin('');
  };

  return (
    <div className="page" style={{ backgroundColor: 'white' }}>
      {/* Header */}
      <div className="page-header flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Listing Profils</h1>
        <div className="flex gap-3">
          <button className="btn btn-secondary" onClick={fetchData}>
            <RotateCw size={18} />
            Actualiser
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={18} />
            Ajouter Profil
          </button>
        </div>
      </div>

      {showAddModal && (
        <AddProfileModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchData(); }}
        />
      )}

      {/* Tabs */}
      <div className="client-tabs">
        {TABS.map(tab => (
          <div
            key={tab.id}
            className={`client-tab ${activeTab === tab.id ? 'client-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {/* ── Single-line filter bar ── */}
      <div style={filterBarStyle}>

        {/* Search */}
        <div style={searchWrapStyle}>
          <Search size={16} style={searchIconStyle} />
          <input
            type="text"
            placeholder="Rechercher par nom, numéro, ville, quartier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInputStyle}
          />
        </div>

        <div style={dividerStyle} />

        {/* Date début */}
        <div style={dateWrapStyle}>
          <Calendar size={14} style={calIconStyle} />
          <input
            type="text"
            placeholder="Du"
            value={dateDebut}
            onChange={e => setDateDebut(e.target.value)}
            onFocus={(e) => (e.target.type = 'date')}
            onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
            style={dateInputStyle}
          />
        </div>

        {/* Date fin */}
        <div style={dateWrapStyle}>
          <Calendar size={14} style={calIconStyle} />
          <input
            type="text"
            placeholder="Au"
            value={dateFin}
            onChange={e => setDateFin(e.target.value)}
            onFocus={(e) => (e.target.type = 'date')}
            onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }}
            style={dateInputStyle}
          />
        </div>

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            style={{
              flexShrink: 0,
              height: '38px',
              padding: '0 12px',
              background: 'transparent',
              border: '1px solid #fca5a5',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            <XCircle size={14} />
            Réinitialiser
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Nom</th>
                <th>Prénom</th>
                <th>Téléphone</th>
                <th>WhatsApp</th>
                <th>Situation</th>
                <th>Nationalité</th>
                <th>CIN</th>
                <th>Quartier / Ville</th>
                <th>Disponibilité</th>
                <th>Langue</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id}>
                  <td>
                    {agent.photo ? (
                      <img src={agent.photo} alt="" className="table-avatar-img" />
                    ) : (
                      <div className="table-avatar-placeholder">{getInitials(agent)}</div>
                    )}
                  </td>
                  <td className="font-bold text-slate-700">{agent.last_name || '—'}</td>
                  <td className="font-bold text-slate-700">{agent.first_name || '—'}</td>
                  <td className="text-slate-600 font-medium">{agent.phone || '—'}</td>
                  <td className="text-slate-600 font-medium">{agent.whatsapp || '—'}</td>
                  <td className="text-slate-600">{agent.situation || '—'}</td>
                  <td className="text-slate-600">{agent.nationality || '—'}</td>
                  <td className="text-xs font-mono text-slate-500 uppercase">{agent.cin || '—'}</td>
                  <td>
                    <div className="flex flex-col">
                      <span className="font-bold text-teal-800 text-sm">{agent.neighborhood || ''}</span>
                      <span className="text-xs text-slate-500 uppercase">{agent.city || ''}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${agent.statut === 'disponible' ? 'badge-lime' : 'badge-status-annule'}`}>
                      {agent.statut === 'disponible' ? 'Disponible' : 'Non disponible'}
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-status-attente">
                      {agent.languages?.[0] || 'Français'}
                    </span>
                  </td>
                  <td>
                    <div className="table-inline-actions">
                      <button
                        className="actions-cell-btn py-1.5 px-3"
                        onClick={() => navigate(`/profils/${encodeId(agent.id)}`)}
                      >
                        <User size={14} className="mr-2" />
                        Compte Profil
                      </button>
                      <button
                        type="button"
                        className="table-delete-icon-btn"
                        title="Supprimer le profil"
                        aria-label="Supprimer le profil"
                        onClick={() => handleDeleteAgent(agent)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={12} className="empty-row text-center py-12 text-slate-400">Aucun profil trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


