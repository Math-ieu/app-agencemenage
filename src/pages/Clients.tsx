import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { encodeId } from '../utils/obfuscation';
import { getClients, getUsers, updateClient, deleteClient, affecterClient, getClientAssignments } from '../api/client';
import { renderStatusBadge } from '../utils/statusUtils';
import { useAuthStore } from '../store/auth';
import { checkPermission, hasPermission, hasPermissionWithContext } from '../utils/permissions';
import { useToastStore } from '../store/toast';
import { User } from '../types';
import {
  Search, Settings, MoreVertical,
  RotateCw, Calendar, ChevronDown,
  User as UserIcon, MessageSquare, UserPlus, Slash, Trash2, XCircle, Save, History, Clock
} from 'lucide-react';

interface LatestDemande {
  id: number;
  statut: string;
  statut_paiement: string;
  statut_paiement_ui?: string;
  facturation_annulee?: boolean;
  commercial: string | null;
  cao?: boolean | 'reporte';
  created_at: string;
  frequency?: string;
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
  is_blacklisted?: boolean;
  assigned_commercial?: number | null;
  assigned_commercial_name?: string | null;
}

const PAYMENT_STATUS_OPTIONS = [
  { value: 'non_confirme', apiValue: 'non_paye', label: 'Non confirmé' },
  { value: 'paiement_en_attente', apiValue: 'acompte', label: 'Paiement en attente' },
  { value: 'agence_payee_client', apiValue: 'partiel', label: 'Agence payée / Client' },
  { value: 'profil_paye_client', apiValue: 'partiel', label: 'Profil payé / Client' },
  { value: 'commercial_paye_client', apiValue: 'partiel', label: 'Commercial payé / client' },
  { value: 'paiement_partiel', apiValue: 'partiel', label: 'Paiement partiel' },
  { value: 'paye', apiValue: 'integral', label: 'Payé' },
  { value: 'facturation_annulee', apiValue: 'facturation_annulee', label: 'Facturation annulée' },
  { value: 'intervention_gratuite', apiValue: 'intervention_gratuite', label: 'Intervention gratuite' },
  { value: 'intervention_annulee', apiValue: 'intervention_annulee', label: 'Intervention annulée' },
  { value: 'reporte', apiValue: 'reporte', label: 'Reportée' },
];

const TABS = [
  { id: 'tout', label: 'Tout' },
  { id: 'en_attente', label: 'En attente' },
  { id: 'nouveau_besoin', label: 'Nouveau besoin' },
  { id: 'confirme', label: 'Confirmé' },
  { id: 'pres_en_cours', label: 'Pres. en cours' },
  { id: 'pres_terminee', label: 'Pres. terminée' },
  { id: 'annule', label: 'Annulé' },
  { id: 'paye', label: 'Payé' },
  { id: 'facturation_encours', label: 'Facturation en cours' },
  { id: 'facturation_partielle', label: 'Facturation partielle' },
  { id: 'facturation_annulee', label: 'Annulé' }
];

const SERVICES_LIST = {
  particulier: [
    "Ménage standard",
    "Grand ménage",
    "Ménage Air BnB",
    "Ménage fin de chantier",
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

// ── Inline styles for the single-line filter bar ─────────────────────────────
const filterBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  flexWrap: 'nowrap',
  overflowX: 'auto',
  padding: '12px 0',
};

const selectWrapStyle: React.CSSProperties = {
  position: 'relative',
  flexShrink: 0,
};

const selectStyle: React.CSSProperties = {
  appearance: 'none',
  height: '38px',
  paddingLeft: '12px',
  paddingRight: '30px',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#374151',
  background: 'white',
  cursor: 'pointer',
  outline: 'none',
  whiteSpace: 'nowrap',
};

const chevronStyle: React.CSSProperties = {
  position: 'absolute',
  right: '8px',
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

const dividerStyle: React.CSSProperties = {
  width: '1px',
  height: '24px',
  background: '#e2e8f0',
  flexShrink: 0,
};

// ─────────────────────────────────────────────────────────────────────────────

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

  const [commercialFilter, setCommercialFilter] = useState('Tout');
  const [segmentFilter, setSegmentFilter] = useState('Tout');
  const [serviceFilter, setServiceFilter] = useState('Tout');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  const hasActiveFilters = serviceFilter !== 'Tout' || segmentFilter !== 'Tout' || commercialFilter !== 'Tout' || dateDebut || dateFin;

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

  useEffect(() => { fetchData(); }, [search, activeTab, commercialFilter, segmentFilter, serviceFilter, dateDebut, dateFin]);

  useEffect(() => {
    if (checkPermission(user, 'affecter_commercial').allowed || checkPermission(user, 'affectation_client').allowed) {
      getUsers({ role: 'commercial' }).then(res => setCommerciaux(res.data?.results || res.data)).catch(console.error);
    }
  }, [user]);

  const [assignmentHistory, setAssignmentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedCommercialId, setSelectedCommercialId] = useState<number | null>(null);
  const [assignedByName, setAssignedByName] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);

  useEffect(() => {
    if (showAssignmentModal) {
      setLoadingHistory(true);
      getClientAssignments(showAssignmentModal)
        .then(res => {
          setAssignmentHistory(res.data || []);
        })
        .catch(err => {
          console.error('Error fetching assignment history:', err);
          addToast("Impossible de charger l'historique des affectations", 'error');
        })
        .finally(() => {
          setLoadingHistory(false);
        });

      const clientObj = clients.find(c => c.id === showAssignmentModal);
      setSelectedCommercialId(clientObj?.assigned_commercial || null);
      setAssignedByName(user?.full_name || '');
      setAssignmentNotes('');
    } else {
      setAssignmentHistory([]);
      setSelectedCommercialId(null);
      setAssignedByName('');
      setAssignmentNotes('');
    }
  }, [showAssignmentModal, clients, user]);

  const handleAffecterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAssignmentModal) return;

    const isAllowed = checkPermission(user, 'affecter_commercial').allowed || checkPermission(user, 'affectation_client').allowed;
    if (!isAllowed) {
      addToast('Action non autorisée', 'error');
      return;
    }

    setIsSubmittingAssignment(true);
    try {
      await affecterClient(showAssignmentModal, selectedCommercialId, assignedByName, assignmentNotes);
      addToast('Affectation enregistrée avec succès', 'success');
      fetchData();
      setShowAssignmentModal(null);
    } catch (err) {
      console.error('Error in assignment:', err);
      addToast("Erreur lors de l'enregistrement de l'affectation", 'error');
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  const handleSaveAvis = async () => {
    if (!showAvisModal) return;
    try {
      const clientObj = clients.find(c => c.id === showAvisModal.clientId);
      const existingNotes = showAvisModal.type === 'commercial'
        ? (clientObj?.avis_commercial || '')
        : (clientObj?.avis_operationnel || '');
      
      const newNote = showAvisModal.avis.trim();
      if (!newNote) {
        addToast('Veuillez saisir une note', 'info');
        return;
      }
      
      const formattedDate = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      const noteWithHeader = `[${formattedDate}] : ${newNote}`;
      const updatedNotes = existingNotes 
        ? `${existingNotes}\n\n${noteWithHeader}` 
        : noteWithHeader;

      const payload = showAvisModal.type === 'commercial'
        ? { avis_commercial: updatedNotes }
        : { avis_operationnel: updatedNotes };
        
      await updateClient(showAvisModal.clientId, payload);
      addToast('Note enregistrée avec succès', 'success');
      fetchData();
      setShowAvisModal(null);
    } catch (err) {
      console.error('Error updating note:', err);
      addToast('Erreur lors de la sauvegarde', 'error');
    }
  };

  const handleDeleteClient = async (client: Client) => {
    const perm = checkPermission(user, 'delete_client');
    if (!perm.allowed) {
      addToast(perm.message || 'Action non autorisée', 'error');
      return;
    }
    const label = client.display_name || `${client.first_name} ${client.last_name}`.trim() || `#${client.id}`;
    if (!window.confirm(`Supprimer le client ${label} ?`)) return;

    try {
      await deleteClient(client.id);
      addToast('Client archivé avec succès', 'success');
      fetchData();
      setActiveDropdown(null);
    } catch (err) {
      console.error('Error deleting client:', err);
      addToast('Erreur lors de l\'archivage du client', 'error');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      // Ne ferme pas si on clique à l'intérieur du container du menu (le bouton ou le menu lui-même)
      if (target.closest && target.closest('.dropdown-container')) {
        return;
      }
      setActiveDropdown(null);
    };
    
    if (activeDropdown !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdown]);

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
    return renderStatusBadge(latest.statut, latest.cao);
  };

  const getPaymentStatusBadge = (client: Client) => {
    const latest = client.latest_demande;
    if (!latest) return <span className="badge badge-red">Non payé</span>;

    const statutPaiement = latest.statut_paiement || 'non_paye';
    const facturationAnnulee = Boolean(latest.facturation_annulee);
    
    let statutUi = latest.statut_paiement_ui;
    if (facturationAnnulee) {
      statutUi = 'facturation_annulee';
    } else if (latest.statut === 'annule') {
      statutUi = 'intervention_annulee';
    } else if (latest.cao === 'reporte') {
      statutUi = 'reporte';
    } else if (!statutUi) {
      if (statutPaiement === 'integral') statutUi = 'paye';
      else if (statutPaiement === 'acompte') statutUi = 'paiement_en_attente';
      else if (statutPaiement === 'partiel') statutUi = 'paiement_partiel';
      else statutUi = 'non_confirme';
    }

    const option = PAYMENT_STATUS_OPTIONS.find(o => o.value === statutUi);
    const label = option ? option.label : 'Non payé';

    let badgeClass = 'badge-red';
    if (statutUi === 'paye' || statutUi === 'integral' || statutUi === 'intervention_gratuite') badgeClass = 'badge-green';
    else if (['agence_payee_client', 'profil_paye_client', 'paiement_partiel', 'paiement_en_attente', 'reporte'].includes(statutUi)) badgeClass = 'badge-orange';
    else if (statutUi === 'facturation_annulee' || statutUi === 'intervention_annulee') badgeClass = 'badge-red';

    return <span className={`badge ${badgeClass}`}>{label}</span>;
  };

  const getRowClass = (client: Client) => {
    const latest = client.latest_demande;
    if (!latest) return '';
    
    if (latest.statut === 'annule') return 'row-status-annulee';
    if (latest.statut === 'termine') return 'row-status-termine';
    if (latest.statut === 'pres_terminee') return 'row-status-pres-terminee';
    if (latest.statut === 'pres_en_cours') return 'row-status-pres-en-cours';
    if (latest.statut === 'en_attente') return 'row-status-attente';
    if (latest.statut === 'en_cours') {
      return latest.cao ? 'row-status-termine' : 'row-status-nouveau';
    }
    return '';
  };

  const resetFilters = () => {
    setCommercialFilter('Tout');
    setSegmentFilter('Tout');
    setServiceFilter('Tout');
    setDateDebut('');
    setDateFin('');
  };

  return (
    <div className="page" style={{ backgroundColor: 'white' }}>
      {/* Page header */}
      <div className="page-header flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Listing Clients</h1>
        <button className="btn btn-secondary" onClick={fetchData}>
          <RotateCw size={18} />
          Actualiser
        </button>
      </div>

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
            placeholder="Rechercher par nom, numéro, ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInputStyle}
          />
        </div>

        <div style={dividerStyle} />

        {/* Commercial */}
        <div style={selectWrapStyle}>
          <select
            value={commercialFilter}
            onChange={e => setCommercialFilter(e.target.value)}
            style={{ ...selectStyle, minWidth: '170px' }}
          >
            <option value="Tout">Tous les commerciaux</option>
            {commerciaux.map(comm => (
              <option key={comm.id} value={comm.id.toString()}>
                {comm.full_name || `${comm.first_name} ${comm.last_name}`}
              </option>
            ))}
          </select>
          <ChevronDown size={14} style={chevronStyle} />
        </div>

        {/* Segment */}
        <div style={selectWrapStyle}>
          <select
            value={segmentFilter}
            onChange={e => setSegmentFilter(e.target.value)}
            style={{ ...selectStyle, minWidth: '130px' }}
          >
            <option>Tout</option>
            <option>Particulier</option>
            <option>Entreprise</option>
          </select>
          <ChevronDown size={14} style={chevronStyle} />
        </div>

        {/* Prestation */}
        <div style={selectWrapStyle}>
          <select
            value={serviceFilter}
            onChange={e => setServiceFilter(e.target.value)}
            style={{ ...selectStyle, minWidth: '180px' }}
          >
            <option value="Tout">Toutes les prestations</option>
            <optgroup label="Particuliers">
              {SERVICES_LIST.particulier.map(s => <option key={s} value={s}>{s}</option>)}
            </optgroup>
            <optgroup label="Entreprises">
              {SERVICES_LIST.entreprise.map(s => <option key={s} value={s}>{s}</option>)}
            </optgroup>
          </select>
          <ChevronDown size={14} style={chevronStyle} />
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
        <div className={`table-wrapper ${clients.length >= 8 ? 'enable-table-scroll' : 'disable-table-scroll'}`}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Actions</th>
                <th>Statut besoin</th>
                <th>Statut paiem.</th>
                <th>Segment</th>
                <th>Fréquence</th>
                <th>Commercial</th>
                <th>Nom client</th>
                <th>Quartier / Ville</th>
                <th>Fidélité</th>
                <th style={{ width: '92px' }}></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, index) => (
                <tr
                  key={c.id}
                  className={getRowClass(c)}
                  style={{
                    opacity: c.is_blacklisted ? 0.5 : 1,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  <td>
                    {c.is_blacklisted ? (
                      <Link
                        to={`/clients/${encodeId(c.id)}`}
                        className="actions-cell-btn py-1.5 px-3 flex items-center justify-center text-xs font-semibold rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                        style={{ width: 'fit-content' }}
                      >
                        <UserIcon size={14} className="mr-1.5" style={{ minWidth: '14px' }} />
                        <span>Compte client</span>
                      </Link>
                    ) : (
                      <div className="dropdown-container">
                        <button className="actions-cell-btn" onClick={() => toggleDropdown('actions', c.id)}>
                          <Settings size={14} />
                          Actions
                        </button>
                        {activeDropdown?.type === 'actions' && activeDropdown.id === c.id && (
                          <div className="dropdown-menu" ref={dropdownRef} style={{ left: 0, right: 'auto', ...(clients.length >= 8 && index >= clients.length - 2 ? { top: 'auto', bottom: '100%' } : { top: '100%', bottom: 'auto' }) }}>
                            <Link to={`/clients/${encodeId(c.id)}`} className="dropdown-item">
                              <UserIcon size={16} className="dropdown-item-icon" />
                              <span>Compte client</span>
                            </Link>

                            {hasPermissionWithContext(user, 'modifier_clients', c) && (
                              <>
                                <div className="dropdown-divider"></div>
                                <div className="dropdown-item" onClick={() => {
                                  setShowAvisModal({ clientId: c.id, type: 'commercial', avis: '' });
                                  setActiveDropdown(null);
                                }}>
                                  <MessageSquare size={16} className="dropdown-item-icon" />
                                  <span>Note commerciale</span>
                                </div>
                                <div className="dropdown-item" onClick={() => {
                                  setShowAvisModal({ clientId: c.id, type: 'operationnel', avis: '' });
                                  setActiveDropdown(null);
                                }}>
                                  <MessageSquare size={16} className="dropdown-item-icon" />
                                  <span>Note opérationnelle</span>
                                </div>
                                <div className="dropdown-divider"></div>
                              </>
                            )}
                            {(hasPermission(user, 'affectation_client') || hasPermission(user, 'affecter_commercial')) && (
                              <div className="dropdown-item" onClick={(e) => {
                                e.stopPropagation();
                                setShowAssignmentModal(c.id);
                                  setActiveDropdown(null);
                              }}>
                                <UserPlus size={16} className="dropdown-item-icon" />
                                <span>Affectation</span>
                              </div>
                            )}
                            {hasPermission(user, 'geste_commercial') && (
                              <Link to="/marketing" state={{ tab: 'gestes' }} className="dropdown-item">
                                <Slash size={16} className="dropdown-item-icon" />
                                <span>Geste commercial</span>
                              </Link>
                            )}
                            {hasPermission(user, 'delete_client') && (
                              <>
                                <div className="dropdown-divider"></div>
                                <div className="dropdown-item dropdown-item-danger" onClick={() => handleDeleteClient(c)}>
                                  <Trash2 size={16} className="dropdown-item-icon" />
                                  <span>Supprimer</span>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td>{getStatusBadge(c)}</td>
                  <td>{getPaymentStatusBadge(c)}</td>
                  <td>
                    <span className={`badge ${c.segment === 'particulier' ? 'badge-dark-teal' : 'badge-lime'}`}>
                      {c.segment === 'particulier' ? 'Particulier' : 'Entreprise'}
                    </span>
                  </td>
                  <td>
                    {c.latest_demande ? (
                      c.latest_demande.frequency === 'abonnement' ? (
                        <span className="badge badge-purple">Abonnement</span>
                      ) : (
                        <span className="badge badge-gray">Une fois</span>
                      )
                    ) : (
                      <span className="badge badge-gray">Une fois</span>
                    )}
                  </td>
                  <td className="text-slate-500 font-medium">
                    {c.assigned_commercial_name || '—'}
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
                    {!c.is_blacklisted && (
                      <div className="table-inline-actions table-inline-actions-right">
                        <div className="dropdown-container">
                          <button className="btn-more" onClick={() => toggleDropdown('more', c.id)}>
                            <MoreVertical size={18} />
                          </button>
                          {activeDropdown?.type === 'more' && activeDropdown.id === c.id && (
                            <div className="dropdown-menu" ref={dropdownRef} style={{ minWidth: '160px', ...(clients.length >= 8 && index >= clients.length - 2 ? { top: 'auto', bottom: '100%' } : { top: '100%', bottom: 'auto' }) }}>
                              <Link to={`/clients/${encodeId(c.id)}`} className="dropdown-item">
                                <UserIcon size={16} className="dropdown-item-icon" />
                                <span>Voir le compte</span>
                              </Link>
                              {(hasPermission(user, 'affectation_client') || hasPermission(user, 'affecter_commercial')) && (
                                <div className="dropdown-item" onClick={(e) => {
                                  e.stopPropagation();
                                  setShowAssignmentModal(c.id);
                                  setActiveDropdown(null);
                                }}>
                                  <UserPlus size={16} className="dropdown-item-icon" />
                                  <span>Affectation</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {hasPermission(user, 'delete_client') && (
                          <button
                            type="button"
                            className="table-delete-icon-btn"
                            title="Supprimer le client"
                            aria-label="Supprimer le client"
                            onClick={() => handleDeleteClient(c)}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={10} className="empty-row text-center py-12 text-slate-400">Aucun client trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Avis */}
      {showAvisModal && (
        <div className="modal-overlay z-[110]" onClick={() => setShowAvisModal(null)}>
          <div
            className="modal-content max-w-[500px]"
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: 0, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', border: 'none' }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d9488' }}>
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                    {showAvisModal.type === 'commercial' ? 'Note Commerciale' : 'Note Opérationnelle'}
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Saisie des notes pour ce client</p>
                </div>
              </div>
              <button
                onClick={() => setShowAvisModal(null)}
                style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}
              >
                <XCircle size={16} />
              </button>
            </div>
            <div style={{ padding: '24px' }}>
              {/* Note History */}
              {(() => {
                const clientObj = clients.find(x => x.id === showAvisModal.clientId);
                const currentNotes = showAvisModal.type === 'commercial' 
                  ? clientObj?.avis_commercial 
                  : clientObj?.avis_operationnel;
                if (!currentNotes) return null;
                return (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Historique des notes</label>
                    <div style={{ maxHeight: '120px', overflowY: 'auto', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#475569', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                      {currentNotes}
                    </div>
                  </div>
                );
              })()}

              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Nouvelle note</label>
              <textarea
                style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px', fontSize: '14px', color: '#0f172a', minHeight: '100px', resize: 'vertical', outline: 'none', backgroundColor: '#ffffff', boxSizing: 'border-box' }}
                placeholder={`Veuillez rédiger la note ${showAvisModal.type === 'commercial' ? 'commerciale' : 'opérationnelle'}...`}
                value={showAvisModal.avis}
                onChange={(e) => setShowAvisModal({ ...showAvisModal, avis: e.target.value })}
                onKeyDown={(e) => e.stopPropagation()}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#0d9488'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.15)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowAvisModal(null)}
                style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: '#475569', backgroundColor: 'white', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; }}
              >
                Annuler
              </button>
              <button
                onClick={handleSaveAvis}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'white', backgroundColor: '#0f766e', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#0d9488'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#0f766e'; }}
              >
                <Save size={18} /> Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Affectation */}
      {showAssignmentModal && (() => {
        const clientObj = clients.find(c => c.id === showAssignmentModal);
        const clientName = clientObj ? clientObj.display_name : '';
        const currentAssignment = assignmentHistory.find(h => h.commercial === clientObj?.assigned_commercial);
        const currentCreatedBy = currentAssignment ? currentAssignment.assigned_by_name_display : '—';
        const currentAssignDate = currentAssignment 
          ? new Date(currentAssignment.created_at).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })
          : '—';

        return (
          <div className="modal-overlay z-[110]" onClick={() => setShowAssignmentModal(null)}>
            <div
              className="modal-content max-w-[600px] w-full animate-in fade-in zoom-in-95 duration-200"
              onClick={e => e.stopPropagation()}
              style={{ backgroundColor: '#ffffff', borderRadius: '16px', padding: 0, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', border: 'none' }}
            >
              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d9488' }}>
                    <UserIcon size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                      Commercial affecté — {clientName}
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                      Gérez l'affectation commerciale du client et consultez l'historique chronologique des changements.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAssignmentModal(null)}
                  style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'white'; }}
                >
                  <XCircle size={16} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '24px' }}>
                {/* Current Assignment Summary Card */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', padding: '16px', marginBottom: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Commercial actuel</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>
                      {clientObj?.assigned_commercial_name || 'Non affecté'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Créé par</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>{currentCreatedBy}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Date d'affectation</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>{currentAssignDate}</div>
                  </div>
                </div>

                {/* Form Modifier l'affectation */}
                <form onSubmit={handleAffecterSubmit}>
                  <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f766e', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '16px' }}>
                    Modifier l'affectation
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Sélectionner un commercial</label>
                      <select
                        value={selectedCommercialId || ''}
                        onChange={(e) => setSelectedCommercialId(e.target.value ? parseInt(e.target.value, 10) : null)}
                        style={{ width: '100%', height: '42px', padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', color: '#334155', backgroundColor: 'white', outline: 'none', cursor: 'pointer' }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#0d9488'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.15)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        <option value="">Choisir...</option>
                        {commerciaux.map(comm => (
                          <option key={comm.id} value={comm.id}>
                            {comm.full_name || `${comm.first_name} ${comm.last_name}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Effectué par (optionnel)</label>
                      <input
                        type="text"
                        placeholder="Votre nom"
                        value={assignedByName}
                        onChange={(e) => setAssignedByName(e.target.value)}
                        style={{ width: '100%', height: '42px', padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', color: '#334155', backgroundColor: 'white', outline: 'none', boxSizing: 'border-box' }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#0d9488'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.15)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = 'none'; }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Note / Motif (optionnel)</label>
                    <input
                      type="text"
                      placeholder="Motif de la réaffectation, contexte..."
                      value={assignmentNotes}
                      onChange={(e) => setAssignmentNotes(e.target.value)}
                      style={{ width: '100%', height: '42px', padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', color: '#334155', backgroundColor: 'white', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={e => { e.currentTarget.style.borderColor = '#0d9488'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.15)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '16px', marginBottom: '16px' }}>
                    <button
                      type="submit"
                      disabled={isSubmittingAssignment}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'white',
                        backgroundColor: '#0f766e',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={e => { if (!isSubmittingAssignment) e.currentTarget.style.backgroundColor = '#0d9488'; }}
                      onMouseLeave={e => { if (!isSubmittingAssignment) e.currentTarget.style.backgroundColor = '#0f766e'; }}
                    >
                      <Save size={16} />
                      <span>Enregistrer l'affectation</span>
                    </button>
                  </div>
                </form>

                {/* History Section */}
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#0f766e', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '12px', marginTop: '24px' }}>
                    <History size={16} />
                    <span>Historique des affectations</span>
                  </h3>

                  {loadingHistory ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                      <div className="spinner" />
                    </div>
                  ) : assignmentHistory.length === 0 ? (
                    <div style={{ border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#94a3b8', backgroundColor: '#fafafa', fontSize: '13px' }}>
                      Aucun changement enregistré.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
                      {assignmentHistory.map((h, i) => (
                        <div key={h.id || i} style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: '10px', border: '1px solid #f1f5f9', backgroundColor: '#f8fafc', fontSize: '12px', textAlign: 'left' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#e2e8f0', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Clock size={14} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 700, color: '#334155' }}>
                                {h.commercial_name ? `Affecté à : ${h.commercial_name}` : 'Désaffecté'}
                              </span>
                              <span style={{ color: '#94a3b8' }}>
                                {new Date(h.created_at).toLocaleString('fr-FR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <div style={{ color: '#64748b', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span>Effectué par : <strong style={{ color: '#475569' }}>{h.assigned_by_name_display}</strong></span>
                              {h.notes && (
                                <p style={{ margin: '4px 0 0 0', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#475569', fontStyle: 'italic' }}>
                                  Note : {h.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}