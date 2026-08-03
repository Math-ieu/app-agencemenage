import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getClient, getDemandes, getFeedbacks, getClientActionLogs,
  updateDemande, deleteDemande, fetchSecureDocBlob, updateClient, savePlanning,
  createPlanningIntervention, generateDocument, sendWhatsApp
} from '../api/client';
import { decodeId, encodeId } from '../utils/obfuscation';
import {
  ChevronDown, User, FileText,
  MessageSquare, History, ArrowLeft, RefreshCw, Slash,
  Eye, Star, Clock, Heart, AlertCircle, FileDown,
  XCircle, Send, Download, CheckCircle, X, Check, Trash2, Plus, Calendar, Settings
} from 'lucide-react';
import { useToastStore } from '../store/toast';
import { checkPermission, hasPermission, hasPermissionWithClientContext } from '../utils/permissions';
import { useAuthStore } from '../store/auth';
import { Client, Demande } from '../types';
import { renderStatusBadge, renderPaymentStatusBadge } from '../utils/statusUtils';
import { normalizeFrequence } from '../utils/formNormalizers';
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
  const isEmail = label.toLowerCase() === 'email';
  return (
    <div style={{ padding: '8px 0' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontWeight: 700, color: '#1e293b', fontSize: 15, textTransform: isEmail ? 'none' : 'capitalize' }}>
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

const formatFrequencyLabel = (val?: string): string => {
  if (!val) return '';
  const s = val.toLowerCase().trim();
  const mapping: Record<string, string> = {
    '1/sem': '1 fois / semaine',
    '2/sem': '2 fois / semaine',
    '3/sem': '3 fois / semaine',
    '4/sem': '4 fois / semaine',
    '5/sem': '5 fois / semaine',
    '6/sem': '6 fois / semaine',
    '7/sem': '7 fois / semaine',
    '1/mois': '1 fois / mois',
    '2/mois': '2 fois / mois',
    '3/mois': '3 fois / mois',
    '4/mois': '4 fois / mois',
    'quotidien': 'Quotidien',
    'une fois': 'Une fois',
  };
  return mapping[s] || val;
};

const getOneMonthLater = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 29); // start date + 29 days is 30 days total
  return date.toISOString().split('T')[0];
};

const getMonday = (d: Date): Date => {
  const date = new Date(d.getTime());
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
};

const getDayOfWeekKey = (dayIndex: number): string => {
  const keys = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  return keys[dayIndex];
};

const getDayDate = (weekStartDateStr: string, dayKey: string): string => {
  if (!weekStartDateStr) return '';
  const date = new Date(weekStartDateStr);
  const offsets: Record<string, number> = {
    lundi: 0,
    mardi: 1,
    mercredi: 2,
    jeudi: 3,
    vendredi: 4,
    samedi: 5,
    dimanche: 6
  };
  const offset = offsets[dayKey] !== undefined ? offsets[dayKey] : 0;
  date.setDate(date.getDate() + offset);
  return date.toISOString().split('T')[0];
};

const getFrequencyCount = (freqLabel: string): number => {
  if (!freqLabel) return 1;
  const match = freqLabel.match(/^(\d+)\/sem/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  if (freqLabel.toLowerCase().trim() === 'quotidien') {
    return 7;
  }
  return 1;
};

const getSelectedDaysForFrequency = (
  joursIntervention: string[],
  freqCount: number,
  startDayKey: string
): string[] => {
  const daysOrder = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  let selected = [...joursIntervention].filter(d => daysOrder.includes(d));
  
  if (selected.length >= freqCount) {
    return selected.slice(0, freqCount);
  }
  
  let startIndex = daysOrder.indexOf(startDayKey);
  if (startIndex === -1) startIndex = 0;
  
  for (let i = 0; i < 7; i++) {
    const idx = (startIndex + i) % 7;
    const day = daysOrder[idx];
    if (!selected.includes(day)) {
      selected.push(day);
    }
    if (selected.length === freqCount) {
      break;
    }
  }
  return selected;
};

const calculateEndTime = (start: string, durationHours: number): string => {
  if (!start) return '';
  const [h, m] = start.split(':').map(Number);
  let endH = h + Math.floor(durationHours);
  let endM = m + Math.round((durationHours % 1) * 60);
  if (endM >= 60) {
    endH += Math.floor(endM / 60);
    endM = endM % 60;
  }
  endH = endH % 24;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

const generateWeeksForMonth = (
  startDateStr: string,
  endDateStr: string,
  joursIntervention: string[],
  heureDebut: string,
  nbHeures: number,
  frequencyLabel: string,
  monthIndex: number,
  startWeekIndex: number,
  parentDemandeId?: number
): any[] => {
  if (!startDateStr || !endDateStr) return [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  const startDayIndex = start.getDay();
  const startDayKey = getDayOfWeekKey(startDayIndex);
  
  const freqCount = getFrequencyCount(frequencyLabel);
  const selectedDays = getSelectedDaysForFrequency(joursIntervention, freqCount, startDayKey);
  
  const duration = nbHeures || 2;
  const startHour = heureDebut || '09:00';
  const endHour = calculateEndTime(startHour, duration);

  const weeks: any[] = [];
  let currentMonday = getMonday(start);
  let weekIndex = startWeekIndex;

  while (currentMonday <= end) {
    const weekDebut = currentMonday.toISOString().split('T')[0];
    const sunday = new Date(currentMonday.getTime());
    sunday.setDate(sunday.getDate() + 6);
    const weekFin = sunday.toISOString().split('T')[0];

    const jours: Record<string, any> = {};
    const daysOrder = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    
    daysOrder.forEach(dayKey => {
      const dayDateStr = getDayDate(weekDebut, dayKey);
      const dayDate = new Date(dayDateStr);
      
      const isParentDemandDay = parentDemandeId && dayDateStr === startDateStr;
      const isSelected = isParentDemandDay || (selectedDays.includes(dayKey) && dayDate >= start && dayDate <= end);
      
      jours[dayKey] = {
        selected: isSelected,
        heure_debut: isSelected ? startHour : '',
        heure_fin: isSelected ? endHour : '',
        demande_id: isParentDemandDay ? parentDemandeId : null
      };
    });

    weeks.push({
      id: Math.random().toString(36).substr(2, 9),
      label: `Semaine ${weekIndex}`,
      date_debut: weekDebut,
      date_fin: weekFin,
      termine: false,
      jours,
      mois: monthIndex
    });

    weekIndex++;
    currentMonday.setDate(currentMonday.getDate() + 7);
  }

  return weeks;
};

const generateDefaultWeeks = (
  startDateStr: string,
  endDateStr: string,
  joursIntervention: string[],
  heureDebut: string,
  nbHeures: number,
  frequencyLabel: string,
  parentDemandeId?: number
): any[] => {
  return generateWeeksForMonth(
    startDateStr,
    endDateStr,
    joursIntervention,
    heureDebut,
    nbHeures,
    frequencyLabel,
    1,
    1,
    parentDemandeId
  );
};

const getMonthDateRange = (weeks: any[]) => {
  const startDates = weeks.map(w => w.date_debut).filter(Boolean);
  const endDates = weeks.map(w => w.date_fin).filter(Boolean);
  if (startDates.length === 0) return '';
  const minStart = startDates.reduce((min, d) => d < min ? d : min, startDates[0]);
  const maxEnd = endDates.reduce((max, d) => d > max ? d : max, endDates[0]);
  
  const formatDate = (s: string) => {
    const parts = s.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return s;
  };
  return `(du ${formatDate(minStart)} au ${formatDate(maxEnd)})`;
};

const formatDateFR = (s: string) => {
  const parts = s.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return s;
};

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

  const renderNeedStatusBadge = (label: string) => {
    let bg = '#e2e8f0';
    let color = '#475569';
    const cleanLabel = (label || '').toLowerCase().trim();
    if (cleanLabel === 'nouveau besoin') {
      bg = '#e0f2fe';
      color = '#0369a1';
    } else if (cleanLabel === 'confirmé' || cleanLabel === 'confirme') {
      bg = '#dcfce7';
      color = '#15803d';
    } else if (cleanLabel === 'en attente') {
      bg = '#fef3c7';
      color = '#d97706';
    } else if (cleanLabel === 'paye' || cleanLabel === 'payé') {
      bg = '#e6f7f5';
      color = '#037265';
    } else if (cleanLabel === 'annule' || cleanLabel === 'annulé') {
      bg = '#fee2e2';
      color = '#b91c1c';
    }
    return <Badge bg={bg} color={color}>{label}</Badge>;
  };

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
  const [frequencyLabel, setFrequencyLabel] = useState('2/sem');
  const [deleteMonthConfirm, setDeleteMonthConfirm] = useState(false);
  const [monthToDelete, setMonthToDelete] = useState<number | null>(null);

  useEffect(() => {
    if (latest) {
      const ji = latest.planning?.jours_intervention || [];
      const hd = latest.planning?.heure_debut ? latest.planning.heure_debut.slice(0, 5) : (latest.heure_intervention ? latest.heure_intervention.slice(0, 5) : '09:00');
      const hf = latest.planning?.heure_fin ? latest.planning.heure_fin.slice(0, 5) : '11:00';
      const db = latest.planning?.date_debut || latest.date_intervention || '';
      const s = latest.planning?.semaines || [];
      let df = latest.planning?.date_fin || (db ? getOneMonthLater(db) : '');
      
      if (s && s.length > 0) {
        const lastWeek = s[s.length - 1];
        if (lastWeek && lastWeek.date_fin) {
          df = lastWeek.date_fin;
        }
      }

      const statut = latest.planning?.statut || 'en_cours';
      const notes = latest.planning?.notes || '';

      setJoursIntervention(ji);
      setHeureDebut(hd);
      setHeureFin(hf);
      setDateDebut(db);
      setDateFin(df);
      setPlanningStatut(statut);
      setPlanningNotes(notes);

      if (s && s.length > 0) {
        const normalized = s.map((w: any) => ({ ...w, mois: w.mois || 1 }));
        setSemaines(normalized);
        if (statut === 'en_cours') {
          checkAndAutoRenew(normalized, db, hd, ji, latest.id);
        }
      } else if (db && df) {
        const dur = Number(latest.nb_heures || latest.formulaire_data?.duree || 2);
        const fl = normalizeFrequence(latest.frequency_label) || '2/sem';
        const defaultWeeks = generateDefaultWeeks(db, df, ji, hd, dur, fl, latest.id);
        setSemaines(defaultWeeks);
        if (defaultWeeks.length > 0) {
          const lastW = defaultWeeks[defaultWeeks.length - 1];
          if (lastW && lastW.date_fin) {
            setDateFin(lastW.date_fin);
          }
        }
      } else {
        setSemaines([]);
      }
      
      setFrequencyLabel(normalizeFrequence(latest.frequency_label) || '2/sem');
    } else {
      setJoursIntervention([]);
      setHeureDebut('');
      setHeureFin('');
      setDateDebut('');
      setDateFin('');
      setPlanningStatut('en_cours');
      setPlanningNotes('');
      setSemaines([]);
      setFrequencyLabel('2/sem');
    }
  }, [latest]);

  const checkAndAutoRenew = async (
    currentWeeks: any[],
    db: string,
    hd: string,
    ji: string[],
    demandeId: number
  ) => {
    if (!currentWeeks || currentWeeks.length === 0) return;
    
    let maxMonth = 1;
    let maxDateFin = '';
    let maxWeekLabelIndex = 0;
    
    currentWeeks.forEach(w => {
      const m = w.mois || 1;
      if (m > maxMonth) maxMonth = m;
      if (w.date_fin && w.date_fin > maxDateFin) maxDateFin = w.date_fin;
      
      const match = (w.label || '').match(/Semaine\s+(\d+)/i);
      if (match) {
        const idx = parseInt(match[1], 10);
        if (idx > maxWeekLabelIndex) maxWeekLabelIndex = idx;
      }
    });
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    const weeksOfMaxMonth = currentWeeks.filter(w => (w.mois || 1) === maxMonth);
    const allWeeksCompleted = weeksOfMaxMonth.length > 0 && weeksOfMaxMonth.every(w => w.termine);
    const timeHasPassed = maxDateFin && todayStr > maxDateFin;
    
    if (allWeeksCompleted || timeHasPassed) {
      const nextMonthIndex = maxMonth + 1;
      const startWeekLabelIndex = maxWeekLabelIndex + 1;
      
      let startStr = db;
      if (maxDateFin) {
        const d = new Date(maxDateFin);
        d.setDate(d.getDate() + 1);
        startStr = d.toISOString().split('T')[0];
      }
      
      const dStart = new Date(startStr);
      const dEnd = new Date(dStart.getTime());
      dEnd.setDate(dEnd.getDate() + 29);
      const endStr = dEnd.toISOString().split('T')[0];
      
      const dur = Number(latest?.nb_heures || latest?.formulaire_data?.duree || 2);
      const fl = normalizeFrequence(latest?.frequency_label) || '2/sem';
      
      const newWeeks = generateWeeksForMonth(
        startStr,
        endStr,
        ji,
        hd,
        dur,
        fl,
        nextMonthIndex,
        startWeekLabelIndex
      );
      
      const updatedSemaines = [...currentWeeks, ...newWeeks];
      
      try {
        const fallbackHeureDebut = hd;
        const fallbackHeureFin = heureFin || '11:00';
        
        const lastNewWeek = newWeeks[newWeeks.length - 1];
        const finalEndStr = (lastNewWeek && lastNewWeek.date_fin) ? lastNewWeek.date_fin : endStr;

        const data = {
          jours_intervention: ji,
          heure_debut: fallbackHeureDebut ? (fallbackHeureDebut.length === 5 ? `${fallbackHeureDebut}:00` : fallbackHeureDebut) : null,
          heure_fin: fallbackHeureFin ? (fallbackHeureFin.length === 5 ? `${fallbackHeureFin}:00` : fallbackHeureFin) : null,
          date_debut: db,
          date_fin: finalEndStr,
          statut: 'en_cours',
          notes: planningNotes || '',
          semaines: updatedSemaines,
        };
        
        const prevWeeksCount = nextMonthIndex - 1;
        const originalMonthlyPrice = prevWeeksCount > 0 ? Number(latest?.prix || 0) / prevWeeksCount : Number(latest?.prix || 0);
        const newPrice = originalMonthlyPrice * nextMonthIndex;
        
        const updatedFormData = latest?.formulaire_data ? { ...latest.formulaire_data } : {};
        if (updatedFormData.facturation) {
          const fact = { ...updatedFormData.facturation };
          const tva_active = !!fact.tva_active;
          fact.montant_ttc = newPrice;
          fact.montant_ht = tva_active ? Math.round((newPrice / 1.2) * 100) / 100 : newPrice;
          fact.montant = newPrice;
          updatedFormData.facturation = fact;
        }

        await Promise.all([
          savePlanning(demandeId, data),
          updateDemande(demandeId, { 
            frequency_label: fl,
            prix: newPrice,
            formulaire_data: updatedFormData
          })
        ]);
        
        setSemaines(updatedSemaines);
        setDateFin(finalEndStr);
        
        addToast(`Renouvellement automatique : Le Mois ${nextMonthIndex} a été planifié automatiquement (du ${formatDateFR(startStr)} au ${formatDateFR(finalEndStr)}).`, "info");
        
        // Auto-generate invoice and send it to client
        try {
          addToast(`Génération automatique de la facture pour le Mois ${nextMonthIndex}...`, "info");
          await generateDocument(demandeId, 'facture', nextMonthIndex);
          
          addToast(`Envoi de la facture au commercial via WhatsApp...`, "info");
          const res = await sendWhatsApp(demandeId, 'facture', undefined, undefined, nextMonthIndex);
          addToast(res.data?.message || `Facture du Mois ${nextMonthIndex} envoyée au commercial responsable pour transfert.`, "success");
        } catch (invoiceErr) {
          console.error("Failed to auto-generate or send invoice during renew:", invoiceErr);
        }
      } catch (err) {
        console.error("Failed to auto-renew planning:", err);
      }
    }
  };

  const handleAddMonth = () => {
    if (!latest) return;
    let maxMonth = 0;
    let maxDateFin = '';
    let maxWeekLabelIndex = 0;
    
    semaines.forEach(w => {
      const m = w.mois || 1;
      if (m > maxMonth) maxMonth = m;
      if (w.date_fin && w.date_fin > maxDateFin) maxDateFin = w.date_fin;
      
      const match = (w.label || '').match(/Semaine\s+(\d+)/i);
      if (match) {
        const idx = parseInt(match[1], 10);
        if (idx > maxWeekLabelIndex) maxWeekLabelIndex = idx;
      }
    });
    
    const nextMonthIndex = maxMonth + 1;
    const startWeekLabelIndex = maxWeekLabelIndex + 1;
    
    let startStr = dateDebut;
    if (maxDateFin) {
      const d = new Date(maxDateFin);
      d.setDate(d.getDate() + 1);
      startStr = d.toISOString().split('T')[0];
    }
    
    if (!startStr) {
      addToast("Veuillez définir une date de début pour l'abonnement d'abord.", "error");
      return;
    }
    
    const dStart = new Date(startStr);
    const dEnd = new Date(dStart.getTime());
    dEnd.setDate(dEnd.getDate() + 29);
    const endStr = dEnd.toISOString().split('T')[0];
    
    const dur = Number(latest?.nb_heures || latest?.formulaire_data?.duree || 2);
    const newWeeks = generateWeeksForMonth(
      startStr,
      endStr,
      joursIntervention,
      heureDebut,
      dur,
      frequencyLabel,
      nextMonthIndex,
      startWeekLabelIndex
    );
    
    const lastNewWeek = newWeeks[newWeeks.length - 1];
    const finalEndStr = (lastNewWeek && lastNewWeek.date_fin) ? lastNewWeek.date_fin : endStr;
    
    setSemaines([...semaines, ...newWeeks]);
    setDateFin(finalEndStr);
    
    if (newWeeks.length > 0) {
      setOpenWeekIds([...openWeekIds, newWeeks[0].id]);
    }
    
    addToast(`Mois ${nextMonthIndex} ajouté avec succès (du ${formatDateFR(startStr)} au ${formatDateFR(finalEndStr)}). N'oubliez pas d'enregistrer le planning !`, "success");
  };

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

      // --- CALCUL DU NOUVEAU PRIX CUMULE & DES INFOS DE FACTURATION ---
      let newPrice = Number(latest.prix || 0);
      let prevMaxMonth = 0;
      let maxMonth = 1;
      
      const prevWeeks = latest.planning?.semaines || [];
      prevWeeks.forEach((w: any) => {
        if (w.mois && w.mois > prevMaxMonth) {
          prevMaxMonth = w.mois;
        }
      });
      if (prevMaxMonth === 0 && prevWeeks.length > 0) {
        prevMaxMonth = 1;
      }
      
      semaines.forEach(w => {
        if (w.mois && w.mois > maxMonth) {
          maxMonth = w.mois;
        }
      });
      
      const originalMonthlyPrice = prevMaxMonth > 0
        ? Number(latest.prix || 0) / prevMaxMonth
        : Number(latest.prix || 0);
        
      newPrice = originalMonthlyPrice * maxMonth;

      // Update formulaire_data.facturation if present
      const updatedFormData = latest.formulaire_data ? { ...latest.formulaire_data } : {};
      if (updatedFormData.facturation) {
        const fact = { ...updatedFormData.facturation };
        const tva_active = !!fact.tva_active;
        fact.montant_ttc = newPrice;
        fact.montant_ht = tva_active ? Math.round((newPrice / 1.2) * 100) / 100 : newPrice;
        fact.montant = newPrice;
        updatedFormData.facturation = fact;
      }

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
        updateDemande(latest.id, { 
          frequency_label: frequencyLabel,
          prix: newPrice,
          formulaire_data: updatedFormData
        })
      ]);
      
      addToast("Planning d'abonnement mis à jour avec succès", 'success');
      
      // If a new month was registered, automatically generate and send invoice!
      if (maxMonth > prevMaxMonth && prevMaxMonth > 0) {
        try {
          addToast(`Génération automatique de la facture pour le Mois ${maxMonth}...`, "info");
          await generateDocument(latest.id, 'facture', maxMonth);
          
          addToast(`Envoi de la facture au commercial via WhatsApp...`, "info");
          const res = await sendWhatsApp(latest.id, 'facture', undefined, undefined, maxMonth);
          addToast(res.data?.message || `Facture du Mois ${maxMonth} envoyée au commercial responsable pour transfert.`, "success");
        } catch (err) {
          console.error("Failed to auto-generate or send invoice:", err);
          addToast("Erreur lors de la génération ou de l'envoi automatique de la facture", "error");
        }
      }
      
      await fetchData();
    } catch (err) {
      console.error(err);
      addToast("Erreur lors de l'enregistrement", 'error');
    } finally {
      setSavingPlanning(false);
    }
  };

  const handleGenerateInvoice = async (demandeId: number) => {
    try {
      addToast("Génération de la facture en cours...", "info");
      await generateDocument(demandeId, 'facture');
      addToast("Facture générée avec succès", "success");
      await fetchData();
    } catch (err) {
      console.error("Erreur génération facture:", err);
      addToast("Erreur lors de la génération de la facture", "error");
    }
  };

  const handleDownloadInvoice = async (demandeId: number) => {
    try {
      addToast("Préparation du téléchargement de la facture...", "info");
      const res = await generateDocument(demandeId, 'facture');
      const filename = res.data?.filename || res.data?.pdf_file || `facture_${demandeId}.pdf`;
      const blob = await fetchSecureDocBlob(filename);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      addToast("Téléchargement de la facture démarré", "success");
    } catch (err) {
      console.error("Erreur téléchargement facture:", err);
      addToast("Erreur lors du téléchargement de la facture", "error");
    }
  };

  const handleCreatePlanningIntervention = async (
    weekId: string,
    dayKey: string,
    dayDateStr: string,
    timeStr: string
  ) => {
    if (!latest) return;
    try {
      const res = await createPlanningIntervention(latest.id, {
        date: dayDateStr,
        time: timeStr || '09:00',
        week_id: weekId,
        day_key: dayKey
      });
      addToast("Intervention créée avec succès.", "success");
      if (res.data && res.data.planning && res.data.planning.semaines) {
        setSemaines(res.data.planning.semaines);
      }
      await fetchData();
    } catch (err: any) {
      console.error(err);
      addToast("Erreur lors de la création de l'intervention.", "error");
    }
  };

  const renderPaymentStatus = (demande: any) => {
    const facturation = demande.formulaire_data?.facturation || {};
    let rawStatutPaiementUi = facturation.statut_paiement_ui;
    
    if (facturation.facturation_annulee === true) {
      rawStatutPaiementUi = 'facturation_annulee';
    } else if (demande.statut === 'annule') {
      rawStatutPaiementUi = 'intervention_annulee';
    } else if (demande.cao === 'reporte') {
      rawStatutPaiementUi = 'reporte';
    } else if (!rawStatutPaiementUi) {
      rawStatutPaiementUi = (demande.statut_paiement === 'integral' ? 'paye' : demande.statut_paiement === 'acompte' ? 'paiement_en_attente' : demande.statut_paiement === 'partiel' ? 'paiement_partiel' : 'non_paye');
    }
    
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

  const handleAddWeekToMonth = (monthIndex: number) => {
    if (!latest) return;
    
    const monthWeeks = semaines.filter(w => (w.mois || 1) === monthIndex);
    let defaultStart = '';
    let defaultEnd = '';
    
    if (monthWeeks.length > 0) {
      // Find the last week's end date in this month
      const lastWeekOfThisMonth = monthWeeks.reduce((last, w) => {
        if (!last.date_fin) return w;
        if (!w.date_fin) return last;
        return w.date_fin > last.date_fin ? w : last;
      }, monthWeeks[0]);
      
      if (lastWeekOfThisMonth.date_fin) {
        const d = new Date(lastWeekOfThisMonth.date_fin);
        d.setDate(d.getDate() + 1);
        defaultStart = d.toISOString().split('T')[0];
        
        const dEnd = new Date(d.getTime());
        dEnd.setDate(dEnd.getDate() + 6);
        defaultEnd = dEnd.toISOString().split('T')[0];
      }
    } else {
      // If the month is empty, let's determine start date from previous month or dateDebut
      let prevMaxDateFin = '';
      semaines.forEach(w => {
        if ((w.mois || 1) < monthIndex && w.date_fin && w.date_fin > prevMaxDateFin) {
          prevMaxDateFin = w.date_fin;
        }
      });
      
      if (prevMaxDateFin) {
        const d = new Date(prevMaxDateFin);
        d.setDate(d.getDate() + 1);
        defaultStart = d.toISOString().split('T')[0];
      } else {
        defaultStart = dateDebut;
      }
      
      if (defaultStart) {
        const d = new Date(defaultStart);
        const dEnd = new Date(d.getTime());
        dEnd.setDate(dEnd.getDate() + 6);
        defaultEnd = dEnd.toISOString().split('T')[0];
      }
    }

    let newWeek: any;
    if (defaultStart && defaultEnd) {
      const dur = Number(latest?.nb_heures || latest?.formulaire_data?.duree || 2);
      const fl = normalizeFrequence(latest?.frequency_label) || '2/sem';
      const weeksGenerated = generateWeeksForMonth(
        defaultStart,
        defaultEnd,
        joursIntervention,
        heureDebut,
        dur,
        fl,
        monthIndex,
        1
      );
      if (weeksGenerated.length > 0) {
        newWeek = weeksGenerated[0];
      }
    }
    
    // Fallback if weeks generation didn't yield a week or dates weren't available
    if (!newWeek) {
      const newId = Math.random().toString(36).substr(2, 9);
      newWeek = {
        id: newId,
        label: `Semaine`,
        date_debut: defaultStart || '',
        date_fin: defaultEnd || '',
        termine: false,
        mois: monthIndex,
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
    }

    // Insert the week right after the last week of this month.
    const newSemaines: any[] = [];
    let inserted = false;
    
    semaines.forEach(w => {
      newSemaines.push(w);
      if (monthWeeks.length > 0 && w.id === monthWeeks[monthWeeks.length - 1].id) {
        newSemaines.push(newWeek);
        inserted = true;
      }
    });
    
    if (!inserted) {
      let insertIdx = 0;
      for (let i = 0; i < semaines.length; i++) {
        if ((semaines[i].mois || 1) <= monthIndex) {
          insertIdx = i + 1;
        }
      }
      newSemaines.splice(insertIdx, 0, newWeek);
    }
    
    const reindexedSemaines = newSemaines.map((w, idx) => ({
      ...w,
      label: `Semaine ${idx + 1}`
    }));
    
    setSemaines(reindexedSemaines);
    setOpenWeekIds([...openWeekIds, newWeek.id]);
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

  const handleRequestDeleteMonth = (monthIndex: number) => {
    setMonthToDelete(monthIndex);
    setDeleteMonthConfirm(true);
  };

  const executeDeleteMonth = async () => {
    if (monthToDelete === null || !latest) return;

    const targetMonth = monthToDelete;

    // 1. Identify demands to delete and demands to reindex
    const demandsToDelete = demandes.filter(
      d => Number(d.parent_demande) === Number(latest.id) && d.formulaire_data?.subscription_month === targetMonth
    );
    const demandsToReindex = demandes.filter(
      d => Number(d.parent_demande) === Number(latest.id) && d.formulaire_data?.subscription_month && d.formulaire_data.subscription_month > targetMonth
    );

    // 2. Update local state immediately for snappy UI
    setDemandes(prev => {
      const afterDelete = prev.filter(
        d => !(Number(d.parent_demande) === Number(latest.id) && d.formulaire_data?.subscription_month === targetMonth)
      );
      return afterDelete.map(d => {
        if (Number(d.parent_demande) === Number(latest.id) && d.formulaire_data?.subscription_month && d.formulaire_data.subscription_month > targetMonth) {
          return {
            ...d,
            formulaire_data: {
              ...d.formulaire_data,
              subscription_month: d.formulaire_data.subscription_month - 1
            }
          };
        }
        return d;
      });
    });

    const filteredSemaines = semaines.filter(w => (w.mois || 1) !== targetMonth);
    
    // Shift subsequent month indices in semaines state
    const normalizedSemaines = filteredSemaines.map(w => {
      const m = w.mois || 1;
      if (m > targetMonth) {
        return { ...w, mois: m - 1 };
      }
      return w;
    });

    const reindexedSemaines = normalizedSemaines.map((w, idx) => ({
      ...w,
      label: `Semaine ${idx + 1}`
    }));

    let newDateFin = dateDebut;
    if (reindexedSemaines.length > 0) {
      const maxDateFin = reindexedSemaines.reduce((max, w) => {
        if (!max) return w.date_fin || '';
        if (!w.date_fin) return max;
        return w.date_fin > max ? w.date_fin : max;
      }, '');
      if (maxDateFin) {
        newDateFin = maxDateFin;
      }
    }

    setSemaines(reindexedSemaines);
    setDateFin(newDateFin);
    setDeleteMonthConfirm(false);
    setMonthToDelete(null);

    // 3. Make API calls to sync with backend
    try {
      // Delete demands of the deleted month
      await Promise.all(demandsToDelete.map(d => deleteDemande(d.id)));

      // Reindex subsequent months
      await Promise.all(demandsToReindex.map(d => {
        const currentMonth = d.formulaire_data?.subscription_month || 1;
        return updateDemande(d.id, {
          formulaire_data: {
            ...(d.formulaire_data || {}),
            subscription_month: currentMonth - 1
          }
        });
      }));

      addToast(`Le Mois ${targetMonth} a été supprimé ainsi que toutes ses interventions avec succès. N'oubliez pas d'enregistrer le planning !`, "success");
    } catch (error) {
      console.error("Failed to delete or reindex demands on month deletion:", error);
      addToast("Erreur lors de la suppression des interventions du mois sur le serveur", "error");
    }
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
        const dayDateStr = getDayDate(w.date_debut, day);
        const assocD = joursCopy[day]?.demande_id 
          ? demandes.find(d => d.id === joursCopy[day].demande_id)
          : (latest ? demandes.find(d => d.parent_demande === latest.id && d.date_intervention === dayDateStr) : null);
        if (assocD && ['pres_terminee', 'termine', 'annule'].includes(assocD.statut)) {
          return w;
        }

        if (field === 'selected' && value === false) {
          joursCopy[day] = {
            selected: false,
            heure_debut: '',
            heure_fin: '',
            demande_id: null
          };
        } else if (field === 'selected' && value === true) {
          const duration = Number(latest?.nb_heures || latest?.formulaire_data?.duree || 2);
          const startH = heureDebut || '09:00';
          const endH = calculateEndTime(startH, duration);
          joursCopy[day] = {
            ...joursCopy[day],
            selected: true,
            heure_debut: joursCopy[day]?.heure_debut || startH,
            heure_fin: joursCopy[day]?.heure_fin || endH
          };
        } else if (field === 'heure_debut') {
          const duration = Number(latest?.nb_heures || latest?.formulaire_data?.duree || 2);
          const endH = calculateEndTime(value, duration);
          joursCopy[day] = {
            ...joursCopy[day],
            heure_debut: value,
            heure_fin: endH
          };
        } else {
          joursCopy[day] = { ...joursCopy[day], [field]: value };
        }
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
        getDemandes({ client: realId.toString(), no_page: 'true' }).catch(err => {
          console.warn('Error fetching client demands:', err);
          return { data: [] };
        }),
        getFeedbacks({ client: realId.toString() }).catch(err => {
          console.warn('Error fetching client feedbacks:', err);
          return { data: [] };
        }),
        getClientActionLogs(realId).catch(err => {
          console.warn('Error fetching client action logs:', err);
          return { data: [] };
        }),
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

  const getMostRecentSubDemande = (d: any) => {
    if (d.frequency !== 'abonnement') return d;
    const parentId = d.parent_demande || d.id;
    const subDemands = demandes.filter(x => x.id === parentId || x.parent_demande === parentId);
    if (subDemands.length === 0) return d;

    const parseFrenchDate = (value?: string): Date | null => {
      if (!value) return null;
      if (value.includes('-')) {
        const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }
      const [day, month, year] = value.split('/');
      if (!year || !month || !day) return null;
      const parsed = new Date(`${year}-${month}-${day}T00:00:00`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const sorted = [...subDemands].sort((a, b) => {
      const dateA = parseFrenchDate(a.date_intervention || a.formulaire_data?.date_intervention || a.created_at)?.getTime() || 0;
      const dateB = parseFrenchDate(b.date_intervention || b.formulaire_data?.date_intervention || b.created_at)?.getTime() || 0;
      return dateB - dateA;
    });

    return sorted[0] || d;
  };

  const getSubscriptionProfiles = (d: any) => {
    if (d.frequency !== 'abonnement') {
      return (d.profils_envoyes || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        ranks: []
      }));
    }

    const parentId = d.parent_demande || d.id;
    const subDemands = demandes
      .filter(x => x.id === parentId || x.parent_demande === parentId)
      .sort((a, b) => {
        const dateA = a.date_intervention || a.created_at;
        const dateB = b.date_intervention || b.created_at;
        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;
        return 0;
      });

    const profilesMap = new Map<number, any>();

    subDemands.forEach((sd, idx) => {
      const rank = idx + 1;
      const env = sd.profils_envoyes || [];
      env.forEach((p: any) => {
        if (!p.id) return;
        const pId = Number(p.id);
        if (!profilesMap.has(pId)) {
          profilesMap.set(pId, {
            id: pId,
            full_name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
            ranks: []
          });
        }
        profilesMap.get(pId)!.ranks.push(rank);
      });
    });

    return Array.from(profilesMap.values());
  };

  const parentDemandes = useMemo(() => demandes.filter(d => !d.parent_demande), [demandes]);

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

  const getInterventionLabel = (d: any) => {
    if (d.frequency !== 'abonnement') {
      return "Intervention une fois";
    }
    const parentId = d.parent_demande || d.id;
    const subDemands = demandes
      .filter(x => x.frequency === 'abonnement' && (x.id === parentId || x.parent_demande === parentId))
      .sort((a, b) => {
        const dateA = a.date_intervention || a.created_at;
        const dateB = b.date_intervention || b.created_at;
        if (dateA < dateB) return -1;
        if (dateA > dateB) return 1;
        return 0;
      });
    const index = subDemands.findIndex(x => x.id === d.id);
    if (index === -1) {
      return "Intervention abonnement";
    }
    const rank = index + 1;
    if (rank === 1) {
      return "1ère intervention";
    }
    return `${rank}ème intervention`;
  };



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
                  {demandes[0] && renderStatusBadge(demandes[0].statut, demandes[0].cao)}
                  {demandes[0] && demandes[0].statut_besoin_label && renderNeedStatusBadge(demandes[0].statut_besoin_label)}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10 }} className="flex-wrap">
            {hasPermissionWithClientContext(user, client, demandes) && (
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
            <InfoField label="EMAIL" value={client.email ? client.email.toLowerCase() : ''} />
            <InfoField label="VILLE" value={client.city || 'Casablanca'} />
            <InfoField label="QUARTIER" value={client.neighborhood} />
            <InfoField label="ADRESSE" value={client.address} />
          </div>
        </Accordion>

        {/* ── 2. Historique Fidélité ── */}
        <Accordion title="Historique Fidélité" icon={<Heart size={18} />} isOpen={openSections.fidelite} onToggle={() => toggle('fidelite')} color={C.coral} badge={parentDemandes.length}>
          {parentDemandes.length === 0 ? <EmptyState text="Aucune demande trouvée." /> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <Th>Date</Th><Th>Nom du service</Th><Th>Intervention</Th><Th>Profils proposés</Th><Th>Segment</Th><Th>Statut</Th><Th>Paiement</Th><Th center>Actions</Th>
                </tr></thead>
                <tbody>
                  {parentDemandes.map(d => {
                    const latestD = getMostRecentSubDemande(d);
                    return (
                      <React.Fragment key={d.id}>
                        <tr style={{ borderBottom: '1px solid #f8fafc' }}>
                          <Td>{new Date(d.created_at).toLocaleDateString('fr-FR')}</Td>
                          <Td bold color="#1e293b">{d.service}</Td>
                          <Td>{d.frequency === 'abonnement' ? '—' : getInterventionLabel(d)}</Td>
                          <Td>
                            {(() => {
                              const subProfs = getSubscriptionProfiles(d);
                              if (subProfs.length > 0) {
                                return (
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                    {subProfs.map((p: any) => (
                                      <div key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <Link 
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
                                          {p.full_name}
                                        </Link>
                                        {p.ranks.map((r: number) => (
                                          <span 
                                            key={r}
                                            style={{
                                              padding: '1px 5px',
                                              backgroundColor: C.teal,
                                              color: 'white',
                                              borderRadius: 4,
                                              fontSize: 9,
                                              fontWeight: 'bold',
                                              lineHeight: 1
                                            }}
                                          >
                                            {r}
                                          </span>
                                        ))}
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              return <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>;
                            })()}
                          </Td>
                          <Td>
                            <Badge bg={d.segment === 'entreprise' ? C.lime : C.teal} color="white">
                              {d.segment === 'entreprise' ? 'Entreprise' : 'Particulier'}
                            </Badge>
                          </Td>
                          <Td>
                            {renderStatusBadge(latestD.statut, latestD.cao)}
                          </Td>
                          <Td>
                            {renderPaymentStatus(latestD)}
                          </Td>
                        <Td center>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                            <button 
                              onClick={() => navigate('/demandes', { state: { renewDemandeId: d.id, returnToClient: id } })}
                              disabled={d.frequency === 'abonnement'}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 6, 
                                color: d.frequency === 'abonnement' ? '#cbd5e1' : '#475569', 
                                fontWeight: 600, 
                                fontSize: 13, 
                                background: 'none', 
                                border: 'none', 
                                cursor: d.frequency === 'abonnement' ? 'not-allowed' : 'pointer' 
                              }}
                            >
                              <RefreshCw size={15} color={d.frequency === 'abonnement' ? '#cbd5e1' : C.teal} /> Renouveler
                            </button>
                            {d.frequency === 'abonnement' && (
                              <button 
                                onClick={() => navigate('/demandes', { state: { renewDemandeId: d.id, returnToClient: id } })}
                                disabled
                                style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: 6, 
                                  color: '#cbd5e1', 
                                  fontWeight: 600, 
                                  fontSize: 13, 
                                  background: 'none', 
                                  border: 'none', 
                                  cursor: 'not-allowed' 
                                }}
                              >
                                <RefreshCw size={15} color="#cbd5e1" /> Abonnement
                              </button>
                            )}
                            {(() => {
                              const devisDoc = d.documents?.find(doc => doc.type_document === 'devis') || null;
                              const isAbonnement = d.frequency === 'abonnement';
                              return (
                                <>
                                  <button 
                                    onClick={() => setShowDemandDetails(d)}
                                    disabled={isAbonnement}
                                    style={{ 
                                      background: 'none', 
                                      border: 'none', 
                                      cursor: isAbonnement ? 'not-allowed' : 'pointer', 
                                      color: isAbonnement ? '#cbd5e1' : '#64748b' 
                                    }}
                                    title={isAbonnement ? "Non disponible pour les abonnements" : "Détails du besoin actuel"}
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
                                    disabled={isAbonnement || !devisDoc}
                                    style={{ 
                                      background: 'none', 
                                      border: 'none', 
                                      cursor: (isAbonnement || !devisDoc) ? 'not-allowed' : 'pointer', 
                                      color: (isAbonnement || !devisDoc) ? '#cbd5e1' : '#64748b', 
                                      opacity: devisDoc ? 1 : 0.4 
                                    }}
                                    title={isAbonnement ? "Non disponible pour les abonnements" : (devisDoc ? "Télécharger le devis" : "Aucun devis disponible")}
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
                    );
                  })}
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

        {/* ── 4. Type de Fréquence / Gestion de l'abonnement ── */}
        <Accordion title="Gestion de l'abonnement" icon={<Clock size={18} />} isOpen={openSections.frequence} onToggle={() => toggle('frequence')} color={C.sage}>
          {latest ? (
            latest.frequency === 'oneshot' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ padding: '6px 16px', border: '1px solid #e2e8f0', borderRadius: 99, fontSize: 14, fontWeight: 700, color: '#475569', background: 'white' }}>
                    {formatFrequencyLabel(latest.frequency_label) || latest.frequency || 'Une fois'}
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
              <SubscriptionManagementView
                latest={latest}
                client={client}
                demandes={demandes}
                navigate={navigate}
                handleGenerateInvoice={handleGenerateInvoice}
                handleDownloadInvoice={handleDownloadInvoice}
                handleSavePlanning={handleSavePlanning}
                savingPlanning={savingPlanning}
                dateDebut={dateDebut}
                setDateDebut={setDateDebut}
                dateFin={dateFin}
                setDateFin={setDateFin}
                frequencyLabel={frequencyLabel}
                setFrequencyLabel={setFrequencyLabel}
                planningStatut={planningStatut}
                setPlanningStatut={setPlanningStatut}
                planningNotes={planningNotes}
                setPlanningNotes={setPlanningNotes}
                addToast={addToast}
                fetchData={fetchData}
              />
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

      {deleteMonthConfirm && monthToDelete !== null && (
        <ConfirmDialog
          isOpen={deleteMonthConfirm}
          onOpenChange={setDeleteMonthConfirm}
          title={`Supprimer le Mois ${monthToDelete} ?`}
          description={`Voulez-vous vraiment supprimer le Mois ${monthToDelete} de la planification ? Toutes les semaines d'intervention rattachées à ce mois seront supprimées définitivement. Les mois restants suivants seront ré-indexés.`}
          confirmLabel="Supprimer le mois"
          onConfirm={executeDeleteMonth}
          variant="danger"
        />
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

/* ═══════════════════════════════════════════════════════════
   SubscriptionManagementView Component (Matching User Screenshots)
   ═══════════════════════════════════════════════════════════ */
function SubscriptionManagementView({
  latest,
  client,
  demandes,
  navigate,
  handleGenerateInvoice,
  handleDownloadInvoice,
  handleSavePlanning,
  savingPlanning,
  dateDebut,
  setDateDebut,
  dateFin,
  setDateFin,
  frequencyLabel,
  setFrequencyLabel,
  planningStatut,
  setPlanningStatut,
  planningNotes,
  setPlanningNotes,
  addToast,
  fetchData
}: any) {
  if (!latest) return null;

  const [activeMonthTab, setActiveMonthTab] = useState<'mois1' | 'mois2'>('mois1');
  const [monthTabs, setMonthTabs] = useState([{ id: 'mois1', label: 'Mois 1' }]);

  const [activeCalendarDate, setActiveCalendarDate] = useState(() => new Date());
  const [statutAbonnement, setStatutAbonnement] = useState('Actif');

  const [selectedDays, setSelectedDays] = useState<string[]>(() => {
    const rawJours = latest?.formulaire_data?.jours_intervention || latest?.planning?.jours_intervention || [];
    if (rawJours.length > 0) return rawJours;
    const freq = frequencyLabel || latest?.frequency_label || '';
    if (freq.includes('3')) return ['lundi', 'mercredi', 'vendredi'];
    if (freq.includes('2')) return ['lundi', 'jeudi'];
    return ['lundi', 'mercredi', 'vendredi'];
  });

  const [dayTimes, setDayTimes] = useState<Record<string, { start: string; end: string }>>({
    lundi: { start: '', end: '' },
    jeudi: { start: '', end: '' },
    mercredi: { start: '', end: '' },
    vendredi: { start: '', end: '' }
  });

  const [prorataInvoice, setProrataInvoice] = useState(false);

  const [selectedCellDate, setSelectedCellDate] = useState<string | null>(null);
  const [popoverStart, setPopoverStart] = useState('');
  const [popoverEnd, setPopoverEnd] = useState('');

  const childDemandes = useMemo(() => {
    if (!demandes || !Array.isArray(demandes) || !latest?.id) return [];
    return demandes.filter((d: Demande) => {
      if (!d) return false;
      const isParentMatch = d.parent_demande && Number(d.parent_demande) === Number(latest.id);
      const isClientMatch = client?.id && Number(d.client) === Number(client.id);
      return (isParentMatch || (isClientMatch && !!d.parent_demande)) && !!d.date_intervention;
    });
  }, [demandes, latest?.id, client?.id]);

  const handleSetCellStatus = async (dayIso: string, newStatut: string) => {
    if (!latest) return;
    try {
      const existing = childDemandes.find((d: Demande) => {
        if (!d.date_intervention) return false;
        const dDate = d.date_intervention.includes('T') ? d.date_intervention.split('T')[0] : d.date_intervention.slice(0, 10);
        return dDate === dayIso;
      });

      if (existing) {
        if (newStatut === 'retirer') {
          await deleteDemande(existing.id);
          addToast("Intervention retirée", "info");
        } else {
          await updateDemande(existing.id, {
            statut: newStatut,
            heure_intervention: popoverStart || '09:00'
          });
          addToast("Statut mis à jour", "success");
        }
      } else if (newStatut !== 'retirer') {
        await createPlanningIntervention(latest.id, {
          date: dayIso,
          time: popoverStart || '09:00',
          week_id: 'w1',
          day_key: 'day'
        });
        addToast("Intervention créée", "success");
      }
      setSelectedCellDate(null);
      if (fetchData) await fetchData();
    } catch (err) {
      console.error("Erreur statut intervention:", err);
      addToast("Erreur lors de la mise à jour de l'intervention", "error");
    }
  };

  const nextIntervention = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const upcoming = childDemandes
      .filter((d: Demande) => d.date_intervention && d.date_intervention >= todayStr && !['annule', 'annulee'].includes((d.statut || '').toLowerCase()))
      .sort((a: Demande, b: Demande) => (a.date_intervention || '').localeCompare(b.date_intervention || ''));
    return upcoming[0];
  }, [childDemandes]);

  const year = activeCalendarDate.getFullYear();
  const month = activeCalendarDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthIsoPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthTitle = activeCalendarDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const capitalizedMonthTitle = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const prevMonthLastDate = new Date(year, month, 0).getDate();
  const prevMonthDays = Array.from({ length: firstDayOfWeek }, (_, i) => prevMonthLastDate - firstDayOfWeek + 1 + i);

  const toggleDay = (dayKey: string) => {
    setSelectedDays(prev =>
      prev.includes(dayKey) ? prev.filter(d => d !== dayKey) : [...prev, dayKey]
    );
  };

  const handleCellClick = (dayIso: string) => {
    const existing = childDemandes.find((d: Demande) => {
      if (!d.date_intervention) return false;
      const dDate = d.date_intervention.includes('T') ? d.date_intervention.split('T')[0] : d.date_intervention.slice(0, 10);
      return dDate === dayIso;
    });
    setSelectedCellDate(dayIso);
    if (existing) {
      setPopoverStart(existing.heure_intervention || '');
      setPopoverEnd('');
    } else {
      setPopoverStart('');
      setPopoverEnd('');
    }
  };

  const handleAddNextMonthTab = () => {
    if (monthTabs.length < 2) {
      setMonthTabs([...monthTabs, { id: 'mois2', label: 'Mois 2' }]);
      setActiveMonthTab('mois2');
    }
  };

  const handleRemoveMonthTab = (id: string) => {
    setMonthTabs(monthTabs.filter(t => t.id !== id));
    setActiveMonthTab('mois1');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'inherit' }}>
      {/* ── Top Header Navigation Bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#dcfce7', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px' }}>
        <button
          type="button"
          onClick={() => navigate('/abonnements')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700, color: '#1e293b', cursor: 'pointer' }}
        >
          <ArrowLeft size={16} /> Retour à Gestion Abonnement
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {monthTabs.map(tab => (
            <div key={tab.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: activeMonthTab === tab.id ? '#ffffff' : '#f1f5f9', border: activeMonthTab === tab.id ? '2px solid #037265' : '1px solid #cbd5e1', borderRadius: 8, padding: '4px 10px' }}>
              <button
                type="button"
                onClick={() => setActiveMonthTab(tab.id as any)}
                style={{ background: 'none', border: 'none', fontWeight: 700, fontSize: 13, color: activeMonthTab === tab.id ? '#037265' : '#64748b', cursor: 'pointer' }}
              >
                {tab.label}
              </button>
              {tab.id !== 'mois1' && (
                <button type="button" onClick={() => handleRemoveMonthTab(tab.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}>
                  <X size={14} />
                </button>
              )}
            </div>
          ))}

          {monthTabs.length < 2 && (
            <button
              type="button"
              onClick={handleAddNextMonthTab}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700, color: '#037265', cursor: 'pointer' }}
            >
              <RefreshCw size={14} /> Activer le mois prochain
            </button>
          )}
        </div>
      </div>

      {/* ── Status & Action Bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>STATUT ABONNEMENT</span>
          <select
            value={statutAbonnement}
            onChange={e => setStatutAbonnement(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#0f172a', background: 'white', outline: 'none' }}
          >
            <option value="Actif">Actif</option>
            <option value="Suspendu">Suspendu</option>
            <option value="Terminé">Terminé</option>
            <option value="En attente">En attente</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => handleGenerateInvoice(latest.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
            <FileText size={15} /> Générer facture
          </button>
          <button type="button" onClick={() => handleDownloadInvoice(latest.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
            <FileDown size={15} /> Formulaire facture
          </button>
          <button 
            type="button" 
            onClick={async () => {
              if (!latest?.id) return;
              try {
                addToast("Envoi de la facture via WhatsApp...", "info");
                const res = await sendWhatsApp(latest.id, 'facture');
                addToast(res.data?.message || "Facture envoyée avec succès.", "success");
              } catch (err) {
                console.error(err);
                addToast("Erreur lors de l'envoi de la facture.", "error");
              }
            }} 
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}
          >
            <Send size={15} /> Envoyer facture
          </button>
          <button type="button" onClick={handleSavePlanning} disabled={savingPlanning} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#034a3e', border: 'none', borderRadius: 8, padding: '7px 18px', fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer' }}>
            <Check size={16} /> Enregistrer
          </button>
        </div>
      </div>

      {/* ── Dark Teal KPI Banner ── */}
      <div style={{ background: '#034a3e', borderRadius: 12, padding: '1.25rem 1.5rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <span style={{ display: 'inline-block', background: 'rgba(255, 255, 255, 0.2)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
            AB-{latest.id}
          </span>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>
            {client?.display_name || latest.formulaire_data?.nom || 'Abonnement'}
          </h2>
          <div style={{ fontSize: '0.85rem', opacity: 0.85, marginTop: 4 }}>
            {latest.service || 'Grand ménage'} · {frequencyLabel || 'Abonnement'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{childDemandes.filter((c: Demande) => ['termine', 'terminee'].includes((c.statut || '').toLowerCase())).length}</div>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>PASSAGES RÉALISÉS</div>
          </div>
          <div style={{ width: 1, height: 35, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{childDemandes.filter((c: Demande) => (c.statut || '').toLowerCase().includes('report') || c.cao === 'reporte').length}</div>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>REPORT</div>
          </div>
          <div style={{ width: 1, height: 35, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>0</div>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>IMPAYÉ</div>
          </div>
          <div style={{ width: 1, height: 35, background: 'rgba(255,255,255,0.2)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>100%</div>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>ASSIDUITÉ</div>
          </div>
        </div>
      </div>

      {/* ── 5th Week Detection Notice Banner ── */}
      <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <AlertCircle size={20} color="#6d28d9" style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#5b21b6' }}>
            5ème semaine détectée — {capitalizedMonthTitle}
          </div>
          <div style={{ fontSize: 12, color: '#6d28d9', marginTop: 2 }}>
            Le mois contient 5 jeudis. Le passage du jeudi 30 juillet est facturé en complément au prorata : +0 DH déjà intégrés à la facture de {capitalizedMonthTitle}.
          </div>
        </div>
      </div>

      {/* ── Main 2 Columns Layout: Left Content & Right Sidebar Stack ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Paramètres de l'abonnement Card (Strictly BDD Real Data) */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#034a3e', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={18} color="#037265" /> Paramètres de l'abonnement
              </div>
              <button type="button" style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#037265', cursor: 'pointer' }}>
                Modifier
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
              {(() => {
                const formatSafeValue = (val: any, fallback = '—') => {
                  if (val === null || val === undefined || val === '') return fallback;
                  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
                  if (Array.isArray(val)) {
                    if (val.length === 0) return fallback;
                    const items = val.map((item: any) => {
                      if (item && typeof item === 'object') {
                        return item.label || item.name || item.title || item.key || String(item);
                      }
                      return String(item);
                    });
                    return items.join(', ');
                  }
                  if (typeof val === 'object') {
                    return val.label || val.name || val.title || val.key || fallback;
                  }
                  return String(val);
                };

                const rawOptions = latest.formulaire_data?.options || latest.options;
                const formattedOptions = formatSafeValue(rawOptions, 'Aucune option');

                const rawModePaiement = latest.mode_paiement || latest.mode_paiement_label;
                const formattedModePaiement = formatSafeValue(rawModePaiement, '—');

                const rawCom = latest.formulaire_data?.com || latest.commission;
                const formattedCom = formatSafeValue(rawCom, '—');

                return [
                  { 
                    label: "Service", 
                    value: `${latest.service || latest.type_prestation || 'Demande'}${latest.segment ? ` — ${latest.segment}` : ''}` 
                  },
                  { 
                    label: "Type de fréquence", 
                    value: frequencyLabel || latest.frequency_label || (selectedDays.length > 0 ? `${selectedDays.length} fois par semaine` : (latest.frequency ? `${latest.frequency}` : '—')) 
                  },
                  { 
                    label: "Date de démarrage", 
                    value: dateDebut ? (dateDebut.includes('-') ? dateDebut.split('-').reverse().join('/') : dateDebut) : (latest.date_intervention ? new Date(latest.date_intervention).toLocaleDateString('fr-FR') : (latest.created_at ? new Date(latest.created_at).toLocaleDateString('fr-FR') : '—')) 
                  },
                  { 
                    label: "Jours de passage", 
                    value: selectedDays.length > 0 ? selectedDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(' + ') : (latest.formulaire_data?.jours_passage ? (Array.isArray(latest.formulaire_data.jours_passage) ? latest.formulaire_data.jours_passage.join(' + ') : latest.formulaire_data.jours_passage) : '—') 
                  },
                  { 
                    label: "Nbre de personnes", 
                    value: `${latest.nb_intervenants || latest.formulaire_data?.nb_personnes || latest.formulaire_data?.nb_intervenants || 1} personne(s)` 
                  },
                  { 
                    label: "Nombre total de passages", 
                    value: (
                      <span>
                        {childDemandes.length} passage(s) / mois{' '}
                        {childDemandes.filter((d: Demande) => ['annule', 'annulee'].includes((d.statut || '').toLowerCase())).length > 0 && (
                          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                            ({childDemandes.filter((d: Demande) => ['annule', 'annulee'].includes((d.statut || '').toLowerCase())).length} annulée(s))
                          </span>
                        )}
                      </span>
                    ) 
                  },
                  { 
                    label: "Durée / passage", 
                    value: latest.nb_heures ? `${latest.nb_heures}h` : (latest.formulaire_data?.duree ? `${latest.formulaire_data.duree}h` : '—') 
                  },
                  { 
                    label: "Tarif horaire", 
                    value: latest.formulaire_data?.tarif_horaire ? `${latest.formulaire_data.tarif_horaire} DH` : (latest.tarif_horaire ? `${latest.tarif_horaire} DH` : '—') 
                  },
                  { 
                    label: "Options", 
                    value: formattedOptions 
                  },
                  { 
                    label: "Mensuel de base", 
                    value: latest.prix ? `${latest.prix} DH` : (latest.formulaire_data?.prix ? `${latest.formulaire_data.prix} DH` : '—') 
                  },
                  { 
                    label: "Mode de paiement", 
                    value: formattedModePaiement 
                  },
                  { 
                    label: "Com", 
                    value: formattedCom 
                  },
                  { 
                    label: "Taux de réduction", 
                    value: latest.formulaire_data?.remise ? `${latest.formulaire_data.remise}%` : (latest.remise ? `${latest.remise}%` : '—') 
                  },
                  { 
                    label: "Interventions récupérées", 
                    value: `${childDemandes.filter((d: Demande) => (d.statut || '').toLowerCase() === 'recup' || d.cao === 'recup').length} récupérée(s)` 
                  }
                ].map((row, idx, arr) => (
                  <div 
                    key={row.label} 
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '200px 1fr', 
                      padding: '8px 0', 
                      borderBottom: idx < arr.length - 1 ? '1px solid #f1f5f9' : 'none',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ color: '#64748b', fontWeight: 500 }}>{row.label}</div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{row.value}</div>
                  </div>
                ));
              })()}
            </div>
          </div>



          {/* Jours d'intervention Selector */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                JOURS D'INTERVENTION *
              </div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                {selectedDays.length}/7 jour(s) sélectionné(s)
              </div>
            </div>

            {/* Days pills */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {[
                { key: 'lundi', label: 'Lundi' },
                { key: 'mardi', label: 'Mardi' },
                { key: 'mercredi', label: 'Mercredi' },
                { key: 'jeudi', label: 'Jeudi' },
                { key: 'vendredi', label: 'Vendredi' },
                { key: 'samedi', label: 'Samedi' },
                { key: 'dimanche', label: 'Dimanche' },
              ].map(d => {
                const isSel = selectedDays.includes(d.key);
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 8,
                      border: 'none',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      background: isSel ? '#037265' : '#f1f5f9',
                      color: isSel ? 'white' : '#64748b',
                      transition: 'all 0.15s'
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>

            {/* Time range per day */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Horaires par jour (début / fin)</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {selectedDays.map(dayKey => (
                  <div key={dayKey} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', width: 60, textTransform: 'capitalize' }}>{dayKey}</span>
                    <input
                      type="time"
                      value={dayTimes[dayKey]?.start || ''}
                      onChange={e => setDayTimes({ ...dayTimes, [dayKey]: { ...(dayTimes[dayKey] || { start: '', end: '' }), start: e.target.value } })}
                      style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, color: '#334155', background: 'white' }}
                    />
                    <span style={{ color: '#94a3b8' }}>→</span>
                    <input
                      type="time"
                      value={dayTimes[dayKey]?.end || ''}
                      onChange={e => setDayTimes({ ...dayTimes, [dayKey]: { ...(dayTimes[dayKey] || { start: '', end: '' }), end: e.target.value } })}
                      style={{ padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, color: '#334155', background: 'white' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CALENDRIER DES INTERVENTIONS */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              CALENDRIER DES INTERVENTIONS
            </div>

            {/* Calendar Header Title (Fixed to Current Month) */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#034a3e' }}>
                {capitalizedMonthTitle}
              </div>
            </div>

            {/* 7 Column Calendar Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'].map(d => (
                <div key={d} style={{ background: '#e6f4f1', color: '#037265', textAlign: 'center', padding: '6px 0', fontWeight: 800, fontSize: 12, borderRadius: 4 }}>
                  {d}
                </div>
              ))}

              {/* Offset days */}
              {prevMonthDays.map(dayNum => (
                <div key={`prev-${dayNum}`} style={{ minHeight: 65, padding: 4, background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 4 }}>
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>{dayNum}</div>
                </div>
              ))}

              {/* Days of Month */}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(dayNum => {
                const dayIso = `${monthIsoPrefix}-${String(dayNum).padStart(2, '0')}`;
                const realDemande = childDemandes.find((d: Demande) => {
                  if (!d.date_intervention) return false;
                  const dDate = d.date_intervention.includes('T') ? d.date_intervention.split('T')[0] : d.date_intervention.slice(0, 10);
                  return dDate === dayIso;
                });

                const isToday = dayIso === new Date().toISOString().slice(0, 10);

                let badgeText = '';
                let badgeBg = '#00796b';
                let cellBg = isToday ? '#fefce8' : '#ffffff';

                if (realDemande) {
                  const st = (realDemande.statut || '').toLowerCase();
                  if (st === 'termine' || st === 'terminee') {
                    badgeText = 'TERMINÉ';
                    badgeBg = '#10b981';
                    cellBg = '#f0fdf4';
                  } else if (st === 'annule' || st === 'annulee') {
                    badgeText = 'ANNULÉ';
                    badgeBg = '#ef4444';
                    cellBg = '#fef2f2';
                  } else if (st.includes('report') || realDemande.cao === 'reporte') {
                    badgeText = 'REPORTÉE';
                    badgeBg = '#8b5cf6';
                    cellBg = '#f5f3ff';
                  } else {
                    badgeText = 'À VENIR';
                    badgeBg = '#00796b';
                    cellBg = '#f0fdfa';
                  }
                }

                return (
                  <div
                    key={dayNum}
                    onClick={() => handleCellClick(dayIso)}
                    style={{
                      minHeight: 65,
                      padding: 4,
                      background: cellBg,
                      border: '1px solid #e2e8f0',
                      borderRadius: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                  >
                    <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#334155' }}>{dayNum}</div>

                    {realDemande && (
                      <div style={{ marginTop: 'auto' }}>
                        <div style={{ background: badgeBg, color: 'white', fontSize: 10, fontWeight: 800, padding: '2px 4px', borderRadius: 4, textAlign: 'center' }}>
                          {badgeText}
                        </div>
                        {realDemande.heure_intervention && (
                          <div style={{ fontSize: 9, color: '#475569', textAlign: 'center', marginTop: 2, fontWeight: 600 }}>
                            {realDemande.heure_intervention.slice(0, 5)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pop-over modal when clicking on this specific day (Screenshot 4) */}
                    {selectedCellDate === dayIso && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          top: -10,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          zIndex: 100,
                          width: 260,
                          background: 'white',
                          border: '1px solid #cbd5e1',
                          borderRadius: 12,
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                          padding: 14
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a', marginBottom: 10 }}>
                          {new Date(dayIso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                          <div>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 2 }}>Heure début</span>
                            <input
                              type="time"
                              value={popoverStart}
                              onChange={e => setPopoverStart(e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12 }}
                            />
                          </div>
                          <div>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 2 }}>Heure fin</span>
                            <input
                              type="time"
                              value={popoverEnd}
                              onChange={e => setPopoverEnd(e.target.value)}
                              style={{ width: '100%', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12 }}
                            />
                          </div>
                        </div>

                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Statut</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                          <button
                            type="button"
                            onClick={() => handleSetCellStatus(dayIso, 'en_cours')}
                            style={{ padding: '6px 8px', borderRadius: 6, border: 'none', background: '#037265', color: 'white', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                          >
                            À venir
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetCellStatus(dayIso, 'termine')}
                            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', color: '#334155', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                          >
                            Terminé
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetCellStatus(dayIso, 'annule')}
                            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', color: '#334155', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                          >
                            Annulé (perdu)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetCellStatus(dayIso, 'recup')}
                            style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', color: '#334155', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                          >
                            Annulé à récupérer
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSetCellStatus(dayIso, 'reporte')}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', color: '#334155', fontWeight: 700, fontSize: 11, cursor: 'pointer', marginBottom: 8 }}
                        >
                          Reportée
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSetCellStatus(dayIso, 'retirer')}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: 'none', background: '#fef2f2', color: '#ef4444', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}
                        >
                          Retirer
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footnote & Legend */}
            <div style={{ textAlign: 'center', fontSize: 12, color: '#64748b', margin: '12px 0 8px 0', fontWeight: 600 }}>
              {childDemandes.length} intervention(s) sur {capitalizedMonthTitle}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', fontSize: 11, color: '#475569', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, border: '1px solid #10b981', background: '#f0fdf4' }} /> Passage prévu</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, border: '1px solid #8b5cf6', background: '#f5f3ff' }} /> 5ème semaine (facturée en +)</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, border: '1px solid #f59e0b', background: '#fffbeb' }} /> Suspension fête religieuse</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, border: '1px solid #eab308', background: '#fefce8' }} /> Aujourd'hui</span>
            </div>
          </div>

          {/* Notes complémentaires */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
              NOTES COMPLÉMENTAIRES
            </label>
            <textarea
              value={planningNotes}
              onChange={e => setPlanningNotes(e.target.value)}
              placeholder="Précisions sur l'abonnement..."
              style={{ width: '100%', height: 70, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#334155', resize: 'none' }}
            />
          </div>

          {/* Factures & règlements Table (Real BDD Documents) */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={16} color="#037265" /> Factures & règlements
            </div>
            {latest.documents && latest.documents.filter((doc: any) => doc.type_document === 'facture' || doc.document_type === 'facture').length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>FACTURE</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>PÉRIODE</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>MONTANT</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>ENVOYÉE LE</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>STATUT</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.documents
                    .filter((doc: any) => doc.type_document === 'facture' || doc.document_type === 'facture')
                    .map((doc: any, idx: number) => (
                      <tr key={doc.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0f172a' }}>{doc.numero || doc.nom_fichier || `FAC-${doc.id}`}</td>
                        <td style={{ padding: '10px 12px', color: '#475569' }}>{doc.periode || capitalizedMonthTitle}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 800, color: '#0f172a' }}>{doc.montant ? `${doc.montant} DH` : (latest.prix ? `${latest.prix} DH` : '—')}</td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{doc.created_at ? new Date(doc.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#15803d' }}>
                            {doc.statut || 'Générée'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: 12, color: '#94a3b8', fontStyle: 'italic', fontSize: 13, textAlign: 'center' }}>
                Aucune facture enregistrée pour cet abonnement
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN SIDEBAR (Stack of Cards) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card 1: Prochain passage */}
          <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: 12, padding: 16 }}>
            <div style={{ color: '#b45309', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>» Prochain passage</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', marginBottom: 4 }}>
              {nextIntervention?.date_intervention
                ? new Date(nextIntervention.date_intervention).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                : 'Aucun passage programmé'}
            </div>
            {nextIntervention && (
              <div style={{ display: 'inline-block', background: '#fef3c7', color: '#b45309', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, marginBottom: 8 }}>
                → Remonté au Tableau de bord (J0)
              </div>
            )}
            <div style={{ fontSize: 12, color: '#854d0e', fontWeight: 600 }}>
              Intervenante : <span style={{ color: '#b45309', fontWeight: 700 }}>{nextIntervention?.assigned_to_operations_name || latest.assigned_to_operations_name || 'À assigner par la chargée opérationnelle'}</span>
            </div>
          </div>

          {/* Card 2: Intervenantes habituelles (Real BDD Data) */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={15} color="#037265" /> Intervenantes habituelles
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              {(() => {
                const map: Record<string, number> = {};
                childDemandes.forEach((d: Demande) => {
                  const name = d.assigned_to_operations_name || d.assigned_to_name;
                  if (name) map[name] = (map[name] || 0) + 1;
                });
                if (latest.assigned_to_operations_name && !map[latest.assigned_to_operations_name]) {
                  map[latest.assigned_to_operations_name] = 1;
                }
                const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
                if (entries.length === 0) {
                  return <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Aucune intervenante assignée</div>;
                }
                return entries.map(([name, count], idx) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {idx === 0 ? (
                      <Star size={14} color="#f59e0b" fill="#f59e0b" />
                    ) : (
                      <CheckCircle size={14} color="#10b981" />
                    )}
                    <span style={{ fontWeight: 800, color: '#0f172a' }}>{name}</span>
                    <span style={{ color: '#64748b' }}>— {count} passage(s)</span>
                  </div>
                ));
              })()}
            </div>

            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 12, fontStyle: 'italic', lineHeight: 1.3 }}>
              ⓘ Continuité non garantie contractuellement — priorité donnée à la première intervenante quand disponible.
            </div>
          </div>

          {/* Card 3: Infos terrain */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                📍 Infos terrain
              </div>
              <button type="button" style={{ background: '#f1f5f9', border: 'none', borderRadius: 4, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 800 }}>+</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#334155' }}>
              <div>🏢 {client?.ville || client?.quartier || 'Casablanca'}</div>
              <div>🔑 Code entrée : à renseigner — gardien : —</div>
              <div>🚪 Accès / ascenseur : à renseigner</div>
              <div>🐕 Animaux : à renseigner</div>
              <div>🧼 Produits ménagers : fournis par le client</div>
              <div>💬 Préférence contact : WhatsApp</div>
            </div>
          </div>

          {/* Card 4: Journal de l'abonnement */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              📜 Journal de l'abonnement
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
              Aucun évènement
            </div>
          </div>

          {/* Card 5: Actions */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a', marginBottom: 12 }}>
              Actions
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: 'white', fontSize: 12, fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                <Slash size={14} color="#64748b" /> Suspendre temporairement (vacances)
              </button>
              <button type="button" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: 'white', fontSize: 12, fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                <Clock size={14} color="#64748b" /> Modifier jours / heures
              </button>
              <button 
                type="button" 
                onClick={() => {
                  const tel = client?.telephone || latest?.client_phone || latest?.client_whatsapp;
                  if (tel) {
                    const cleaned = tel.replace(/[^0-9]/g, '');
                    window.open(`https://wa.me/${cleaned}`, '_blank');
                  } else {
                    addToast("Aucun numéro de téléphone disponible.", "info");
                  }
                }} 
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: 'white', fontSize: 12, fontWeight: 700, color: '#334155', cursor: 'pointer' }}
              >
                <MessageSquare size={14} color="#037265" /> Contacter le client (WhatsApp)
              </button>
              <button type="button" style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: '1px solid #fee2e2', borderRadius: 8, background: '#fef2f2', fontSize: 12, fontWeight: 700, color: '#ef4444', cursor: 'pointer' }}>
                <XCircle size={14} color="#ef4444" /> Résilier l'abonnement
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
