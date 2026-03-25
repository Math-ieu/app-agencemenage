import { useEffect, useState, useRef } from 'react';
import { getClients } from '../api/client';
import { 
  Search, Settings, MoreVertical, 
  RotateCw, Calendar, ChevronDown,
  User, Pencil, MessageSquare, UserPlus, Slash, Trash2
} from 'lucide-react';

interface LatestDemande {
  id: number;
  statut: string;
  statut_paiement: string;
  commercial: string | null;
  created_at: string;
}

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
  demandes_count: number;
  latest_demande: LatestDemande | null;
}

const TABS = [
  { id: 'tout', label: 'Tout' },
  { id: 'confirme', label: 'Confirmé' },
  { id: 'annule', label: 'Annulé' },
  { id: 'paye', label: 'Payé' },
  { id: 'facturation_encours', label: 'Facturation en cours' },
  { id: 'facturation_partielle', label: 'Facturation partielle' },
  { id: 'facturation', label: 'Facturation' }
];

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('tout');
  const [activeDropdown, setActiveDropdown] = useState<{ type: 'actions' | 'more', id: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // New filter states based on screenshot
  const [commercialFilter, setCommercialFilter] = useState('Tout');
  const [segmentFilter, setSegmentFilter] = useState('Tout');
  const [serviceFilter, setServiceFilter] = useState('Tout');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (activeTab !== 'tout') params.statut = activeTab;
      if (commercialFilter !== 'Tout') params.commercial = commercialFilter;
      if (segmentFilter !== 'Tout') params.segment = segmentFilter.toLowerCase();
      if (serviceFilter !== 'Tout') params.service = serviceFilter;
      if (dateDebut) params.date_debut = dateDebut;
      if (dateFin) params.date_fin = dateFin;

      const { data } = await getClients(params);
      setClients(data.results || data);
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, activeTab]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (type: 'actions' | 'more', id: number) => {
    if (activeDropdown?.type === type && activeDropdown?.id === id) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown({ type, id });
    }
  };

  const getStatusBadge = (client: Client) => {
    const latest = client.latest_demande;
    if (!latest) return <span className="badge badge-status-attente">Nouveau</span>;

    // Logic to determine status badge based on latest demand
    if (latest.statut_paiement === 'partiel') return <span className="badge badge-status-partielle">Facturation partielle</span>;
    if (latest.statut_paiement === 'integral') return <span className="badge badge-status-paye">Payé</span>;
    if (latest.statut === 'annule') return <span className="badge badge-status-annulee">Annulée</span>;
    if (latest.statut === 'termine') return <span className="badge badge-status-effectuee">Prestation effectuée</span>;
    if (latest.statut === 'en_cours') return <span className="badge badge-status-encours">En cours</span>;
    
    return <span className="badge badge-status-attente">{latest.statut}</span>;
  };

  const getRowClass = (client: Client) => {
    const latest = client.latest_demande;
    if (!latest) return '';
    if (latest.statut_paiement === 'partiel') return 'row-status-partielle';
    if (latest.statut_paiement === 'integral') return 'row-status-paye';
    if (latest.statut === 'annule') return 'row-status-annulee';
    if (latest.statut === 'en_cours') return 'row-status-encours';
    return '';
  };

  return (
    <div className="page" style={{ backgroundColor: 'white' }}>
      <div className="page-header flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Listing Clients</h1>
        <button className="btn btn-secondary" onClick={fetchData}>
          <RotateCw size={18} />
          Actualiser
        </button>
      </div>

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

      <div className="client-toolbar">
        <div className="search-box" style={{ flex: '0 0 600px' }}>
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Rechercher par nom, numéro, ville, quartier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="client-toolbar-filters">
          <div className="toolbar-dropdown">
            <select value={commercialFilter} onChange={e => setCommercialFilter(e.target.value)} className="toolbar-select">
              <option>Tout</option>
              {/* These would ideally be fetched from the API */}
              <option>Kaoutar</option>
              <option>Amine</option>
              <option>Yassine</option>
            </select>
            <ChevronDown size={16} className="dropdown-icon" />
          </div>

          <div className="toolbar-dropdown">
            <select value={segmentFilter} onChange={e => setSegmentFilter(e.target.value)} className="toolbar-select">
              <option>Tout</option>
              <option>Particulier</option>
              <option>Entreprise</option>
            </select>
            <ChevronDown size={16} className="dropdown-icon" />
          </div>

          <div className="toolbar-dropdown">
            <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)} className="toolbar-select">
              <option>Tout</option>
              <option>Ménage Bureaux</option>
              <option>Ménage standard</option>
              <option>Grand ménage</option>
              <option>Nettoyage fin de chantier</option>
              <option>Aide à domicile</option>
              <option>Placement & gestion</option>
            </select>
            <ChevronDown size={16} className="dropdown-icon" />
          </div>
          
          <div className="toolbar-date-picker">
            <Calendar size={18} className="text-slate-400" />
            <input 
              type="text" 
              placeholder="Du" 
              value={dateDebut} 
              onChange={e => setDateDebut(e.target.value)}
              onFocus={(e) => e.target.type = 'date'}
              onBlur={(e) => e.target.type = 'text'}
              className="date-input"
            />
          </div>
          <div className="toolbar-date-picker">
            <Calendar size={18} className="text-slate-400" />
            <input 
              type="text" 
              placeholder="Au" 
              value={dateFin} 
              onChange={e => setDateFin(e.target.value)}
              onFocus={(e) => e.target.type = 'date'}
              onBlur={(e) => e.target.type = 'text'}
              className="date-input"
            />
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
                <th style={{ width: '100px' }}>Actions</th>
                <th>Statut besoin</th>
                <th>Segment</th>
                <th>Commercial</th>
                <th>Nom client</th>
                <th>Quartier / Ville</th>
                <th>Fidélité</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className={getRowClass(c)}>
                  <td>
                    <div className="dropdown-container">
                      <button className="actions-cell-btn" onClick={() => toggleDropdown('actions', c.id)}>
                        <Settings size={14} />
                        Actions
                      </button>
                      {activeDropdown?.type === 'actions' && activeDropdown.id === c.id && (
                        <div className="dropdown-menu" ref={dropdownRef} style={{ left: 0, right: 'auto' }}>
                          <div className="dropdown-item">
                            <User size={16} className="dropdown-item-icon" />
                            <span>Compte client</span>
                          </div>
                          <div className="dropdown-item">
                            <Pencil size={16} className="dropdown-item-icon" />
                            <span>Éditer le besoin</span>
                          </div>
                          <div className="dropdown-divider"></div>
                          <div className="dropdown-item">
                            <MessageSquare size={16} className="dropdown-item-icon" />
                            <span>Avis commercial</span>
                          </div>
                          <div className="dropdown-item">
                            <MessageSquare size={16} className="dropdown-item-icon" />
                            <span>Avis opérationnel</span>
                          </div>
                          <div className="dropdown-divider"></div>
                          <div className="dropdown-item">
                            <UserPlus size={16} className="dropdown-item-icon" />
                            <span>Affectation</span>
                          </div>
                          <div className="dropdown-item">
                            <Slash size={16} className="dropdown-item-icon" />
                            <span>Geste commercial</span>
                          </div>
                          <div className="dropdown-divider"></div>
                          <div className="dropdown-item dropdown-item-danger">
                            <Trash2 size={16} className="dropdown-item-icon" />
                            <span>Supprimer</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    {getStatusBadge(c)}
                  </td>
                  <td>
                    <span className={`badge ${c.segment === 'particulier' ? 'badge-dark-teal' : 'badge-lime'}`}>
                      {c.segment === 'particulier' ? 'Particulier' : 'Entreprise'}
                    </span>
                  </td>
                  <td className="text-slate-500 font-medium">
                    {c.latest_demande?.commercial || '—'}
                  </td>
                  <td>
                    <div className="flex items-center">
                      <span className="font-bold text-slate-700 capitalize">{c.display_name.toLowerCase()}</span>
                      <span className="client-id-badge">#{c.id}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col">
                      <span className="font-bold text-teal-800 text-sm">{c.neighborhood || ''}</span>
                      <span className="text-xs text-slate-500 uppercase">{c.city || ''}</span>
                    </div>
                  </td>
                  <td>
                    {c.demandes_count > 0 ? (
                      <span className="badge badge-fidely">
                        {c.demandes_count} demande{c.demandes_count > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="badge-new">Nouveau</span>
                    )}
                  </td>
                  <td>
                    <div className="dropdown-container">
                      <button className="btn-more" onClick={() => toggleDropdown('more', c.id)}>
                        <MoreVertical size={18} />
                      </button>
                      {activeDropdown?.type === 'more' && activeDropdown.id === c.id && (
                        <div className="dropdown-menu" ref={dropdownRef} style={{ minWidth: '160px' }}>
                          <div className="dropdown-item">
                            <User size={16} className="dropdown-item-icon" />
                            <span>Voir le compte</span>
                          </div>
                          <div className="dropdown-item">
                            <Pencil size={16} className="dropdown-item-icon" />
                            <span>Éditer</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-row text-center py-12 text-slate-400">Aucun client trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
