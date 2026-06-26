import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAgents, deleteAgent, getDemandes, getUsers, affecterAgent, getAgentAssignments } from '../api/client';
import { Search, Plus, RotateCw, Calendar, User, XCircle, Trash2, MoreVertical, UserPlus, History, Clock, Save } from 'lucide-react';
import { Agent } from '../types';
import { encodeId } from '../utils/obfuscation';
import AddProfileModal from './ProfilEditModal';
import { useToastStore } from '../store/toast';
import { PROFIL_FILTER_TABS } from '../lib/profil-form-constants';
import { useAuthStore } from '../store/auth';
import { checkPermission, hasPermission } from '../utils/permissions';



const TABS = PROFIL_FILTER_TABS.map(tab => ({ id: tab.value, label: tab.label }));

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
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboardDemandes, setDashboardDemandes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Nouvelles variables d'état pour l'assignation et la postulation
  const [usersList, setUsersList] = useState<any[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState<number | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [assignedByName, setAssignedByName] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);

  useEffect(() => {
    if (hasPermission(user, 'assigner_charge_profil')) {
      getUsers().then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data?.results || []);
        setUsersList(list);
      }).catch(console.error);
    }
  }, [user]);

  const getFilteredUsers = (currentAssignedId: any) => {
    const parsedCurrentId = currentAssignedId ? String(currentAssignedId) : null;
    return usersList.filter(u => 
      u.role === 'charge_operations' || 
      String(u.id) === parsedCurrentId
    );
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
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

  useEffect(() => {
    if (showAssignmentModal) {
      setLoadingHistory(true);
      getAgentAssignments(showAssignmentModal)
        .then(res => {
          setAssignmentHistory(res.data || []);
        })
        .catch(err => {
          console.error('Error fetching agent assignment history:', err);
          addToast("Impossible de charger l'historique des affectations", 'error');
        })
        .finally(() => {
          setLoadingHistory(false);
        });

      const agentObj = agents.find(a => a.id === showAssignmentModal);
      setSelectedUserId(agentObj?.assigned_to || null);
      setAssignedByName(user?.full_name || '');
      setAssignmentNotes('');
    } else {
      setAssignmentHistory([]);
      setSelectedUserId(null);
      setAssignedByName('');
      setAssignmentNotes('');
    }
  }, [showAssignmentModal, agents, user, addToast]);

  const handleAffecterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAssignmentModal) return;

    if (!hasPermission(user, 'assigner_charge_profil')) {
      addToast('Action non autorisée', 'error');
      return;
    }

    setIsSubmittingAssignment(true);
    try {
      await affecterAgent(showAssignmentModal, selectedUserId, assignedByName, assignmentNotes);
      addToast('Affectation enregistrée avec succès', 'success');
      await fetchData();
      setShowAssignmentModal(null);
    } catch (err) {
      console.error('Error in agent assignment:', err);
      addToast("Erreur lors de l'enregistrement de l'affectation", 'error');
    } finally {
      setIsSubmittingAssignment(false);
    }
  };



  const hasActiveFilters = Boolean(dateDebut || dateFin);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (activeTab !== 'all') params.poste = activeTab;
      if (dateDebut) params.date_debut = dateDebut;
      if (dateFin) params.date_fin = dateFin;

      const [agentsRes, demandsRes] = await Promise.all([
        getAgents(params),
        getDemandes({ no_page: 'true' }).catch(() => ({ data: [] }))
      ]);

      const agentsList = agentsRes.data.results || agentsRes.data || [];
      const dashDemandes = Array.isArray(demandsRes?.data?.results) ? demandsRes.data.results : (Array.isArray(demandsRes?.data) ? demandsRes.data : []);

      setAgents(agentsList);
      setDashboardDemandes(dashDemandes);
    } catch (err) {
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPaymentUiValue = (statutPaiement: string, facturationAnnulee: boolean): string => {
    if (facturationAnnulee) return 'facturation_annulee';
    if (statutPaiement === 'integral') return 'paye';
    if (statutPaiement === 'acompte') return 'paiement_en_attente';
    if (statutPaiement === 'partiel') return 'paiement_partiel';
    return 'non_confirme';
  };

  const busyAgentIds = useMemo(() => {
    const activeIds = new Set<number>();
    for (const d of dashboardDemandes) {
      if (d.statut === 'en_attente' || d.statut === 'pres_terminee' || d.statut === 'termine') continue;

      const factDataDef = d.formulaire_data?.facturation || {};
      const statutUi = factDataDef.statut_paiement_ui || d.statut_paiement_ui || getPaymentUiValue(d.statut_paiement || 'non_paye', Boolean(factDataDef.facturation_annulee));

      // Une demande n'est pas active si elle est payée
      if (statutUi === 'paye') continue;

      // Si elle est annulée, elle reste sur le dashboard si les profils doivent être payés et ne le sont pas entièrement
      const isAnnule = d.statut === 'annule' || statutUi === 'facturation_annulee' || factDataDef.facturation_annulee;
      if (isAnnule) {
        const profilSeraPaye = d.profil_sera_paye !== undefined ? Boolean(d.profil_sera_paye) : Boolean(factDataDef.profil_sera_paye);
        if (profilSeraPaye) {
          let allProfilesPaid = false;
          const parts = d.parts_repartition || factDataDef.parts_repartition || d.formulaire_data?.parts_repartition || [];
          if (Array.isArray(parts) && parts.length > 0) {
            allProfilesPaid = parts.every((p: any) => p.part_profil_versee);
          } else {
            allProfilesPaid = Boolean(factDataDef.part_profil_versee);
          }
          if (allProfilesPaid) continue;
        } else {
          continue;
        }
      }

      // Collecter depuis profils_envoyes
      if (Array.isArray(d.profils_envoyes)) {
        for (const p of d.profils_envoyes) {
          if (p.id) activeIds.add(p.id);
        }
      }

      // Collecter aussi depuis parts_repartition (formulaire_data)
      const parts = d.parts_repartition || factDataDef.parts_repartition || d.formulaire_data?.parts_repartition || [];
      if (Array.isArray(parts)) {
        for (const part of parts) {
          const pid = Number(part.profile_id);
          if (pid) activeIds.add(pid);
        }
      }
    }
    return activeIds;
  }, [dashboardDemandes]);

  useEffect(() => { fetchData(); }, [search, activeTab, dateDebut, dateFin]);

  const handleDeleteAgent = async (agent: Agent) => {
    const perm = checkPermission(user, 'delete_profile');
    if (!perm.allowed) {
      addToast(perm.message || 'Action non autorisée', 'error');
      return;
    }
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
          {hasPermission(user, 'creer_agents') && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={18} />
              Ajouter Profil
            </button>
          )}
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
                <th>Chargé</th>
                <th>Disponibilité</th>
                <th>Langue</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr
                  key={agent.id}
                  style={{
                    opacity: agent.is_blacklisted ? 0.5 : 1,
                    transition: 'opacity 0.2s ease',
                  }}
                >
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
                    <span className="text-slate-600 text-sm font-medium">
                      {agent.assigned_to_name || 'Non assigné'}
                    </span>
                  </td>
                  <td>
                    {busyAgentIds.has(agent.id) ? (
                      <span className="badge badge-status-annule" style={{ backgroundColor: '#f59e0b', color: 'white' }}>
                        Occupé (Mission)
                      </span>
                    ) : (
                      <span className={`badge ${agent.statut === 'disponible' ? 'badge-lime' : 'badge-status-annule'}`}>
                        {agent.statut === 'disponible' ? 'Disponible' : 'Non disponible'}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-status-attente">
                      {agent.languages?.[0] || 'Français'}
                    </span>
                  </td>
                  <td>
                    <div className="dropdown-container">
                      <button className="btn-more" onClick={() => setActiveDropdown(activeDropdown === agent.id ? null : agent.id)}>
                        <MoreVertical size={18} />
                      </button>
                      {activeDropdown === agent.id && (
                        <div className="dropdown-menu" style={{ minWidth: '160px', right: 0, left: 'auto' }}>
                          <button
                            className="dropdown-item"
                            onClick={() => {
                              navigate(`/profils/${encodeId(agent.id)}`);
                              setActiveDropdown(null);
                            }}
                          >
                            <User size={16} className="dropdown-item-icon" />
                            <span>Compte Profil</span>
                          </button>

                          {hasPermission(user, 'assigner_charge_profil') && (
                            <button
                              className="dropdown-item"
                              onClick={() => {
                                setShowAssignmentModal(agent.id);
                                setActiveDropdown(null);
                              }}
                            >
                              <UserPlus size={16} className="dropdown-item-icon" />
                              <span>Affectation</span>
                            </button>
                          )}

                          {!agent.is_blacklisted && hasPermission(user, 'supprimer_profil') && (
                            <>
                              <div className="dropdown-divider"></div>
                              <button
                                className="dropdown-item dropdown-item-danger"
                                onClick={() => {
                                  handleDeleteAgent(agent);
                                  setActiveDropdown(null);
                                }}
                              >
                                <Trash2 size={16} className="dropdown-item-icon" />
                                <span>Supprimer</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr>
                  <td colSpan={13} className="empty-row text-center py-12 text-slate-400">Aucun profil trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Affectation */}
      {showAssignmentModal && (() => {
        const agentObj = agents.find(a => a.id === showAssignmentModal);
        const agentName = agentObj ? `${agentObj.first_name} ${agentObj.last_name}` : '';
        const currentAssignment = (agentObj && agentObj.assigned_to) 
          ? assignmentHistory.find(h => h.assigned_to === agentObj.assigned_to) 
          : null;
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
                    <User size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                      Chargé d'opérations affecté — {agentName}
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                      Gérez l'affectation du chargé d'opérations pour ce profil et consultez l'historique chronologique des changements.
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
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Chargé actuel</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>
                      {agentObj?.assigned_to_name || 'Non affecté'}
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
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Sélectionner un chargé</label>
                      <select
                        value={selectedUserId || ''}
                        onChange={(e) => setSelectedUserId(e.target.value ? parseInt(e.target.value, 10) : null)}
                        style={{ width: '100%', height: '42px', padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '14px', color: '#334155', backgroundColor: 'white', outline: 'none', cursor: 'pointer' }}
                        onFocus={e => { e.currentTarget.style.borderColor = '#0d9488'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.15)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        <option value="">Choisir...</option>
                        {getFilteredUsers(agentObj?.assigned_to).map(u => (
                          <option key={u.id} value={u.id}>
                            {u.full_name || `${u.first_name} ${u.last_name}`}
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
                                {h.assigned_to ? `Affecté à : ${h.assigned_to_name}` : 'Désaffecté'}
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


