import { useState, useEffect, type FormEvent } from 'react';
import { 
  getPlanningGrid, assignerCommandeAirbnb, cloturerCommandeAirbnb, getMissionPdfData, extractResults 
} from '../../api/airbnb';
import { getAgents } from '../../api/client';
import type { CommandeAirbnb } from '../../types/airbnb';
import { 
  RotateCw, Printer, X, 
  Calendar, UserCheck, Clock, FileText, Camera
} from 'lucide-react';
import './PlanningExecution.css';

export default function PlanningExecutionView() {
  const [activeTab, setActiveTab] = useState<'assignation' | 'fiche' | 'suivi'>('assignation');
  const [commandes, setCommandes] = useState<CommandeAirbnb[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Commande for Assignment / Details
  const [selectedCmd, setSelectedCmd] = useState<CommandeAirbnb | null>(null);

  // Assignment Modal State
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignIntervenante, setAssignIntervenante] = useState<number | ''>('');
  const [assignIntervenante2, setAssignIntervenante2] = useState<number | ''>('');
  const [assignRunner, setAssignRunner] = useState<number | ''>('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Photos Validation State
  const [isPhotosOpen, setIsPhotosOpen] = useState(false);
  const [photos, setPhotos] = useState<string[]>(['', '', '', '']);
  const [clotureLoading, setClotureLoading] = useState(false);

  const fetchPlanning = async () => {
    setLoading(true);
    try {
      const [planRes, agentsRes] = await Promise.all([
        getPlanningGrid({ days: 7 }),
        getAgents()
      ]);
      const cmds = planRes.data?.commandes || extractResults<CommandeAirbnb>(planRes.data);
      setCommandes(cmds);
      setAgents(extractResults<any>(agentsRes.data));
      if (cmds.length > 0 && !selectedCmd) {
        setSelectedCmd(cmds[0]);
      }
    } catch (err) {
      console.error("Erreur chargement planning :", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanning();
  }, []);

  const handleAssign = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCmd || !assignIntervenante) return;

    setAssignLoading(true);
    try {
      await assignerCommandeAirbnb(selectedCmd.id, {
        intervenante_id: Number(assignIntervenante),
        intervenante_2_id: assignIntervenante2 ? Number(assignIntervenante2) : undefined,
        runner_id: assignRunner ? Number(assignRunner) : undefined,
      });
      setIsAssignOpen(false);
      fetchPlanning();
      alert("Intervenante(s) assignée(s) avec succès.");
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de l'assignation");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleCloture = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCmd) return;

    const validPhotos = photos.filter(p => p.trim() !== '');
    if (validPhotos.length < 4) {
      alert("4 photos sont obligatoires (Salon, Chambre, SDB, Cuisine).");
      return;
    }

    setClotureLoading(true);
    try {
      await cloturerCommandeAirbnb(selectedCmd.id, { photos: validPhotos });
      setIsPhotosOpen(false);
      fetchPlanning();
      alert("Mission clôturée avec succès.");
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de la clôture");
    } finally {
      setClotureLoading(false);
    }
  };

  const handlePrintMissionPdf = async (cmdId: string) => {
    try {
      const res = await getMissionPdfData(cmdId);
      const data = res.data as any;
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Fiche de Mission — ${data.numero_commande}</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; color: #0f172a; font-size: 13px; line-height: 1.5; }
                .header { border-bottom: 2px solid #00473E; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; }
                .title { font-size: 20px; font-weight: 800; color: #00473E; }
                .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 14px; background: #f8fafc; }
                .confidential { background: #fef2f2; border: 1px dashed #ef4444; color: #991b1b; padding: 12px; border-radius: 8px; font-weight: bold; margin-bottom: 16px; font-size: 12px; }
                .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
                .label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 2px; }
                .val { font-weight: 700; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="header">
                <div>
                  <div class="title">FICHE DE MISSION — ${data.numero_commande}</div>
                  <div style="color: #64748b;">Turnover Airbnb & Conciergerie • Agence Ménage</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-weight: bold;">Date : ${data.date_prestation}</div>
                  <div>Heure : ${data.heure_prestation}</div>
                </div>
              </div>

              <div class="confidential">
                🔒 STRICTEMENT CONFIDENTIEL — DOCUMENT OPÉRATIONNEL SANS MENTION TARIFAIRE
              </div>

              <div class="box">
                <div class="label">Logement d'Intervention</div>
                <div class="val">${data.nom_bien || 'Logement'} (${data.code_bien})</div>
                <div>${data.adresse_complete} (${data.quartier})</div>
                <div style="margin-top: 8px;"><b>Typologie :</b> ${data.typologie.toUpperCase()}</div>
              </div>

              <div class="box" style="border-color: #fca5a5; background: #fff5f5;">
                <div class="label" style="color: #dc2626;">Accès Sécurisé & Digicodes</div>
                <div class="val" style="color: #991b1b;">${data.acces_securise}</div>
                <div style="margin-top: 4px; font-weight: bold;">${data.consignes_securite || 'Pas de consigne particulière'}</div>
              </div>

              <div class="grid">
                <div class="box">
                  <div class="label">Intervenante(s) Assignée(s)</div>
                  <div class="val">${data.intervenante_nom || 'Non assignée'}</div>
                  ${data.intervenante_2_nom ? `<div><b>Renfort Villa :</b> ${data.intervenante_2_nom}</div>` : ''}
                </div>

                <div class="box">
                  <div class="label">Runner & Logistique Linge</div>
                  <div class="val">${data.nature_linge}</div>
                  <div><b>Runner :</b> ${data.runner_nom || 'Non assigné'}</div>
                </div>
              </div>

              <div class="box">
                <div class="label">Checklist Clôture Obligatoire</div>
                <div>• Prendre impérativement les 4 photos de conformité (Salon, Chambre, Salle de bain, Cuisine).</div>
                <div>• Contrôler les placards et tiroirs à la recherche d'objets oubliés par les voyageurs.</div>
                <div>• Fermer les fenêtres et s'assurer du verrouillage de la porte d'entrée.</div>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      }
    } catch (err: any) {
      alert("Erreur lors de la génération de la fiche de mission PDF");
    }
  };

  const unassignedCount = commandes.filter(c => !c.intervenante).length;

  return (
    <div className="pe-container">
      {/* 18h00 J-1 Alert Strip */}
      <div className="pe-alert-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <Clock size={20} />
          <div>
            <b>Verrouillage des Assignations à 18h00 (J-1) :</b> Toutes les missions du lendemain doivent avoir leurs intervenantes et runners affectés.
          </div>
        </div>
        {unassignedCount > 0 ? (
          <span style={{ padding: '0.25rem 0.65rem', background: '#dc2626', color: '#ffffff', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 800 }}>
            {unassignedCount} mission(s) non assignée(s)
          </span>
        ) : (
          <span style={{ padding: '0.25rem 0.65rem', background: '#16a34a', color: '#ffffff', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 800 }}>
            ✓ Toutes les équipes sont assignées
          </span>
        )}
      </div>

      {/* Subtabs Segmented Strip */}
      <div className="pe-subtabs">
        <button
          onClick={() => setActiveTab('assignation')}
          className={`pe-tab-btn ${activeTab === 'assignation' ? 'active' : ''}`}
        >
          <UserCheck size={16} />
          <span>Assignation J-1 (18h00)</span>
        </button>

        <button
          onClick={() => setActiveTab('fiche')}
          className={`pe-tab-btn ${activeTab === 'fiche' ? 'active' : ''}`}
        >
          <FileText size={16} />
          <span>Fiche de Mission (Sans Prix)</span>
        </button>

        <button
          onClick={() => setActiveTab('suivi')}
          className={`pe-tab-btn ${activeTab === 'suivi' ? 'active' : ''}`}
        >
          <Camera size={16} />
          <span>Suivi du Jour & Photos</span>
        </button>
      </div>

      {activeTab === 'assignation' && (
        /* ══════════ ASSIGNATION J-1 ══════════ */
        <div className="pe-table-card">
          <table className="pe-table">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Date & Heure</th>
                <th>Logement</th>
                <th>Intervenante 1</th>
                <th>Intervenante 2 (Villa)</th>
                <th>Runner</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    <RotateCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                    Chargement du planning des missions...
                  </td>
                </tr>
              ) : commandes.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    <Calendar size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                    Aucun turnover planifié sur les 7 prochains jours.
                  </td>
                </tr>
              ) : (
                commandes.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f766e', background: '#f0fdfa', padding: '0.25rem 0.55rem', borderRadius: '0.375rem', border: '1px solid #ccfbf1' }}>
                        {c.numero}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.date_prestation}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.heure_prestation.slice(0, 5)}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.bien_nom}</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.bien_code}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: c.intervenante_name ? '#0f172a' : '#dc2626' }}>
                        {c.intervenante_name || '⚠️ Non assignée'}
                      </div>
                    </td>
                    <td>
                      {c.intervenante_2_name ? (
                        <div style={{ fontWeight: 700, color: '#0d9488' }}>
                          {c.intervenante_2_name}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#334155' }}>
                        {c.runner_name || 'Non assigné'}
                      </span>
                    </td>
                    <td>
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, background: c.statut === 'cloturee' ? '#f0fdf4' : '#f1f5f9', color: c.statut === 'cloturee' ? '#15803d' : '#475569' }}>
                        {c.statut.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        style={{ padding: '0.35rem 0.85rem', background: '#00473E', color: '#ffffff', border: 'none', borderRadius: '0.45rem', fontSize: '0.785rem', fontWeight: 700, cursor: 'pointer' }}
                        onClick={() => {
                          setSelectedCmd(c);
                          setIsAssignOpen(true);
                        }}
                      >
                        Affecter
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'fiche' && (
        /* ══════════ FICHE DE MISSION ══════════ */
        <div className="pe-split-layout">
          <div className="pe-mission-list">
            <div style={{ padding: '0.875rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase', color: '#64748b' }}>
              Missions à Exécuter ({commandes.length})
            </div>
            {commandes.map((c) => (
              <div
                key={c.id}
                className={`pe-mission-item ${selectedCmd?.id === c.id ? 'selected' : ''}`}
                onClick={() => setSelectedCmd(c)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.75rem', color: '#00473E' }}>
                    {c.numero}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>
                    {c.date_prestation}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{c.bien_nom}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.intervenante_name || 'Non assignée'}</div>
              </div>
            ))}
          </div>

          <div className="pe-sheet-card">
            {selectedCmd ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #00473E', paddingBottom: '0.875rem', marginBottom: '1.25rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#00473E', margin: 0 }}>
                      Fiche de Mission — {selectedCmd.numero}
                    </h2>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      Prestation prévue le {selectedCmd.date_prestation} à {selectedCmd.heure_prestation.slice(0, 5)}
                    </div>
                  </div>

                  <button
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1rem', background: '#00473E', color: '#ffffff', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.825rem', border: 'none', cursor: 'pointer' }}
                    onClick={() => handlePrintMissionPdf(selectedCmd.id)}
                  >
                    <Printer size={16} />
                    Imprimer Fiche PDF
                  </button>
                </div>

                <div style={{ background: '#fef2f2', border: '1px dashed #ef4444', color: '#991b1b', padding: '0.875rem', borderRadius: '0.5rem', fontSize: '0.775rem', fontWeight: 700, marginBottom: '1rem' }}>
                  🔒 STRICTEMENT CONFIDENTIEL — AUCUNE MENTION DE PRIX SUR LA FICHE DE MISSION DE L'INTERVENANTE
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Logement</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>{selectedCmd.bien_nom}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Code : {selectedCmd.bien_code}</div>
                  </div>

                  <div style={{ padding: '1rem', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '0.5rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#dc2626' }}>Accès Sécurisé</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#991b1b', marginTop: '2px' }}>Standard Boîte à Clés</div>
                    <div style={{ fontSize: '0.8rem', color: '#991b1b' }}>Code confidentiel remis à l'arrivée</div>
                  </div>
                </div>

                <div style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.5rem' }}>
                    Checklist Qualité de Clôture
                  </div>
                  <div style={{ fontSize: '0.825rem', color: '#334155', lineHeight: 1.6 }}>
                    ✓ Nettoyage et désinfection des sanitaires et cuisine<br />
                    ✓ Mise en place du linge propre selon standard hôtelier<br />
                    ✓ Prise des 4 photos de conformité obligatoires (Salon, Chambre, SDB, Cuisine)<br />
                    ✓ Contrôle des fenêtres et fermeture à clé
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                Sélectionnez une mission dans la liste de gauche pour afficher la fiche.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'suivi' && (
        /* ══════════ SUIVI DU JOUR & PHOTOS ══════════ */
        <div className="pe-suivi-grid">
          {commandes.map((c) => (
            <div key={c.id} className="pe-suivi-card">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#00473E', background: '#f0fdfa', padding: '0.2rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #ccfbf1', fontSize: '0.75rem' }}>
                    {c.numero}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                    {c.heure_prestation.slice(0, 5)}
                  </span>
                </div>

                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.2rem' }}>
                  {c.bien_nom}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.75rem' }}>
                  Intervenante : <b>{c.intervenante_name || 'Non assignée'}</b>
                </div>

                <div style={{ padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0', fontSize: '0.8rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Photos de Clôture :</span>
                  <b style={{ color: c.photos_cloture?.length === 4 ? '#16a34a' : '#dc2626' }}>
                    {c.photos_cloture?.length || 0} / 4 photos
                  </b>
                </div>
              </div>

              {c.statut !== 'cloturee' ? (
                <button
                  style={{ width: '100%', padding: '0.6rem', background: '#0d9488', color: '#ffffff', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.825rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                  onClick={() => {
                    setSelectedCmd(c);
                    setIsPhotosOpen(true);
                  }}
                >
                  <Camera size={15} />
                  Valider les Photos
                </button>
              ) : (
                <div style={{ textAlign: 'center', padding: '0.5rem', background: '#f0fdf4', color: '#15803d', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.8rem' }}>
                  ✓ Mission Conforme & Clôturée
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ══════════ MODALE : ASSIGNATION ══════════ */}
      {isAssignOpen && selectedCmd && (
        <div className="cb-modal-overlay" onClick={() => setIsAssignOpen(false)}>
          <div className="cb-modal-box" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="cb-modal-header">
              <h3>Affectation des Équipes — {selectedCmd.numero}</h3>
              <button style={{ background: '#f1f5f9', border: 'none', borderRadius: '0.45rem', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setIsAssignOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAssign}>
              <div className="cb-modal-body">
                <div className="cb-form-group">
                  <label className="cb-form-label">Intervenante Principale <span className="req">*</span></label>
                  <select
                    required
                    value={assignIntervenante}
                    onChange={(e) => setAssignIntervenante(Number(e.target.value))}
                    className="cb-form-select"
                  >
                    <option value="">Sélectionner une intervenante...</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
                    ))}
                  </select>
                </div>

                <div className="cb-form-group">
                  <label className="cb-form-label">Intervenante 2 (Renfort Villa / Riad)</label>
                  <select
                    value={assignIntervenante2}
                    onChange={(e) => setAssignIntervenante2(e.target.value ? Number(e.target.value) : '')}
                    className="cb-form-select"
                  >
                    <option value="">Optionnel (Obligatoire pour Villa/Riad)...</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
                    ))}
                  </select>
                </div>

                <div className="cb-form-group">
                  <label className="cb-form-label">Runner Logistique</label>
                  <select
                    value={assignRunner}
                    onChange={(e) => setAssignRunner(e.target.value ? Number(e.target.value) : '')}
                    className="cb-form-select"
                  >
                    <option value="">Optionnel (Tournée Runner)...</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="cb-modal-footer">
                <button type="button" className="cb-btn-secondary" onClick={() => setIsAssignOpen(false)}>
                  Annuler
                </button>
                <button type="submit" disabled={assignLoading} className="cb-btn-primary">
                  {assignLoading ? 'Enregistrement...' : 'Valider l\'Affectation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ MODALE : PHOTOS CLÔTURE ══════════ */}
      {isPhotosOpen && selectedCmd && (
        <div className="cb-modal-overlay" onClick={() => setIsPhotosOpen(false)}>
          <div className="cb-modal-box" style={{ maxWidth: '540px' }} onClick={(e) => e.stopPropagation()}>
            <div className="cb-modal-header">
              <h3>Contrôle & Validation des 4 Photos</h3>
              <button style={{ background: '#f1f5f9', border: 'none', borderRadius: '0.45rem', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setIsPhotosOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCloture}>
              <div className="cb-modal-body">
                {['Photo 1 : Salon', 'Photo 2 : Chambre', 'Photo 3 : Salle de bain', 'Photo 4 : Cuisine'].map((label, idx) => (
                  <div key={idx} className="cb-form-group">
                    <label className="cb-form-label">{label} <span className="req">*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="URL ou repère de validation (ex: photo_ok)"
                      value={photos[idx]}
                      onChange={(e) => {
                        const newP = [...photos];
                        newP[idx] = e.target.value;
                        setPhotos(newP);
                      }}
                      className="cb-form-input"
                    />
                  </div>
                ))}
              </div>

              <div className="cb-modal-footer">
                <button type="button" className="cb-btn-secondary" onClick={() => setIsPhotosOpen(false)}>
                  Annuler
                </button>
                <button type="submit" disabled={clotureLoading} className="cb-btn-primary" style={{ background: '#0d9488' }}>
                  {clotureLoading ? 'Validation...' : 'Valider la Clôture'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
