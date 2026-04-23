import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  getFeedbacks,
  getFeedbackStats,
  deleteFeedback,
  sendWhatsApp
} from '../api/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  Search, Eye, Share2, ClipboardCheck, ThumbsUp, ThumbsDown,
  TrendingUp, Star, Trash2, Download, ChevronDown
} from 'lucide-react';
import { Feedback } from '../types';
import { useToastStore } from '../store/toast';
import { encodeId } from '../utils/obfuscation';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'];

const SATISFACTION_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  'Très satisfait': { label: 'Très satisfait', bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  'Satisfait':      { label: 'Satisfait',      bg: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6' },
  'Moyen':          { label: 'Moyen',           bg: '#fef9c3', text: '#a16207', dot: '#eab308' },
  'Pas satisfait':  { label: 'Pas satisfait',   bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
};

export default function Qualite() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToastStore();

  const [search, setSearch] = useState('');
  const [noteAgenceFilter, setNoteAgenceFilter] = useState('toutes');
  const [noteProfilFilter, setNoteProfilFilter] = useState('toutes');
  const [cityFilter, setCityFilter] = useState('toutes');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [feedbacksRes, statsRes] = await Promise.all([
        getFeedbacks(),
        getFeedbackStats()
      ]);
      setFeedbacks(feedbacksRes.data.results || feedbacksRes.data);
      setStats(statsRes.data);
    } catch {
      addToast('Erreur lors du chargement des données qualité', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleShare = async (demandeId: number) => {
    if (!demandeId) {
      addToast('Aucune demande associée pour l\'envoi', 'error');
      return;
    }
    try {
      addToast('Envoi du lien feedback WhatsApp...', 'info');
      await sendWhatsApp(demandeId, 'feedback');
      addToast('Lien WhatsApp envoyé avec succès !', 'success');
    } catch (err) {
      addToast('Erreur lors de l\'envoi WhatsApp', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Voulez-vous vraiment supprimer ce feedback ?')) return;
    try {
      await deleteFeedback(id);
      addToast('Feedback supprimé', 'success');
      fetchData();
    } catch {
      addToast('Erreur lors de la suppression', 'error');
    }
  };

  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter(f => {
      const matchesSearch =
        f.client_name.toLowerCase().includes(search.toLowerCase()) ||
        f.agent_name.toLowerCase().includes(search.toLowerCase()) ||
        f.commentaire.toLowerCase().includes(search.toLowerCase());
      const matchesNoteAgence = noteAgenceFilter === 'toutes' || f.note_agence === parseInt(noteAgenceFilter);
      const matchesNoteProfil = noteProfilFilter === 'toutes' || f.note_intervenant === parseInt(noteProfilFilter);
      const matchesCity = cityFilter === 'toutes' || (f.city || '').toLowerCase().includes(cityFilter.toLowerCase());
      return matchesSearch && matchesNoteAgence && matchesNoteProfil && matchesCity;
    });
  }, [feedbacks, search, noteAgenceFilter, noteProfilFilter, cityFilter]);

  const getSatisfactionLabel = (noteAgence: number | null, noteProfil: number | null) => {
    const nA = noteAgence || 0;
    const nP = noteProfil || 0;
    const mean = (nA + nP) / ( (noteAgence ? 1 : 0) + (noteProfil ? 1 : 0) || 1 );
    if (mean >= 4.5) return 'Très satisfait';
    if (mean >= 3.5) return 'Satisfait';
    if (mean >= 2.5) return 'Moyen';
    return 'Pas satisfait';
  };

  const renderStars = (rating: number) => (
    <div style={{ display: 'flex', gap: 2 }}>
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          size={14}
          fill={i < rating ? '#f59e0b' : 'none'}
          stroke={i < rating ? '#f59e0b' : '#d1d5db'}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '10px 16px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          fontSize: 13,
        }}>
          <p style={{ fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{label}</p>
          {payload.map((p: any) => (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill, display: 'inline-block' }} />
              <span style={{ color: '#64748b' }}>{p.name}:</span>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>{p.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading && !stats) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid #e2e8f0',
          borderTopColor: '#3b82f6',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const SelectFilter = ({ value, onChange, children }: any) => (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <select
        value={value}
        onChange={onChange}
        style={{
          appearance: 'none',
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '9px 36px 9px 14px',
          fontSize: 13,
          color: '#374151',
          fontWeight: 500,
          cursor: 'pointer',
          outline: 'none',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          minWidth: 170,
        }}
      >
        {children}
      </select>
      <ChevronDown size={14} style={{ position: 'absolute', right: 12, color: '#9ca3af', pointerEvents: 'none' }} />
    </div>
  );

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', padding: '28px 32px', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Qualité & Feedback</h1>
        </div>
        <button
          onClick={() => addToast('Génération en cours...', 'info')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: 600,
            color: '#374151',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            transition: 'all 0.15s',
          }}
        >
          <Download size={16} /> Générer les feedbacks
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Prestations effectuées */}
        <div style={{
          borderRadius: 18,
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          padding: '24px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          boxShadow: '0 4px 20px rgba(245,158,11,0.25)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', right: 30, bottom: -30, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <ClipboardCheck size={26} color="#fff" />
          </div>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
              Prestations effectuées
            </div>
            <div style={{ color: '#fff', fontSize: 38, fontWeight: 800, lineHeight: 1 }}>
              {stats?.kpis?.total_finished ?? 0}
            </div>
          </div>
        </div>

        {/* Feedback */}
        <div style={{
          borderRadius: 18,
          background: 'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)',
          padding: '24px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          boxShadow: '0 4px 20px rgba(6,182,212,0.25)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', right: 30, bottom: -30, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <ThumbsUp size={26} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Feedback</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ThumbsUp size={16} color="#fff" />
                  <span style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>{stats?.kpis?.positives ?? 0}</span>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>positifs</span>
              </div>
              <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.2)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ThumbsDown size={16} color="#fff" />
                  <span style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>{stats?.kpis?.negatives ?? 0}</span>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>négatifs</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Bar Chart */}
        <div style={{
          background: '#fff',
          borderRadius: 18,
          padding: '24px 24px 16px',
          border: '1px solid #f1f5f9',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} color="#3b82f6" />
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>
              Répartition des notes (Agence & Profil)
            </h3>
          </div>
          <div style={{ height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.charts?.distribution} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 16, fontSize: 12 }} />
                <Bar dataKey="agence" name="Note Agence" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={28} />
                <Bar dataKey="profil" name="Note Profil" fill="#22c55e" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div style={{
          background: '#fff',
          borderRadius: 18,
          padding: '24px 24px 16px',
          border: '1px solid #f1f5f9',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 20px' }}>
            Niveau de satisfaction client
          </h3>
          <div style={{ height: 270 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.charts?.satisfaction}
                  cx="50%"
                  cy="45%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                >
                  {stats?.charts?.satisfaction?.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div style={{
        background: '#fff',
        borderRadius: 18,
        border: '1px solid #f1f5f9',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        overflow: 'hidden',
      }}>
        {/* Filters bar */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          background: '#fafbfc',
        }}>
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={16} />
            <input
              type="text"
              placeholder="Rechercher client ou profil..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: 38,
                paddingRight: 14,
                paddingTop: 9,
                paddingBottom: 9,
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                fontSize: 13,
                color: '#374151',
                outline: 'none',
                background: '#fff',
                boxSizing: 'border-box',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            />
          </div>

          <SelectFilter value={noteAgenceFilter} onChange={(e: any) => setNoteAgenceFilter(e.target.value)}>
            <option value="toutes">Toutes notes agence</option>
            {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} étoiles</option>)}
          </SelectFilter>

          <SelectFilter value={noteProfilFilter} onChange={(e: any) => setNoteProfilFilter(e.target.value)}>
            <option value="toutes">Toutes notes profil</option>
            {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} étoiles</option>)}
          </SelectFilter>

          <SelectFilter value={cityFilter} onChange={(e: any) => setCityFilter(e.target.value)}>
            <option value="toutes">Toutes les villes</option>
            <option value="Casablanca">Casablanca</option>
            <option value="Rabat">Rabat</option>
            <option value="Marrakech">Marrakech</option>
            <option value="Tanger">Tanger</option>
          </SelectFilter>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Date prestation', 'Client', 'Ville / Quartier', 'Service', 'Segment', 'Profil', 'Satisfaction', 'Note agence', 'Note profil', 'Action'].map(col => (
                  <th key={col} style={{
                    padding: '12px 16px',
                    textAlign: col === 'Note agence' || col === 'Note profil' || col === 'Action' ? 'center' : 'left',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#94a3b8',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid #f1f5f9',
                    whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredFeedbacks.map((f) => {
                const satKey = getSatisfactionLabel(f.note_agence, f.note_intervenant);
                const sat = SATISFACTION_CONFIG[satKey];
                return (
                  <tr
                    key={f.id}
                    style={{
                      borderBottom: '1px solid #f8fafc',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fafbff')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>
                      {f.date_prestation ? new Date(f.date_prestation).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {f.client ? (
                        <Link to={`/clients/${encodeId(f.client)}`} style={{ fontWeight: 700, color: '#3b82f6', textDecoration: 'none', fontSize: 13 }}>
                          {f.client_name}
                        </Link>
                      ) : (
                        <span style={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>{f.client_name}</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#64748b' }}>
                      {f.city}, {f.neighborhood}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        background: '#f1f5f9',
                        color: '#475569',
                        borderRadius: 6,
                        padding: '3px 10px',
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {f.service}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        borderRadius: 6,
                        padding: '3px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        ...(f.segment === 'particulier'
                          ? { background: '#ede9fe', color: '#6d28d9' }
                          : { background: '#d1fae5', color: '#065f46' }),
                      }}>
                        {f.segment === 'particulier' ? 'Particulier' : 'Entreprise'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {f.agent_id ? (
                        <Link to={`/profils/${encodeId(f.agent_id)}`} style={{ color: '#1e293b', fontWeight: 600, textDecoration: 'none', fontSize: 13 }}>
                          {f.agent_name}
                        </Link>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: 13 }}>{f.agent_name}</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', maxWidth: 220 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          background: sat.bg,
                          color: sat.text,
                          borderRadius: 6,
                          padding: '3px 10px',
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: '0.03em',
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sat.dot, display: 'inline-block' }} />
                          {sat.label}
                        </span>
                      </div>
                      <p style={{
                        fontSize: 12,
                        color: '#94a3b8',
                        fontStyle: 'italic',
                        margin: 0,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: 1.4,
                      }}>
                        "{f.commentaire || 'Pas de commentaire'}"
                      </p>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>{renderStars(f.note_agence)}</div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>{renderStars(f.note_intervenant)}</div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                        {[
                          { 
                            Icon: Share2, hoverBg: '#eff6ff', hoverColor: '#3b82f6', title: 'Partager', 
                            onClick: () => handleShare(f.demande) 
                          },
                          { Icon: Eye, hoverBg: '#eff6ff', hoverColor: '#3b82f6', title: 'Voir détails', onClick: () => {} },
                          {
                            Icon: Trash2, hoverBg: '#fff1f2', hoverColor: '#ef4444', title: 'Supprimer',
                            onClick: () => handleDelete(f.id)
                          },
                        ].map(({ Icon, hoverBg, hoverColor, title, onClick }, i) => (
                          <button
                            key={i}
                            title={title}
                            onClick={onClick}
                            style={{
                              width: 30, height: 30, borderRadius: 8,
                              border: 'none', background: 'transparent',
                              color: '#cbd5e1', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLButtonElement).style.background = hoverBg;
                              (e.currentTarget as HTMLButtonElement).style.color = hoverColor;
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                              (e.currentTarget as HTMLButtonElement).style.color = '#cbd5e1';
                            }}
                          >
                            <Icon size={15} />
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredFeedbacks.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 14, fontStyle: 'italic' }}>
                    Aucun retour client trouvé pour ces critères.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}