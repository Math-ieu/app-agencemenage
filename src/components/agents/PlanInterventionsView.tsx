import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  format,
  isSameWeek,
  eachDayOfInterval,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  RotateCw,
  User as UserIcon,
} from 'lucide-react';
import { getDemandes, getAgents, API_URL } from '../../api/client';
import { getDemandeStartDate, getDemandeStartTime } from '../../utils/pricing';
import { encodeId } from '../../utils/obfuscation';

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getPhotoUrl(photo?: string | null): string | null {
  if (!photo || typeof photo !== 'string') return null;
  const trimmed = photo.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const base = API_URL.replace(/\/+$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
}

function getInterventionTiming(d: any) {
  const rawStartTime = getDemandeStartTime(d) || d.heure_intervention || d.formulaire_data?.heure;
  const duration = Number(d.nb_heures || d.formulaire_data?.duree_heures || d.formulaire_data?.duree || 4);

  let startH = 9;
  let startM = 0;
  let hasValidTime = false;

  if (rawStartTime) {
    const match = String(rawStartTime).match(/(\d{1,2})[:hH](\d{2})?/);
    if (match) {
      startH = parseInt(match[1], 10);
      startM = parseInt(match[2] || '0', 10);
      hasValidTime = true;
    }
  }

  if (hasValidTime) {
    const totalStartMinutes = startH * 60 + startM;
    const totalEndMinutes = totalStartMinutes + Math.round(duration * 60);
    const endH = Math.floor(totalEndMinutes / 60) % 24;
    const endM = totalEndMinutes % 60;

    const startStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
    const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    return {
      timeRange: `${startStr} - ${endStr}`,
      durationStr: `${duration} h`,
    };
  }

  return {
    timeRange: rawStartTime || '09:00 - 13:00',
    durationStr: `${duration} h`,
  };
}

function getStatutInfo(statut: string) {
  switch (statut) {
    case 'pres_confirmee':
    case 'confirmee':
    case 'valide':
      return {
        label: 'Confirmé',
        bg: '#ccfbf1',
        color: '#0f766e',
        dot: '#0d9488',
      };
    case 'pres_en_cours':
    case 'en_cours':
      return {
        label: 'Pres. en cours',
        bg: '#ede9fe',
        color: '#6d28d9',
        dot: '#8b5cf6',
      };
    case 'pres_terminee':
    case 'termine':
      return {
        label: 'Pres. terminée',
        bg: '#f1f5f9',
        color: '#475569',
        dot: '#64748b',
      };
    case 'pres_a_confirmer':
      return {
        label: 'Pres. à confirmer',
        bg: '#fef3c7',
        color: '#b45309',
        dot: '#f59e0b',
      };
    case 'en_attente':
      return {
        label: 'En attente',
        bg: '#fef3c7',
        color: '#b45309',
        dot: '#f59e0b',
      };
    case 'annule':
      return {
        label: 'Annulé',
        bg: '#fee2e2',
        color: '#b91c1c',
        dot: '#ef4444',
      };
    default:
      return {
        label: statut ? capitalize(statut.replace(/_/g, ' ')) : 'Inconnu',
        bg: '#f1f5f9',
        color: '#475569',
        dot: '#94a3b8',
      };
  }
}

export default function PlanInterventionsView() {
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [demandes, setDemandes] = useState<any[]>([]);
  const [agentsMap, setAgentsMap] = useState<Map<number, any>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [demandesRes, agentsRes] = await Promise.all([
        getDemandes({ no_page: 'true' }).catch(() => ({ data: [] })),
        getAgents({ no_page: 'true' }).catch(() => ({ data: [] })),
      ]);

      const rawDemandes = Array.isArray(demandesRes?.data?.results)
        ? demandesRes.data.results
        : Array.isArray(demandesRes?.data)
        ? demandesRes.data
        : [];
      setDemandes(rawDemandes);

      const rawAgents = Array.isArray(agentsRes?.data?.results)
        ? agentsRes.data.results
        : Array.isArray(agentsRes?.data)
        ? agentsRes.data
        : [];
      const map = new Map<number, any>();
      rawAgents.forEach((ag: any) => {
        if (ag.id) map.set(Number(ag.id), ag);
      });
      setAgentsMap(map);
    } catch (err) {
      console.error('Erreur chargement données planning:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const weekEnd = useMemo(() => {
    return endOfWeek(selectedWeekStart, { weekStartsOn: 1 });
  }, [selectedWeekStart]);

  const isCurrentWeek = useMemo(() => {
    return isSameWeek(selectedWeekStart, new Date(), { weekStartsOn: 1 });
  }, [selectedWeekStart]);

  const weekStartStr = useMemo(() => format(selectedWeekStart, 'yyyy-MM-dd'), [selectedWeekStart]);
  const weekEndStr = useMemo(() => format(weekEnd, 'yyyy-MM-dd'), [weekEnd]);

  // Subtitle: e.g. "Semaine du 07 sept. au 13 sept. 2026"
  const weekSubtitle = useMemo(() => {
    const startStr = format(selectedWeekStart, 'dd MMM', { locale: fr });
    const endStr = format(weekEnd, 'dd MMM yyyy', { locale: fr });
    return `Semaine du ${startStr} au ${endStr}`;
  }, [selectedWeekStart, weekEnd]);

  // Extract all assigned agents for a demand
  const getDemandeAgents = (d: any): any[] => {
    const list: any[] = [];
    const seenIds = new Set<number>();

    if (Array.isArray(d.profils_envoyes)) {
      d.profils_envoyes.forEach((p: any) => {
        const id = Number(p.id || p);
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          const fullAg = agentsMap.get(id) || (typeof p === 'object' ? p : { id });
          list.push(fullAg);
        }
      });
    }

    // Also check parts_repartition
    const parts =
      d.parts_repartition ||
      d.formulaire_data?.parts_repartition ||
      d.formulaire_data?.facturation?.parts_repartition;
    if (Array.isArray(parts)) {
      parts.forEach((p: any) => {
        const pId = Number(p.profile_id || p.agent_id || p.id);
        if (pId && !seenIds.has(pId)) {
          seenIds.add(pId);
          const fullAg = agentsMap.get(pId) || {
            id: pId,
            full_name: p.profile_name || p.agent_name,
            categorie: p.categorie,
          };
          list.push(fullAg);
        }
      });
    }

    return list;
  };

  // Filter demands for this week
  const weekDemandes = useMemo(() => {
    return demandes.filter((d) => {
      // Exclure les contrats mères d'abonnement (les séances filles sont les interventions réelles)
      const isRootSubscription =
        (d.frequency === 'abonnement' || d.frequence === 'abonnement') && !d.parent_demande;
      if (isRootSubscription) return false;

      // Exclure les demandes annulées
      if (d.statut === 'annule') return false;

      const dDateStr = getDemandeStartDate(d);
      if (!dDateStr) return false;

      return dDateStr >= weekStartStr && dDateStr <= weekEndStr;
    });
  }, [demandes, weekStartStr, weekEndStr]);

  // Group by day of week
  const daysWithDemandes = useMemo(() => {
    const days = eachDayOfInterval({ start: selectedWeekStart, end: weekEnd });
    const grouped: { dayDate: Date; dayKey: string; items: any[] }[] = [];

    days.forEach((dayDate) => {
      const dayKey = format(dayDate, 'yyyy-MM-dd');
      const items = weekDemandes.filter((d) => {
        const dDateStr = getDemandeStartDate(d);
        return dDateStr === dayKey;
      });

      // Show day if it has interventions
      if (items.length > 0) {
        grouped.push({ dayDate, dayKey, items });
      }
    });

    return grouped;
  }, [selectedWeekStart, weekEnd, weekDemandes]);

  return (
    <div style={{ backgroundColor: 'white', minHeight: '500px', marginTop: 16 }}>
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 28,
        }}
      >
        {/* Title & Subtitle */}
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#037265', margin: '0 0 4px 0' }}>
            Planning des interventions
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>{weekSubtitle}</p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Week Pagination */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: '3px 4px',
              gap: 4,
            }}
          >
            <button
              onClick={() => setSelectedWeekStart((prev) => subWeeks(prev, 1))}
              title="Semaine précédente"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 6,
                border: 'none',
                backgroundColor: 'transparent',
                color: '#475569',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <ChevronLeft size={18} />
            </button>

            {/* "Semaine en cours" button — active/shown automatically when NOT on current week */}
            {!isCurrentWeek && (
              <button
                onClick={() => setSelectedWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                title="Revenir à la semaine en cours"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '5px 12px',
                  backgroundColor: '#bef264',
                  color: '#1e293b',
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Semaine en cours
              </button>
            )}

            <button
              onClick={() => setSelectedWeekStart((prev) => addWeeks(prev, 1))}
              title="Semaine suivante"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 6,
                border: 'none',
                backgroundColor: 'transparent',
                color: '#475569',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e2e8f0')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Interventions Count Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 14px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              color: '#334155',
            }}
          >
            <Calendar size={15} color="#037265" />
            <span>
              {weekDemandes.length} Intervention{weekDemandes.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchData}
            title="Actualiser les données"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              backgroundColor: 'white',
              color: '#64748b',
              cursor: 'pointer',
            }}
          >
            <RotateCw size={16} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
          <RotateCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          Chargement du planning des interventions...
        </div>
      ) : daysWithDemandes.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: '#f8fafc',
            borderRadius: 12,
            border: '1px dashed #cbd5e1',
            color: '#64748b',
          }}
        >
          <Calendar size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: '#334155', margin: '0 0 4px 0' }}>
            Aucune intervention programmée
          </p>
          <p style={{ fontSize: 13, margin: 0 }}>
            Aucune intervention n’est planifiée pour la {weekSubtitle.toLowerCase()}.
          </p>
        </div>
      ) : (
        daysWithDemandes.map(({ dayDate, dayKey, items }) => {
          const dayNameFormatted = format(dayDate, 'EEEE dd MMMM yyyy', { locale: fr });
          const words = dayNameFormatted.split(' ');
          const dayTitle = words
            .map((w, idx) => (idx === 0 || idx === 2 ? capitalize(w) : w))
            .join(' ');

          const dayAbbr = format(dayDate, 'EEE', { locale: fr }).toUpperCase().slice(0, 3) + '.';
          const dayNum = format(dayDate, 'dd');

          return (
            <div key={dayKey} style={{ marginBottom: 32 }}>
              {/* Day Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                {/* Date Badge */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px 10px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    minWidth: 48,
                    height: 48,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      lineHeight: 1.1,
                    }}
                  >
                    {dayAbbr}
                  </span>
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: '#037265',
                      lineHeight: 1.1,
                    }}
                  >
                    {dayNum}
                  </span>
                </div>

                {/* Day Titles */}
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    {dayTitle}
                  </h3>
                  <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                    {items.length} intervention{items.length > 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Day Table */}
              <div
                style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          backgroundColor: '#fafbfc',
                        }}
                      >
                        <th
                          style={{
                            padding: '12px 20px',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#64748b',
                            letterSpacing: '0.06em',
                          }}
                        >
                          INTERVENANTE
                        </th>
                        <th
                          style={{
                            padding: '12px 20px',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#64748b',
                            letterSpacing: '0.06em',
                          }}
                        >
                          CLIENT / SERVICE
                        </th>
                        <th
                          style={{
                            padding: '12px 20px',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#64748b',
                            letterSpacing: '0.06em',
                          }}
                        >
                          HORAIRES
                        </th>
                        <th
                          style={{
                            padding: '12px 20px',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#64748b',
                            letterSpacing: '0.06em',
                          }}
                        >
                          CATÉGORIE
                        </th>
                        <th
                          style={{
                            padding: '12px 20px',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#64748b',
                            letterSpacing: '0.06em',
                          }}
                        >
                          STATUT
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((d: any, idx: number) => {
                        const assignedAgents = getDemandeAgents(d);
                        const timing = getInterventionTiming(d);
                        const statutInfo = getStatutInfo(d.statut);

                        // Client details
                        const clientName =
                          d.client_name ||
                          d.client?.display_name ||
                          d.formulaire_data?.nom_complet ||
                          'Client';
                        const clientId =
                          d.client?.id ||
                          (typeof d.client === 'number' ? d.client : null) ||
                          (d.client_details?.id ? d.client_details.id : null);

                        const serviceName =
                          d.service || d.formulaire_data?.type_service || 'Ménage standard';
                        const location =
                          d.client_neighborhood ||
                          d.formulaire_data?.quartier ||
                          d.client_city ||
                          d.formulaire_data?.ville ||
                          '';

                        return (
                          <tr
                            key={d.id || idx}
                            style={{
                              borderBottom:
                                idx === items.length - 1 ? 'none' : '1px solid #f1f5f9',
                              transition: 'background-color 0.15s',
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor = '#f8fafc')
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor = 'white')
                            }
                          >
                            {/* INTERVENANTE */}
                            <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                              {assignedAgents.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {assignedAgents.map((ag) => {
                                    const photoUrl = getPhotoUrl(ag.photo);
                                    const agName =
                                      ag.full_name ||
                                      `${ag.first_name || ''} ${ag.last_name || ''}`.trim() ||
                                      `Profil #${ag.id}`;
                                    const initials =
                                      `${ag.first_name?.[0] || ''}${ag.last_name?.[0] || ''}`.toUpperCase() ||
                                      'FM';

                                    return (
                                      <div
                                        key={ag.id}
                                        style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                                      >
                                        {photoUrl ? (
                                          <img
                                            src={photoUrl}
                                            alt={agName}
                                            style={{
                                              width: 36,
                                              height: 36,
                                              borderRadius: '50%',
                                              objectFit: 'cover',
                                              border: '1px solid #cbd5e1',
                                              flexShrink: 0,
                                            }}
                                            onError={(e) => {
                                              // Fallback to initials if image link 404s
                                              e.currentTarget.style.display = 'none';
                                              const next = e.currentTarget.nextElementSibling as HTMLElement;
                                              if (next) next.style.display = 'flex';
                                            }}
                                          />
                                        ) : null}
                                        <div
                                          style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: '50%',
                                            backgroundColor: '#e2e8f0',
                                            color: '#334155',
                                            display: photoUrl ? 'none' : 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 700,
                                            fontSize: 13,
                                            flexShrink: 0,
                                            border: '1px solid #cbd5e1',
                                          }}
                                        >
                                          {initials}
                                        </div>

                                        <Link
                                          to={`/profils/${encodeId(ag.id)}`}
                                          style={{
                                            fontWeight: 600,
                                            fontSize: 14,
                                            color: '#1e293b',
                                            textDecoration: 'none',
                                            transition: 'color 0.15s',
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.color = '#037265';
                                            e.currentTarget.style.textDecoration = 'underline';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.color = '#1e293b';
                                            e.currentTarget.style.textDecoration = 'none';
                                          }}
                                          title={`Consulter le profil de ${agName}`}
                                        >
                                          {agName}
                                        </Link>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div
                                    style={{
                                      width: 36,
                                      height: 36,
                                      borderRadius: '50%',
                                      backgroundColor: '#f1f5f9',
                                      color: '#94a3b8',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: '1px dashed #cbd5e1',
                                      flexShrink: 0,
                                    }}
                                  >
                                    <UserIcon size={16} />
                                  </div>
                                  <span
                                    style={{
                                      fontSize: 13.5,
                                      fontStyle: 'italic',
                                      color: '#94a3b8',
                                    }}
                                  >
                                    Non assignée
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* CLIENT / SERVICE */}
                            <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                              <div>
                                {clientId ? (
                                  <Link
                                    to={`/clients/${encodeId(clientId)}`}
                                    style={{
                                      fontWeight: 700,
                                      fontSize: 14,
                                      color: '#1e293b',
                                      textDecoration: 'none',
                                      transition: 'color 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.color = '#037265';
                                      e.currentTarget.style.textDecoration = 'underline';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.color = '#1e293b';
                                      e.currentTarget.style.textDecoration = 'none';
                                    }}
                                    title={`Consulter la fiche client de ${clientName}`}
                                  >
                                    {clientName}
                                  </Link>
                                ) : (
                                  <div
                                    style={{
                                      fontWeight: 700,
                                      fontSize: 14,
                                      color: '#1e293b',
                                    }}
                                  >
                                    {clientName}
                                  </div>
                                )}
                                <div
                                  style={{
                                    fontSize: 12.5,
                                    color: '#64748b',
                                    marginTop: 3,
                                  }}
                                >
                                  {serviceName}
                                  {location ? ` · ${location}` : ''}
                                </div>
                              </div>
                            </td>

                            {/* HORAIRES */}
                            <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>
                                  {timing.timeRange}
                                </div>
                                <div
                                  style={{
                                    fontSize: 12.5,
                                    color: '#64748b',
                                    marginTop: 3,
                                  }}
                                >
                                  {timing.durationStr}
                                </div>
                              </div>
                            </td>

                            {/* CATÉGORIE */}
                            <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                              {assignedAgents.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {assignedAgents.map((ag) => {
                                    const isInterne = ag.categorie === 'interne';
                                    return (
                                      <div
                                        key={ag.id}
                                        style={{ height: 36, display: 'flex', alignItems: 'center' }}
                                      >
                                        <span
                                          style={{
                                            display: 'inline-block',
                                            padding: '3px 10px',
                                            backgroundColor: isInterne ? '#e0f2fe' : '#fef3c7',
                                            color: isInterne ? '#0369a1' : '#b45309',
                                            borderRadius: 14,
                                            fontSize: 11.5,
                                            fontWeight: 600,
                                            border: isInterne
                                              ? '1px solid #bae6fd'
                                              : '1px solid #fde68a',
                                          }}
                                        >
                                          {isInterne ? 'Interne' : 'Externe'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span style={{ color: '#cbd5e1' }}>—</span>
                              )}
                            </td>

                            {/* STATUT */}
                            <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '4px 12px',
                                  borderRadius: 20,
                                  backgroundColor: statutInfo.bg,
                                  color: statutInfo.color,
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                <span
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    backgroundColor: statutInfo.dot,
                                    display: 'inline-block',
                                  }}
                                />
                                {statutInfo.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
