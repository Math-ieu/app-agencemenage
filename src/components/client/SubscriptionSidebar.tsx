import React, { useState } from 'react';
import { Slash, Clock, MessageSquare, XCircle, Plus, Trash2, PlayCircle, AlertTriangle } from 'lucide-react';
import { Client, Demande } from '../../types';
import { updateDemande } from '../../api/client';
import { getNextIntervention } from '../../utils/pricing';
import { useAuthStore } from '../../store/auth';
import { checkPermission } from '../../utils/permissions';

const INVALID_INTERVENANT_NAMES = [
  'mathdev', 'mathieu dev', 'admin', 'administrator', 'system', 'chargée opérationnelle', 'à attribuer', 'aucun', 'undefined', 'null'
];

export const isRealPrestataireName = (name: any): boolean => {
  if (!name || typeof name !== 'string') return false;
  const normalized = name.trim().toLowerCase();
  if (!normalized || normalized.length < 2) return false;
  return !INVALID_INTERVENANT_NAMES.some(invalid => normalized.includes(invalid));
};

export interface SubscriptionSidebarProps {
  latest: Demande;
  client?: Client;
  childDemandes: Demande[];
  onOpenInvoiceModal: () => void;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  fetchData?: () => Promise<void>;
}

export const SubscriptionSidebar: React.FC<SubscriptionSidebarProps> = ({
  latest,
  client,
  childDemandes,
  onOpenInvoiceModal,
  addToast,
  fetchData
}) => {
  const { user } = useAuthStore();
  const [showResilierModal, setShowResilierModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isResilie = React.useMemo(() => {
    const dbStatut = (latest?.statut || '').toLowerCase().trim();
    const stEnCours = ((latest?.formulaire_data as any)?.statut_mois_en_cours || '').toLowerCase().trim();
    return dbStatut === 'resilie' || stEnCours === 'résilié' || stEnCours === 'resilie';
  }, [latest?.statut, latest?.formulaire_data]);
  const [customTerrainLines, setCustomTerrainLines] = useState<string[]>(() => {
    return latest?.formulaire_data?.infos_terrain_custom || [];
  });

  React.useEffect(() => {
    if (latest?.formulaire_data?.infos_terrain_custom) {
      setCustomTerrainLines(latest.formulaire_data.infos_terrain_custom);
    }
  }, [latest?.id, latest?.formulaire_data?.infos_terrain_custom]);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newLineText, setNewLineText] = useState('');

  const handleAddLine = async () => {
    if (!newLineText.trim() || !latest?.id) return;
    const updated = [...customTerrainLines, newLineText.trim()];
    setCustomTerrainLines(updated);
    setNewLineText('');
    setShowAddInput(false);
    try {
      await updateDemande(latest.id, { formulaire_data: { infos_terrain_custom: updated } } as any);
      addToast("Info terrain ajoutée avec succès", "success");
    } catch (e) {
      console.error("Erreur d'ajout info terrain:", e);
    }
  };

  const handleRemoveLine = async (index: number) => {
    if (!latest?.id) return;
    const updated = customTerrainLines.filter((_, i) => i !== index);
    setCustomTerrainLines(updated);
    try {
      await updateDemande(latest.id, { formulaire_data: { infos_terrain_custom: updated } } as any);
      addToast("Info terrain supprimée", "info");
    } catch (e) {
      console.error("Erreur de suppression info terrain:", e);
    }
  };
  const nextInterventionResult = React.useMemo(() => {
    return getNextIntervention(latest, childDemandes);
  }, [latest, childDemandes]);

  const extractRealAgentNames = (d: Demande): string[] => {
    if (!d) return [];
    const dAny = d as any;
    const names: string[] = [];

    const candidateNames = [
      dAny.intervenant_name,
      dAny.intervenante_name,
      dAny.intervenante,
      dAny.agent_name,
      dAny.profil_affecte_name,
      dAny.assigned_to_operations_name,
      dAny.agent_detail?.full_name,
      dAny.intervenante_detail?.full_name
    ];

    candidateNames.forEach(cName => {
      if (isRealPrestataireName(cName) && !names.includes((cName as string).trim())) {
        names.push((cName as string).trim());
      }
    });

    if (Array.isArray(d.profils_envoyes) && d.profils_envoyes.length > 0) {
      d.profils_envoyes.forEach((p: any) => {
        const pName = p.full_name || p.nom_complet || p.name || (p.first_name || p.prenom ? `${p.first_name || p.prenom || ''} ${p.last_name || p.nom || ''}`.trim() : null);
        if (isRealPrestataireName(pName) && !names.includes(pName.trim())) {
          names.push(pName.trim());
        }
      });
    }

    return names;
  };

  const nextIntervenantDisplay = React.useMemo(() => {
    if (nextInterventionResult?.childDemande) {
      const names = extractRealAgentNames(nextInterventionResult.childDemande);
      if (names.length > 0) return names.join(', ');
    }
    if (nextInterventionResult?.housekeeper && nextInterventionResult.housekeeper !== 'Non affecté') {
      return nextInterventionResult.housekeeper;
    }
    return 'À assigner par la chargée opérationnelle';
  }, [nextInterventionResult]);

  const handleConfirmResiliation = async () => {
    if (!latest?.id) return;
    const perm = checkPermission(user, 'resilier_abonnement');
    if (!perm.allowed) {
      addToast(perm.message || "Action non autorisée par votre rôle.", "error");
      return;
    }
    setIsProcessing(true);
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      await updateDemande(latest.id, {
        statut: 'resilie',
        formulaire_data: {
          ...(latest.formulaire_data || {}),
          statut_mois_en_cours: 'Résilié',
          statut_mois_prochain: 'Résilié',
          date_resiliation: todayIso
        }
      } as any);

      // Cancel unexecuted child interventions for this subscription
      if (Array.isArray(childDemandes) && childDemandes.length > 0) {
        const unexecutedChildren = childDemandes.filter(c => 
          !['termine', 'terminee', 'pres_terminee', 'pres. terminée'].includes((c.statut || '').toLowerCase().trim())
        );
        for (const child of unexecutedChildren) {
          await updateDemande(child.id, { statut: 'annule' }).catch(() => {});
        }
      }

      addToast("L'abonnement a été résilié. Le client reste conservé dans la base de données.", "info");
      setShowResilierModal(false);
      if (fetchData) await fetchData();
    } catch (err) {
      console.error("Erreur lors de la résiliation:", err);
      addToast("Erreur lors de la résiliation de l'abonnement.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReactiverAbonnement = async () => {
    if (!latest?.id) return;
    const perm = checkPermission(user, 'modifier_abonnement');
    if (!perm.allowed) {
      addToast(perm.message || "Action non autorisée par votre rôle.", "error");
      return;
    }
    setIsProcessing(true);
    try {
      await updateDemande(latest.id, {
        statut: 'en_cours',
        formulaire_data: {
          ...(latest.formulaire_data || {}),
          statut_mois_en_cours: 'Actif',
          statut_mois_prochain: 'Non défini',
          date_resiliation: null
        }
      } as any);

      addToast("Abonnement réactivé avec succès ! Il réapparaît désormais sur la gestion des abonnements et le planning.", "success");
      if (fetchData) await fetchData();
    } catch (err) {
      console.error("Erreur lors de la réactivation:", err);
      addToast("Erreur lors de la réactivation de l'abonnement.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const clientDisplayName = client?.display_name || `${(client as any)?.first_name || ''} ${(client as any)?.last_name || ''}`.trim() || latest?.client_name || 'ce client';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Card 1: Prochain passage */}
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          » Prochain passage
        </div>
        {nextInterventionResult?.date ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#037265' }}>
              {nextInterventionResult.formattedFullDay}
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>—</div>
            <div>
              <span style={{ fontSize: 11, background: '#ffffff', border: '1px solid #f59e0b', color: '#92400e', padding: '3px 10px', borderRadius: 20, fontWeight: 600, display: 'inline-block' }}>
                → Remonté au Tableau de bord (J-1)
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, marginTop: 4 }}>
              Intervenante : <span style={{ fontWeight: 700 }}>{nextIntervenantDisplay}</span>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
            Aucune intervention programmée
          </div>
        )}
      </div>

      {/* Card 2: Intervenantes habituelles */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#037265', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
          👥 Intervenantes habituelles
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
          {(() => {
            const intervCounts: Record<string, { count: number; note?: string }> = {};

            childDemandes.forEach((d: Demande) => {
              const names = extractRealAgentNames(d);
              const note = (d as any).intervenant_note || (d as any).note_client;
              names.forEach(name => {
                if (!intervCounts[name]) {
                  intervCounts[name] = { count: 1, note };
                } else {
                  intervCounts[name].count += 1;
                  if (note && !intervCounts[name].note) {
                    intervCounts[name].note = note;
                  }
                }
              });
            });

            const parentAgentNames = extractRealAgentNames(latest);
            parentAgentNames.forEach(name => {
              if (!intervCounts[name]) {
                intervCounts[name] = { count: Math.max(childDemandes.length, 1) };
              }
            });

            const entries = Object.entries(intervCounts).sort((a, b) => b[1].count - a[1].count);

            if (entries.length === 0) {
              return (
                <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 12, padding: '4px 0' }}>
                  Aucune intervenante affectée pour le moment
                </div>
              );
            }

            return entries.map(([name, info], index) => {
              let icon = '•';
              let iconColor = '#64748b';
              if (index === 0) {
                icon = '⭐';
                iconColor = '#f59e0b';
              } else if (index === 1) {
                icon = '✓';
                iconColor = '#64748b';
              }

              return (
                <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155' }}>
                    <span style={{ color: iconColor, fontSize: 14 }}>{icon}</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{name}</span>
                    <span style={{ color: '#64748b' }}>
                      — {info.count} passage{info.count > 1 ? 's' : ''}
                      {info.note ? ` · ${info.note}` : (index === 0 && info.count >= 5 ? ' · appréciée du client' : (index === 1 ? ' · remplacements' : ''))}
                    </span>
                  </div>
                </div>
              );
            });
          })()}
        </div>

        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 14, fontStyle: 'italic', lineHeight: 1.4, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
          ⓘ Continuité non garantie contractuellement — priorité donnée à la première intervenante quand disponible.
        </div>
      </div>

      {/* Card 3: Infos terrain */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
            📍 Infos terrain
          </div>
          <button
            type="button"
            onClick={() => setShowAddInput(prev => !prev)}
            title="Ajouter une ligne d'information"
            style={{ background: '#f1f5f9', border: 'none', borderRadius: 4, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: 800 }}
          >
            <Plus size={14} color="#0f172a" />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: '#334155' }}>
          {(() => {
            const realLines: React.ReactNode[] = [];

            const cityQuartier = [(client as any)?.quartier, client?.city || (client as any)?.ville].filter(Boolean).join(', ');
            if (cityQuartier) {
              realLines.push(<div key="city">🏢 {cityQuartier}</div>);
            }

            const codeEntree = (client as any)?.code_entree || latest?.formulaire_data?.code_entree;
            if (codeEntree) {
              realLines.push(<div key="code">🔑 Code entrée : {codeEntree}</div>);
            }

            const accesAscenseur = (client as any)?.acces_ascenseur || latest?.formulaire_data?.acces_ascenseur;
            if (accesAscenseur) {
              realLines.push(<div key="acces">🚪 Accès / ascenseur : {accesAscenseur}</div>);
            }

            const animaux = (client as any)?.animaux || latest?.formulaire_data?.animaux;
            if (animaux) {
              realLines.push(<div key="animaux">🐕 Animaux : {animaux}</div>);
            }

            const prefContact = (client as any)?.preference_contact || latest?.formulaire_data?.preference_contact;
            if (prefContact) {
              realLines.push(<div key="contact">💬 Préférence contact : {prefContact}</div>);
            }

            customTerrainLines.forEach((line, idx) => {
              realLines.push(
                <div key={`custom-${idx}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '4px 8px', borderRadius: 6 }}>
                  <span>📌 {line}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(idx)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
                  >
                    <Trash2 size={12} color="#ef4444" />
                  </button>
                </div>
              );
            });

            if (realLines.length === 0 && !showAddInput) {
              return (
                <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 12 }}>
                  Aucune information terrain enregistrée
                </div>
              );
            }

            return realLines;
          })()}

          {showAddInput && (
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <input
                type="text"
                placeholder="Nouvelle précision..."
                value={newLineText}
                onChange={e => setNewLineText(e.target.value)}
                style={{ flex: 1, padding: '4px 8px', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none' }}
                onKeyDown={e => { if (e.key === 'Enter') handleAddLine(); }}
              />
              <button
                type="button"
                onClick={handleAddLine}
                style={{ background: '#037265', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                Ajouter
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Card 4: Journal de l'abonnement */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: '#0f172a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          📜 Journal de l'abonnement
        </div>
        <div style={{ fontSize: 12, color: isResilie ? '#dc2626' : '#94a3b8', fontStyle: 'italic', fontWeight: isResilie ? 700 : 400 }}>
          {isResilie ? "⚠️ Abonnement résilié" : "Aucun évènement"}
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
          <button type="button" onClick={onOpenInvoiceModal} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 8, background: 'white', fontSize: 12, fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
            <Clock size={14} color="#64748b" /> Modifier jours / heures
          </button>
          <button 
            type="button" 
            onClick={() => {
              const tel = client?.phone || (client as any)?.telephone || latest?.client_phone || latest?.client_whatsapp;
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

          {/* Résilier ou Réactiver button */}
          {isResilie ? (
            <button
              type="button"
              onClick={handleReactiverAbonnement}
              disabled={isProcessing}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                padding: '9px 12px',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                background: '#f0fdf4',
                fontSize: 12,
                fontWeight: 700,
                color: '#15803d',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 3px rgba(22, 163, 74, 0.15)'
              }}
            >
              <PlayCircle size={15} color="#15803d" />
              {isProcessing ? "Réactivation..." : "Réactiver l'abonnement"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowResilierModal(true)}
              disabled={isProcessing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #fee2e2',
                borderRadius: 8,
                background: '#fef2f2',
                fontSize: 12,
                fontWeight: 700,
                color: '#ef4444',
                cursor: isProcessing ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <XCircle size={14} color="#ef4444" />
              Résilier l'abonnement
            </button>
          )}
        </div>
      </div>

      {/* ── Modal Confirmation Résiliation ── */}
      {showResilierModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(3px)',
            padding: 16
          }}
          onClick={() => { if (!isProcessing) setShowResilierModal(false); }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: 14,
              padding: '24px',
              maxWidth: 440,
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626',
                  flexShrink: 0
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Résilier l'abonnement ?
                </h3>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  Action réversible à tout moment
                </span>
              </div>
            </div>

            <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <p style={{ margin: 0, marginBottom: 8 }}>
                L'abonnement de <strong>{clientDisplayName}</strong> sera résilié et ses interventions ne figureront plus sur la page de gestion des abonnements ni sur le planning.
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#047857', fontWeight: 600 }}>
                ✓ Le compte client reste bien conservé dans votre base de données.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setShowResilierModal(false)}
                disabled={isProcessing}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: isProcessing ? 'not-allowed' : 'pointer'
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmResiliation}
                disabled={isProcessing}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <XCircle size={15} />
                {isProcessing ? "Résiliation..." : "Confirmer la résiliation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
