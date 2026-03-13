import { useEffect, useState, useMemo } from 'react';
import { getDemandes } from '../api/client';
import { 
  RefreshCw, ClipboardCheck, Clock, Building2, 
  Search, List, Grid, MoreHorizontal, Edit2, 
  User as UserIcon, Calendar, Clock3,
  FileText, PenTool, CheckCircle, RotateCcw, 
  AlertCircle, Check, Trash2
} from 'lucide-react';
import { Demande } from '../types';

interface DashboardStats {
  total: number;
  en_cours: number;
  particulier: number;
  entreprise: number;
  en_attente: number;
}



export default function Dashboard() {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ total: 0, en_cours: 0, particulier: 0, entreprise: 0, en_attente: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'besoins' | 'abonnements'>('besoins');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  // Filtres
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('tous');
  const [prestationFilter, setPrestationFilter] = useState('toutes');
  const [dateRange] = useState({ start: '', end: '' });
  const [selectedDemande, setSelectedDemande] = useState<Demande | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Pour le tableau de bord, on récupère tout ce qui est validé (statut != en_attente)
      const { data } = await getDemandes(); 
      const results: Demande[] = data.results || data;
      setDemandes(results);
      
      const enCours = results.filter(d => d.statut_besoin === 'en_cours');
      const spp = results.filter(d => d.segment === 'particulier');
      const spe = results.filter(d => d.segment === 'entreprise');
      const enAttente = results.filter(d => d.statut_besoin === 'en_attente');

      setStats({
        total: results.length,
        en_cours: enCours.length,
        particulier: spp.length,
        entreprise: spe.length,
        en_attente: enAttente.length,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    return demandes.filter((d) => {
      // Filtre Onglet (Besoins vs Abonnements)
      if (activeTab === 'abonnements' && d.frequency !== 'abonnement') return false;
      if (activeTab === 'besoins' && d.frequency === 'abonnement') return false;

      // Recherche
      if (search && !d.client_name.toLowerCase().includes(search.toLowerCase()) && !d.service.toLowerCase().includes(search.toLowerCase())) return false;

      // Filtre Service (SPP/SPE)
      if (serviceFilter !== 'tous') {
        if (serviceFilter === 'spp' && d.segment !== 'particulier') return false;
        if (serviceFilter === 'spe' && d.segment !== 'entreprise') return false;
      }

      // Filtre Prestation
      if (prestationFilter !== 'toutes' && d.service !== prestationFilter) return false;

      // Filtre Date
      if (dateRange.start && new Date(d.date_intervention) < new Date(dateRange.start)) return false;
      if (dateRange.end && new Date(d.date_intervention) > new Date(dateRange.end)) return false;

      return true;
    });
  }, [demandes, activeTab, search, serviceFilter, prestationFilter, dateRange]);

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
        <div className="stat-card" style={{ backgroundColor: '#edba54', color: 'white' }}>
          <div className="stat-icon" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}><ClipboardCheck size={22} /></div>
          <div>
            <p className="stat-value">{stats.en_cours}</p>
            <p className="stat-label">Demandes en cours</p>
          </div>
        </div>
        <div className="stat-card" style={{ backgroundColor: '#61c1c9', color: 'white' }}>
          <div className="stat-icon" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}><UserIcon size={22} /></div>
          <div>
            <p className="stat-value">{stats.particulier}</p>
            <p className="stat-label">Services Particuliers</p>
          </div>
        </div>
        <div className="stat-card" style={{ backgroundColor: '#0d8e8aff', color: 'white' }}>
          <div className="stat-icon" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}><Building2 size={22} /></div>
          <div>
            <p className="stat-value">{stats.entreprise}</p>
            <p className="stat-label">Services Entreprises</p>
          </div>
        </div>
        <div className="stat-card" style={{ backgroundColor: '#d9c532', color: 'white' }}>
          <div className="stat-icon" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}><Clock size={22} /></div>
          <div>
            <p className="stat-value">{stats.en_attente}</p>
            <p className="stat-label">En attente</p>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="dashboard-toolbar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Rechercher..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select className="filter-select" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
          <option value="tous">Tous les services</option>
          <option value="spp">Services Particuliers (SPP)</option>
          <option value="spe">Services Entreprises (SPE)</option>
        </select>

        <select className="filter-select" value={prestationFilter} onChange={(e) => setPrestationFilter(e.target.value)}>
          <option value="toutes">Toutes prestations</option>
          <option value="Ménage standard">Ménage standard</option>
          <option value="Grand ménage">Grand ménage</option>
          <option value="Nettoyage fin de chantier">Nettoyage fin de chantier</option>
          <option value="Ménage post-déménagement">Ménage post-déménagement</option>
          <option value="Ménage AirBnB">Ménage AirBnB</option>
          <option value="Ménage bureaux">Ménage bureaux</option>
        </select>

        <div className="view-toggles">
          <button 
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="Vue liste"
          >
            <List size={20} />
          </button>
          <button 
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Vue icônes"
          >
            <Grid size={20} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'besoins' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('besoins')}
        >
          Besoins ({demandes.filter(d => d.frequency !== 'abonnement').length})
        </button>
        <button
          className={`tab ${activeTab === 'abonnements' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('abonnements')}
        >
          Abonnements ({demandes.filter(d => d.frequency === 'abonnement').length})
        </button>
      </div>

      {/* Content area */}
      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : (
        <>
          {viewMode === 'list' ? (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Actions</th>
                    <th>Commercial</th>
                    <th>Date intervention</th>
                    <th>Nb heures</th>
                    <th>Statut besoin</th>
                    <th>Nom client</th>
                    <th>Quartier / Ville</th>
                    <th>Fréquence</th>
                    <th>Segment</th>
                    <th>Type de service</th>
                    <th>Avec produit</th>
                    <th>Tarif total</th>
                    <th>Mode paiement</th>
                    <th>Statut paiement</th>
                    <th>Reste à payer</th>
                    <th>Profils envoyés</th>
                    <th>CAO</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} className={!d.cao && new Date(d.date_intervention).getTime() - new Date().getTime() < 86400000 ? 'row-alert' : ''}>
                      <td className="relative">
                        <button 
                          className="btn btn-action"
                          onClick={() => setActiveMenu(activeMenu === d.id ? null : d.id)}
                        >
                          <Edit2 size={14} />
                          Actions
                        </button>
                        
                        {activeMenu === d.id && (
                          <div className="action-menu">
                            <button className="menu-item" onClick={() => { setSelectedDemande(d); setShowDetail(true); setActiveMenu(null); }}>
                              <Edit2 size={14} /> Éditer le besoin
                            </button>
                            <button className="menu-item"><FileText size={14} /> Note commerciale</button>
                            <button className="menu-item"><PenTool size={14} /> Note opérationnelle</button>
                            <div className="menu-divider" />
                            <button className="menu-item text-green"><CheckCircle size={14} /> Prestation effectuée</button>
                            <button className="menu-item text-blue"><RotateCcw size={14} /> Facturation en cours</button>
                            <button className="menu-item text-orange"><AlertCircle size={14} /> Facturation partielle</button>
                            <button className="menu-item text-green"><Check size={14} /> Payé</button>
                            <div className="menu-divider" />
                            <button className="menu-item text-red"><Trash2 size={14} /> Supprimer</button>
                          </div>
                        )}
                      </td>
                      <td>{d.commercial_name || d.assigned_to_name || '—'}</td>
                      <td>{d.date_intervention ? new Date(d.date_intervention).toLocaleDateString('fr-FR') : '—'}</td>
                      <td>{d.nb_heures || '—'}</td>
                      <td>
                        <span className={`badge ${d.statut_besoin === 'en_cours' ? 'badge-blue' : d.statut_besoin === 'termine' ? 'badge-green' : 'badge-orange'}`}>
                          {d.statut_besoin === 'en_cours' ? 'En cours' : d.statut_besoin === 'termine' ? 'Terminé' : 'En attente'}
                        </span>
                      </td>
                      <td>{d.client_name}</td>
                      <td>{d.neighborhood_city || '—'}</td>
                      <td>{d.frequency === 'abonnement' ? 'Abonnement' : 'Une fois'}</td>
                      <td>
                        <span className={`badge ${d.segment === 'particulier' ? 'badge-blue' : 'badge-purple'}`}>
                          {d.segment === 'particulier' ? 'SPP' : 'SPE'}
                        </span>
                      </td>
                      <td>{d.service}</td>
                      <td>
                        {d.avec_produit ? (
                          <span className="text-sm">Oui ({d.tarif_produit} MAD)</span>
                        ) : 'Non'}
                      </td>
                      <td>
                        <div className="price-info">
                          <p className="price-main">{d.prix} MAD</p>
                          <p className="price-sub">{d.is_devis ? 'Prix/devis' : 'Prix/réservation'}</p>
                        </div>
                      </td>
                      <td>{d.mode_paiement}</td>
                      <td>
                        <span className={`badge ${d.statut_paiement === 'paye' ? 'badge-green' : d.statut_paiement === 'partiel' ? 'badge-orange' : 'badge-red'}`}>
                          {d.statut_paiement === 'paye' ? 'Payé' : d.statut_paiement === 'partiel' ? 'Avance versée' : 'Non payé'}
                        </span>
                      </td>
                      <td>
                        {d.reste_a_payer > 0 ? (
                          <span className="text-red fw-bold">{d.reste_a_payer} MAD</span>
                        ) : '—'}
                      </td>
                      <td>
                        {d.profils_envoyes?.length > 0 ? (
                          <div className="avatar-group">
                            {d.profils_envoyes.map(p => (
                              <span key={p.id} className="avatar-sm" title={p.full_name}>{p.full_name[0]}</span>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        {d.cao ? (
                          <span className="badge badge-green">Oui</span>
                        ) : (
                          <span className="badge badge-red animate-pulse">Non</span>
                        )}
                      </td>
                      <td>
                        <button className="icon-btn">
                          <MoreHorizontal size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="demandes-grid">
              {filtered.map((d) => (
                <div key={d.id} className="demande-card-detail">
                  <div className="card-header">
                    <span className={`badge ${d.segment === 'particulier' ? 'badge-blue' : 'badge-purple'}`}>
                      {d.segment === 'particulier' ? 'SPP' : 'SPE'}
                    </span>
                    <button className="icon-btn"><MoreHorizontal size={18} /></button>
                  </div>
                  <div className="card-body">
                    <h3 className="client-name">{d.client_name}</h3>
                    <p className="service-type">{d.service}</p>
                    <div className="card-info">
                      <div className="info-item">
                        <Calendar size={14} />
                        <span>{d.date_intervention ? new Date(d.date_intervention).toLocaleDateString('fr-FR') : '—'}</span>
                      </div>
                      <div className="info-item">
                        <Clock3 size={14} />
                        <span>{d.nb_heures}h</span>
                      </div>
                    </div>
                    <div className="card-footer">
                      <div className="price-tag">{d.prix} MAD</div>
                      <span className={`badge ${d.cao ? 'badge-green' : 'badge-red'}`}>
                        CAO: {d.cao ? 'Oui' : 'Non'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {filtered.length === 0 && (
            <div className="empty-state">
              <ClipboardCheck size={48} className="text-muted" />
              <p>Aucun besoin ne correspond à vos critères.</p>
              <button className="btn btn-secondary" onClick={() => {
                setSearch('');
                setServiceFilter('tous');
                setPrestationFilter('toutes');
              }}>Réinitialiser les filtres</button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal / Sheet */}
      {showDetail && selectedDemande && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal-content detail-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-header">
              <h2>Détails du besoin: {selectedDemande.client_name}</h2>
              <button className="icon-btn" onClick={() => setShowDetail(false)}>✕</button>
            </div>
            <div className="sheet-body">
              <div className="detail-section">
                <h3>Informations Client</h3>
                <div className="detail-grid">
                  <div className="detail-item"><span>Nom:</span> {selectedDemande.client_name}</div>
                  <div className="detail-item"><span>Téléphone:</span> {selectedDemande.client_phone}</div>
                  <div className="detail-item"><span>Email:</span> {selectedDemande.client_details?.email || '—'}</div>
                  <div className="detail-item"><span>Ville:</span> {selectedDemande.neighborhood_city}</div>
                  <div className="detail-item"><span>Segment:</span> {selectedDemande.segment.toUpperCase()}</div>
                </div>
              </div>
              
              <div className="detail-section">
                <h3>Détails Prestation</h3>
                <div className="detail-grid">
                  <div className="detail-item"><span>Service:</span> {selectedDemande.service}</div>
                  <div className="detail-item"><span>Date:</span> {selectedDemande.date_intervention}</div>
                  <div className="detail-item"><span>Heures:</span> {selectedDemande.nb_heures}h</div>
                  <div className="detail-item"><span>Fréquence:</span> {selectedDemande.frequency}</div>
                  <div className="detail-item"><span>Avec produit:</span> {selectedDemande.avec_produit ? `Oui (${selectedDemande.tarif_produit} MAD)` : 'Non'}</div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Paiement & Statut</h3>
                <div className="detail-grid">
                  <div className="detail-item"><span>Total:</span> {selectedDemande.prix} MAD</div>
                  <div className="detail-item"><span>Mode:</span> {selectedDemande.mode_paiement}</div>
                  <div className="detail-item"><span>Statut:</span> {selectedDemande.statut_paiement}</div>
                  <div className="detail-item"><span>CAO:</span> {selectedDemande.cao ? 'Confirmé' : 'Non confirmé'}</div>
                </div>
              </div>

              {selectedDemande.note_commerciale && (
                <div className="detail-section">
                  <h3>Note Commerciale</h3>
                  <p className="note-text">{selectedDemande.note_commerciale}</p>
                </div>
              )}
            </div>
            <div className="sheet-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetail(false)}>Fermer</button>
              <button className="btn btn-primary">Enregistrer les modifications</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
