import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getClient, getDemandes, getFeedbacks, getMissions,
  updateDemande, fetchSecureDocBlob
} from '../api/client';
import { decodeId } from '../utils/obfuscation';
import {
  ChevronDown, User, Calendar, FileText,
  MessageSquare, History, ArrowLeft, RefreshCw, Slash,
  Eye, Star, Clock, Heart, AlertCircle, FileDown,
  XCircle, Send, Download
} from 'lucide-react';
import { useToastStore } from '../store/toast';
import { Client, Demande } from '../types';

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
  const [client, setClient] = useState<Client | null>(null);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    info: true, fidelite: false, frequence: false,
    besoin: false, documents: false, candidats: false,
    feedback: false, historique: false,
    avisComm: true, avisOp: true,
  });

  const dateInputRef = useRef<HTMLInputElement>(null);
  const [selectedDate, setSelectedDate] = useState('');

  const [avisComm, setAvisComm] = useState('');
  const [avisOp, setAvisOp] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState<{ url: string; type: string; name: string } | null>(null);
  const addToast = useToastStore(state => state.addToast);

  const fetchData = async () => {
    if (!id) return;
    const realId = decodeId(id);
    if (!realId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [clientRes, demandesRes, feedbacksRes, missionsRes] = await Promise.all([
        getClient(realId),
        getDemandes({ client: realId.toString() }),
        getFeedbacks({ client: realId.toString() }),
        getMissions({ client: realId.toString() }),
      ]);
      setClient(clientRes.data);
      const list = Array.isArray(demandesRes.data?.results) ? demandesRes.data.results : (Array.isArray(demandesRes.data) ? demandesRes.data : []);
      setDemandes(list);
      if (list[0]) { setAvisComm(list[0].note_commercial || ''); setAvisOp(list[0].note_operationnel || ''); }
      setFeedbacks(Array.isArray(feedbacksRes.data?.results) ? feedbacksRes.data.results : (Array.isArray(feedbacksRes.data) ? feedbacksRes.data : []));
      setMissions(Array.isArray(missionsRes.data?.results) ? missionsRes.data.results : (Array.isArray(missionsRes.data) ? missionsRes.data : []));
    } catch (err) { console.error('Error fetching client details:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [id]);
  const toggle = (s: string) => setOpenSections(p => ({ ...p, [s]: !p[s] }));

  const handleSaveAvis = async () => {
    if (!demandes[0]) return;
    setSaving(true);
    try { await updateDemande(demandes[0].id, { note_commercial: avisComm, note_operationnel: avisOp }); }
    catch (err) { console.error(err); }
    finally { setSaving(false); }
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

  const latest = demandes[0] || null;

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
                {(client.full_name || client.first_name || 'C')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a202c', margin: 0, textTransform: 'lowercase' }}>
                    {client.full_name || `${client.first_name || ''} ${client.last_name || ''}`.trim()}
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
                  {latest?.statut_paiement === 'partiel' && (
                    <Badge bg={C.orange} color="white">Facturation partielle</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10 }} className="flex-wrap">
            <button style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 18px', border: '1px solid #e2e8f0',
              borderRadius: 8, background: 'white', color: '#475569',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              <RefreshCw size={16} color={C.teal} /> Renouveler
            </button>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 18px', border: '1px solid #FEB2B2',
              borderRadius: 8, background: 'white', color: '#E53E3E',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              <Slash size={16} /> Black lister
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════ BODY ══════════════ */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>

        {/* ── 1. Informations Client ── */}
        <Accordion title="Informations Client" icon={<User size={18} />} isOpen={openSections.info} onToggle={() => toggle('info')} color={C.teal}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 32px' }}>
            <InfoField label="NOM COMPLET" value={client.full_name || `${client.first_name || ''} ${client.last_name || ''}`.trim()} />
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
                  <Th>Date</Th><Th>Nom du service</Th><Th>Segment</Th><Th>Statut</Th><Th center>Actions</Th>
                </tr></thead>
                <tbody>
                  {demandes.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <Td>{new Date(d.created_at).toLocaleDateString('fr-FR')}</Td>
                      <Td bold color="#1e293b">{d.service}</Td>
                      <Td>
                        <Badge bg={d.segment === 'entreprise' ? C.lime : C.teal} color="white">
                          {d.segment === 'entreprise' ? 'Entreprise' : 'Particulier'}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge bg={d.statut_paiement === 'integral' ? '#2F855A' : C.orange} color="white">
                          {d.statut_paiement === 'integral' ? 'Payé' : 'Facturation partielle'}
                        </Badge>
                      </Td>
                      <Td center>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                          <button style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontWeight: 600, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>
                            <RefreshCw size={15} color={C.teal} /> Renouveler
                          </button>
                          {d.frequency === 'abonnement' && (
                            <button style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#475569', fontWeight: 600, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>
                              <RefreshCw size={15} color={C.teal} /> Abonnement
                            </button>
                          )}
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><Eye size={17} /></button>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><FileText size={17} /></button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Accordion>

        {/* ── 3. Avis Panels (side by side) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'start' }}>
          {/* Avis Commercial */}
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div
              onClick={() => toggle('avisComm')}
              style={{ padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.orange, color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ padding: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 6, display: 'flex' }}><MessageSquare size={16} /></div>
                Avis Service Commercial
              </div>
              <ChevronDown size={17} style={{ opacity: 0.6, transition: 'transform 0.3s', transform: openSections.avisComm ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
            {openSections.avisComm && (
              <div style={{ padding: 16 }}>
                <textarea
                  style={{ width: '100%', height: 96, padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, color: '#334155', resize: 'none', fontWeight: 500, fontFamily: 'inherit', outline: 'none' }}
                  placeholder="Saisir un avis commercial..."
                  value={avisComm} onChange={e => setAvisComm(e.target.value)}
                />
              </div>
            )}
          </div>
          {/* Avis Opérationnel */}
          <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div
              onClick={() => toggle('avisOp')}
              style={{ padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.tan, color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ padding: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 6, display: 'flex' }}><MessageSquare size={16} /></div>
                Avis Service Opérationnel
              </div>
              <ChevronDown size={17} style={{ opacity: 0.6, transition: 'transform 0.3s', transform: openSections.avisOp ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
            {openSections.avisOp && (
              <div style={{ padding: 16 }}>
                <textarea
                  style={{ width: '100%', height: 96, padding: 12, border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 14, color: '#334155', resize: 'none', fontWeight: 500, fontFamily: 'inherit', outline: 'none' }}
                  placeholder="Saisir un avis opérationnel..."
                  value={avisOp} onChange={e => setAvisOp(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Save avis button */}
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
            {saving ? 'Enregistrement...' : 'Enregistrer les avis'}
          </button>
        </div>

        {/* ── 4. Type de Fréquence ── */}
        <Accordion title="Type de Fréquence" icon={<Clock size={18} />} isOpen={openSections.frequence} onToggle={() => toggle('frequence')} color={C.sage}>
          {latest ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <span style={{ padding: '6px 16px', border: '1px solid #e2e8f0', borderRadius: 99, fontSize: 14, fontWeight: 700, color: '#475569', background: 'white' }}>
                  {latest.frequency_label || latest.frequency || 'Non défini'}
                </span>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#94a3b8' }}>
                  Prestation — {latest.nb_heures ? `${latest.nb_heures}h` : '—'}
                </span>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#475569', marginBottom: 8 }}>Programmer les interventions</p>
                <div style={{ position: 'relative' }}>
                  <textarea
                    style={{ width: '100%', height: 96, padding: 16, border: '1px solid #e2e8f0', borderRadius: 10, background: 'white', color: '#334155', fontSize: 14, fontWeight: 500, resize: 'none', fontFamily: 'inherit', outline: 'none' }}
                    placeholder="Détails planning (ex : Lundi et Jeudi, 9h-12h)..."
                    value={selectedDate ? `${selectedDate} : ` : (latest.preference_horaire || latest.formulaire_data?.planning_details || '')}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                  <input
                    type="date"
                    ref={dateInputRef}
                    style={{ position: 'absolute', right: 12, bottom: 12, opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                  <button
                    onClick={() => {
                      if (dateInputRef.current?.showPicker) {
                        dateInputRef.current.showPicker();
                      } else {
                        dateInputRef.current?.click();
                      }
                    }}
                    style={{
                      position: 'absolute', right: 12, bottom: 12,
                      padding: '6px 12px', background: 'white', border: '1px solid #e2e8f0',
                      borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#475569',
                      display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    }}
                  >
                    <Calendar size={15} color={C.teal} /> Date
                  </button>
                </div>
              </div>
            </div>
          ) : <EmptyState text="Aucune donnée de fréquence" />}
        </Accordion>

        {/* ── 5. Détails Besoin Actuel ── */}
        <Accordion title="Détails Besoin Actuel" icon={<FileText size={18} />} isOpen={openSections.besoin} onToggle={() => toggle('besoin')} color={C.teal}>
          {latest ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 32px' }}>
              <InfoField label="RÉF COMMANDE" value={`#${latest.id}`} />
              <InfoField label="TYPE DE SERVICE" value={latest.service} />
              <InfoField label="TYPE D'HABITATION" value={latest.formulaire_data?.type_habitation} />
              <InfoField label="NOMBRE D'HEURES" value={latest.nb_heures ? `${latest.nb_heures}h` : latest.formulaire_data?.duree ? `${latest.formulaire_data.duree}h` : undefined} />
              <InfoField label="TARIF" value={latest.prix ? `${latest.prix} MAD` : undefined} />
              <InfoField label="DATE INTERVENTION" value={latest.date_intervention || undefined} />
              <InfoField label="HEURE INTERVENTION" value={latest.heure_intervention || undefined} />
              <InfoField label="ADRESSE" value={latest.client_details?.address || client.address} />
              <InfoField label="VILLE" value={client.city || 'Casablanca'} />
              <InfoField label="REPÈRE / QUARTIER" value={client.neighborhood} />
              <InfoField label="DATE CRÉATION" value={new Date(latest.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
              <InfoField label="DERNIÈRE MODIFICATION" value={new Date(latest.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
              <InfoField label="AVEC PRODUIT" value={latest.avec_produit ? 'Oui' : 'Non'} />
              <InfoField label="MODE PAIEMENT" value={latest.mode_paiement_label || latest.mode_paiement} />
              <InfoField label="NBRE INTERVENANTS" value={latest.formulaire_data?.nb_intervenants || 1} />
            </div>
          ) : <EmptyState text="Aucune donnée disponible" />}
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
                  const statusLabel = d.statut === 'en_cours' ? 'En cours' : d.statut === 'termine' ? 'Prestation effectuée' : 'En attente';
                  const statusBg = d.statut === 'termine' ? C.orange : (d.statut === 'en_cours' ? '#3B82F6' : '#94A3B8');
                  const fileName = doc.nom || (doc.type_document === 'devis' ? 'Devis PDF' : 'Récapitulatif PNG');

                  return (
                    <tr key={doc.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <Td>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</Td>
                      <Td color="#94a3b8">{d.commercial_name || '—'}</Td>
                      <Td>
                        <Badge bg={d.segment === 'entreprise' ? '#10b981' : C.teal} color="white">
                          {d.segment === 'particulier' ? 'Particulier' : 'Entreprise'}
                        </Badge>
                      </Td>
                      <Td bold color="#1e293b">{d.service}</Td>
                      <Td>
                        <Badge bg={statusBg} color="white">
                          {statusLabel}
                        </Badge>
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

        {/* ── 7. Candidats Proposés ── */}
        <Accordion title="Candidats Proposés" icon={<User size={18} />} isOpen={openSections.candidats} onToggle={() => toggle('candidats')} color={C.sage} badge={missions.length}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <Th>Date d'intervention</Th><Th>Nom du profil</Th><Th>Statut profil</Th><Th>Statut paiement</Th><Th center>Note du profil</Th>
              </tr></thead>
              <tbody>
                {missions.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <Td>{m.date_debut ? new Date(m.date_debut).toLocaleDateString('fr-FR') : 'Non planifiée'}</Td>
                    <Td bold color={C.teal}>{m.agent_name || m.agent?.full_name || 'Agent non assigné'}</Td>
                    <Td><Badge bg="#EBF8FF" color="#2B6CB0">Présenté</Badge></Td>
                    <Td><Badge bg="#FFF5F5" color="#C53030">Non payé</Badge></Td>
                    <Td center>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} color="#e2e8f0" fill="#e2e8f0" />)}
                      </div>
                    </Td>
                  </tr>
                ))}
                {missions.length === 0 && <EmptyState text="Aucun candidat proposé" colSpan={5} />}
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
                {feedbacks.map(f => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <Td bold color="#1e293b">{f.mission?.demande?.service || '—'}</Td>
                    <Td bold color={C.teal}>{f.agent_name || f.mission?.agent?.full_name || '—'}</Td>
                    <Td>{new Date(f.date).toLocaleDateString('fr-FR')}</Td>
                    <Td><Badge bg="#F0FFF4" color="#2F855A">Très satisfait</Badge></Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 2, color: '#ECC94B' }}>
                        {[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} fill={s <= (f.note || 4) ? 'currentColor' : 'none'} />)}
                      </div>
                    </Td>
                    <Td><Badge bg="#F0FFF4" color="#2F855A">Positif</Badge></Td>
                    <Td center>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><Eye size={17} /></button>
                    </Td>
                  </tr>
                ))}
                {feedbacks.length === 0 && <EmptyState text="Aucun feedback trouvé" colSpan={7} />}
              </tbody>
            </table>
          </div>
        </Accordion>

        {/* ── 9. Historique ── */}
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
    </div>
  );
}
