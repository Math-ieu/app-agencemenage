import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getAgent, getMissions, getFeedbacks,
  updateAgent, fetchSecureDocBlob, getDemandes, sendProfilToDemande,
  getAgentHistory, getDemandesHistorique, API_URL
} from '../api/client';
import { decodeId, encodeId } from '../utils/obfuscation';
import {
  ChevronDown, User, FileText,
  MessageSquare, History, ArrowLeft,
  Download, Eye, Star, Briefcase, ShieldAlert, CheckCircle,
  ClipboardCheck, Search, Send, PlusCircle, AlertTriangle, Image
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { renderStatusBadge } from '../utils/statusUtils';
import { Agent } from '../types';
import { useToastStore } from '../store/toast';
import AddProfileModal from './ProfilEditModal';

/* ═══════════════════════════════════════════════════════════
   Color palette
   ═══════════════════════════════════════════════════════════ */
const C = {
  teal: '#037265',
  coral: '#E16E53',
  orange: '#F0A24A',
  tan: '#D1A784',
  sage: '#B7D9C6',
  lime: '#BADF00',
};

/* ─── Accordion Section ─── */
interface AccordionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  color: string;
  badge?: string | number;
}

function Accordion({ title, icon, children, isOpen, onToggle, color, badge }: AccordionProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 18px', cursor: 'pointer', borderRadius: 12,
          backgroundColor: color, color: 'white', fontWeight: 700,
          fontSize: 15, letterSpacing: '-0.01em', userSelect: 'none',
          transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ padding: 5, background: 'rgba(255,255,255,0.2)', borderRadius: 8, display: 'flex' }}>
            {icon}
          </div>
          <span>
            {title}
            {badge !== undefined && badge !== null && (
              <span style={{
                marginLeft: 8, padding: '2px 8px', background: 'rgba(255,255,255,0.3)',
                borderRadius: 99, fontSize: 11, fontWeight: 800,
              }}>{badge}</span>
            )}
          </span>
        </div>
        <ChevronDown size={18} style={{
          opacity: 0.8, transition: 'transform 0.3s',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        }} />
      </div>
      {isOpen && (
        <div style={{
          marginTop: 4, border: '1px solid #e2e8f0', borderRadius: 12,
          background: 'white', padding: '24px 32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Info Field ─── */
function InfoField({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div style={{ padding: '8px 0' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>
        {value || '—'}
      </p>
    </div>
  );
}

/* ─── Badge ─── */
function Badge({ children, bg, color: textColor, style }: { children: React.ReactNode; bg: string; color: string; style?: React.CSSProperties }) {
  return (
    <span style={{
      display: 'inline-block', padding: '4px 14px', borderRadius: 99,
      fontSize: 12, fontWeight: 700, backgroundColor: bg, color: textColor,
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
      ...style,
    }}>
      {children}
    </span>
  );
}

/* ─── Table components ─── */
function Th({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <th style={{
      textAlign: center ? 'center' : 'left', padding: '14px 10px',
      fontWeight: 500, fontSize: 13, color: '#94a3b8',
      borderBottom: '1px solid #f1f5f9',
    }}>
      {children}
    </th>
  );
}

function Td({ children, bold, color: textColor, center, mono }: {
  children: React.ReactNode; bold?: boolean; color?: string; center?: boolean; mono?: boolean;
}) {
  return (
    <td style={{
      padding: '16px 10px', fontWeight: bold ? 700 : 500,
      color: textColor || '#475569', fontSize: 14,
      textAlign: center ? 'center' : 'left',
      fontFamily: mono ? 'monospace' : 'inherit',
    }}>
      {children}
    </td>
  );
}

function EmptyState({ text, colSpan }: { text: string; colSpan?: number }) {
  if (colSpan) {
    return (
      <tr>
        <td colSpan={colSpan} style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontStyle: 'italic' }}>
          <ShieldAlert size={36} style={{ opacity: 0.2, marginBottom: 8, display: 'inline-block' }} />
          <p>{text}</p>
        </td>
      </tr>
    );
  }
  return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
      <ShieldAlert size={36} style={{ opacity: 0.2, marginBottom: 8 }} />
      <p style={{ fontStyle: 'italic', fontSize: 14 }}>{text}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */
export default function ProfilDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToastStore();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [missions, setMissions] = useState<any[]>([]);
  const [historyDemandes, setHistoryDemandes] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [operatorNotes, setOperatorNotes] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

  // Postuler modal state
  const [showPostulerModal, setShowPostulerModal] = useState(false);
  const [allDemandes, setAllDemandes] = useState<any[]>([]);
  const [demandesLoading, setDemandesLoading] = useState(false);
  const [demandesSearch, setDemandesSearch] = useState('');
  const [selectedDemande, setSelectedDemande] = useState<any | null>(null);
  const [sending, setSending] = useState(false);

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    info: true,
    notes: true,
    media: true,
    finance: true,
    evaluation: true,
    missions: true,
    historique: true,
  });

  const fetchData = async () => {
    if (!id) return;
    const realId = decodeId(id);
    if (!realId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [agentRes, feedbackRes, historyRes] = await Promise.all([
        getAgent(realId),
        getFeedbacks({ mission__agent: realId }),
        getAgentHistory(realId)
      ]);

      setAgent(agentRes.data);
      setOperatorNotes(agentRes.data.operator_notes || '');

      const fetchAllMissions = async (params: Record<string, string | number>) => {
        const rows: any[] = [];
        let page = 1;
        while (true) {
          const response = await getMissions({ ...params, page });
          const data = response.data;
          const pageRows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
          rows.push(...pageRows);
          if (!data?.next || pageRows.length === 0) break;
          page += 1;
        }
        return rows;
      };

      const fetchAllDemands = async () => {
        const rows: any[] = [];
        let page = 1;
        while (true) {
          try {
            const response = await getDemandesHistorique({ page });
            if (!response?.data) break;
            const data = response.data;
            const pageRows = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
            rows.push(...pageRows);
            if (!data?.next || pageRows.length === 0) break;
            page += 1;
          } catch { break; }
        }
        return rows;
      };

      const [agentMissions, delegueMissions, intervenantMissions, allDemandsRaw] = await Promise.all([
        fetchAllMissions({ agent: realId }),
        fetchAllMissions({ delegue: realId }),
        fetchAllMissions({ intervenants: realId }),
        fetchAllDemands()
      ]);

      const missionsById = new Map<number, any>();
      for (const mission of [...agentMissions, ...delegueMissions, ...intervenantMissions]) {
        if (mission?.id) missionsById.set(mission.id, mission);
      }

      const filteredDemands = allDemandsRaw.filter((d: any) => {
        const fact = d?.formulaire_data?.facturation || {};
        const parts = Array.isArray(fact.parts_repartition) ? fact.parts_repartition : (Array.isArray(d.parts_repartition) ? d.parts_repartition : []);
        if (parts.some((p: any) => Number(p.profile_id) === realId)) return true;
        if (fact.profil_id && Number(fact.profil_id) === realId) return true;
        return false;
      });

      const feedbackData = feedbackRes.data.results || feedbackRes.data;

      setMissions(Array.from(missionsById.values()));
      setHistoryDemandes(filteredDemands);
      setFeedbacks(Array.isArray(feedbackData) ? feedbackData : []);
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
    } catch (err) {
      console.error('Error fetching agent details:', err);
      addToast('Erreur lors du chargement des données.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const toggle = (s: string) => setOpenSections(p => ({ ...p, [s]: !p[s] }));

  // Fetch all demandes when Postuler modal opens
  useEffect(() => {
    if (!showPostulerModal) return;
    setDemandesLoading(true);
    getDemandes({ exclude_statut: 'en_attente' })
      .then(res => {
        const data = res.data;
        setAllDemandes(Array.isArray(data?.results) ? data.results : (Array.isArray(data) ? data : []));
      })
      .catch(console.error)
      .finally(() => setDemandesLoading(false));
  }, [showPostulerModal]);

  const handleEnvoyerProfil = async () => {
    if (!agent || !selectedDemande) return;
    setSending(true);
    try {
      await sendProfilToDemande(selectedDemande.id, agent.id);
      addToast(`Profil envoyé pour la demande #${selectedDemande.id} avec succès !`, 'success');
      setShowPostulerModal(false);
      setSelectedDemande(null);
      setDemandesSearch('');
    } catch (err) {
      console.error(err);
      addToast("Erreur lors de l'envoi du profil.", 'error');
    } finally {
      setSending(false);
    }
  };

  const getStatutBadge = (statut: string) => {
    return renderStatusBadge(statut);
  };

  const formatAction = (log: any) => {
    const { action, extra_data } = log;
    if (action === 'envoyer_profil' || (typeof action === 'string' && action.startsWith('envoyer_profil:'))) {
      const demandId = extra_data?.object_id || log.object_id;
      const clientName = extra_data?.client_name || 'Client';
      return `Profil envoyé pour la demande #${demandId} — ${clientName}`;
    }
    if (action === 'Mission créée') {
      return `Mission créée pour la demande #${extra_data?.demande_id} — ${extra_data?.client_name || 'Client'}`;
    }
    if (action === 'Feedback reçu') {
      return `Note de ${extra_data?.note}/5 reçue — ${extra_data?.client_name || 'Client'}`;
    }
    return action;
  };

  const isAgentBusy = useMemo(() => {
    // L'agent est occupé s'il est affecté (via profils_envoyes) à une demande active.
    // Ce champ est calculé côté backend (vérifie profils_envoyes sur les demandes non terminées).
    if (agent?.is_assigned_active) return true;

    // Fallback: vérifier aussi les missions (si une mission existe sur une demande non terminée)
    return missions.some(m => {
      if (m.statut === 'annulee') return false;
      const demandeStatut = m.demande_detail?.statut;
      return !['termine', 'pres_terminee', 'annule'].includes(demandeStatut);
    });
  }, [agent, missions]);

  const filteredHistory = history.filter(log => {
    if (!historySearch) return true;
    const q = historySearch.toLowerCase();
    const actionDesc = formatAction(log).toLowerCase();
    return actionDesc.includes(q) || (log.user_name || '').toLowerCase().includes(q);
  });

  const ACTIVE_STATUTS = ['en_attente', 'en_cours'];
  const filteredDemandes = allDemandes.filter(d => {
    // Only show active demands
    if (!ACTIVE_STATUTS.includes(d.statut)) return false;
    if (!demandesSearch) return true;
    const q = demandesSearch.toLowerCase();
    return (
      String(d.id).includes(q) ||
      (d.client_name || '').toLowerCase().includes(q) ||
      (d.service || '').toLowerCase().includes(q) ||
      (d.client_phone || '').includes(q)
    );
  });

  const handleSaveNotes = async () => {
    if (!agent) return;
    setSaving(true);
    try {
      await updateAgent(agent.id, { operator_notes: operatorNotes } as any);
      addToast('Notes enregistrées avec succès !', 'success');
    } catch (err) {
      console.error(err);
      addToast('Erreur lors de l\'enregistrement des notes.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return '—';
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `${age} ans`;
  };

  const money = (value: number): string => `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} DH`;

  const toNumber = (value: unknown): number => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };

    const financeStats = useMemo(() => {
    let totalCa = 0;
    let profilDoitAgence = 0;
    let agenceDoitProfil = 0;
    let nombreMissions = 0;

    if (!agent) return { totalCa: 0, nombreMissions: 0, profilDoitAgence: 0, agenceDoitProfil: 0 };

    const processItem = (sourceData: any, isMission: boolean) => {
      const demande = isMission ? sourceData.demande_detail || {} : sourceData;
      const facturation = demande.formulaire_data?.facturation || {};
      const montantTotal = Number(demande.prix || facturation.montant_ttc || 0);

      const rawStatutPaiementUi = facturation.statut_paiement_ui || sourceData.paiement_client_statut || (demande.statut_paiement === 'integral' ? 'paye' : 'non_paye');
      let encaissePar = (sourceData.encaisse_par === 'profil' || demande.mode_paiement === 'sur_place') ? 'Profil' : 'Agence';
      if (['profil_paye_client', 'Profil payé / Client'].includes(rawStatutPaiementUi)) encaissePar = 'Profil';
      else if (['agence_payee_client', 'Agence payée / Client'].includes(rawStatutPaiementUi)) encaissePar = 'Agence';
      else if (['paye', 'integral', 'effectue'].includes(rawStatutPaiementUi)) {
        if (sourceData.part_agence_reversee || facturation.part_agence_reversee) encaissePar = 'Profil';
        else if (sourceData.part_profil_versee || facturation.part_profil_versee) encaissePar = 'Agence';
      }

      const partProfilVersee = encaissePar === 'Agence' ? (sourceData.part_profil_versee ?? facturation.part_profil_versee ?? false) : (sourceData.part_agence_reversee ?? facturation.part_agence_reversee ?? false);
      const reglementInterne = partProfilVersee ? 'Réglé' : 'Non réglé';

      const partsRep: any[] = Array.isArray(facturation.parts_repartition) ? facturation.parts_repartition : (Array.isArray(demande.parts_repartition) ? demande.parts_repartition : []);
      const partAgenceGlobal = Number(demande.part_agence ?? facturation.part_agence ?? (montantTotal * 0.5));

      if (partsRep.length > 0) {
        const myPart = partsRep.find((p: any) => Number(p.profile_id) === agent.id);
        if (myPart) {
          const amount = Number(myPart.amount);
          const splitPartAgence = partAgenceGlobal / partsRep.length;
          const isDelegate = myPart === (partsRep.find((p: any) => p.is_delegate) || partsRep[0]);

          nombreMissions += 1;
          totalCa += (amount + splitPartAgence);

          if (encaissePar === 'Agence' && reglementInterne !== 'Réglé') agenceDoitProfil += amount;
          else if (encaissePar === 'Profil' && reglementInterne !== 'Réglé' && isDelegate) profilDoitAgence += partAgenceGlobal;
        }
      } else {
        const partProfil = Number(facturation.part_profil ?? (montantTotal * 0.5));
        nombreMissions += 1;
        totalCa += partProfil;

        if (encaissePar === 'Agence' && reglementInterne !== 'Réglé') {
          const due = Number(facturation.montant_agence_doit_profil || partProfil);
          agenceDoitProfil += due;
        } else if (encaissePar === 'Profil' && reglementInterne !== 'Réglé') {
          const due = Number(facturation.montant_profil_doit_agence || partAgenceGlobal);
          profilDoitAgence += due;
        }
      }
    };

    // Traiter les missions
    const missionDemandeIds = new Set();
    missions.forEach(m => {
      if (m.demande_detail?.id) missionDemandeIds.add(m.demande_detail.id);
      processItem(m, true);
    });

    // Traiter l'historique non couvert par les missions
    historyDemandes.forEach(d => {
      if (!missionDemandeIds.has(d.id)) {
        processItem(d, false);
      }
    });

    return { totalCa, nombreMissions, profilDoitAgence, agenceDoitProfil };
  }, [agent, missions, historyDemandes]);

  const formatMissionStatus = (status?: string): string => {
    const map: Record<string, string> = {
      en_attente: 'En attente',
      confirmee: 'Confirmée',
      en_cours: 'Nouveau besoin',
      terminee: 'Terminée',
      annulee: 'Annulée',
    };
    return map[status || ''] || status || '—';
  };

  const handleDownload = async (url: string, baseName?: string) => {
    if (!url) return;
    try {
      // Si c'est une URL absolue externe, on l'ouvre directement
      if (url.startsWith('http') && !url.includes(window.location.hostname) && !url.includes('localhost')) {
        window.open(url, '_blank');
        return;
      }
      const { blobUrl, mimeType } = await fetchSecureDocBlob(url);
      
      // Déterminer l'extension
      let extension = '';
      if (mimeType.includes('pdf')) extension = '.pdf';
      else if (mimeType.includes('image/jpeg')) extension = '.jpg';
      else if (mimeType.includes('image/png')) extension = '.png';
      else if (mimeType.includes('image/webp')) extension = '.webp';
      else if (mimeType.includes('image')) extension = '.jpg';

      // Téléchargement forcé
      const a = document.createElement('a');
      a.href = blobUrl;
      const fileName = baseName ? (baseName.endsWith(extension) ? baseName : `${baseName}${extension}`) : (url.split('/').pop() || 'document');
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
      const finalUrl = (url.startsWith('/') && !url.startsWith('//')) ? `${API_URL}${url}` : url;
      window.open(finalUrl, '_blank');
    }
  };

  const getMediaIcon = (url?: string, defaultIcon?: React.ReactNode) => {
    if (!url) return defaultIcon;
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) {
      return <Image size={40} color={C.teal} />;
    }
    return defaultIcon;
  };

  const combinedHistorique = useMemo(() => {
    const list: any[] = [];
    const missionDemandeIds = new Set(missions.map(m => m.demande_detail?.id).filter(Boolean));

    missions.forEach(m => list.push({ type: 'mission', data: m }));
    historyDemandes.forEach(d => {
      if (!missionDemandeIds.has(d.id)) {
        list.push({ type: 'demande', data: d });
      }
    });

    list.sort((a, b) => {
      const getD = (item: any) => {
        if (item.type === 'mission') return item.data.demande_detail?.date_intervention || item.data.date_debut || item.data.created_at;
        return item.data.date_intervention || item.data.created_at;
      };
      const dA = new Date(getD(a)).getTime() || 0;
      const dB = new Date(getD(b)).getTime() || 0;
      return dB - dA;
    });
    return list;
  }, [missions, historyDemandes]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  );

  if (!agent) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8', fontSize: 18 }}>
      Profil introuvable.
    </div>
  );

  return (
    <div style={{ background: '#F8F9FA', minHeight: '100vh', paddingBottom: 64, fontFamily: 'Inter, sans-serif' }}>

      {/* ══════════════ HEADER ══════════════ */}
      <div style={{
        background: 'white', borderBottom: '1px solid #e2e8f0',
        padding: '12px 0', position: 'sticky', top: 0, zIndex: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="flex-wrap gap-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <button
              onClick={() => navigate('/profils')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', background: 'white',
                border: '1px solid #e2e8f0', borderRadius: 8,
                color: '#475569', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <ArrowLeft size={16} /> Retour
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 20, fontWeight: 700,
                backgroundColor: C.teal,
              }}>
                {(agent.last_name || 'P')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a202c', margin: 0 }}>
                    {agent.last_name} {agent.first_name}
                  </h1>
                  {agent.average_rating !== undefined && agent.average_rating !== null && (
                    <Badge bg="#FEF3C7" color="#D97706" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Star size={12} fill="#D97706" /> {agent.average_rating}/5
                    </Badge>
                  )}
                  <Badge bg="#DCFCE7" color="#166534">
                    {agent.statut === 'disponible' ? 'Disponible' : 'Indisponible'}
                  </Badge>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>
                    {agent.poste === 'femme_menage' ? 'Femme de ménage' :
                      agent.poste === 'garde_malade' ? 'Garde malade' :
                        agent.poste === 'auxiliaire_vie' ? 'Auxiliaire de vie' :
                          agent.poste === 'nounou' ? 'Nounou' : agent.poste}
                  </span>
                  <span style={{ color: '#e2e8f0' }}>•</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>{agent.phone}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }} className="flex-wrap">
            <button
              onClick={() => setShowEditModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 18px', border: '1px solid #e2e8f0',
                borderRadius: 8, background: 'white', color: '#475569',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <FileText size={16} color={C.teal} /> Éditer
            </button>
            <button
              disabled={isAgentBusy}
              onClick={() => {
                setShowPostulerModal(true);
                setSelectedDemande(null);
                setDemandesSearch('');
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px',
                backgroundColor: isAgentBusy ? '#94a3b8' : C.teal,
                color: 'white',
                borderRadius: 8, border: 'none', fontWeight: 700,
                fontSize: 14, cursor: isAgentBusy ? 'not-allowed' : 'pointer',
                opacity: isAgentBusy ? 0.8 : 1,
              }}
              title={isAgentBusy ? "Ce profil est déjà affecté à une prestation en cours" : ""}
            >
              {isAgentBusy ? <AlertTriangle size={16} /> : <PlusCircle size={16} />}
              {isAgentBusy ? 'Déjà affecté' : 'Postuler'}
            </button>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 18px', border: '1px solid #FEB2B2',
              borderRadius: 8, background: '#FFF5F5', color: '#C53030',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              <ShieldAlert size={16} /> Blacklister
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>

        {/* ── 1. Informations du profil ── */}
        <Accordion title="Informations du profil" icon={<User size={18} />} isOpen={openSections.info} onToggle={() => toggle('info')} color={C.teal}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 32px' }}>
            <InfoField label="NOM" value={agent.last_name} />
            <InfoField label="PRÉNOM" value={agent.first_name} />
            <InfoField label="SEXE" value={agent.gender === 'femme' ? 'Femme' : 'Homme'} />
            <InfoField label="DATE DE NAISSANCE" value={agent.birth_date ? new Date(agent.birth_date).toLocaleDateString('fr-FR') : undefined} />
            <InfoField label="ÂGE" value={calculateAge(agent.birth_date)} />
            <InfoField label="CIN" value={agent.cin} />
            <InfoField label="TÉLÉPHONE" value={agent.phone} />
            <InfoField label="WHATSAPP" value={agent.whatsapp} />
            <InfoField label="VILLE" value={agent.city} />
            <InfoField label="QUARTIER" value={agent.neighborhood} />
            <InfoField label="NATIONALITÉ" value={agent.nationality} />
            <InfoField label="SITUATION MATRIMONIALE" value={agent.situation} />
            <InfoField label="ENFANTS" value={agent.has_children ? 'Oui' : 'Non'} />
            <InfoField label="LANGUES" value={agent.languages?.join(', ')} />
            <InfoField label="NIVEAU D'ÉTUDE" value={agent.education_level} />
            <InfoField label="EXPÉRIENCE TOTALE" value={`${agent.experience_years} an(s) ${agent.experience_months} mois`} />
            <InfoField label="TYPE DE PROFIL" value={agent.type_profil} />
            <InfoField label="FORMATION REQUISE" value={agent.training_details} />
            <InfoField label="SAIT LIRE ET ÉCRIRE" value={agent.can_read_write ? 'Oui' : 'Non'} />
            <InfoField label="MALADIE / HANDICAP" value={agent.health_issues} />
            <InfoField label="PRÉSENTATION PHYSIQUE" value={agent.physical_appearance} />
            <InfoField label="CORPULENCE" value={agent.corpulence} />
          </div>

          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              DISPONIBILITÉS
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              {agent.avail_emergencies && <Badge bg="#EBF8FF" color="#2B6CB0">Urgences</Badge>}
              {agent.avail_day && <Badge bg="#F0FFF4" color="#2F855A">Journée (7h-18h)</Badge>}
              {agent.avail_evening && <Badge bg="#FAF5FF" color="#6B46C1">Soirée (après 18h)</Badge>}
              {agent.avail_7_7 && <Badge bg="#F0FFF4" color="#2F855A">7j/7</Badge>}
              {agent.avail_holidays && <Badge bg="#FFF5F5" color="#C53030">Jours fériés</Badge>}
            </div>
          </div>

          {/* Expériences section (like the screenshot) */}
          <div style={{ marginTop: 32 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
              EXPÉRIENCES
            </p>
            <div style={{ padding: 20, background: '#f8fafc', borderRadius: 12, border: '1px solid #f1f5f9' }}>
              {/* This would be a map over agent.experiences if they were passed separately, 
                  but in the screenshot it shows a specialized list */}
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>Femme de ménage</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['Hôtel', 'Faire le lit', 'Laver le sol', 'Nettoyer les vitres', 'Ranger les placards'].map(task => (
                  <span key={task} style={{ padding: '4px 12px', background: '#ecfdf5', color: '#065f46', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>{task}</span>
                ))}
                <span style={{ padding: '4px 12px', background: '#ecfdf5', color: '#065f46', borderRadius: 6, fontSize: 12, fontWeight: 500 }}>...</span>
              </div>
            </div>
          </div>
        </Accordion>

        {/* ── 2. Avis opérateur sur le profil ── */}
        <Accordion title="Avis opérateur sur le profil" icon={<MessageSquare size={18} />} isOpen={openSections.notes} onToggle={() => toggle('notes')} color={C.sage}>
          <textarea
            style={{ width: '100%', minHeight: 120, padding: 16, border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 14, outline: 'none', marginBottom: 16, resize: 'vertical' }}
            value={operatorNotes}
            onChange={(e) => setOperatorNotes(e.target.value)}
            placeholder="Saisir un avis sur ce profil..."
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSaveNotes}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 20px', background: C.teal, color: 'white',
                border: 'none', borderRadius: 8, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >
              <ClipboardCheck size={18} />
              Enregistrer
            </button>
          </div>
        </Accordion>

        {/* ── 3. Média ── */}
        <Accordion title="Média" icon={<Eye size={18} />} isOpen={openSections.media} onToggle={() => toggle('media')} color={C.teal}>
          <div className="media-layout-grid">
            {/* Photo */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase' }}>PHOTO DE PROFIL</p>
              <div style={{ width: 120, height: 120, margin: '0 auto 16px', background: '#f1f5f9', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {agent.photo ? <img src={agent.photo} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} /> : <User size={40} color="#cbd5e1" />}
              </div>
              <button onClick={() => agent.photo && handleDownload(agent.photo, `Photo_${agent.full_name || agent.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto', padding: '6px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white', color: '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <Download size={14} /> Télécharger
              </button>
            </div>
            {/* CIN */}
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase' }}>CIN</p>
              <div style={{ width: 120, height: 120, margin: '0 auto 16px', background: '#f1f5f9', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {getMediaIcon(agent.cin_file, <FileText size={40} color={agent.cin_file ? C.teal : "#cbd5e1"} />)}
                {agent.cin_file && (
                  <div style={{ position: 'absolute', top: -5, right: -5, background: '#10B981', color: 'white', borderRadius: '50%', padding: 4, display: 'flex', border: '2px solid white' }}>
                    <CheckCircle size={14} />
                  </div>
                )}
              </div>
              <button disabled={!agent.cin_file} onClick={() => agent.cin_file && handleDownload(agent.cin_file, `CIN_${agent.full_name || agent.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto', padding: '6px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white', color: agent.cin_file ? '#475569' : '#cbd5e1', fontSize: 12, fontWeight: 700, cursor: agent.cin_file ? 'pointer' : 'not-allowed' }}>
                <Download size={14} /> {agent.cin_file ? 'Télécharger' : 'Indisponible'}
              </button>
            </div>
            {/* Attestation */}
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase' }}>ATTESTATION</p>
              <div style={{ width: 120, height: 120, margin: '0 auto 16px', background: '#f1f5f9', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {getMediaIcon(agent.attestation_file, <ClipboardCheck size={40} color={agent.attestation_file ? C.teal : "#cbd5e1"} />)}
                {agent.attestation_file && (
                  <div style={{ position: 'absolute', top: -5, right: -5, background: '#10B981', color: 'white', borderRadius: '50%', padding: 4, display: 'flex', border: '2px solid white' }}>
                    <CheckCircle size={14} />
                  </div>
                )}
              </div>
              <button disabled={!agent.attestation_file} onClick={() => agent.attestation_file && handleDownload(agent.attestation_file, `Attestation_${agent.full_name || agent.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto', padding: '6px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white', color: agent.attestation_file ? '#475569' : '#cbd5e1', fontSize: 12, fontWeight: 700, cursor: agent.attestation_file ? 'pointer' : 'not-allowed' }}>
                <Download size={14} /> {agent.attestation_file ? 'Télécharger' : 'Indisponible'}
              </button>
            </div>
            {/* Fiche Antropométrique */}
            <div style={{ textAlign: 'center', position: 'relative' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase' }}>FICHE ANTROPOMÉTRIQUE</p>
              <div style={{ width: 120, height: 120, margin: '0 auto 16px', background: '#f1f5f9', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {getMediaIcon(agent.fiche_antropometrique, <FileText size={40} color={agent.fiche_antropometrique ? C.teal : "#cbd5e1"} />)}
                {agent.fiche_antropometrique && (
                  <div style={{ position: 'absolute', top: -5, right: -5, background: '#10B981', color: 'white', borderRadius: '50%', padding: 4, display: 'flex', border: '2px solid white' }}>
                    <CheckCircle size={14} />
                  </div>
                )}
              </div>
              <button disabled={!agent.fiche_antropometrique} onClick={() => agent.fiche_antropometrique && handleDownload(agent.fiche_antropometrique, `Fiche_Antropometrique_${agent.full_name || agent.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto', padding: '6px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white', color: agent.fiche_antropometrique ? '#475569' : '#cbd5e1', fontSize: 12, fontWeight: 700, cursor: agent.fiche_antropometrique ? 'pointer' : 'not-allowed' }}>
                <Download size={14} /> {agent.fiche_antropometrique ? 'Télécharger' : 'Indisponible'}
              </button>
            </div>
          </div>
        </Accordion>

        {/* ── 4. Solde financier ── */}
        <Accordion title="Solde financier" icon={<ArrowLeft size={18} />} isOpen={openSections.finance} onToggle={() => toggle('finance')} color={C.tan}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <FinancialCard label="TOTAL CA GÉNÉRÉ" value={money(financeStats.totalCa)} color="#f1f5f9" textColor="#1e293b" />
            <FinancialCard label="NOMBRE DE MISSIONS" value={String(financeStats.nombreMissions)} color="#f1f5f9" textColor="#1e293b" />
            <FinancialCard
              label="LE PROFIL DOIT À L'AGENCE"
              value={money(financeStats.profilDoitAgence)}
              color="#FFF5F5"
              textColor="#C53030"
              subtext="Part agence non reversée"
            />
            <FinancialCard
              label="L'AGENCE DOIT AU PROFIL"
              value={money(financeStats.agenceDoitProfil)}
              color="#EBF8FF"
              textColor="#2B6CB0"
              subtext="Part profil non versée"
            />
          </div>
        </Accordion>

        {/* ── 5. Évaluation Profil ── */}
        <Accordion title="Évaluation Profil" icon={<Star size={18} />} isOpen={openSections.evaluation} onToggle={() => toggle('evaluation')} color={C.coral}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Date</Th><Th>Client</Th><Th>Étoiles</Th><Th>Satisfaction</Th><Th>Statut</Th>
              </tr></thead>
              <tbody>
                {feedbacks.map((f, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <Td>{f.date ? new Date(f.date).toLocaleDateString('fr-FR') : '—'}</Td>
                    <Td bold>
                      <Link 
                        to={f.client ? `/clients/${encodeId(f.client)}` : '#'} 
                        style={{ color: C.teal, textDecoration: 'none', cursor: f.client ? 'pointer' : 'default' }}
                      >
                        {f.client_name || 'Client'}
                      </Link>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {[...Array(5)].map((_, j) => {
                          const note = f.note_intervenant || 0;
                          return <Star key={j} size={14} fill={j < note ? '#F6E05E' : 'none'} color={j < note ? '#F6E05E' : '#e2e8f0'} />;
                        })}
                      </div>
                    </Td>
                    <Td>
                      {f.note_intervenant >= 4 ? <Badge bg="#F0FFF4" color="#2F855A">Satisfait</Badge> :
                        f.note_intervenant === 3 ? <Badge bg="#FEF3C7" color="#D97706">Moyen</Badge> :
                          <Badge bg="#FFF5F5" color="#C53030">Pas satisfait</Badge>}
                    </Td>
                    <Td>
                      {f.note_intervenant >= 4 ? <Badge bg="#F0FFF4" color="#2F855A">Positif</Badge> :
                        f.note_intervenant === 3 ? <Badge bg="#FEF3C7" color="#D97706">Neutre</Badge> :
                          <Badge bg="#FFF5F5" color="#C53030">Négatif</Badge>}
                    </Td>
                  </tr>
                ))}
                {feedbacks.length === 0 && <EmptyState text="Aucune évaluation trouvée." colSpan={5} />}
              </tbody>
            </table>
          </div>
        </Accordion>

        {/* ── 6. Historique Mission ── */}
        <Accordion title="Historique Mission" icon={<Briefcase size={18} />} isOpen={openSections.missions} onToggle={() => toggle('missions')} color={C.sage}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>N°</Th><Th>Date</Th><Th>Client</Th><Th>Service</Th><Th>Montant</Th><Th>Statut</Th>
              </tr></thead>
              <tbody>
                {combinedHistorique.map((item, i) => {
                  const isMission = item.type === 'mission';
                  const d = isMission ? item.data.demande_detail : item.data;
                  if (!d) return null;

                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <Td mono>{isMission ? `MSN-${String(item.data.id).padStart(5, '0')}` : `#${d.id}`}</Td>
                      <Td>{d.date_intervention ? new Date(d.date_intervention).toLocaleDateString('fr-FR') : (isMission && item.data.date_debut ? new Date(item.data.date_debut).toLocaleDateString('fr-FR') : '—')}</Td>
                      <Td bold color="#475569">
                        {d.client ? (
                          <Link to={`/clients/${encodeId(d.client)}`} style={{ color: '#037265', textDecoration: 'none' }}>
                            {d.client_name || '—'}
                          </Link>
                        ) : (
                          d.client_name || '—'
                        )}
                      </Td>
                      <Td>{d.service || '—'}</Td>
                      <Td bold color="#1e293b">{money(toNumber(d.prix))}</Td>
                      <Td>
                        {isMission ? (
                          <Badge bg="#f1f5f9" color="#475569">{formatMissionStatus(item.data.statut)}</Badge>
                        ) : (
                          getStatutBadge(d.statut)
                        )}
                      </Td>
                    </tr>
                  );
                })}
                {combinedHistorique.length === 0 && <EmptyState text="Aucun historique de mission trouvé." colSpan={6} />}
              </tbody>
            </table>
          </div>
        </Accordion>

        {/* ── 7. Historique ── */}
        <Accordion title="Historique" icon={<History size={18} />} isOpen={openSections.historique} onToggle={() => toggle('historique')} color={C.tan}>
          {/* Search bar */}
          <div style={{ padding: '0 0 16px 0' }}>
            <div style={{ position: 'relative', maxWidth: 350 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Rechercher une action..."
                style={{
                  width: '100%', height: 38, paddingLeft: 38, paddingRight: 12,
                  border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13,
                  outline: 'none', color: '#1e293b',
                }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Date</Th><Th>Action</Th><Th>Note</Th><Th>Utilisateur</Th>
              </tr></thead>
              <tbody>
                {filteredHistory.map((log, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <Td mono>{new Date(log.timestamp).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit'
                    })}</Td>
                    <Td bold color="#475569">{formatAction(log)}</Td>
                    <Td color="#94a3b8">{log.extra_data?.notes || '—'}</Td>
                    <Td>{log.user_name || 'Opérateur'}</Td>
                  </tr>
                ))}
                {filteredHistory.length === 0 && <EmptyState text="Aucun historique trouvé." colSpan={4} />}
              </tbody>
            </table>
          </div>
        </Accordion>

      </div>

      {showEditModal && agent && (
        <AddProfileModal
          initialAgent={agent}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            fetchData();
          }}
        />
      )}

      {/* ── Postuler Modal ── */}
      {showPostulerModal && agent && (
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
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {demandesLoading ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Chargement...</div>
                  ) : filteredDemandes.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontStyle: 'italic' }}>Aucune demande trouvée.</div>
                  ) : filteredDemandes.map(d => {
                    const isAlreadyAssigned = d.profils_envoyes?.some((p: any) => p.id === agent.id);
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
                          {getStatutBadge(d.statut)}
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
                    {`${agent.last_name?.[0] || ''}${agent.first_name?.[0] || ''}`.toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 17, color: '#1e293b', margin: 0 }}>{agent.last_name} {agent.first_name}</p>
                    <p style={{ fontSize: 13, color: '#64748b', margin: '2px 0 0' }}>{agent.type_profil}</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#475569' }}>
                    <span>📞</span> {agent.phone}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#475569' }}>
                    <span>📍</span> {agent.neighborhood || '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#475569' }}>
                    <span>📅</span> {agent.experience_years} an(s) {agent.experience_months} mois d’expérience
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#475569' }}>
                    <span>👤</span> {agent.nationality || '—'}
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
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', backgroundColor: C.teal, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}
                  >
                    <Send size={16} />
                    {sending ? 'Envoi...' : 'Envoyer le profil'}
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

function FinancialCard({ label, value, color, textColor, subtext }: { label: string; value: string; color: string; textColor: string; subtext?: string }) {
  return (
    <div style={{ padding: '24px 20px', background: color, borderRadius: 12, textAlign: 'center', border: '1px solid #e2e8f0' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 800, color: textColor, margin: 0 }}>{value}</p>
      {subtext && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>{subtext}</p>}
    </div>
  );
}

