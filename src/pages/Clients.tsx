import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { encodeId } from '../utils/obfuscation';
import { getClients, getUsers, affecterDemande, updateClient } from '../api/client';
import { useAuthStore } from '../store/auth';
import { useToastStore } from '../store/toast';
import { User } from '../types';
import {
  Search, Settings, MoreVertical,
  RotateCw, Calendar, ChevronDown,
  User as UserIcon, Pencil, MessageSquare, UserPlus, Slash, Trash2, XCircle, Save
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
  address: string;
  created_at: string;
  demandes_count: number;
  latest_demande: LatestDemande | null;
  avis_commercial?: string;
  avis_operationnel?: string;
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

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('tout');
  const [activeDropdown, setActiveDropdown] = useState<{ type: 'actions' | 'more', id: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [commerciaux, setCommerciaux] = useState<User[]>([]);
  const [showAssignmentModal, setShowAssignmentModal] = useState<number | null>(null);
  const [showAvisModal, setShowAvisModal] = useState<{ clientId: number; type: 'commercial' | 'operationnel'; avis: string } | null>(null);

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
  }, [search, activeTab, commercialFilter, segmentFilter, serviceFilter, dateDebut, dateFin]);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'responsable_commercial') {
      getUsers({ role: 'commercial' }).then(res => setCommerciaux(res.data?.results || res.data)).catch(console.error);
    }
  }, [user]);

  const handleAffecter = async (demandeId: number, commercialId: number) => {
    try {
      await affecterDemande(demandeId, commercialId);
      addToast('Client affecté avec succès', 'success');
      fetchData();
      setShowAssignmentModal(null);
      setActiveDropdown(null);
    } catch (err) {
      console.error('Error affecting client:', err);
      addToast('Erreur lors de l\'affectation', 'error');
    }
  };

  const handleSaveAvis = async () => {
    if (!showAvisModal) return;
    try {
      const payload = showAvisModal.type === 'commercial' 
        ? { avis_commercial: showAvisModal.avis }
        : { avis_operationnel: showAvisModal.avis };
      
      await updateClient(showAvisModal.clientId, payload);
      addToast('Avis mis à jour avec succès', 'success');
      fetchData();
      setShowAvisModal(null);
    } catch (err) {
      console.error('Error updating avis:', err);
      addToast('Erreur lors de la mise à jour', 'error');
    }
  };

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
              <option value="Tout">Tous les commerciaux</option>
              {commerciaux.map(comm => (
                <option key={comm.id} value={comm.id.toString()}>
                  {comm.full_name || `${comm.first_name} ${comm.last_name}`}
                </option>
              ))}
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
              <option value="Tout">Toutes les prestations</option>
              <optgroup label="Particuliers">
                {SERVICES_LIST.particulier.map(s => <option key={s} value={s}>{s}</option>)}
              </optgroup>
              <optgroup label="Entreprises">
                {SERVICES_LIST.entreprise.map(s => <option key={s} value={s}>{s}</option>)}
              </optgroup>
            </select>
            <ChevronDown size={16} className="dropdown-icon" />
          </div>

          <div className="pro-date-picker">
            <Calendar size={18} className="calendar-icon" />
            <input
              type="text"
              placeholder="Du"
              value={dateDebut}
              onChange={e => setDateDebut(e.target.value)}
              onFocus={(e) => e.target.type = 'date'}
              onBlur={(e) => e.target.type = 'text'}
              className="pro-date-input"
            />
          </div>
          <div className="pro-date-picker">
            <Calendar size={18} className="calendar-icon" />
            <input
              type="text"
              placeholder="Au"
              value={dateFin}
              onChange={e => setDateFin(e.target.value)}
              onFocus={(e) => e.target.type = 'date'}
              onBlur={(e) => e.target.type = 'text'}
              className="pro-date-input"
            />
          </div>

          {(serviceFilter !== 'Tout' || segmentFilter !== 'Tout' || commercialFilter !== 'Tout' || dateDebut || dateFin) && (
            <button
              onClick={() => {
                setCommercialFilter('Tout');
                setSegmentFilter('Tout');
                setServiceFilter('Tout');
                setDateDebut('');
                setDateFin('');
              }}
              style={{ padding: '0 12px', background: 'transparent', border: 'none', color: '#ef4444', fontSize: '13px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center' }}
            >
              Réinitialiser
            </button>
          )}
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
                          <Link to={`/clients/${encodeId(c.id)}`} className="dropdown-item">
                            <UserIcon size={16} className="dropdown-item-icon" />
                            <span>Compte client</span>
                          </Link>
                          <div className="dropdown-item">
                            <Pencil size={16} className="dropdown-item-icon" />
                            <span>Éditer le besoin</span>
                          </div>
                          <div className="dropdown-divider"></div>
                          <div className="dropdown-item" onClick={() => {
                            setShowAvisModal({ clientId: c.id, type: 'commercial', avis: c.avis_commercial || '' });
                            setActiveDropdown(null);
                          }}>
                            <MessageSquare size={16} className="dropdown-item-icon" />
                            <span>Avis commercial</span>
                          </div>
                          <div className="dropdown-item" onClick={() => {
                            setShowAvisModal({ clientId: c.id, type: 'operationnel', avis: c.avis_operationnel || '' });
                            setActiveDropdown(null);
                          }}>
                            <MessageSquare size={16} className="dropdown-item-icon" />
                            <span>Avis opérationnel</span>
                          </div>
                          <div className="dropdown-divider"></div>
                          {(user?.role === 'admin' || user?.role === 'responsable_commercial') && c.latest_demande && (
                            <div className="dropdown-item" onClick={(e) => {
                              e.stopPropagation();
                              setShowAssignmentModal(c.latest_demande!.id);
                              setActiveDropdown(null);
                            }}>
                              <UserPlus size={16} className="dropdown-item-icon" />
                              <span>Affectation</span>
                            </div>
                          )}
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
                          <Link to={`/clients/${encodeId(c.id)}`} className="dropdown-item">
                            <UserIcon size={16} className="dropdown-item-icon" />
                            <span>Voir le compte</span>
                          </Link>
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

      {/* Modal d'Avis */}
      {showAvisModal && (
        <div className="modal-overlay z-[110]" onClick={() => setShowAvisModal(null)}>
          <div className="modal-content max-w-[500px]" onClick={e => e.stopPropagation()} style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: 0, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', border: 'none' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#ccfbf1', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', color: '#0d9488' }}>
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                    {showAvisModal.type === 'commercial' ? 'Avis Commercial' : 'Avis Opérationnel'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Saisie des retours pour ce client</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAvisModal(null)}
                style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}
              >
                <XCircle size={16} />
              </button>
            </div>
            
            {/* Body */}
            <div style={{ padding: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Détails de l'avis</label>
              <textarea
                style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px', fontSize: '14px', color: '#0f172a', minHeight: '140px', resize: 'vertical', outline: 'none', backgroundColor: '#ffffff', boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)', transition: 'all 0.2s', boxSizing: 'border-box' }}
                placeholder={`Veuillez rédiger l'avis ${showAvisModal.type === 'commercial' ? 'commercial' : 'opérationnel'} complet...`}
                value={showAvisModal.avis}
                onChange={(e) => setShowAvisModal({ ...showAvisModal, avis: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#0d9488'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.15)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)'; }}
              />
            </div>
            
            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px', backgroundColor: '#ffffff' }}>
              <button 
                onClick={() => setShowAvisModal(null)}
                style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#475569', backgroundColor: 'white', border: '1px solid #cbd5e1', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = '#475569'; }}
              >
                Annuler
              </button>
              <button 
                onClick={handleSaveAvis}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white', backgroundColor: '#0f766e', border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(15, 118, 110, 0.2), 0 2px 4px -1px rgba(15, 118, 110, 0.1)', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0d9488'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#0f766e'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <Save size={18} /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Affectation */}
      {showAssignmentModal && (
        <div className="modal-overlay z-[110]" onClick={() => { setShowAssignmentModal(null); }}>
          <div className="modal-content max-w-[500px]" onClick={e => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Affectation</h2>
                <p className="text-slate-500 text-sm mt-1">Sélectionnez le commercial pour ce client</p>
              </div>
              <button className="p-2 hover:bg-slate-100 rounded-full transition-colors" onClick={() => { setShowAssignmentModal(null); }}>
                <XCircle size={24} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {commerciaux && commerciaux.length > 0 ? (
                commerciaux.map(comm => {
                  const initials = (comm.full_name || `${comm.first_name} ${comm.last_name}`).split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
                  return (
                    <button
                      key={comm.id}
                      onClick={() => handleAffecter(showAssignmentModal, comm.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-teal-200 hover:bg-teal-50 transition-all text-left group"
                    >
                      <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-lg group-hover:bg-teal-600 group-hover:text-white transition-colors">
                        {initials}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-slate-700 group-hover:text-teal-900">{comm.full_name || `${comm.first_name} ${comm.last_name}`}</div>
                        <div className="text-xs text-slate-400">Commercial Agence</div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-teal-600 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Choisir</div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <UserPlus size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">Aucun commercial trouvé</p>
                  <p className="text-slate-400 text-xs mt-1">Veuillez d'abord créer des commerciaux dans le système.</p>
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-end">
              <button 
                className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800 transition-colors"
                onClick={() => { setShowAssignmentModal(null); }}
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
