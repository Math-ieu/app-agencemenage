import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAgents, deleteAgent, getDemandes, getUsers, updateAgent, sendProfilToDemande } from '../api/client';
import { Search, Plus, RotateCw, Calendar, User, XCircle, Trash2, Send } from 'lucide-react';
import { Agent } from '../types';
import { encodeId } from '../utils/obfuscation';
import AddProfileModal from './ProfilEditModal';
import { useToastStore } from '../store/toast';
import { PROFIL_FILTER_TABS } from '../lib/profil-form-constants';
import { useAuthStore } from '../store/auth';
import { checkPermission, hasPermission } from '../utils/permissions';
import { renderStatusBadge } from '../utils/statusUtils';

const C = {
  teal: '#037265',
  coral: '#E16E53',
  orange: '#F0A24A',
  tan: '#D1A784',
  sage: '#B7D9C6',
  lime: '#BADF00',
};

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
  const [showPostulerModal, setShowPostulerModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [allDemandes, setAllDemandes] = useState<any[]>([]);
  const [demandesLoading, setDemandesLoading] = useState(false);
  const [demandesSearch, setDemandesSearch] = useState('');
  const [selectedDemande, setSelectedDemande] = useState<any | null>(null);
  const [sending, setSending] = useState(false);

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
      u.role === 'responsable_operations' || 
      u.role === 'admin' ||
      String(u.id) === parsedCurrentId
    );
  };

  const handleAssignChange = async (agentId: number, userIdStr: string) => {
    const userId = userIdStr ? parseInt(userIdStr, 10) : null;
    try {
      await updateAgent(agentId, { assigned_to: userId });
      addToast('Assignation mise à jour avec succès', 'success');
      await fetchData();
    } catch (err) {
      console.error(err);
      addToast("Erreur lors de la mise à jour de l'assignation", 'error');
    }
  };

  // Fetch all demandes when Postuler modal opens
  useEffect(() => {
    if (!showPostulerModal) return;
    setDemandesLoading(true);
    getDemandes({ no_page: 'true' })
      .then(res => {
        const data = res.data;
        setAllDemandes(Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []));
      })
      .catch(console.error)
      .finally(() => setDemandesLoading(false));
  }, [showPostulerModal]);

  const filteredDemandes = useMemo(() => {
    return allDemandes.filter(d => {
      if (d.statut === 'en_attente' || d.statut === 'pres_terminee' || d.statut === 'termine') return false;
      
      const facturation = d.formulaire_data?.facturation || {};
      const statutUi = facturation.statut_paiement_ui || d.statut_paiement_ui || getPaymentUiValue(d.statut_paiement || 'non_paye', Boolean(facturation.facturation_annulee));
      
      const isAnnule = d.statut === 'annule' || statutUi === 'facturation_annulee' || facturation.facturation_annulee;
      if (isAnnule) {
        const profilSeraPaye = d.profil_sera_paye !== undefined ? Boolean(d.profil_sera_paye) : Boolean(facturation.profil_sera_paye);
        if (profilSeraPaye) {
          let allProfilesPaid = false;
          const parts = d.parts_repartition || facturation.parts_repartition || d.formulaire_data?.parts_repartition || [];
          if (Array.isArray(parts) && parts.length > 0) {
            allProfilesPaid = parts.every((p: any) => p.part_profil_versee);
          } else {
            allProfilesPaid = Boolean(facturation.part_profil_versee);
          }
          if (!allProfilesPaid) {
            if (!demandesSearch) return true;
            const q = demandesSearch.toLowerCase();
            return (
              String(d.id).includes(q) ||
              (d.client_name || '').toLowerCase().includes(q) ||
              (d.service || '').toLowerCase().includes(q) ||
              (d.client_phone || '').includes(q)
            );
          }
        }
        return false;
      }

      if (statutUi === 'paye') return false;

      if (!demandesSearch) return true;
      const q = demandesSearch.toLowerCase();
      return (
        String(d.id).includes(q) ||
        (d.client_name || '').toLowerCase().includes(q) ||
        (d.service || '').toLowerCase().includes(q) ||
        (d.client_phone || '').includes(q)
      );
    });
  }, [allDemandes, demandesSearch]);

  const handleEnvoyerProfil = async () => {
    if (!selectedAgent || !selectedDemande) return;
    setSending(true);
    try {
      await sendProfilToDemande(selectedDemande.id, selectedAgent.id);
      addToast(`Profil envoyé pour la demande #${selectedDemande.id} avec succès !`, 'success');
      setShowPostulerModal(false);
      setSelectedDemande(null);
      setSelectedAgent(null);
      setDemandesSearch('');
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || "Erreur lors de l'envoi du profil.";
      addToast(errMsg, 'error');
    } finally {
      setSending(false);
    }
  };

  const getStatutBadge = (statut: string, cao?: boolean) => {
    return renderStatusBadge(statut, cao);
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
                    {hasPermission(user, 'assigner_charge_profil') ? (
                      <select
                        value={agent.assigned_to || ''}
                        onChange={(e) => handleAssignChange(agent.id, e.target.value)}
                        className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none text-slate-700 font-medium focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                        style={{ maxWidth: '140px' }}
                      >
                        <option value="">Non assigné</option>
                        {getFilteredUsers(agent.assigned_to).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.full_name || `${u.first_name} ${u.last_name}`}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-600 text-sm font-medium">
                        {agent.assigned_to_name || 'Non assigné'}
                      </span>
                    )}
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
                    <div className="table-inline-actions">
                      <button
                        className="actions-cell-btn py-1.5 px-3"
                        onClick={() => navigate(`/profils/${encodeId(agent.id)}`)}
                      >
                        <User size={14} className="mr-2" />
                        Compte Profil
                      </button>
                      {hasPermission(user, 'postuler_demande') && (
                        <button
                          type="button"
                          className="actions-cell-btn py-1.5 px-3"
                          disabled={user?.role === 'charge_operations' && Number(agent.assigned_to) !== Number(user?.id)}
                          onClick={() => {
                            setSelectedAgent(agent);
                            setShowPostulerModal(true);
                          }}
                          style={{
                            opacity: (user?.role === 'charge_operations' && Number(agent.assigned_to) !== Number(user?.id)) ? 0.5 : 1,
                            cursor: (user?.role === 'charge_operations' && Number(agent.assigned_to) !== Number(user?.id)) ? 'not-allowed' : 'pointer'
                          }}
                          title={user?.role === 'charge_operations' && Number(agent.assigned_to) !== Number(user?.id) ? "Ce profil ne vous est pas assigné" : "Postuler ce profil à une demande"}
                        >
                          <Send size={14} className="mr-2" />
                          Postuler
                        </button>
                      )}
                      {!agent.is_blacklisted && hasPermission(user, 'supprimer_profil') && (
                        <button
                          type="button"
                          className="table-delete-icon-btn"
                          title="Supprimer le profil"
                          aria-label="Supprimer le profil"
                          onClick={() => handleDeleteAgent(agent)}
                        >
                          <Trash2 size={15} />
                        </button>
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

      {/* Modal de postulation */}
      {showPostulerModal && selectedAgent && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 200, backdropFilter: 'blur(2px)',
          }}
          onClick={() => { if (!selectedDemande) { setShowPostulerModal(false); } }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'white', borderRadius: 16, width: '100%', maxWidth: 660,
              maxHeight: '90vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)', overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                {selectedDemande ? 'Aperçu avant envoi' : 'Postuler — Choisir une demande'}
              </h2>
              <button
                onClick={() => { setShowPostulerModal(false); setSelectedDemande(null); setSelectedAgent(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 22, lineHeight: 1 }}
              >×</button>
            </div>

            {!selectedDemande ? (
              /* ── Step 1: Liste des demandes ── */
              <>
                {/* Search */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      autoFocus
                      value={demandesSearch}
                      onChange={e => setDemandesSearch(e.target.value)}
                      placeholder="Rechercher par nom, service, numéro..."
                      style={{
                        width: '100%', height: 44, paddingLeft: 38, paddingRight: 12,
                        border: '2px solid #0d9488', borderRadius: 10, fontSize: 14,
                        outline: 'none', boxSizing: 'border-box', color: '#1e293b',
                      }}
                    />
                  </div>
                </div>

                {/* List */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {demandesLoading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Chargement...</div>
                  ) : filteredDemandes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontStyle: 'italic' }}>Aucune demande trouvée.</div>
                  ) : filteredDemandes.map(d => {
                    const isAlreadyAssigned = d.profils_envoyes?.some((p: any) => p.id === selectedAgent.id);
                    return (
                      <div
                        key={d.id}
                        onClick={() => !isAlreadyAssigned && setSelectedDemande(d)}
                        style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '14px 24px', borderBottom: '1px solid #f8fafc',
                          cursor: isAlreadyAssigned ? 'not-allowed' : 'pointer',
                          opacity: isAlreadyAssigned ? 0.75 : 1,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { if (!isAlreadyAssigned) e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={e => { if (!isAlreadyAssigned) e.currentTarget.style.background = 'white'; }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>#{d.id}</span>
                            <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>{d.client_name || 'Client inconnu'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b' }}>
                            <span className={`badge ${d.segment === 'particulier' ? 'badge-spp' : 'badge-spe'}`}>{d.segment === 'particulier' ? 'PARTICULIER' : 'ENTREPRISE'}</span>
                            <span>•</span>
                            <span>{d.client_details?.city || d.formulaire_data?.ville || 'N/A'}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {isAlreadyAssigned && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', backgroundColor: '#fffbeb', padding: '2px 8px', borderRadius: 6, border: '1px solid #fef3c7' }}>
                              Déjà affecté
                            </span>
                          )}
                          {getStatutBadge(d.statut, d.cao)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              /* ── Step 2: Confirmation ── */
              <div style={{ padding: 24, overflowY: 'auto' }}>
                {/* Back */}
                <button
                  onClick={() => setSelectedDemande(null)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontWeight: 600, fontSize: 14, marginBottom: 20 }}
                >
                  ← Retour à la liste
                </button>

                {/* Demande card */}
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Demande sélectionnée</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>#{selectedDemande.id}</span>
                    <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 16 }}>{selectedDemande.client_name || 'Client inconnu'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b', marginTop: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 4, background: selectedDemande.segment === 'particulier' ? '#dbeafe' : '#f3e8ff', color: selectedDemande.segment === 'particulier' ? '#1e40af' : '#6b21a8' }}>
                      {selectedDemande.segment === 'particulier' ? 'SPP' : 'SPE'}
                    </span>
                    <span>•</span>
                    <span>{selectedDemande.client_details?.city || selectedDemande.formulaire_data?.ville || 'N/A'}</span>
                  </div>
                </div>

                {/* Agent preview */}
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Profil à envoyer</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: C.teal, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20, flexShrink: 0 }}>
                    {`${selectedAgent.last_name?.[0] || ''}${selectedAgent.first_name?.[0] || ''}`.toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 17, color: '#1e293b', margin: 0 }}>{selectedAgent.last_name} {selectedAgent.first_name}</p>
                    <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>{selectedAgent.type_profil}</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#475569' }}>
                    <span>📞</span> {selectedAgent.phone}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#475569' }}>
                    <span>📍</span> {selectedAgent.neighborhood || '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#475569' }}>
                    <span>📅</span> {selectedAgent.experience_years} an(s) {selectedAgent.experience_months} mois d’expérience
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#475569' }}>
                    <span>👤</span> {selectedAgent.nationality || '—'}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button
                    onClick={() => { setShowPostulerModal(false); setSelectedDemande(null); setSelectedAgent(null); }}
                    style={{ padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white', color: '#475569', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleEnvoyerProfil}
                    disabled={sending}
                    style={{
                      padding: '10px 24px', backgroundColor: C.teal, color: 'white', border: 'none', borderRadius: 8,
                      fontWeight: 600, fontSize: 14, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    {sending ? 'Envoi...' : 'Confirmer & Envoyer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


