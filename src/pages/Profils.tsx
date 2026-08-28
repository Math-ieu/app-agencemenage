import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAgents, deleteAgent, getDemandes, updateAgent, sendProfilToDemande, removeProfilFromDemande } from '../api/client';
import { Search, Plus, RotateCw, Calendar, User, XCircle, Trash2, UserPlus, UserMinus, Send, Ban, Pause, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Agent } from '../types';
import { encodeId } from '../utils/obfuscation';
import AddProfileModal from './ProfilEditModal';
import { useToastStore } from '../store/toast';
import { useAuthStore } from '../store/auth';
import { checkPermission, hasPermission } from '../utils/permissions';
import { renderStatusBadge } from '../utils/statusUtils';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

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
  width: '135px',
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

const getPaymentUiValue = (statutPaiement: string, facturationAnnulee: boolean): string => {
  if (facturationAnnulee) return 'facturation_annulee';
  if (statutPaiement === 'integral') return 'paye';
  if (statutPaiement === 'acompte') return 'paiement_en_attente';
  if (statutPaiement === 'partiel') return 'paiement_partiel';
  return 'non_confirme';
};

// ─────────────────────────────────────────────────────────────────────────────

export default function Profils() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Nouvelles variables d'état pour les filtres
  const [filterStatut, setFilterStatut] = useState('');
  const [filterDispoType, setFilterDispoType] = useState('');
  const [filterFume, setFilterFume] = useState('');
  const [filterTypeProfil, setFilterTypeProfil] = useState('');
  const [filterSegment, setFilterSegment] = useState('');
  const [filterJourDispo, setFilterJourDispo] = useState('');

  // Variables pour le modal de postulation (raccourci Affectation)
  const [selectedAgentForPostuler, setSelectedAgentForPostuler] = useState<Agent | null>(null);
  const [showPostulerModal, setShowPostulerModal] = useState(false);
  const [allDemandes, setAllDemandes] = useState<any[]>([]);
  const [demandesLoading, setDemandesLoading] = useState(false);
  const [demandesSearch, setDemandesSearch] = useState('');
  const [selectedDemande, setSelectedDemande] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [activePauseDropdown, setActivePauseDropdown] = useState<number | null>(null);
  const [selectedAgentForStandby, setSelectedAgentForStandby] = useState<Agent | null>(null);
  const [standbyDays, setStandbyDays] = useState(7);
  const [selectedAgentForResume, setSelectedAgentForResume] = useState<Agent | null>(null);
  const [selectedAgentForBlacklist, setSelectedAgentForBlacklist] = useState<Agent | null>(null);

  // Variables pour le modal de retrait de profil d'une demande
  const [showRetirerModal, setShowRetirerModal] = useState(false);
  const [selectedAgentForRetirer, setSelectedAgentForRetirer] = useState<Agent | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const fetchDemandes = async () => {
    try {
      const res = await getDemandes({ no_page: 'true' });
      const data = res.data;
      setAllDemandes(Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []));
    } catch (err) {
      console.error('Failed to fetch demandes in Profils:', err);
    }
  };

  useEffect(() => {
    fetchDemandes();
  }, []);

  // Fetch all demandes when Postuler or Retirer modal opens
  useEffect(() => {
    if (!showPostulerModal && !showRetirerModal) return;
    setDemandesLoading(true);
    fetchDemandes().finally(() => setDemandesLoading(false));
  }, [showPostulerModal, showRetirerModal]);

  const assignedDemandesForAgent = useMemo(() => {
    const map: Record<number, any[]> = {};
    const activeList = allDemandes.filter(d => {
      if (d.statut === 'en_attente' || d.statut === 'pres_terminee' || d.statut === 'termine') return false;
      const facturation = d.formulaire_data?.facturation || {};
      const statutUi = facturation.statut_paiement_ui || d.statut_paiement_ui || getPaymentUiValue(d.statut_paiement || 'non_paye', Boolean(facturation.facturation_annulee));
      if (statutUi === 'paye') return false;
      return true;
    });

    agents.forEach(ag => {
      map[ag.id] = activeList.filter(d => {
        const inProfils = Array.isArray(d.profils_envoyes) && d.profils_envoyes.some((p: any) => Number(p.id || p) === ag.id);
        const inParts = Array.isArray(d.parts_repartition) && d.parts_repartition.some((p: any) => Number(p.profile_id) === ag.id);
        return inProfils || inParts;
      });
    });
    return map;
  }, [allDemandes, agents]);

  const handleRetirerProfil = async (demandeId: number, agentId: number) => {
    setRemovingId(demandeId);
    try {
      await removeProfilFromDemande(demandeId, agentId);
      addToast(`Femme de ménage retirée de la demande #${demandeId} avec succès !`, 'success');
      setShowRetirerModal(false);
      setSelectedAgentForRetirer(null);
      await Promise.all([fetchData(), fetchDemandes()]);
    } catch (err) {
      console.error(err);
      addToast("Erreur lors du retrait du profil.", 'error');
    } finally {
      setRemovingId(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (target.closest && target.closest('.pause-dropdown-container')) {
        return;
      }
      setActivePauseDropdown(null);
    };
    if (activePauseDropdown !== null) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activePauseDropdown]);

  const handleToggleBlacklist = (agent: Agent) => {
    const perm = checkPermission(user, 'blacklister_agents');
    if (!perm.allowed) {
      addToast(perm.message || 'Action non autorisée', 'error');
      return;
    }
    setSelectedAgentForBlacklist(agent);
  };

  const confirmBlacklist = async () => {
    if (!selectedAgentForBlacklist) return;
    const isCurrentlyBlacklisted = selectedAgentForBlacklist.statut === 'blacklist' || selectedAgentForBlacklist.is_blacklisted;
    const nextStatus = !isCurrentlyBlacklisted;
    try {
      await updateAgent(selectedAgentForBlacklist.id, {
        statut: nextStatus ? 'blacklist' : 'active',
        is_blacklisted: nextStatus,
      } as any);
      addToast(`Profil ${nextStatus ? 'blacklisté' : 'retiré de la blacklist'} avec succès`, 'success');
      await fetchData();
    } catch (err) {
      console.error(err);
      addToast('Erreur lors du changement de statut de la blacklist', 'error');
    } finally {
      setSelectedAgentForBlacklist(null);
    }
  };

  const handleTogglePause = (agent: Agent) => {
    const perm = checkPermission(user, 'mettre_standby_profil');
    if (!perm.allowed) {
      addToast(perm.message || 'Action non autorisée', 'error');
      return;
    }
    if (agent.statut === 'stand_by') {
      setSelectedAgentForResume(agent);
    } else {
      setSelectedAgentForStandby(agent);
      setStandbyDays(7);
    }
  };

  const confirmStandby = async () => {
    if (!selectedAgentForStandby) return;
    try {
      await updateAgent(selectedAgentForStandby.id, { statut: 'stand_by', standby_days: standbyDays } as any);
      addToast('Profil mis en pause avec succès !', 'success');
      setSelectedAgentForStandby(null);
      await fetchData();
    } catch (err) {
      console.error(err);
      addToast('Erreur lors de la mise en pause du profil.', 'error');
    }
  };

  const confirmResume = async () => {
    if (!selectedAgentForResume) return;
    try {
      await updateAgent(selectedAgentForResume.id, { statut: 'active', standby_days: null, standby_until: null } as any);
      addToast('Profil réactivé avec succès !', 'success');
      setSelectedAgentForResume(null);
      await fetchData();
    } catch (err) {
      console.error(err);
      addToast('Erreur lors de la réactivation du profil.', 'error');
    }
  };

  const handleEnvoyerProfil = async () => {
    if (!selectedAgentForPostuler || !selectedDemande) return;
    setSending(true);
    try {
      await sendProfilToDemande(selectedDemande.id, selectedAgentForPostuler.id);
      addToast(`Profil envoyé pour la demande #${selectedDemande.id} avec succès !`, 'success');
      setShowPostulerModal(false);
      setSelectedDemande(null);
      setDemandesSearch('');
      await Promise.all([fetchData(), fetchDemandes()]);
    } catch (err) {
      console.error(err);
      addToast("Erreur lors de l'envoi du profil.", 'error');
    } finally {
      setSending(false);
    }
  };

  const filteredDemandes = useMemo(() => {
    return allDemandes.filter(d => {
      // Exclure les demandes "en attente" ou déjà traitées/terminées
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

  const hasActiveFilters = Boolean(
    dateDebut || dateFin || search || filterStatut || filterDispoType || filterFume !== '' || filterTypeProfil || filterSegment || filterJourDispo
  );

  const resetFilters = () => {
    setDateDebut('');
    setDateFin('');
    setSearch('');
    setFilterStatut('');
    setFilterDispoType('');
    setFilterFume('');
    setFilterTypeProfil('');
    setFilterSegment('');
    setFilterJourDispo('');
    setPage(1);
  };

  const isFirstMount = useRef(true);

  const fetchData = async (overridePage?: number) => {
    setLoading(true);
    const targetPage = overridePage !== undefined ? overridePage : page;
    try {
      const params: Record<string, string | number> = {
        page: targetPage,
        page_size: pageSize,
      };
      if (search) params.search = search;
      if (dateDebut) params.date_debut = dateDebut;
      if (dateFin) params.date_fin = dateFin;
      if (filterStatut) params.statut = filterStatut;
      if (filterDispoType) params.disponibilite_type = filterDispoType;
      if (filterFume !== '') params.is_smoking = filterFume;
      if (filterTypeProfil) params.type_profil = filterTypeProfil;
      if (filterSegment) params.segment = filterSegment;
      if (filterJourDispo) params.jour_dispo = filterJourDispo;

      const agentsRes = await getAgents(params);
      const data = agentsRes.data;
      const agentsList = data?.results || (Array.isArray(data) ? data : []);
      const count = typeof data?.count === 'number' ? data.count : agentsList.length;

      setAgents(agentsList);
      setTotalCount(count);
    } catch (err) {
      console.error('Error fetching agents:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reset page to 1 when filters or pageSize change
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    setPage(1);
  }, [search, dateDebut, dateFin, filterStatut, filterDispoType, filterFume, filterTypeProfil, filterSegment, filterJourDispo, pageSize]);

  // Fetch when page, pageSize or any filter changes
  useEffect(() => { 
    fetchData(); 
  }, [page, pageSize, search, dateDebut, dateFin, filterStatut, filterDispoType, filterFume, filterTypeProfil, filterSegment, filterJourDispo]);

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

  const selectStyle: React.CSSProperties = {
    height: '38px',
    padding: '0 8px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#374151',
    background: 'white',
    outline: 'none',
    cursor: 'pointer',
    minWidth: '110px',
    boxSizing: 'border-box',
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (page <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (page >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', page - 1, page, page + 1, '...', totalPages];
  };

  return (
    <div className="page" style={{ backgroundColor: 'white' }}>
      {/* Header */}
      <div className="page-header flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Liste des femmes de ménage</h1>
        <div className="flex gap-3">
          <button className="btn btn-secondary" onClick={() => fetchData()}>
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

      {/* ── Single-line filter bar ── */}
      <div style={filterBarStyle}>

        {/* Search */}
        <div style={searchWrapStyle}>
          <Search size={16} style={searchIconStyle} />
          <input
            type="text"
            placeholder="Rechercher par nom, numéro, vi"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInputStyle}
          />
        </div>

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

        <div style={dividerStyle} />

        {/* Statut profil */}
        <select
          value={filterStatut}
          onChange={e => setFilterStatut(e.target.value)}
          style={selectStyle}
        >
          <option value="">Tous statuts</option>
          <option value="nouveau">Nouveau</option>
          <option value="active">Active (Binômage)</option>
          <option value="blacklist">Blacklisté</option>
          <option value="stand_by">Stand by</option>
          <option value="en_conge">En congé</option>
          <option value="malade">Malade</option>
        </select>

        {/* Disponibilité type */}
        <select
          value={filterDispoType}
          onChange={e => setFilterDispoType(e.target.value)}
          style={selectStyle}
        >
          <option value="">Toutes dispos....</option>
          <option value="urgences">Les urgences</option>
          <option value="soiree">Soirée (après 18h)</option>
          <option value="feries">Jours fériés</option>
        </select>

        {/* Fume ? */}
        <select
          value={filterFume}
          onChange={e => setFilterFume(e.target.value)}
          style={selectStyle}
        >
          <option value="">Fume ?</option>
          <option value="true">Fumeur</option>
          <option value="false">Non fumeur</option>
        </select>

        {/* Domaine d'intervention / Type de profil */}
        <select
          value={filterTypeProfil}
          onChange={e => setFilterTypeProfil(e.target.value)}
          style={selectStyle}
        >
          <option value="">Tous services</option>
          <option value="Femme de ménage">Femme de ménage</option>
          <option value="Garde malade">Garde malade</option>
          <option value="Auxiliaire de vie">Auxiliaire de vie</option>
          <option value="Nounou">Nounou</option>
        </select>

        {/* Segment affectable */}
        <select
          value={filterSegment}
          onChange={e => setFilterSegment(e.target.value)}
          style={selectStyle}
        >
          <option value="">Tous segments</option>
          <option value="particulier">Particulier</option>
          <option value="entreprise">Entreprise</option>
        </select>

        {/* Jour de disponibilité */}
        <select
          value={filterJourDispo}
          onChange={e => setFilterJourDispo(e.target.value)}
          style={selectStyle}
        >
          <option value="">Tous les jours</option>
          <option value="lundi">Lundi</option>
          <option value="mardi">Mardi</option>
          <option value="mercredi">Mercredi</option>
          <option value="jeudi">Jeudi</option>
          <option value="vendredi">Vendredi</option>
          <option value="samedi">Samedi</option>
          <option value="dimanche">Dimanche</option>
        </select>

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
        <>
          <div className="table-wrapper profils-table-wrap" style={{ minHeight: '280px', marginBottom: '8px' }}>
            <table className="data-table profils-table">
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
                  <th>Quartier /<br />Ville</th>
                  <th>Statut profil</th>
                  <th>Disponibilité<br />d'intervention</th>
                  <th>Fume</th>
                  <th>Langue</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent, index) => (
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
                    {/* Statut profil */}
                    <td>
                      <span className={`badge ${
                        agent.statut === 'nouveau' ? 'badge-blue' :
                        agent.statut === 'active' ? 'badge-lime' :
                        agent.statut === 'blacklist' ? 'badge-red' :
                        agent.statut === 'stand_by' ? 'badge-orange' :
                        agent.statut === 'en_conge' ? 'badge-purple' :
                        agent.statut === 'malade' ? 'badge-red' :
                        'badge-gray'
                      }`} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}>
                        {agent.statut === 'nouveau' ? 'Nouveau' :
                         agent.statut === 'active' ? 'Active (Binômage)' :
                         agent.statut === 'blacklist' ? 'Blacklisté' :
                         agent.statut === 'stand_by' ? 'Stand by' :
                         agent.statut === 'en_conge' ? 'En congé' :
                         agent.statut === 'malade' ? 'Malade' :
                         agent.statut || 'Nouveau'}
                      </span>
                    </td>
                    {/* Disponibilité d'intervention */}
                    <td>
                      <span className={`badge ${
                        agent.disponibilite_intervention === 'disponible' ? 'badge-lime' :
                        agent.disponibilite_intervention === 'occupee' ? 'badge-orange' :
                        'badge-red'
                      }`} style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: agent.disponibilite_intervention === 'occupee' ? '#f59e0b' : undefined,
                        color: agent.disponibilite_intervention === 'occupee' ? 'white' : undefined,
                      }}>
                        {agent.disponibilite_intervention === 'disponible' ? 'Disponible' :
                         agent.disponibilite_intervention === 'occupee' ? 'Occupé (Mission)' :
                         'Non disponible'}
                      </span>
                    </td>
                    {/* Fume */}
                    <td>
                      <span className={`badge ${agent.is_smoking ? 'badge-red' : 'badge-lime'}`} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px' }}>
                        {agent.is_smoking ? 'Oui' : 'Non'}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-status-attente">
                        {agent.languages?.[0] || 'Français'}
                      </span>
                    </td>
                    {/* Action */}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'nowrap' }}>
                        <button
                          onClick={() => navigate(`/profils/${encodeId(agent.id)}`)}
                          title="Compte Profil"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '8px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            background: 'white',
                            color: '#334155',
                            cursor: 'pointer',
                          }}
                        >
                          <User size={16} />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedAgentForPostuler(agent);
                            setShowPostulerModal(true);
                          }}
                          title="Affectation"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '8px',
                            backgroundColor: '#0d9488',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                          }}
                        >
                          <UserPlus size={16} />
                        </button>

                        {(() => {
                          const assignedList = assignedDemandesForAgent[agent.id] || [];
                          const isAssigned = assignedList.length > 0;
                          return (
                            <button
                              onClick={() => {
                                if (!isAssigned) return;
                                setSelectedAgentForRetirer(agent);
                                setShowRetirerModal(true);
                              }}
                              disabled={!isAssigned}
                              title={isAssigned ? `Retirer de la demande (${assignedList.length} affectation${assignedList.length > 1 ? 's' : ''})` : "Aucune demande affectée"}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '8px',
                                backgroundColor: isAssigned ? '#fee2e2' : '#f8fafc',
                                color: isAssigned ? '#ef4444' : '#cbd5e1',
                                border: isAssigned ? '1px solid #fca5a5' : '1px solid #e2e8f0',
                                borderRadius: '8px',
                                cursor: isAssigned ? 'pointer' : 'not-allowed',
                                opacity: isAssigned ? 1 : 0.45,
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <UserMinus size={16} />
                            </button>
                          );
                        })()}

                        {(hasPermission(user, 'blacklister_agents') || hasPermission(user, 'mettre_standby_profil')) && (
                          <div className="pause-dropdown-container relative" style={{ display: 'inline-block' }}>
                            <button
                              onClick={() => setActivePauseDropdown(activePauseDropdown === agent.id ? null : agent.id)}
                              title="Mise en pause"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '8px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                background: 'white',
                                color: '#334155',
                                cursor: 'pointer',
                              }}
                            >
                              <Pause size={16} />
                            </button>

                            {activePauseDropdown === agent.id && (() => {
                              const isNearBottom = index >= agents.length - 2 && agents.length > 2;
                              return (
                                <div
                                  style={{
                                    position: 'absolute',
                                    ...(isNearBottom ? { bottom: '100%', marginBottom: '6px' } : { top: '100%', marginTop: '6px' }),
                                    right: 0,
                                    width: '140px',
                                    backgroundColor: 'white',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '8px',
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                    zIndex: 9999,
                                    overflow: 'hidden',
                                  }}
                                >
                                  {hasPermission(user, 'blacklister_agents') && (
                                    <button
                                      onClick={() => {
                                        setActivePauseDropdown(null);
                                        handleToggleBlacklist(agent);
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: 'none',
                                        background: 'none',
                                        textAlign: 'left',
                                        fontSize: '13px',
                                        color: '#334155',
                                        cursor: 'pointer',
                                        transition: 'background-color 0.15s',
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                      <Ban size={14} className="text-red-500" />
                                      <span>{agent.statut === 'blacklist' || agent.is_blacklisted ? 'Déblacklister' : 'Blacklisté'}</span>
                                    </button>
                                  )}
                                  {hasPermission(user, 'mettre_standby_profil') && (
                                    <button
                                      onClick={() => {
                                        setActivePauseDropdown(null);
                                        handleTogglePause(agent);
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: 'none',
                                        background: 'none',
                                        textAlign: 'left',
                                        fontSize: '13px',
                                        color: '#334155',
                                        cursor: 'pointer',
                                        transition: 'background-color 0.15s',
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                      <Pause size={14} className="text-amber-500" />
                                      <span>{agent.statut === 'stand_by' ? 'Reprendre' : 'Stand-by'}</span>
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {!agent.is_blacklisted && hasPermission(user, 'supprimer_profil') && (
                          <button
                            onClick={() => handleDeleteAgent(agent)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '8px',
                              border: '1px solid #fecaca',
                              borderRadius: '8px',
                              background: 'white',
                              color: '#dc2626',
                              cursor: 'pointer',
                            }}
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {agents.length === 0 && (
                  <tr>
                    <td colSpan={14} className="empty-row text-center py-12 text-slate-400">Aucun profil trouvé.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination Toolbar ── */}
          <div
            className="profils-pagination-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '14px',
              padding: '12px 18px',
              marginTop: '4px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            {/* Info and PageSize */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Affichage de <strong style={{ color: '#0f172a', fontWeight: 700 }}>{startItem}</strong> à <strong style={{ color: '#0f172a', fontWeight: 700 }}>{endItem}</strong> sur <strong style={{ color: '#0d9488', fontWeight: 700 }}>{totalCount}</strong> profils
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label htmlFor="pageSizeSelect" style={{ fontSize: '13px', color: '#64748b' }}>
                  Afficher :
                </label>
                <select
                  id="pageSizeSelect"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  style={{
                    height: '32px',
                    padding: '0 8px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#334155',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  <option value={5}>5 par page</option>
                  <option value={10}>10 par page</option>
                  <option value={15}>15 par page</option>
                  <option value={20}>20 par page</option>
                  <option value={50}>50 par page</option>
                  <option value={100}>100 par page</option>
                </select>
              </div>
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1}
                title="Première page"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: page <= 1 ? '#f8fafc' : '#ffffff',
                  color: page <= 1 ? '#cbd5e1' : '#475569',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <ChevronsLeft size={16} />
              </button>

              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                title="Page précédente"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: page <= 1 ? '#f8fafc' : '#ffffff',
                  color: page <= 1 ? '#cbd5e1' : '#475569',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <ChevronLeft size={16} />
              </button>

              {getPageNumbers().map((num, idx) => {
                if (num === '...') {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        fontSize: '13px',
                        color: '#94a3b8',
                      }}
                    >
                      …
                    </span>
                  );
                }
                const isSelected = num === page;
                return (
                  <button
                    key={`page-${num}`}
                    onClick={() => setPage(Number(num))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '32px',
                      height: '32px',
                      padding: '0 6px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: isSelected ? 700 : 500,
                      border: isSelected ? '1px solid #0d9488' : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? '#0d9488' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#475569',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 1px 2px rgba(13, 148, 136, 0.3)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {num}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                title="Page suivante"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: page >= totalPages ? '#f8fafc' : '#ffffff',
                  color: page >= totalPages ? '#cbd5e1' : '#475569',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <ChevronRight size={16} />
              </button>

              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                title="Dernière page"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: page >= totalPages ? '#f8fafc' : '#ffffff',
                  color: page >= totalPages ? '#cbd5e1' : '#475569',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Postuler/Affectation Modal ── */}
      {showPostulerModal && selectedAgentForPostuler && (
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
                {selectedDemande ? 'Aperçu avant affectation' : 'Affectation — Choisir une demande'}
              </h2>
              <button
                onClick={() => { setShowPostulerModal(false); setSelectedDemande(null); }}
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
                <div style={{ overflowY: 'auto', flex: 1, maxHeight: '400px' }}>
                  {demandesLoading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Chargement...</div>
                  ) : filteredDemandes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontStyle: 'italic' }}>Aucune demande trouvée.</div>
                  ) : filteredDemandes.map(d => {
                    const isAlreadyAssigned = d.profils_envoyes?.some((p: any) => p.id === selectedAgentForPostuler.id);
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
                          {renderStatusBadge(d.statut, d.cao)}
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
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Profil à affecter</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: '#0d9488', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20, flexShrink: 0 }}>
                    {`${selectedAgentForPostuler.last_name?.[0] || ''}${selectedAgentForPostuler.first_name?.[0] || ''}`.toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 17, color: '#1e293b', margin: 0 }}>{selectedAgentForPostuler.last_name} {selectedAgentForPostuler.first_name}</p>
                    <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>{selectedAgentForPostuler.type_profil}</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#475569' }}>
                    <span>📞</span> {selectedAgentForPostuler.phone}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#475569' }}>
                    <span>📍</span> {selectedAgentForPostuler.neighborhood || '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#475569' }}>
                    <span>📅</span> {selectedAgentForPostuler.experience_years} an(s) {selectedAgentForPostuler.experience_months} mois d’expérience
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#475569' }}>
                    <span>👤</span> {selectedAgentForPostuler.nationality || '—'}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <button
                    onClick={() => { setShowPostulerModal(false); setSelectedDemande(null); }}
                    style={{ padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white', color: '#475569', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleEnvoyerProfil}
                    disabled={sending}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', backgroundColor: '#0d9488', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}
                  >
                    <Send size={16} />
                    {sending ? 'Affectation...' : 'Confirmer l\'affectation'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedAgentForResume && (
        <ConfirmDialog
          isOpen={!!selectedAgentForResume}
          onOpenChange={() => setSelectedAgentForResume(null)}
          title="Reprendre l'activité ?"
          description={`Voulez-vous vraiment réactiver le profil ${selectedAgentForResume.last_name || ''} ${selectedAgentForResume.first_name || ''} ? Il ne sera plus en stand-by.`}
          confirmLabel="Confirmer"
          onConfirm={confirmResume}
          variant="success"
        />
      )}

      {selectedAgentForBlacklist && (
        <ConfirmDialog
          isOpen={!!selectedAgentForBlacklist}
          onOpenChange={() => setSelectedAgentForBlacklist(null)}
          title={
            selectedAgentForBlacklist.statut === 'blacklist' || selectedAgentForBlacklist.is_blacklisted
              ? "Déblacklister le profil ?"
              : "Blacklister le profil ?"
          }
          description={
            selectedAgentForBlacklist.statut === 'blacklist' || selectedAgentForBlacklist.is_blacklisted
              ? `Voulez-vous vraiment retirer le profil ${selectedAgentForBlacklist.last_name || ''} ${selectedAgentForBlacklist.first_name || ''} de la blacklist ? Il pourra de nouveau être affecté à des missions.`
              : `Voulez-vous vraiment ajouter le profil ${selectedAgentForBlacklist.last_name || ''} ${selectedAgentForBlacklist.first_name || ''} à la blacklist ? Cela l'exclura de futures affectations.`
          }
          confirmLabel={
            selectedAgentForBlacklist.statut === 'blacklist' || selectedAgentForBlacklist.is_blacklisted
              ? "Déblacklister"
              : "Blacklister"
          }
          onConfirm={confirmBlacklist}
          variant={
            selectedAgentForBlacklist.statut === 'blacklist' || selectedAgentForBlacklist.is_blacklisted
              ? "success"
              : "danger"
          }
        />
      )}

      {selectedAgentForStandby && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 300, backdropFilter: 'blur(2px)',
          }}
        >
          <div
            style={{
              background: 'white', borderRadius: 12, width: '100%', maxWidth: 400,
              padding: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              position: 'relative'
            }}
          >
            <button
              onClick={() => setSelectedAgentForStandby(null)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20 }}
            >
              &times;
            </button>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>Mise en stand-by</h3>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Nombre de jours</label>
              <input
                type="number"
                min="1"
                value={standbyDays}
                onChange={e => setStandbyDays(parseInt(e.target.value, 10) || 1)}
                style={{
                  width: '100%', height: 40, padding: '0 12px', border: '2px solid #0d9488',
                  borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
            
            <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5, margin: '0 0 24px' }}>
              Le profil reviendra automatiquement en statut « Active » à l'expiration.
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button
                onClick={() => setSelectedAgentForStandby(null)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: 13 }}
              >
                Annuler
              </button>
              <button
                onClick={confirmStandby}
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: 13, backgroundColor: '#0d9488', border: 'none' }}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retirer de la demande Modal */}
      {showRetirerModal && selectedAgentForRetirer && (
        <div
          className="modal-overlay z-[110]"
          onClick={() => setShowRetirerModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 300,
            backdropFilter: 'blur(2px)'
          }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              border: 'none'
            }}
          >
            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #fee2e2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fef2f2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                  <UserMinus size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    Retirer d'une demande
                  </h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    {selectedAgentForRetirer.first_name} {selectedAgentForRetirer.last_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRetirerModal(false)}
                style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', maxHeight: '380px', overflowY: 'auto' }}>
              <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 14px 0' }}>
                Sélectionnez la demande de laquelle vous souhaitez retirer ce profil :
              </p>

              {(() => {
                const assignedList = assignedDemandesForAgent[selectedAgentForRetirer.id] || [];
                if (assignedList.length === 0) {
                  return (
                    <p style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '24px 0' }}>
                      Ce profil n'est actuellement affecté à aucune demande active.
                    </p>
                  );
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {assignedList.map((d: any) => (
                      <div
                        key={d.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#f8fafc'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#0d9488' }}>#{d.id}</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b' }}>{d.client_name || 'Client inconnu'}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            {d.service || 'Prestation'} {d.date_intervention ? `• ${new Date(d.date_intervention).toLocaleDateString('fr-FR')}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={removingId === d.id}
                          onClick={() => handleRetirerProfil(d.id, selectedAgentForRetirer.id)}
                          style={{
                            padding: '7px 14px',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'white',
                            backgroundColor: '#ef4444',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: removingId === d.id ? 'not-allowed' : 'pointer',
                            opacity: removingId === d.id ? 0.6 : 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            flexShrink: 0
                          }}
                        >
                          <UserMinus size={14} /> {removingId === d.id ? 'Retrait...' : 'Retirer'}
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
              <button
                onClick={() => setShowRetirerModal(false)}
                style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


