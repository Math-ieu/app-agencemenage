import { useEffect, useState, useMemo } from 'react';
import { 
  RefreshCw, ClipboardCheck, Building2, Clock,
  Search, List, Grid, MoreHorizontal, MoreVertical, Edit2,  
  User as UserIcon, Calendar, Clock3,
  CheckCircle, 
  Settings, UserCheck, 
  XCircle, CreditCard, MessageSquare,
  ChevronLeft,
  FileText,
  Save
} from 'lucide-react';
import { Demande } from '../types';
import { getDemandes, updateDemande, annulerDemande, confirmerCAO } from '../api/client';
import { useToastStore } from '../store/toast';

interface DashboardStats {
  total: number;
  en_cours: number;
  particulier: number;
  entreprise: number;
  en_attente: number;
}



const SERVICES_LIST = {
  particulier: [
    "Ménage standard",
    "Grand ménage",
    "Ménage Air BnB",
    "Nettoyage post-déménagement",
    "Ménage fin de chantier",
    "Aide à domicile",
    "Auxiliaire de vie",
    "Ménage post-sinistre"
  ],
  entreprise: [
    "Ménage bureaux",
    "Nettoyage fin de chantier",
    "Placement & gestion",
    "Ménage post-sinistre"
  ]
};

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
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [showDetail, setShowDetail] = useState(false);
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const [activeMoreMenu, setActiveMoreMenu] = useState<number | null>(null);
  const { addToast } = useToastStore();

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await getDemandes(); 
      const data = response.data;
      const allResults: Demande[] = Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []);
      
      const enAttenteList = allResults.filter(d => d.statut === 'en_attente');
      const results = allResults.filter(d => d.statut !== 'en_attente');
      setDemandes(results);
      
      const enCours = results.filter(d => d.statut === 'en_cours');
      const spp = results.filter(d => d.segment === 'particulier');
      const spe = results.filter(d => d.segment === 'entreprise');

      setStats({
        total: results.length,
        en_cours: enCours.length,
        particulier: spp.length,
        entreprise: spe.length,
        en_attente: enAttenteList.length,
      });
    } catch (err) {
      console.error(err);
      addToast('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedDemande) return;
    try {
      const updateData: any = {
        ...editFormData,
        prix: parseFloat(editFormData.prix) || 0,
        nb_heures: parseInt(editFormData.nb_heures) || 0,
      };

      if (selectedDemande.formulaire_data) {
        updateData.formulaire_data = {
          ...selectedDemande.formulaire_data,
          type_habitation: editFormData.type_habitation,
          nb_intervenants: editFormData.nb_intervenants,
          produits: editFormData.avec_produit,
          torchons: editFormData.avec_torchons,
        };
      }

      updateData.avec_produit = editFormData.avec_produit;

      await updateDemande(selectedDemande.id, updateData);
      setIsEditing(false);
      setShowDetail(false);
      await fetchData();
      addToast('Mise à jour effectuée avec succès !', 'success');
      
      if (editFormData.envoyer_whatsapp) {
        addToast('Demande de régénération et envoi WhatsApp transmise.', 'info');
      }
    } catch (err) {
      console.error(err);
      addToast('Erreur lors de la mise à jour.', 'error');
    }
  };

  const openDetail = (d: Demande) => {
    setSelectedDemande(d);
    setIsEditing(false);
    setEditFormData({
      prix: d.prix,
      mode_paiement: d.mode_paiement,
      statut_paiement: d.statut_paiement,
      nb_heures: d.nb_heures,
      date_intervention: d.date_intervention,
      heure_intervention: d.heure_intervention || '',
      note_commerciale: d.note_commerciale || '',
      note_operationnelle: d.note_operationnelle || '',
      service: d.service,
      segment: d.segment,
      frequency: d.frequency,
      client_name: d.client_name || d.formulaire_data?.nom || '',
      client_phone: d.client_phone || d.formulaire_data?.whatsapp_phone || '',
      client_whatsapp: d.client_whatsapp || d.formulaire_data?.whatsapp_phone || '',
      client_email: d.client_details?.email || '',
      neighborhood: d.neighborhood_city || 'Casablanca',
      is_devis: d.is_devis,
      statut: d.statut,
      type_habitation: d.formulaire_data?.type_habitation || '',
      nb_intervenants: d.formulaire_data?.nb_intervenants || ((d.nb_heures || 0) > 0 ? 1 : 0),
      avec_produit: d.avec_produit || false,
      avec_torchons: d.formulaire_data?.torchons || false,
      regenerer_devis: false,
      envoyer_whatsapp: false
    });
    setShowDetail(true);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    return demandes.filter((d) => {
      // Filtre Onglet (Besoins vs Abonnements)
      if (activeTab === 'abonnements' && d.frequency !== 'abonnement') return false;
      if (activeTab === 'besoins' && d.frequency === 'abonnement') return false;

      // Recherche
      if (search) {
        const clientName = d.client_name || d.formulaire_data?.nom || '';
         if (!clientName.toLowerCase().includes(search.toLowerCase()) && !d.service.toLowerCase().includes(search.toLowerCase())) return false;
      }

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
                          onClick={() => {
                            setActiveMenu(activeMenu === d.id ? null : d.id);
                            setActiveMoreMenu(null);
                          }}
                        >
                          <Settings size={14} />
                          Actions
                        </button>
                        
                        {activeMenu === d.id && (
                          <div className="action-menu">
                            <button className="menu-item" onClick={() => { openDetail(d); setActiveMenu(null); }}>
                              <Edit2 size={14} /> Éditer le besoin
                            </button>
                            <button className="menu-item" onClick={async () => {
                              if (confirm('Confirmer cette opération ?')) {
                                await confirmerCAO(d.id);
                                fetchData();
                              }
                            }}>
                              <CheckCircle size={14} /> Confirmation Opé
                            </button>
                            <button className="menu-item">
                              <UserCheck size={14} /> Compte Client
                            </button>
                          </div>
                        )}
                      </td>
                      <td>{d.commercial_name || d.assigned_to_name || '—'}</td>
                      <td>{d.date_intervention ? new Date(d.date_intervention).toLocaleDateString('fr-FR') : (d.formulaire_data?.date_intervention || '—')}</td>
                      <td>{d.nb_heures || d.formulaire_data?.duree || d.formulaire_data?.nb_heures || '—'}</td>
                      <td>
                        <span className={`badge ${d.statut === 'en_cours' ? 'badge-blue' : d.statut === 'termine' ? 'badge-green' : 'badge-orange'}`}>
                          {d.statut === 'en_cours' ? 'En cours' : d.statut === 'termine' ? 'Terminé' : 'En attente'}
                        </span>
                      </td>
                      <td>{d.client_name || d.formulaire_data?.nom || '—'}</td>
                      <td>
                        {[d.formulaire_data?.quartier || d.client_neighborhood, d.formulaire_data?.ville || d.client_city].filter(Boolean).join(', ') || d.neighborhood_city || '—'}
                      </td>
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
                          <p className="price-main">{typeof d.prix === 'number' ? d.prix.toLocaleString('fr-FR') : (d.prix || '0')} MAD</p>
                          <p className="price-sub">{d.is_devis ? 'Prix/devis' : 'Prix/réservation'}</p>
                        </div>
                      </td>
                      <td>{d.mode_paiement_label || d.mode_paiement || '—'}</td>
                      <td>
                        <span className={`badge ${['paye', 'integral'].includes(d.statut_paiement) ? 'badge-green' : d.statut_paiement === 'partiel' ? 'badge-orange' : 'badge-red'}`}>
                          {d.statut_paiement_label || d.statut_paiement || 'Non payé'}
                        </span>
                      </td>
                      <td>
                        {(d.reste_a_payer ?? 0) > 0 ? (
                          <span className="text-red fw-bold">{(d.reste_a_payer ?? 0).toLocaleString('fr-FR')} MAD</span>
                        ) : '—'}
                      </td>
                      <td>
                        {(d.profils_envoyes?.length ?? 0) > 0 ? (
                          <div className="avatar-group">
                            {d.profils_envoyes?.map(p => (
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
                      <td className="relative">
                        <button 
                          className="icon-btn"
                          onClick={() => {
                            setActiveMoreMenu(activeMoreMenu === d.id ? null : d.id);
                            setActiveMenu(null);
                          }}
                        >
                          <MoreVertical size={18} />
                        </button>

                        {activeMoreMenu === d.id && (
                          <div className="action-menu" style={{ right: 0, left: 'auto', top: '100%' }}>
                            <button className="menu-item" onClick={() => { openDetail(d); setActiveMoreMenu(null); }}>
                              <Edit2 size={14} /> Éditer le besoin
                            </button>
                            <button className="menu-item">
                              <MessageSquare size={14} /> Note commerciale
                            </button>
                            <button className="menu-item">
                              <MessageSquare size={14} /> Note opérationnelle
                            </button>
                            <div className="menu-divider" />
                            <button className="menu-item text-blue" onClick={async () => {
                              await updateDemande(d.id, { statut: 'termine' });
                              fetchData();
                            }}>
                              <CheckCircle size={14} /> Prestation effectuée
                            </button>
                            <button className="menu-item text-green" onClick={async () => {
                              await updateDemande(d.id, { statut_paiement: 'acompte' });
                              fetchData();
                            }}>
                              <CreditCard size={14} /> Facturation en cours
                            </button>
                            <button className="menu-item text-orange" onClick={async () => {
                              await updateDemande(d.id, { statut_paiement: 'partiel' });
                              fetchData();
                            }}>
                              <CreditCard size={14} /> Facturation partielle
                            </button>
                            <button className="menu-item text-green" onClick={async () => {
                              await updateDemande(d.id, { statut_paiement: 'integral' });
                              fetchData();
                            }}>
                              <CheckCircle size={14} /> Payé
                            </button>
                            <div className="menu-divider" />
                            <button className="menu-item text-red" onClick={async () => {
                              const reason = prompt('Motif d\'annulation :');
                              if (reason === null) return;
                              await annulerDemande(d.id, reason);
                              fetchData();
                            }}>
                              <XCircle size={14} /> Rejeté / Annulé
                            </button>
                            <button className="menu-item text-red" onClick={async () => {
                              await updateDemande(d.id, { statut_paiement: 'annule' });
                              fetchData();
                            }}>
                              <XCircle size={14} /> Facturation annulée
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="demandes-grid">
              {filtered.map((d) => (
                <div key={d.id} className={`demande-card-detail table-row-matching ${!d.cao && new Date(d.date_intervention).getTime() - new Date().getTime() < 86400000 ? 'row-alert' : ''}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <h3 className="client-name" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                      {d.client_name || d.formulaire_data?.nom || '—'}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`badge ${d.segment === 'particulier' ? 'badge-teal' : 'badge-lime'}`}>
                        {d.segment === 'particulier' ? 'SPP' : 'SPE'}
                      </span>
                      <div className="relative">
                        <button 
                          className="icon-btn"
                          onClick={() => {
                            setActiveMoreMenu(activeMoreMenu === d.id ? null : d.id);
                            setActiveMenu(null);
                          }}
                        >
                          <MoreVertical size={18} />
                        </button>
                        
                        {activeMoreMenu === d.id && (
                          <div className="action-menu" style={{ right: 0, left: 'auto', top: '100%', zIndex: 50 }}>
                            <button className="menu-item" onClick={() => { openDetail(d); setActiveMoreMenu(null); }}>
                              <Edit2 size={14} /> Éditer le besoin
                            </button>
                            <button className="menu-item">
                              <MessageSquare size={14} /> Note commerciale
                            </button>
                            <button className="menu-item">
                              <MessageSquare size={14} /> Note opérationnelle
                            </button>
                            <div className="menu-divider" />
                            <button className="menu-item text-blue" onClick={async () => {
                              await updateDemande(d.id, { statut: 'termine' });
                              fetchData();
                            }}>
                              <CheckCircle size={14} /> Prestation effectuée
                            </button>
                            <button className="menu-item text-green" onClick={async () => {
                              await updateDemande(d.id, { statut_paiement: 'acompte' });
                              fetchData();
                            }}>
                              <CreditCard size={14} /> Facturation en cours
                            </button>
                            <button className="menu-item text-orange" onClick={async () => {
                              await updateDemande(d.id, { statut_paiement: 'partiel' });
                              fetchData();
                            }}>
                              <CreditCard size={14} /> Facturation partielle
                            </button>
                            <button className="menu-item text-green" onClick={async () => {
                              await updateDemande(d.id, { statut_paiement: 'integral' });
                              fetchData();
                            }}>
                              <CheckCircle size={14} /> Payé
                            </button>
                            <div className="menu-divider" />
                            <button className="menu-item text-red" onClick={async () => {
                              const reason = prompt('Motif d\'annulation :');
                              if (reason === null) return;
                              await annulerDemande(d.id, reason);
                              fetchData();
                            }}>
                              <XCircle size={14} /> Rejeté / Annulé
                            </button>
                            <button className="menu-item text-red" onClick={async () => {
                              await updateDemande(d.id, { statut_paiement: 'annule' });
                              fetchData();
                            }}>
                              <XCircle size={14} /> Facturation annulée
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '8px', fontWeight: '500' }}>
                    # {d.id} · {d.service}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px', fontSize: '0.875rem', marginBottom: '8px' }}>
                    <div>
                      <span style={{ color: '#64748b', marginRight: '4px' }}>Date :</span> 
                      <span style={{ fontWeight: '500' }}>
                        {d.date_intervention ? new Date(d.date_intervention).toLocaleDateString('fr-FR') : (d.formulaire_data?.date_intervention || '—')}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', marginRight: '4px' }}>Heures :</span> 
                      <span style={{ fontWeight: '500' }}>
                        {d.nb_heures || d.formulaire_data?.duree || d.formulaire_data?.nb_heures || '—'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', marginRight: '4px' }}>Lieu :</span> 
                      <span style={{ fontWeight: '500' }}>
                        {[d.formulaire_data?.quartier || d.client_neighborhood, d.formulaire_data?.ville || d.client_city].filter(Boolean).join(', ') || d.neighborhood_city || '—'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', marginRight: '4px' }}>Tarif :</span> 
                      <span style={{ fontWeight: '600' }}>
                        {typeof d.prix === 'number' && d.prix > 0 ? `${d.prix.toLocaleString('fr-FR')} MAD` : (d.prix && d.prix !== '0' ? `${d.prix} MAD` : '—')}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <span className={`badge ${d.statut === 'en_cours' ? 'badge-gray-blue' : d.statut === 'termine' ? 'badge-green' : 'badge-orange'}`} style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '12px' }}>
                      {d.statut === 'en_cours' ? 'En cours' : d.statut === 'termine' ? 'Terminé' : 'En attente'}
                    </span>
                    {d.avec_produit && (
                      <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#10b981', padding: '4px 10px', fontSize: '0.75rem', borderRadius: '12px', fontWeight: 'bold' }}>
                        + Produit
                      </span>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', justifyContent: 'flex-start' }}>
                    <div className="relative">
                      <button 
                        className="btn"
                        style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', borderRadius: '8px', padding: '6px 12px', fontSize: '0.875rem' }}
                        onClick={() => {
                          setActiveMenu(activeMenu === d.id ? null : d.id);
                          setActiveMoreMenu(null);
                        }}
                      >
                        <Settings size={14} />
                        Actions
                      </button>
                      
                      {activeMenu === d.id && (
                        <div className="action-menu shadow-lg border" style={{ right: 'auto', left: 0, bottom: '100%', top: 'auto', marginBottom: '8px', zIndex: 50 }}>
                          <button className="menu-item" onClick={() => { openDetail(d); setActiveMenu(null); }}>
                            <Edit2 size={14} /> Éditer le besoin
                          </button>
                          <button className="menu-item" onClick={async () => {
                            if (confirm('Confirmer cette opération ?')) {
                              await confirmerCAO(d.id);
                              fetchData();
                            }
                          }}>
                            <CheckCircle size={14} /> Confirmation Opé
                          </button>
                          <button className="menu-item">
                            <UserCheck size={14} /> Compte Client
                          </button>
                        </div>
                      )}
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
            <div className="sheet-header py-4">
              <div className="form-header-compact">
                <button className="back-btn-circle" onClick={() => setShowDetail(false)}>
                  <ChevronLeft size={20} className="text-primary" />
                </button>
                <div>
                  <h2 className="text-xl fw-bold">Éditer le besoin — # {selectedDemande.id}</h2>
                  <p className="text-sm text-muted">Formulaire : {selectedDemande.service}</p>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setShowDetail(false)}>✕</button>
            </div>
            <div className="sheet-body px-6">
              {isEditing ? (
                <div className="edit-form-full">
                  {/* Row 1: Espace agence */}
                  <div className="form-grid-4 gap-4 mb-6">
                    <div className="form-group">
                      <label>Statut du besoin</label>
                      <select 
                        value={editFormData.statut} 
                        onChange={e => setEditFormData({...editFormData, statut: e.target.value})} 
                        className="edit-input"
                        style={{fontWeight: 'bold', color: editFormData.statut === 'en_cours' ? '#10b981' : (editFormData.statut === 'en_attente' ? '#f59e0b' : '#334155')}}
                      >
                        <option value="en_attente">En attente</option>
                        <option value="en_cours">En cours</option>
                        <option value="termine">Terminé</option>
                        <option value="annule">Annulé</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Segment</label>
                      <select 
                        value={editFormData.segment} 
                        onChange={e => {
                          const newSegment = e.target.value as keyof typeof SERVICES_LIST;
                          const currentService = editFormData.service;
                          const availableServices = SERVICES_LIST[newSegment] || [];
                          const isValid = availableServices.includes(currentService);
                          setEditFormData({
                            ...editFormData, 
                            segment: newSegment,
                            service: isValid ? currentService : (availableServices[0] || '')
                          });
                        }} 
                        className="edit-input"
                      >
                        <option value="particulier">Particulier</option>
                        <option value="entreprise">Entreprise</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Type de service</label>
                      <select 
                        value={editFormData.service} 
                        onChange={e => setEditFormData({...editFormData, service: e.target.value})} 
                        className="edit-input"
                      >
                        {(SERVICES_LIST[editFormData.segment as keyof typeof SERVICES_LIST] || []).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Mode de paiement</label>
                      <select value={editFormData.mode_paiement} onChange={e => setEditFormData({...editFormData, mode_paiement: e.target.value})} className="edit-input">
                        <option value="virement">Virement</option>
                        <option value="cheque">Par chèque</option>
                        <option value="agence">À l'agence</option>
                        <option value="sur_place">Sur place</option>
                      </select>
                    </div>
                  </div>

                  {/* Conditional Rendering for Custom Services */}
                  {(editFormData.service === 'Auxiliaire de vie' || editFormData.service === 'Placement & gestion') ? (
                    <div className="custom-service-box">
                      <h3 className="custom-service-title">Service sur mesure — {editFormData.service}</h3>
                      <p className="custom-service-text">
                        {editFormData.service === 'Placement & gestion' 
                          ? "Un chargé de clientèle prendra contact avec l'entreprise pour établir une offre personnalisée."
                          : "Un assistant social et garde-malade prendront contact avec le client pour valider les points essentiels."
                        }
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Standard Service Details */}
                      <div className="form-grid-2 gap-4 mb-4">
                        <div className="form-group">
                          <label>Type d'habitation</label>
                          <select 
                            value={editFormData.type_habitation} 
                            onChange={e => setEditFormData({...editFormData, type_habitation: e.target.value})} 
                            className="edit-input"
                          >
                            <option value="">Choisir...</option>
                            <option value="Studio">Studio</option>
                            <option value="Appartement">Appartement</option>
                            <option value="Duplex">Duplex</option>
                            <option value="Villa">Villa</option>
                            <option value="Maison">Maison</option>
                            <option value="Bureau">Bureau</option>
                            <option value="Magasin">Magasin</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Fréquence</label>
                          <select value={editFormData.frequency} onChange={e => setEditFormData({...editFormData, frequency: e.target.value})} className="edit-input">
                            <option value="oneshot">Une seule fois</option>
                            <option value="abonnement">Abonnement</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-grid-2 gap-4 mb-4">
                        <div className="form-group">
                          <label>Durée (heures)</label>
                          <input type="number" value={editFormData.nb_heures} onChange={e => setEditFormData({...editFormData, nb_heures: e.target.value})} className="edit-input" />
                        </div>
                        <div className="form-group">
                          <label>Nb intervenants</label>
                          <input 
                            type="number" 
                            value={editFormData.nb_intervenants} 
                            onChange={e => setEditFormData({...editFormData, nb_intervenants: parseInt(e.target.value) || 0})} 
                            className="edit-input" 
                          />
                        </div>
                      </div>

                      <div className="form-grid-2 gap-4 mb-4">
                        <div className="form-group">
                          <label>Date d'intervention</label>
                          <input type="date" value={editFormData.date_intervention} onChange={e => setEditFormData({...editFormData, date_intervention: e.target.value})} className="edit-input" />
                        </div>
                        <div className="form-group">
                          <label>Heure</label>
                          <input type="time" value={editFormData.heure_intervention} onChange={e => setEditFormData({...editFormData, heure_intervention: e.target.value})} className="edit-input" />
                        </div>
                      </div>

                      <div className="detail-section mt-6">
                        <h3 className="text-sm fw-bold text-muted mb-4 uppercase">Services optionnels</h3>
                        <div className="form-grid-2">
                           <div className="flex items-center gap-3">
                              <label className="switch">
                                <input type="checkbox" checked={editFormData.avec_produit} onChange={e => setEditFormData({...editFormData, avec_produit: e.target.checked})} />
                                <span className="slider round"></span>
                              </label>
                              <span className="text-sm">Produit ménager (+ 90 MAD)</span>
                           </div>
                           <div className="flex items-center gap-3">
                              <label className="switch">
                                <input type="checkbox" checked={editFormData.avec_torchons} onChange={e => setEditFormData({...editFormData, avec_torchons: e.target.checked})} />
                                <span className="slider round"></span>
                              </label>
                              <span className="text-sm">Torchons et serpillières (+ 40 MAD)</span>
                           </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="detail-section mt-6 border-t pt-6">
                    <h3 className="text-sm fw-bold text-muted mb-4 uppercase">Informations client</h3>
                    <div className="form-grid-2 gap-4">
                      <div className="form-group">
                        <label>Nom</label>
                        <input type="text" value={editFormData.client_name} onChange={e => setEditFormData({...editFormData, client_name: e.target.value})} className="edit-input" />
                      </div>
                      <div className="form-group">
                        <label>Tél. direct</label>
                        <input type="text" value={editFormData.client_phone} onChange={e => setEditFormData({...editFormData, client_phone: e.target.value})} className="edit-input" />
                      </div>
                      <div className="form-group">
                        <label>Tél. WhatsApp</label>
                        <input type="text" value={editFormData.client_whatsapp || editFormData.client_phone} onChange={e => setEditFormData({...editFormData, client_whatsapp: e.target.value})} className="edit-input" />
                      </div>
                      <div className="form-group">
                        <label>Ville</label>
                        <input type="text" value={editFormData.neighborhood} onChange={e => setEditFormData({...editFormData, neighborhood: e.target.value})} className="edit-input" />
                      </div>
                    </div>
                  </div>

                  <div className="detail-section mt-6 border-t pt-6">
                    <h3 className="text-sm fw-bold text-muted mb-4 uppercase">Tarification</h3>
                    <div className="form-grid-2 gap-4">
                      <div className="form-group">
                        <label>Montant total (MAD)</label>
                        <input type="number" value={editFormData.prix} onChange={e => setEditFormData({...editFormData, prix: e.target.value})} className="edit-input" />
                        <span className="text-xs text-muted">Candidat : {editFormData.prix * 0.5} MAD</span>
                      </div>
                      <div className="form-group">
                        <label>Statut de paiement</label>
                        <select value={editFormData.statut_paiement} onChange={e => setEditFormData({...editFormData, statut_paiement: e.target.value})} className="edit-input">
                          <option value="non_paye">Non payé</option>
                          <option value="acompte">Acompte versé</option>
                          <option value="partiel">Paiement partiel</option>
                          <option value="integral">Paiement intégral</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section mt-6 border-t pt-6">
                    <h3 className="text-sm fw-bold text-muted mb-4 uppercase">Notes client</h3>
                    <div className="form-group">
                      <textarea value={editFormData.note_commerciale} onChange={e => setEditFormData({...editFormData, note_commerciale: e.target.value})} className="edit-textarea" rows={4} />
                    </div>
                  </div>

                  <div className="edit-footer-extra">
                    <div className="whatsapp-toggle-card">
                      <div className="flex items-center gap-4">
                        <label className="switch">
                          <input type="checkbox" checked={editFormData.envoyer_whatsapp} onChange={e => setEditFormData({...editFormData, envoyer_whatsapp: e.target.checked, regenerer_devis: e.target.checked})} />
                          <span className="slider round"></span>
                        </label>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 text-teal-dark fw-bold">
                            <MessageSquare size={18} />
                            Régénérer le devis et renvoyer au client via WhatsApp
                          </div>
                          <p className="text-xs text-muted">Le devis sera régénéré et envoyé automatiquement au numéro WhatsApp du client.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="detail-section">
                    <h3>Informations Client</h3>
                    <div className="detail-grid">
                      <div className="detail-item"><span>Nom:</span> {selectedDemande.client_name || selectedDemande.formulaire_data?.nom || '—'}</div>
                      <div className="detail-item"><span>Téléphone:</span> {selectedDemande.client_phone || selectedDemande.formulaire_data?.whatsapp_phone || '—'}</div>
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
                      <div className="detail-item"><span>Mode:</span> {selectedDemande.mode_paiement_label || selectedDemande.mode_paiement}</div>
                      <div className="detail-item"><span>Statut:</span> {selectedDemande.statut_paiement_label || selectedDemande.statut_paiement}</div>
                      <div className="detail-item"><span>CAO:</span> {selectedDemande.cao ? 'Confirmé' : 'Non confirmé'}</div>
                    </div>
                  </div>

                  {(selectedDemande.note_commerciale || selectedDemande.note_operationnelle) && (
                    <div className="detail-section">
                      <h3>Notes</h3>
                      {selectedDemande.note_commerciale && (
                        <div className="mb-2">
                          <p className="fw-bold text-xs text-muted mb-1">Note commerciale:</p>
                          <p className="note-text">{selectedDemande.note_commerciale}</p>
                        </div>
                      )}
                      {selectedDemande.note_operationnelle && (
                        <div>
                          <p className="fw-bold text-xs text-muted mb-1">Note opérationnelle:</p>
                          <p className="note-text">{selectedDemande.note_operationnelle}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="sheet-footer flex justify-between bg-gray-50 border-t p-6">
              <div className="flex gap-2">
                {isEditing ? (
                  <button className="btn btn-secondary flex items-center gap-2 border bg-white" onClick={() => addToast('Fonctionnalité de génération de devis à venir', 'info')}>
                    <FileText size={18} /> Générer devis
                  </button>
                ) : (
                  <button className="btn btn-secondary" onClick={() => setShowDetail(false)}>Fermer</button>
                )}
              </div>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button className="btn btn-outline bg-white px-6" onClick={() => setIsEditing(false)}>✕ Annuler</button>
                    <button className="btn btn-primary flex items-center gap-2 px-8" onClick={handleUpdate} style={{backgroundColor: '#175e5c'}}>
                      <Save size={18} /> Enregistrer
                    </button>
                  </>
                ) : (
                  <button className="btn btn-primary" onClick={() => setIsEditing(true)}>Modifier</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
