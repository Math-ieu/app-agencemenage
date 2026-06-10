import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getClient, getDemandes, getFeedbacks, getClientActionLogs,
  updateDemande, fetchSecureDocBlob, updateClient, savePlanning
} from '../api/client';
import { decodeId, encodeId } from '../utils/obfuscation';
import {
  ChevronDown, User, FileText,
  MessageSquare, History, ArrowLeft, RefreshCw, Slash,
  Eye, Star, Clock, Heart, AlertCircle, FileDown,
  XCircle, Send, Download, CheckCircle, X, Check, Trash2, Plus
} from 'lucide-react';
import { useToastStore } from '../store/toast';
import { checkPermission, hasPermission } from '../utils/permissions';
import { useAuthStore } from '../store/auth';
import { Client, Demande } from '../types';
import { renderStatusBadge, renderPaymentStatusBadge } from '../utils/statusUtils';
import ClientEditModal from './ClientEditModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export interface ActionLog {
  id: number;
  action: string;
  details: string;
  created_at: string;
  user_name: string;
}


/* ═══════════════════════════════════════════════════════════
   Color palette (matching the reference screenshots)
   ═══════════════════════════════════════════════════════════ */
const C = {
  teal: '#037265',
  coral: '#E16E53',
  orange: '#F0A24A',
  tan: '#D1A784',
  sage: '#B7D9C6',
  lime: '#BADF00',
};

const SATISFACTION_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  'Très satisfait': { label: 'Très satisfait', bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  'Satisfait':      { label: 'Satisfait',      bg: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6' },
  'Moyen':          { label: 'Moyen',           bg: '#fef9c3', text: '#a16207', dot: '#eab308' },
  'Pas satisfait':  { label: 'Pas satisfait',   bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
};

const getSatisfactionLabel = (noteAgence: number | null) => {
  const nA = noteAgence || 0;
  if (nA >= 4.5) return 'Très satisfait';
  if (nA >= 3.5) return 'Satisfait';
  if (nA >= 2.5) return 'Moyen';
  return 'Pas satisfait';
};

const renderStars = (rating: number) => (
  <div style={{ display: 'flex', gap: 2 }}>
    {[...Array(5)].map((_, i) => (
      <Star
        key={i}
        size={14}
        fill={i < rating ? '#ECC94B' : 'none'}
        stroke={i < rating ? '#ECC94B' : '#d1d5db'}
        strokeWidth={1.5}
      />
    ))}
  </div>
);

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
      <p style={{ fontWeight: 700, color: '#1e293b', fontSize: 15, textTransform: 'capitalize' }}>
        {value || '—'}
      </p>
    </div>
  );
}

/* ─── Badge ─── */
function Badge({ children, bg, color: textColor }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '4px 14px', borderRadius: 99,
      fontSize: 12, fontWeight: 700, backgroundColor: bg, color: textColor,
      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
    }}>
      {children}
    </span>
  );
}

/* ─── Table Head Cell ─── */
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

/* ─── Table Data Cell ─── */
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

/* ─── Empty State ─── */
function EmptyState({ text, colSpan }: { text: string; colSpan?: number }) {
  if (colSpan) {
    return (
      <tr>
        <td colSpan={colSpan} style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontStyle: 'italic' }}>
          <AlertCircle size={36} style={{ opacity: 0.2, marginBottom: 8, display: 'inline-block' }} />
          <p>{text}</p>
        </td>
      </tr>
    );
  }
  return (
    <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
      <AlertCircle size={36} style={{ opacity: 0.2, marginBottom: 8 }} />
      <p style={{ fontStyle: 'italic', fontSize: 14 }}>{text}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */
export default function ClientDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [client, setClient] = useState<Client | null>(null);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    info: true, fidelite: false, frequence: false,
    besoin: false, documents: false,
    feedback: false, historique: false,
    avisComm: true, avisOp: true,
  });

  const latest = demandes.find(d => !d.parent_demande) || demandes[0] || null;

  const [avisComm, setAvisComm] = useState('');
  const [avisOp, setAvisOp] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState<{ url: string; type: string; name: string } | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDemandDetails, setShowDemandDetails] = useState<Demande | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null);
  const [showBlacklistConfirm, setShowBlacklistConfirm] = useState(false);
  const addToast = useToastStore(state => state.addToast);

  // Subscription Planning States
  const [joursIntervention, setJoursIntervention] = useState<string[]>([]);
  const [heureDebut, setHeureDebut] = useState('');
  const [heureFin, setHeureFin] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [planningStatut, setPlanningStatut] = useState<'en_cours' | 'termine'>('en_cours');
  const [planningNotes, setPlanningNotes] = useState('');
  const [savingPlanning, setSavingPlanning] = useState(false);
  const [semaines, setSemaines] = useState<any[]>([]);
  const [openWeekIds, setOpenWeekIds] = useState<string[]>([]);
  const [frequencyLabel, setFrequencyLabel] = useState('2 fois / semaine');

  useEffect(() => {
    if (latest && latest.planning) {
      setJoursIntervention(latest.planning.jours_intervention || []);
      setHeureDebut(latest.planning.heure_debut ? latest.planning.heure_debut.slice(0, 5) : '');
      setHeureFin(latest.planning.heure_fin ? latest.planning.heure_fin.slice(0, 5) : '');
      setDateDebut(latest.planning.date_debut || '');
      setDateFin(latest.planning.date_fin || '');
      setPlanningStatut(latest.planning.statut || 'en_cours');
      setPlanningNotes(latest.planning.notes || '');
      setSemaines(latest.planning.semaines || []);
    } else {
      setJoursIntervention([]);
      setHeureDebut('');
      setHeureFin('');
      setDateDebut('');
      setDateFin('');
      setPlanningStatut('en_cours');
      setPlanningNotes('');
      setSemaines([]);
    }
    if (latest) {
      setFrequencyLabel(latest.frequency_label || '2 fois / semaine');
    } else {
      setFrequencyLabel('2 fois / semaine');
    }
  }, [latest]);

  const handleSavePlanning = async () => {
    if (!latest) return;
    if (!dateDebut) {
      addToast('La date de début est obligatoire.', 'error');
      return;
    }
    setSavingPlanning(true);
    try {
      // Aggregate jours_intervention for legacy compatibility
      const allSelectedDays = new Set<string>();
      let fallbackHeureDebut = heureDebut;
      let fallbackHeureFin = heureFin;
      
      if (semaines && semaines.length > 0) {
        semaines.forEach(w => {
          if (w.jours) {
            Object.keys(w.jours).forEach(d => {
              if (w.jours[d]?.selected) {
                allSelectedDays.add(d);
              }
            });
          }
        });
        
        const firstWeek = semaines[0];
        const daysOrder = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
        const selectedDay = daysOrder.find(d => firstWeek.jours?.[d]?.selected);
        if (selectedDay) {
          fallbackHeureDebut = firstWeek.jours[selectedDay].heure_debut || fallbackHeureDebut;
          fallbackHeureFin = firstWeek.jours[selectedDay].heure_fin || fallbackHeureFin;
        }
      }
      
      const joursInterventionFallback = allSelectedDays.size > 0 
        ? Array.from(allSelectedDays) 
        : joursIntervention;

      const data = {
        jours_intervention: joursInterventionFallback,
        heure_debut: fallbackHeureDebut ? (fallbackHeureDebut.length === 5 ? `${fallbackHeureDebut}:00` : fallbackHeureDebut) : null,
        heure_fin: fallbackHeureFin ? (fallbackHeureFin.length === 5 ? `${fallbackHeureFin}:00` : fallbackHeureFin) : null,
        date_debut: dateDebut,
        date_fin: dateFin || null,
        statut: planningStatut,
        notes: planningNotes,
        semaines: semaines,
      };
      
      await Promise.all([
        savePlanning(latest.id, data),
        updateDemande(latest.id, { frequency_label: frequencyLabel })
      ]);
      
      addToast("Planning d'abonnement mis à jour avec succès", 'success');
      await fetchData();
    } catch (err) {
      console.error(err);
      addToast("Erreur lors de l'enregistrement du planning", 'error');
    } finally {
      setSavingPlanning(false);
    }
  };

  const renderPaymentStatus = (demande: any) => {
    const facturation = demande.formulaire_data?.facturation || {};
    const rawStatutPaiementUi = facturation.statut_paiement_ui || (demande.statut_paiement === 'integral' ? 'paye' : demande.statut_paiement === 'acompte' ? 'paiement_en_attente' : demande.statut_paiement === 'partiel' ? 'paiement_partiel' : 'non_paye');
    
    return renderPaymentStatusBadge(rawStatutPaiementUi);
  };

  const getSelectedDaysSummary = (week: any) => {
    const daysOrder = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    const labelMap: Record<string, string> = {
      lundi: 'Lundi',
      mardi: 'Mardi',
      mercredi: 'Mercredi',
      jeudi: 'Jeudi',
      vendredi: 'Vendredi',
      samedi: 'Samedi',
      dimanche: 'Dimanche'
    };
    const selected = daysOrder.filter(d => week.jours?.[d]?.selected);
    if (selected.length === 0) return 'aucun jour';
    return selected.map(d => labelMap[d]).join(', ');
  };

  const toggleWeekOpen = (weekId: string) => {
    if (openWeekIds.includes(weekId)) {
      setOpenWeekIds(openWeekIds.filter(id => id !== weekId));
    } else {
      setOpenWeekIds([...openWeekIds, weekId]);
    }
  };

  const handleAddWeek = () => {
    const nextIndex = semaines.length + 1;
    const newId = Math.random().toString(36).substr(2, 9);
    const newWeek = {
      id: newId,
      label: `Semaine ${nextIndex}`,
      date_debut: '',
      date_fin: '',
      termine: false,
      jours: {
        lundi: { selected: false, heure_debut: '', heure_fin: '' },
        mardi: { selected: false, heure_debut: '', heure_fin: '' },
        mercredi: { selected: false, heure_debut: '', heure_fin: '' },
        jeudi: { selected: false, heure_debut: '', heure_fin: '' },
        vendredi: { selected: false, heure_debut: '', heure_fin: '' },
        samedi: { selected: false, heure_debut: '', heure_fin: '' },
        dimanche: { selected: false, heure_debut: '', heure_fin: '' },
      }
    };
    setSemaines([...semaines, newWeek]);
    setOpenWeekIds([...openWeekIds, newId]);
  };

  const handleDeleteWeek = (weekId: string) => {
    const filtered = semaines.filter(w => w.id !== weekId);
    const reindexed = filtered.map((w, idx) => ({
      ...w,
      label: `Semaine ${idx + 1}`
    }));
    setSemaines(reindexed);
    setOpenWeekIds(openWeekIds.filter(id => id !== weekId));
  };

  const updateWeekField = (weekId: string, field: string, value: any) => {
    setSemaines(semaines.map(w => {
      if (w.id === weekId) {
        return { ...w, [field]: value };
      }
      return w;
    }));
  };

  const updateWeekDayField = (weekId: string, day: string, field: string, value: any) => {
    setSemaines(semaines.map(w => {
      if (w.id === weekId) {
        const joursCopy = { ...w.jours };
        joursCopy[day] = { ...joursCopy[day], [field]: value };
        return { ...w, jours: joursCopy };
      }
      return w;
    }));
  };

  const fetchData = async () => {
    if (!id) return;
    const realId = decodeId(id);
    if (!realId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [clientRes, demandesRes, feedbacksRes, actionLogsRes] = await Promise.all([
        getClient(realId),
        getDemandes({ client: realId.toString() }),
        getFeedbacks({ client: realId.toString() }),
        getClientActionLogs(realId),
      ]);
      setClient(clientRes.data);
      const list = Array.isArray(demandesRes.data?.results) ? demandesRes.data.results : (Array.isArray(demandesRes.data) ? demandesRes.data : []);
      // Ensure list is sorted by newest first so that list[0] is the most recent demand
      list.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setDemandes(list);

      setAvisComm('');
      setAvisOp('');

      setFeedbacks(Array.isArray(feedbacksRes.data?.results) ? feedbacksRes.data.results : (Array.isArray(feedbacksRes.data) ? feedbacksRes.data : []));
      setActionLogs(Array.isArray(actionLogsRes.data?.results) ? actionLogsRes.data.results : (Array.isArray(actionLogsRes.data) ? actionLogsRes.data : []));
    } catch (err) { console.error('Error fetching client details:', err); }
    finally { setLoading(false); }
  };

  const getNotesHistory = (type: 'commercial' | 'operationnel') => {
    const history: { label: string; text: string; date: number }[] = [];
    
    // Client notes
    const clientVal = type === 'commercial' ? client?.avis_commercial : client?.avis_operationnel;
    if (clientVal?.trim()) {
      history.push({
        label: 'Notes Fiche Client',
        text: clientVal.trim(),
        date: 0
      });
    }

    // Demands notes
    demandes.forEach(d => {
      const demandVal = type === 'commercial' ? d.note_commercial : d.note_operationnel;
      if (demandVal?.trim()) {
        history.push({
          label: `Demande #${d.id} (${d.service_label || d.service || 'Service'})`,
          text: demandVal.trim(),
          date: new Date(d.created_at).getTime()
        });
      }
    });

    // Sort by date oldest first
    history.sort((a, b) => a.date - b.date);
    return history;
  };

  useEffect(() => { fetchData(); }, [id]);
  const toggle = (s: string) => setOpenSections(p => ({ ...p, [s]: !p[s] }));

  const handleToggleBlacklist = () => {
    if (!client) return;
    const perm = checkPermission(user, 'blacklist_client');
    if (!perm.allowed) {
      addToast(perm.message || 'Action non autorisée', 'error');
      return;
    }
    setShowBlacklistConfirm(true);
  };

  const executeToggleBlacklist = async () => {
    if (!client) return;
    try {
      const nextStatus = !client.is_blacklisted;
      await updateClient(client.id, { is_blacklisted: nextStatus });
      addToast(`Client ${nextStatus ? 'blacklisté' : 'retiré de la blacklist'} avec succès`, 'success');
      fetchData();
    } catch (err) {
      console.error(err);
      addToast(`Erreur lors du changement de statut de la blacklist`, 'error');
    } finally {
      setShowBlacklistConfirm(false);
    }
  };

  const handleSaveAvis = async () => {
    const newComm = avisComm.trim();
    const newOp = avisOp.trim();

    if (newComm && !hasPermission(user, 'note_commerciale')) {
      addToast("Vous n'êtes pas autorisé à saisir une note commerciale", 'error');
      return;
    }
    if (newOp && !hasPermission(user, 'note_operationnelle')) {
      addToast("Vous n'êtes pas autorisé à saisir une note opérationnelle", 'error');
      return;
    }

    if (!newComm && !newOp) {
      addToast('Veuillez saisir au moins une note', 'info');
      return;
    }

    setSaving(true);
    try {
      const formattedDate = new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Save commercial note
      if (newComm) {
        const formattedNote = `[${formattedDate}] : ${newComm}`;
        if (demandes[0]) {
          const existing = demandes[0].note_commercial || '';
          const updated = existing ? `${existing}\n\n${formattedNote}` : formattedNote;
          await updateDemande(demandes[0].id, { note_commercial: updated });
        } else if (client) {
          const existing = client.avis_commercial || '';
          const updated = existing ? `${existing}\n\n${formattedNote}` : formattedNote;
          await updateClient(client.id, { avis_commercial: updated });
        }
      }

      // Save operational note
      if (newOp) {
        const formattedNote = `[${formattedDate}] : ${newOp}`;
        if (demandes[0]) {
          const existing = demandes[0].note_operationnel || '';
          const updated = existing ? `${existing}\n\n${formattedNote}` : formattedNote;
          await updateDemande(demandes[0].id, { note_operationnel: updated });
        } else if (client) {
          const existing = client.avis_operationnel || '';
          const updated = existing ? `${existing}\n\n${formattedNote}` : formattedNote;
          await updateClient(client.id, { avis_operationnel: updated });
        }
      }

      addToast('Notes enregistrées avec succès', 'success');
      setAvisComm('');
      setAvisOp('');
      fetchData();
    } catch (err) {
      console.error(err);
      addToast("Erreur lors de l'enregistrement", 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async (url: string, type: string, name: string) => {
    try {
      addToast('Chargement du document...', 'info');
      const { blobUrl } = await fetchSecureDocBlob(url);
      setShowPreviewModal({ url: blobUrl, type, name });
    } catch (err) {
      console.error(err);
      addToast('Erreur lors du chargement', 'error');
    }
  };

  const handleDownload = async (url: string, fileName: string) => {
    try {
      addToast('Téléchargement en cours...', 'info');
      let finalBlobUrl = url;
      let shouldRevoke = false;

      // If it's not already a blob URL, fetch it
      if (!url.startsWith('blob:')) {
        const { blobUrl } = await fetchSecureDocBlob(url);
        finalBlobUrl = blobUrl;
        shouldRevoke = true;
      }

      const a = document.createElement('a');
      a.href = finalBlobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Only revoke if we created the blob here
      if (shouldRevoke) {
        URL.revokeObjectURL(finalBlobUrl);
      }
      
      addToast('Téléchargement réussi', 'success');
    } catch (err) {
      console.error(err);
      addToast('Erreur lors du téléchargement', 'error');
    }
  };

  /* ── Loading / Not found ── */
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner" />
    </div>
  );
  if (!client) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#94a3b8', fontSize: 18 }}>
      Client introuvable.
    </div>
  );

  /* ═══ Render ═══ */
  return (
    <div style={{ background: '#F8F9FA', minHeight: '100vh', paddingBottom: 64, fontFamily: 'Inter, sans-serif' }}>

      {/* ══════════════ HEADER ══════════════ */}
      <div style={{
        background: 'white', borderBottom: '1px solid #e2e8f0',
        padding: '12px 0', position: 'sticky', top: 0, zIndex: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="flex-wrap gap-y-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Back button */}
            <button
              onClick={() => navigate('/clients')}
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

            {/* Avatar + info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 20, fontWeight: 700,
                backgroundColor: C.teal,
              }}>
                {(client.display_name || client.full_name || client.entity_name || client.last_name || client.first_name || 'C').trim()[0].toUpperCase()}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a202c', margin: 0, textTransform: 'capitalize' }}>
                    {client.display_name || client.full_name || client.entity_name || `${client.first_name || ''} ${client.last_name || ''}`.trim()}
                  </h1>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', border: '1px solid #e2e8f0',
                    borderRadius: 99, background: 'white',
                  }}>
                    <Heart size={13} color={C.teal} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>x{client.demandes_count}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#a0aec0' }}>#{client.id}</span>
                  <Badge bg={C.lime} color="white">{client.segment}</Badge>
                  {latest && renderStatusBadge(latest.statut, latest.cao)}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10 }} className="flex-wrap">
            {hasPermission(user, 'modifier_clients') && (
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
            )}
            {hasPermission(user, 'blacklister_clients') && (
              <button
                onClick={handleToggleBlacklist}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 18px',
                  border: client?.is_blacklisted ? '1px solid #cbd5e1' : '1px solid #FEB2B2',
                  borderRadius: 8,
                  background: client?.is_blacklisted ? '#f1f5f9' : 'white',
                  color: client?.is_blacklisted ? '#475569' : '#E53E3E',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {client?.is_blacklisted ? <CheckCircle size={16} color="#10b981" /> : <Slash size={16} />}
                {client?.is_blacklisted ? 'Déblacklister' : 'Black lister'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════ BODY ══════════════ */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>

        {/* ── 1. Informations Client ── */}
        <Accordion title="Informations Client" icon={<User size={18} />} isOpen={openSections.info} onToggle={() => toggle('info')} color={C.teal}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 32px' }}>
            <InfoField label="NOM / RAISON SOCIALE" value={client.display_name || client.full_name || client.entity_name || `${client.first_name || ''} ${client.last_name || ''}`.trim()} />
            <InfoField label="SEGMENT" value={client.segment} />
            <InfoField label="TÉLÉPHONE DIRECT" value={client.phone} />
            <InfoField label="WHATSAPP" value={client.whatsapp} />
            <InfoField label="EMAIL" value={client.email} />
            <InfoField label="VILLE" value={client.city || 'Casablanca'} />
            <InfoField label="QUARTIER" value={client.neighborhood} />
            <InfoField label="ADRESSE" value={client.address} />
          </div>
        </Accordion>

        {/* ── 2. Historique Fidélité ── */}
        <Accordion title="Historique Fidélité" icon={<Heart size={18} />} isOpen={openSections.fidelite} onToggle={() => toggle('fidelite')} color={C.coral} badge={demandes.length}>
          {demandes.length === 0 ? <EmptyState text="Aucune demande trouvée." /> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <Th>Date</Th><Th>Nom du service</Th><Th>Profils proposés</Th><Th>Segment</Th><Th>Statut</Th><Th>Paiement</Th><Th center>Actions</Th>
                </tr></thead>
                <tbody>
                  {demandes.map(d => (
                    <React.Fragment key={d.id}>
                      <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                        <Td>{new Date(d.created_at).toLocaleDateString('fr-FR')}</Td>
                        <Td bold color="#1e293b">{d.service}</Td>
                        <Td>
                          {(d.profils_envoyes?.length ?? 0) > 0 ? (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {d.profils_envoyes?.map(p => (
                                <Link 
                                  key={p.id} 
                                  to={`/profils/${encodeId(p.id)}`} 
                                  style={{ 
                                    textDecoration: 'none',
                                    padding: '2px 8px',
                                    backgroundColor: '#f1f5f9',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: 6,
                                    fontSize: 12,
                                    color: C.teal,
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center'
                                  }}
                                  title={p.full_name}
                                >
                                  {p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim()}
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>
                          )}
                        </Td>
                        <Td>
                          <Badge bg={d.segment === 'entreprise' ? C.lime : C.teal} color="white">
                            {d.segment === 'entreprise' ? 'Entreprise' : 'Particulier'}
                          </Badge>
                        </Td>
                        <Td>
                          {renderStatusBadge(d.statut, d.cao)}
                        </Td>
                        <Td>
                          {renderPaymentStatus(d)}
                        </Td>
                        <Td center>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                            <button 
                              onClick={() => navigate('/demandes', { state: { renewDemandeId: d.id, returnToClient: id } })}
                              style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontWeight: 600, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              <RefreshCw size={15} color={C.teal} /> Renouveler
                            </button>
                            {d.frequency === 'abonnement' && (
                              <button 
                                onClick={() => navigate('/demandes', { state: { renewDemandeId: d.id, returnToClient: id } })}
                                style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontWeight: 600, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                <RefreshCw size={15} color={C.teal} /> Abonnement
                              </button>
                            )}
                            {(() => {
                              const devisDoc = d.documents?.find(doc => doc.type_document === 'devis') || null;
                              return (
                                <>
                                  <button 
                                    onClick={() => setShowDemandDetails(d)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                                    title="Détails du besoin actuel"
                                  >
                                    <Eye size={17} />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      if (devisDoc && devisDoc.download_url) {
                                        const fileName = devisDoc.nom || 'Devis PDF';
                                        handleDownload(devisDoc.download_url, fileName);
                                      } else {
                                        addToast("Aucun devis disponible pour cette demande", "info");
                                      }
                                    }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: devisDoc ? '#64748b' : '#cbd5e1', opacity: devisDoc ? 1 : 0.4 }}
                                    title={devisDoc ? "Télécharger le devis" : "Aucun devis disponible"}
                                  >
                                    <FileText size={17} />
                                  </button>
                                </>
                              );
                            })()}
                          </div>
                        </Td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Accordion>

        {/* ── 3. Notes Panels (side by side) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'start' }}>
          {/* Notes Commerciales */}
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div
              onClick={() => toggle('avisComm')}
              style={{ padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.orange, color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ padding: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 6, display: 'flex' }}><MessageSquare size={16} /></div>
                Notes Service Commercial
              </div>
              <ChevronDown size={17} style={{ opacity: 0.6, transition: 'transform 0.3s', transform: openSections.avisComm ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
            {openSections.avisComm && (
              <div style={{ padding: 16 }}>
                {getNotesHistory('commercial').length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Historique des notes</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 180, overflowY: 'auto', padding: 10, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      {getNotesHistory('commercial').map((h, i) => (
                        <div key={i} style={{ borderBottom: i < getNotesHistory('commercial').length - 1 ? '1px solid #f1f5f9' : 'none', paddingBottom: i < getNotesHistory('commercial').length - 1 ? 8 : 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.orange }}>{h.label}</span>
                          </div>
                          <div style={{ fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{h.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {hasPermission(user, 'note_commerciale') && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Saisir une nouvelle note</div>
                    <textarea
                      style={{ width: '100%', height: 70, padding: 10, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#334155', resize: 'none', fontWeight: 500, fontFamily: 'inherit', outline: 'none' }}
                      placeholder="Saisir une nouvelle note commerciale..."
                      value={avisComm} onChange={e => setAvisComm(e.target.value)}
                    />
                  </>
                )}
              </div>
            )}
          </div>
          {/* Notes Opérationnelles */}
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div
              onClick={() => toggle('avisOp')}
              style={{ padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.tan, color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ padding: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 6, display: 'flex' }}><MessageSquare size={16} /></div>
                Notes Service Opérationnel
              </div>
              <ChevronDown size={17} style={{ opacity: 0.6, transition: 'transform 0.3s', transform: openSections.avisOp ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
            {openSections.avisOp && (
              <div style={{ padding: 16 }}>
                {getNotesHistory('operationnel').length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Historique des notes</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 180, overflowY: 'auto', padding: 10, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                      {getNotesHistory('operationnel').map((h, i) => (
                        <div key={i} style={{ borderBottom: i < getNotesHistory('operationnel').length - 1 ? '1px solid #f1f5f9' : 'none', paddingBottom: i < getNotesHistory('operationnel').length - 1 ? 8 : 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.tan }}>{h.label}</span>
                          </div>
                          <div style={{ fontSize: 13, color: '#334155', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>{h.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {hasPermission(user, 'note_operationnelle') && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Saisir une nouvelle note</div>
                    <textarea
                      style={{ width: '100%', height: 70, padding: 10, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#334155', resize: 'none', fontWeight: 500, fontFamily: 'inherit', outline: 'none' }}
                      placeholder="Saisir une nouvelle note opérationnelle..."
                      value={avisOp} onChange={e => setAvisOp(e.target.value)}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Save notes button */}
        {(hasPermission(user, 'note_commerciale') || hasPermission(user, 'note_operationnelle')) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button
              onClick={handleSaveAvis} disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 22px', backgroundColor: C.teal, color: 'white',
                borderRadius: 10, fontWeight: 700, fontSize: 14, border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1,
                boxShadow: '0 2px 8px rgba(3,114,101,0.15)',
              }}
            >
              <FileText size={17} />
              {saving ? 'Enregistrement...' : 'Enregistrer les notes'}
            </button>
          </div>
        )}

        {/* ── 4. Type de Fréquence ── */}
        <Accordion title="Type de Fréquence" icon={<Clock size={18} />} isOpen={openSections.frequence} onToggle={() => toggle('frequence')} color={C.sage}>
          {latest ? (
            latest.frequency === 'oneshot' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ padding: '6px 16px', border: '1px solid #e2e8f0', borderRadius: 99, fontSize: 14, fontWeight: 700, color: '#475569', background: 'white' }}>
                    {latest.frequency_label || latest.frequency || 'Une fois'}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8' }}>
                    Prestation Unique — {latest.nb_heures ? `${latest.nb_heures}h` : '—'}
                  </span>
                </div>
                <div style={{ padding: 16, background: '#f8fafc', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                  <p style={{ margin: 0, fontSize: 14, color: '#64748b', fontWeight: 500 }}>
                    Cette demande est configurée comme une prestation ponctuelle (Une fois).
                  </p>
                  {latest.date_intervention && (
                    <p style={{ margin: '8px 0 0 0', fontSize: 14, color: '#334155', fontWeight: 600 }}>
                      Date d'intervention prévue : {new Date(latest.date_intervention).toLocaleDateString('fr-FR')} {latest.heure_intervention ? `à ${latest.heure_intervention}` : ''}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Status indicator and monthly label */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ padding: '6px 16px', border: '1px solid #e2e8f0', borderRadius: 99, fontSize: 13, fontWeight: 700, color: C.teal, background: '#e6f7f5' }}>
                      mensuel
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>
                      Abonnement — {latest.service || 'Ménage'}
                    </span>
                  </div>
                  
                  {/* Status indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Statut planning :</span>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: 99,
                      fontSize: 12,
                      fontWeight: 700,
                      backgroundColor: planningStatut === 'en_cours' ? '#e0f2fe' : '#dcfce7',
                      color: planningStatut === 'en_cours' ? '#0369a1' : '#15803d',
                    }}>
                      {planningStatut === 'en_cours' ? 'En cours' : 'Terminé'}
                    </span>
                  </div>
                </div>

                {/* Section Title & Save Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1e293b' }}>
                    Planning de l'abonnement
                  </h3>
                  <button
                    type="button"
                    onClick={handleSavePlanning}
                    disabled={savingPlanning}
                    style={{
                      padding: '8px 18px',
                      background: C.teal,
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'opacity 0.2s',
                      opacity: savingPlanning ? 0.7 : 1,
                      boxShadow: '0 2px 4px rgba(3, 114, 101, 0.15)'
                    }}
                  >
                    {savingPlanning ? 'Enregistrement...' : (
                      <>
                        <FileText size={15} />
                        Enregistrer le planning
                      </>
                    )}
                  </button>
                </div>

                {/* Core planning fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                      Fréquence de l'abonnement
                    </label>
                    <select
                      value={frequencyLabel}
                      onChange={(e) => setFrequencyLabel(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 500,
                        outline: 'none',
                        background: 'white',
                        color: '#334155'
                      }}
                    >
                      <option value="1 fois / semaine">1 fois / semaine</option>
                      <option value="2 fois / semaine">2 fois / semaine</option>
                      <option value="3 fois / semaine">3 fois / semaine</option>
                      <option value="4 fois / semaine">4 fois / semaine</option>
                      <option value="5 fois / semaine">5 fois / semaine</option>
                      <option value="6 fois / semaine">6 fois / semaine</option>
                      <option value="7 fois / semaine">7 fois / semaine</option>
                      <option value="1 fois / mois">1 fois / mois</option>
                      <option value="2 fois / mois">2 fois / mois</option>
                      <option value="3 fois / mois">3 fois / mois</option>
                      <option value="4 fois / mois">4 fois / mois</option>
                    </select>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                      Date de début de l'abonnement *
                    </label>
                    <input
                      type="date"
                      value={dateDebut}
                      onChange={(e) => setDateDebut(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 500,
                        outline: 'none',
                        color: '#334155',
                        background: 'white'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                      Date de fin (optionnel)
                    </label>
                    <input
                      type="date"
                      value={dateFin}
                      onChange={(e) => setDateFin(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        fontSize: 14,
                        fontWeight: 500,
                        outline: 'none',
                        color: '#334155',
                        background: 'white'
                      }}
                    />
                  </div>
                </div>

                {/* Semaines & jours d'intervention header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>
                    Semaines & jours d'intervention
                  </span>
                  <button
                    type="button"
                    onClick={handleAddWeek}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px', border: '1px solid #cbd5e1', borderRadius: 8,
                      background: 'white', color: C.teal, fontSize: 13, fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Plus size={15} /> Ajouter une semaine
                  </button>
                </div>

                {/* Weeks configurations list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {semaines.map((week) => {
                    const isOpen = openWeekIds.includes(week.id);
                    return (
                      <div key={week.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#fafbfc' }}>
                        {/* Week Header */}
                        <div 
                          onClick={() => toggleWeekOpen(week.id)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '12px 18px', background: '#f8fafc', borderBottom: isOpen ? '1px solid #e2e8f0' : 'none',
                            cursor: 'pointer', userSelect: 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <ChevronDown 
                              size={16} 
                              style={{ 
                                color: '#64748b', 
                                transition: 'transform 0.2s', 
                                transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' 
                              }} 
                            />
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                              {week.label} <span style={{ fontWeight: 500, color: '#64748b', marginLeft: 6 }}>— {getSelectedDaysSummary(week)}</span>
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} onClick={e => e.stopPropagation()}>
                            {/* Status Checkbox Badge */}
                            <label 
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                backgroundColor: week.termine ? '#dcfce7' : 'white',
                                border: week.termine ? '1px solid #10b981' : '1px solid #cbd5e1',
                                borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
                                fontSize: 12, fontWeight: 700, color: week.termine ? '#15803d' : '#475569',
                                userSelect: 'none',
                                transition: 'all 0.15s'
                              }}
                            >
                              <input 
                                type="checkbox"
                                checked={week.termine || false}
                                onChange={(e) => updateWeekField(week.id, 'termine', e.target.checked)}
                                style={{ width: 14, height: 14, cursor: 'pointer', accentColor: week.termine ? '#10b981' : '#475569' }}
                              />
                              {week.termine ? 'Terminé' : 'En cours'}
                            </label>
                            
                            {/* Delete Button */}
                            <button 
                              type="button"
                              onClick={() => handleDeleteWeek(week.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: 4 }}
                              title="Supprimer cette semaine"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        
                        {/* Week Content */}
                        {isOpen && (
                          <div style={{ padding: '20px 24px', background: 'white' }}>
                            {/* Date range inputs */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                              <div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Du</span>
                                <input
                                  type="date"
                                  value={week.date_debut || ''}
                                  onChange={(e) => updateWeekField(week.id, 'date_debut', e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 8,
                                    fontSize: 13,
                                    fontWeight: 500,
                                    outline: 'none',
                                    color: '#334155'
                                  }}
                                />
                              </div>
                              <div>
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: 4 }}>Au</span>
                                <input
                                  type="date"
                                  value={week.date_fin || ''}
                                  onChange={(e) => updateWeekField(week.id, 'date_fin', e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: 8,
                                    fontSize: 13,
                                    fontWeight: 500,
                                    outline: 'none',
                                    color: '#334155'
                                  }}
                                />
                              </div>
                            </div>
                            
                            {/* Days checklist */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {[
                                { label: 'Lundi', key: 'lundi' },
                                { label: 'Mardi', key: 'mardi' },
                                { label: 'Mercredi', key: 'mercredi' },
                                { label: 'Jeudi', key: 'jeudi' },
                                { label: 'Vendredi', key: 'vendredi' },
                                { label: 'Samedi', key: 'samedi' },
                                { label: 'Dimanche', key: 'dimanche' }
                              ].map(day => {
                                const dayConfig = week.jours?.[day.key] || { selected: false, heure_debut: '', heure_fin: '' };
                                return (
                                  <div key={day.key} style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 3fr', gap: 16, alignItems: 'center' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                                      <input
                                        type="checkbox"
                                        checked={dayConfig.selected || false}
                                        onChange={(e) => updateWeekDayField(week.id, day.key, 'selected', e.target.checked)}
                                        style={{
                                          width: 16, height: 16, accentColor: C.teal, cursor: 'pointer'
                                        }}
                                      />
                                      <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
                                        {day.label}
                                      </span>
                                    </label>
                                    
                                    <div>
                                      <input
                                        type="time"
                                        disabled={!dayConfig.selected}
                                        value={dayConfig.heure_debut ? dayConfig.heure_debut.slice(0, 5) : ''}
                                        onChange={(e) => updateWeekDayField(week.id, day.key, 'heure_debut', e.target.value)}
                                        placeholder="--:--"
                                        style={{
                                          width: '100%',
                                          padding: '6px 10px',
                                          border: '1px solid #cbd5e1',
                                          borderRadius: 6,
                                          fontSize: 13,
                                          outline: 'none',
                                          color: '#334155',
                                          opacity: dayConfig.selected ? 1 : 0.4,
                                          background: dayConfig.selected ? 'white' : '#f8fafc'
                                        }}
                                      />
                                    </div>
                                    
                                    <div>
                                      <input
                                        type="time"
                                        disabled={!dayConfig.selected}
                                        value={dayConfig.heure_fin ? dayConfig.heure_fin.slice(0, 5) : ''}
                                        onChange={(e) => updateWeekDayField(week.id, day.key, 'heure_fin', e.target.value)}
                                        placeholder="--:--"
                                        style={{
                                          width: '100%',
                                          padding: '6px 10px',
                                          border: '1px solid #cbd5e1',
                                          borderRadius: 6,
                                          fontSize: 13,
                                          outline: 'none',
                                          color: '#334155',
                                          opacity: dayConfig.selected ? 1 : 0.4,
                                          background: dayConfig.selected ? 'white' : '#f8fafc'
                                        }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {semaines.length === 0 && (
                    <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 12, color: '#64748b', fontSize: 14 }}>
                      Aucune semaine d'intervention ajoutée. Cliquez sur le bouton "Ajouter une semaine" ci-dessus pour commencer à planifier.
                    </div>
                  )}
                </div>

                {/* Notes de planification */}
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                    Notes complémentaires (optionnel)
                  </label>
                  <textarea
                    value={planningNotes}
                    onChange={(e) => setPlanningNotes(e.target.value)}
                    placeholder="Précisions sur le planning..."
                    style={{
                      width: '100%',
                      height: 70,
                      padding: '10px 14px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 500,
                      outline: 'none',
                      color: '#334155',
                      resize: 'none',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                {/* Status and Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: 16, marginTop: 8 }}>
                  {/* Checkbox "En cours" / "Terminé" */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={planningStatut === 'termine'}
                      onChange={(e) => setPlanningStatut(e.target.checked ? 'termine' : 'en_cours')}
                      style={{
                        width: 18,
                        height: 18,
                        accentColor: C.teal,
                        cursor: 'pointer'
                      }}
                    />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#475569' }}>
                      Abonnement Terminé
                    </span>
                  </label>

                  {/* Save button */}
                  <button
                    type="button"
                    onClick={handleSavePlanning}
                    disabled={savingPlanning}
                    style={{
                      padding: '10px 24px',
                      background: C.teal,
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'opacity 0.2s',
                      opacity: savingPlanning ? 0.7 : 1,
                      boxShadow: '0 2px 4px rgba(3, 114, 101, 0.15)'
                    }}
                  >
                    {savingPlanning ? 'Enregistrement...' : (
                      <>
                        <Check size={16} />
                        Enregistrer le planning
                      </>
                    )}
                  </button>
                </div>
              </div>
            )
          ) : <EmptyState text="Aucune donnée de fréquence" />}
        </Accordion>



        {/* ── 6. Historique Documents ── */}
        <Accordion title="Historique Documents" icon={<FileText size={18} />} isOpen={openSections.documents} onToggle={() => toggle('documents')} color={C.orange}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Date d'émission</Th>
                <Th>Commercial</Th>
                <Th>Segment</Th>
                <Th>Type de service</Th>
                <Th>Statut demande</Th>
                <Th center>Fichier (PNG/PDF)</Th>
              </tr></thead>
              <tbody>
                {demandes.flatMap(d => (d.documents || []).map(doc => {
                  const fileName = doc.nom || (doc.type_document === 'devis' ? 'Devis PDF' : 'Récapitulatif PNG');

                  return (
                    <tr key={doc.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <Td>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</Td>
                      <Td color="#94a3b8">{d.commercial_name || '—'}</Td>
                      <Td>
                        <Badge bg={d.segment === 'entreprise' ? C.lime : C.teal} color="white">
                          {d.segment === 'entreprise' ? 'Entreprise' : 'Particulier'}
                        </Badge>
                      </Td>
                      <Td bold color="#1e293b">{d.service}</Td>
                      <Td>
                        {renderStatusBadge(d.statut, d.cao)}
                      </Td>
                      <Td center>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                          {doc.download_url && (
                            <button
                              onClick={() => handlePreview(doc.download_url!, doc.type_document, fileName)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                              title="Voir le document"
                            >
                              <Eye size={18} />
                            </button>
                          )}
                          {doc.download_url && (
                            <button
                              onClick={() => handleDownload(doc.download_url!, fileName)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                              title="Télécharger le document"
                            >
                              <FileDown size={18} />
                            </button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                }))}
                {demandes.every(d => (d.documents || []).length === 0) && <EmptyState text="Aucun document trouvé" colSpan={6} />}
              </tbody>
            </table>
          </div>
        </Accordion>



        

        {/* ── 7. Historique des actions ── */}
        <Accordion title="Historique des actions" icon={<History size={18} />} isOpen={openSections.actionsHistory} onToggle={() => toggle('actionsHistory')} color="#6366f1" badge={actionLogs.length}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <Th>Date</Th>
                  <Th>Action</Th>
                  <Th>Détails</Th>
                  <Th>Utilisateur</Th>
                </tr>
              </thead>
              <tbody>
                {actionLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <Td>{new Date(log.created_at).toLocaleString('fr-FR', {
                       day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}</Td>
                    <Td bold color="#1e293b">{log.action}</Td>
                    <Td color="#64748b">{log.details}</Td>
                    <Td color="#64748b">{log.user_name || 'Système'}</Td>
                  </tr>
                ))}
                {actionLogs.length === 0 && <EmptyState text="Aucun historique d'action trouvé" colSpan={4} />}
              </tbody>
            </table>
          </div>
        </Accordion>

        {/* ── 8. Feedback Client ── */}
        <Accordion title="Feedback Client" icon={<Star size={18} />} isOpen={openSections.feedback} onToggle={() => toggle('feedback')} color={C.coral} badge={feedbacks.length}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Service</Th><Th>Profil</Th><Th>Date</Th><Th>Satisfaction</Th><Th>Note agence</Th><Th>Statut</Th><Th center>Action</Th>
              </tr></thead>
              <tbody>
                {feedbacks.map(f => {
                  const satisfactionLabel = getSatisfactionLabel(f.note_agence);
                  const isPositive = (f.note_agence || 0) >= 3.5;
                  
                  return (
                    <tr key={f.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <Td bold color="#1e293b">{f.service || f.mission?.demande?.service || '—'}</Td>
                      <Td bold color={C.teal}>{f.agent_name || f.mission?.agent?.full_name || '—'}</Td>
                      <Td>{new Date(f.date).toLocaleDateString('fr-FR')}</Td>
                      <Td>
                        <Badge 
                          bg={SATISFACTION_CONFIG[satisfactionLabel]?.bg} 
                          color={SATISFACTION_CONFIG[satisfactionLabel]?.text}
                        >
                          {satisfactionLabel}
                        </Badge>
                      </Td>
                      <Td>
                        <div style={{ display: 'flex', gap: 2, color: '#ECC94B' }}>
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star 
                              key={s} 
                              size={14} 
                              fill={s <= (f.note_agence || f.note || 4) ? '#ECC94B' : 'none'} 
                              stroke={s <= (f.note_agence || f.note || 4) ? '#ECC94B' : '#d1d5db'}
                              strokeWidth={1.5}
                            />
                          ))}
                        </div>
                      </Td>
                      <Td>
                        <Badge bg={isPositive ? '#F0FFF4' : '#FFF5F5'} color={isPositive ? '#2F855A' : '#C53030'}>
                          {isPositive ? 'Positif' : 'Négatif'}
                        </Badge>
                      </Td>
                      <Td center>
                        <button 
                          onClick={() => setSelectedFeedback(f)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                        >
                          <Eye size={17} />
                        </button>
                      </Td>
                    </tr>
                  );
                })}
                {feedbacks.length === 0 && <EmptyState text="Aucun feedback trouvé" colSpan={7} />}
              </tbody>
            </table>
          </div>
        </Accordion>

        {/* ── 9. Historique ── */}
        {/*
        <Accordion title="Historique" icon={<History size={18} />} isOpen={openSections.historique} onToggle={() => toggle('historique')} color={C.tan}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Utilisateur</Th><Th>Date</Th><Th>Action</Th><Th>Note</Th>
              </tr></thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                  <Td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#475569', fontSize: 14 }}>S</div>
                      <span style={{ fontWeight: 700, color: '#1e293b' }}>Système</span>
                    </div>
                  </Td>
                  <Td>{new Date(client.created_at).toLocaleString('fr-FR')}</Td>
                  <Td><Badge bg="#E6FFFA" color="#2C7A7B">Demande créée</Badge></Td>
                  <Td color="#cbd5e1">—</Td>
                </tr>
              </tbody>
            </table>
          </div>
        </Accordion>
        */}

      </div>

      {/* Unified Preview Modal */}
      {showPreviewModal && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, padding: 24
          }} 
          onClick={() => setShowPreviewModal(null)}
        >
          <div 
            style={{ 
              width: '95%', maxWidth: 1200, height: '90vh', background: 'white',
              borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0fdfa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d9488' }}>
                  <Eye size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                    Aperçu — {showPreviewModal.type === 'devis' ? 'Devis' : 'Récapitulatif'}
                  </h2>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{showPreviewModal.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPreviewModal(null)}
                style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', transition: 'color 0.2s' }}
              >
                <XCircle size={24} />
              </button>
            </div>

            <div style={{ flex: 1, background: '#1e293b', overflow: 'hidden', position: 'relative' }}>
              {showPreviewModal.type === 'devis' ? (
                <iframe src={showPreviewModal.url} style={{ width: '100%', height: '100%', border: 'none' }} title="Document" />
              ) : (
                <div style={{ width: '100%', height: '100%', overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 24, background: 'white' }}>
                  <img src={showPreviewModal.url} alt="Recap" style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                </div>
              )}
            </div>

            <div style={{ padding: '20px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button 
                onClick={() => setShowPreviewModal(null)}
                style={{ padding: '10px 20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#475569', cursor: 'pointer' }}
              >
                Fermer
              </button>
              <button 
                onClick={() => handleDownload(showPreviewModal.url, showPreviewModal.name)}
                style={{ padding: '10px 20px', background: C.teal, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Download size={18} /> Télécharger
              </button>
              <button 
                onClick={() => addToast("Fonction d'envoi en cours de développement", "info")}
                style={{ padding: '10px 20px', background: C.orange, border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Send size={18} /> Envoyer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Edit Modal */}
      {showEditModal && (
        <ClientEditModal
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            fetchData();
          }}
          initialClient={client}
        />
      )}

      {/* Demand Details Modal */}
      {showDemandDetails && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16,
        }}>
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { transform: translateY(20px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
          <div style={{
            backgroundColor: 'white',
            borderRadius: 16,
            width: '100%',
            maxWidth: 800,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            overflow: 'hidden',
            animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  Détails de la Demande #{showDemandDetails.id}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b' }}>
                  Historique de Fidélité
                </p>
              </div>
              <button
                onClick={() => setShowDemandDetails(null)}
                style={{
                  background: '#e2e8f0',
                  border: 'none',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#475569',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#cbd5e1'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 32px' }}>
                <InfoField label="RÉF COMMANDE" value={`#${showDemandDetails.id}`} />
                <InfoField label="TYPE DE SERVICE" value={showDemandDetails.service} />
                <InfoField label="TYPE D'HABITATION" value={showDemandDetails.formulaire_data?.type_habitation} />
                <InfoField label="NOMBRE D'HEURES" value={showDemandDetails.nb_heures ? `${showDemandDetails.nb_heures}h` : showDemandDetails.formulaire_data?.duree ? `${showDemandDetails.formulaire_data.duree}h` : undefined} />
                <InfoField label="TARIF" value={showDemandDetails.prix ? `${showDemandDetails.prix} MAD` : undefined} />
                <InfoField label="DATE INTERVENTION" value={showDemandDetails.date_intervention || undefined} />
                <InfoField label="HEURE INTERVENTION" value={showDemandDetails.heure_intervention || undefined} />
                <InfoField label="ADRESSE" value={showDemandDetails.client_detail?.address || client?.address} />
                <InfoField label="VILLE" value={client?.city || 'Casablanca'} />
                <InfoField label="REPÈRE / QUARTIER" value={client?.neighborhood} />
                <InfoField label="DATE CRÉATION" value={new Date(showDemandDetails.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
                <InfoField label="DERNIÈRE MODIFICATION" value={new Date(showDemandDetails.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
                <InfoField label="AVEC PRODUIT" value={showDemandDetails.avec_produit ? 'Oui' : 'Non'} />
                <InfoField label="MODE PAIEMENT" value={showDemandDetails.mode_paiement_label || showDemandDetails.mode_paiement} />
                <InfoField label="NBRE INTERVENANTS" value={showDemandDetails.formulaire_data?.nb_intervenants || 1} />
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              backgroundColor: '#f8fafc'
            }}>
              <button
                onClick={() => setShowDemandDetails(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#0f172a',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0f172a'}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Detail Modal */}
      {selectedFeedback && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={() => setSelectedFeedback(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 32, width: '100%', maxWidth: 500, position: 'relative',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedFeedback(null)} style={{
              position: 'absolute', top: 20, right: 20,
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#64748b', transition: 'all 0.15s'
            }}>
              <X size={18} />
            </button>
            
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 24px 0', paddingRight: 40 }}>
              Détail feedback — {selectedFeedback.client_name || client?.display_name || client?.full_name || 'dainne'}
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px', marginBottom: 24, fontSize: 14 }}>
              <div><span style={{ color: '#64748b' }}>Satisfaction :</span> <span style={{ fontWeight: 600, color: '#0f172a' }}>{getSatisfactionLabel(selectedFeedback.note_agence)}</span></div>
              <div><span style={{ color: '#64748b' }}>Qualité ménage :</span> <span style={{ fontWeight: 600, color: '#0f172a' }}>{getSatisfactionLabel(selectedFeedback.note_intervenant)}</span></div>
              
              <div><span style={{ color: '#64748b' }}>Professionnel :</span> <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedFeedback.note_intervenant >= 4 ? 'Bien' : selectedFeedback.note_intervenant === 3 ? 'Moyen' : 'Mauvais'}</span></div>
              <div><span style={{ color: '#64748b' }}>Recommande profil :</span> <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedFeedback.note_intervenant >= 4 ? 'Oui' : 'Non'}</span></div>
              
              <div><span style={{ color: '#64748b' }}>Recommande agence :</span> <span style={{ fontWeight: 600, color: '#0f172a' }}>{selectedFeedback.note_agence >= 4 ? 'Oui' : 'Non'}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#64748b' }}>Note agence :</span> {renderStars(selectedFeedback.note_agence)}</div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#64748b' }}>Note profil :</span> {renderStars(selectedFeedback.note_intervenant)}</div>
            </div>

            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ color: '#64748b', fontSize: 13, marginBottom: 8 }}>Commentaire</div>
              <div style={{ color: '#0f172a', fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' }}>
                {selectedFeedback.commentaire || 'Aucun commentaire fourni.'}
              </div>
            </div>

            <div style={{ color: '#64748b', fontSize: 13 }}>
              Soumis le {selectedFeedback.date ? new Date(selectedFeedback.date).toLocaleDateString('fr-FR') : '—'}
            </div>
          </div>
        </div>
      )}

      {showBlacklistConfirm && client && (
        <ConfirmDialog
          isOpen={showBlacklistConfirm}
          onOpenChange={setShowBlacklistConfirm}
          title={client.is_blacklisted ? "Déblacklister le client ?" : "Blacklister le client ?"}
          description={
            client.is_blacklisted
              ? `Voulez-vous vraiment retirer le client ${client.display_name || client.full_name || ''} de la blacklist ? Il pourra à nouveau effectuer des demandes.`
              : `Voulez-vous vraiment ajouter le client ${client.display_name || client.full_name || ''} à la blacklist ? Cela restreindra ses actions futures.`
          }
          confirmLabel={client.is_blacklisted ? "Déblacklister" : "Blacklister"}
          onConfirm={executeToggleBlacklist}
          variant={client.is_blacklisted ? "success" : "danger"}
        />
      )}

    </div>
  );
}
