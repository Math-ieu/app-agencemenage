import { useState, useEffect, type FormEvent } from 'react';
import { 
  getCommandesAirbnb, assignerCommandeAirbnb, cloturerCommandeAirbnb, 
  createObjetTrouve, getMissionPdfData, extractResults 
} from '../../api/airbnb';
import { getAgents } from '../../api/client';
import type { CommandeAirbnb } from '../../types/airbnb';
import { 
  Search, RotateCw, X, Printer, UserCheck, 
  Camera, PackageSearch, Building2, Truck, Shirt, DollarSign
} from 'lucide-react';
import './DossierCommande.css';

export default function DossierCommandeView() {
  const [commandes, setCommandes] = useState<CommandeAirbnb[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Selected Commande for Detail Drawer/Modal
  const [selectedCmd, setSelectedCmd] = useState<CommandeAirbnb | null>(null);

  // Intervenantes for Assignment
  const [agentsList, setAgentsList] = useState<any[]>([]);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignIntervenante, setAssignIntervenante] = useState<number | ''>('');
  const [assignIntervenante2, setAssignIntervenante2] = useState<number | ''>('');
  const [assignRunner, setAssignRunner] = useState<number | ''>('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Cloture Modal State
  const [isClotureOpen, setIsClotureOpen] = useState(false);
  const [photos, setPhotos] = useState<string[]>(['', '', '', '']);
  const [clotureLoading, setClotureLoading] = useState(false);

  // Objet Trouve Modal State
  const [isObjetOpen, setIsObjetOpen] = useState(false);
  const [descriptionObjet, setDescriptionObjet] = useState('');
  const [pieceObjet, setPieceObjet] = useState('');
  const [objetLoading, setObjetLoading] = useState(false);

  const fetchCommandes = async () => {
    setLoading(true);
    try {
      const [cmdRes, agRes] = await Promise.all([
        getCommandesAirbnb({ search, statut: statusFilter }),
        getAgents()
      ]);
      setCommandes(extractResults<CommandeAirbnb>(cmdRes.data));
      setAgentsList(extractResults<any>(agRes.data));
    } catch (err) {
      console.error("Erreur chargement commandes :", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommandes();
  }, [search, statusFilter]);

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
      fetchCommandes();
      setSelectedCmd({
        ...selectedCmd,
        statut: 'assignee',
        intervenante: Number(assignIntervenante),
        intervenante_2: assignIntervenante2 ? Number(assignIntervenante2) : undefined,
      });
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
      alert("4 photos sont obligatoires pour valider la clôture (Salon, Chambre, SDB, Cuisine).");
      return;
    }

    setClotureLoading(true);
    try {
      await cloturerCommandeAirbnb(selectedCmd.id, { photos: validPhotos });
      setIsClotureOpen(false);
      fetchCommandes();
      setSelectedCmd({
        ...selectedCmd,
        statut: 'cloturee',
        photos_cloture: validPhotos,
      });
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de la clôture");
    } finally {
      setClotureLoading(false);
    }
  };

  const handleCreateObjet = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCmd || !descriptionObjet) return;

    setObjetLoading(true);
    try {
      await createObjetTrouve({
        commande: selectedCmd.id,
        bien: selectedCmd.bien,
        description: descriptionObjet,
        piece: pieceObjet,
      });
      setIsObjetOpen(false);
      setDescriptionObjet('');
      setPieceObjet('');
      alert("Objet trouvé enregistré et rattaché au logement.");
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de la déclaration de l'objet");
    } finally {
      setObjetLoading(false);
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

  return (
    <div className="dc-container">
      {/* Toolbar & Filters */}
      <div className="dc-toolbar">
        <div className="dc-toolbar-left">
          <div className="dc-search-wrapper">
            <Search size={16} className="dc-search-icon" />
            <input
              type="text"
              placeholder="Rechercher par numéro, logement, client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="dc-search-input"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="dc-filter-select"
          >
            <option value="">Tous les statuts</option>
            <option value="saisie">Saisie (En attente)</option>
            <option value="assignee">Assignée</option>
            <option value="en_cours">En cours</option>
            <option value="cloturee">Clôturée</option>
            <option value="annulee">Annulée</option>
          </select>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="dc-table-card">
        <table className="dc-table">
          <thead>
            <tr>
              <th>Numéro</th>
              <th>Date & Heure</th>
              <th>Logement</th>
              <th>Client</th>
              <th>Chaîne Linge</th>
              <th>Intervenante(s)</th>
              <th>Total TTC</th>
              <th>Statut</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  <RotateCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                  Chargement des dossiers de commandes...
                </td>
              </tr>
            ) : commandes.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  Aucune commande Airbnb trouvée.
                </td>
              </tr>
            ) : (
              commandes.map((c) => (
                <tr key={c.id} onClick={() => setSelectedCmd(c)}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f766e', background: '#f0fdfa', padding: '0.2rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #ccfbf1' }}>
                      {c.numero}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.date_prestation}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.heure_prestation.slice(0, 5)} ({c.creneau})</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{c.bien_nom}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.bien_code}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{c.client_name}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                      {c.nature_linge.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: c.intervenante_name ? '#0f172a' : '#dc2626' }}>
                      {c.intervenante_name || 'Non assignée'}
                    </div>
                    {c.intervenante_2_name && (
                      <div style={{ fontSize: '0.75rem', color: '#0d9488' }}>+ {c.intervenante_2_name}</div>
                    )}
                  </td>
                  <td style={{ fontWeight: 800, color: '#00473E' }}>
                    {c.total_ttc} DH
                  </td>
                  <td>
                    <span className={`dc-status-badge ${c.statut}`}>
                      {c.statut.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      style={{ padding: '0.35rem 0.85rem', background: '#f1f5f9', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '0.45rem', fontSize: '0.785rem', fontWeight: 600, cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCmd(c);
                      }}
                    >
                      Dossier
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ══════════ MODALE : DOSSIER CENTRAL OPÉRATIONNEL (5 BLOCS) ══════════ */}
      {selectedCmd && (
        <div className="dc-modal-overlay" onClick={() => setSelectedCmd(null)}>
          <div className="dc-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="dc-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#00473E', background: '#f0fdfa', padding: '0.25rem 0.65rem', borderRadius: '0.5rem', border: '1px solid #ccfbf1' }}>
                  {selectedCmd.numero}
                </span>
                <span className={`dc-status-badge ${selectedCmd.statut}`}>
                  {selectedCmd.statut.replace(/_/g, ' ')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 700, color: '#334155', cursor: 'pointer' }}
                  onClick={() => handlePrintMissionPdf(selectedCmd.id)}
                >
                  <Printer size={15} />
                  Fiche Mission PDF (Sans Prix)
                </button>
                <button style={{ background: '#f1f5f9', border: 'none', borderRadius: '0.45rem', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setSelectedCmd(null)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="dc-modal-body">
              {/* 5 Operational Blocks */}
              <div className="dc-console-grid">
                {/* 1. Commercial & Logement */}
                <div className="dc-block">
                  <div className="dc-block-title">
                    <Building2 size={16} color="#00473E" />
                    1. Commercial & Logement
                  </div>
                  <div className="dc-block-row">
                    <span className="lbl">Client :</span>
                    <span className="val">{selectedCmd.client_name}</span>
                  </div>
                  <div className="dc-block-row">
                    <span className="lbl">Logement :</span>
                    <span className="val">{selectedCmd.bien_nom} ({selectedCmd.bien_code})</span>
                  </div>
                  <div className="dc-block-row">
                    <span className="lbl">Date & Créneau :</span>
                    <span className="val">{selectedCmd.date_prestation} • {selectedCmd.creneau}</span>
                  </div>
                </div>

                {/* 2. Runner & Logistique */}
                <div className="dc-block">
                  <div className="dc-block-title">
                    <Truck size={16} color="#00473E" />
                    2. Runner & Logistique
                  </div>
                  <div className="dc-block-row">
                    <span className="lbl">Runner Assigné :</span>
                    <span className="val">{selectedCmd.runner_name || 'En attente'}</span>
                  </div>
                  <div className="dc-block-row">
                    <span className="lbl">Prestation Linge :</span>
                    <span className="val">{selectedCmd.nature_linge.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="dc-block-row">
                    <span className="lbl">Sacs de linge :</span>
                    <span className="val" style={{ color: '#0d9488' }}>
                      {selectedCmd.filets_ramasses?.length || 0} sac(s) rattaché(s)
                    </span>
                  </div>
                </div>

                {/* 3. Laverie & Comptage */}
                <div className="dc-block">
                  <div className="dc-block-title">
                    <Shirt size={16} color="#00473E" />
                    3. Blanchisserie & Linge
                  </div>
                  <div className="dc-block-row">
                    <span className="lbl">Tarif Linge Figé :</span>
                    <span className="val" style={{ color: '#00473E', fontWeight: 800 }}>
                      {selectedCmd.montant_linge ? `${selectedCmd.montant_linge} DH` : 'En attente décompte'}
                    </span>
                  </div>
                  <div className="dc-block-row">
                    <span className="lbl">Barème standard :</span>
                    <span className="val">8 pièces = 50 DH</span>
                  </div>
                </div>

                {/* 4. Intervenantes & Exécution */}
                <div className="dc-block">
                  <div className="dc-block-title">
                    <UserCheck size={16} color="#00473E" />
                    4. Intervenantes & Exécution
                  </div>
                  <div className="dc-block-row">
                    <span className="lbl">Intervenante 1 :</span>
                    <span className="val">{selectedCmd.intervenante_name || 'Non assignée'}</span>
                  </div>
                  {selectedCmd.intervenante_2_name && (
                    <div className="dc-block-row">
                      <span className="lbl">Intervenante 2 (Villa) :</span>
                      <span className="val" style={{ color: '#0d9488' }}>{selectedCmd.intervenante_2_name}</span>
                    </div>
                  )}
                  <div className="dc-block-row">
                    <span className="lbl">Photos de Clôture :</span>
                    <span className="val" style={{ color: selectedCmd.photos_cloture?.length === 4 ? '#16a34a' : '#dc2626' }}>
                      {selectedCmd.photos_cloture?.length || 0} / 4 photos validées
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. Finance & Facturation */}
              <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <DollarSign size={16} />
                    5. Synthèse Financière & Clôture
                  </span>
                  <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#00473E' }}>
                    Total TTC : {selectedCmd.total_ttc} DH
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#134e4a', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem' }}>
                  <div>Ménage base : <b>{selectedCmd.prix_menage} DH</b></div>
                  <div>Suppl. Zone : <b>{selectedCmd.supplement_zone} DH</b></div>
                  <div>Linge Laverie : <b>{selectedCmd.montant_linge || 0} DH</b></div>
                </div>
              </div>

              {/* Actions strip */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.1rem', background: '#00473E', color: '#ffffff', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.825rem', border: 'none', cursor: 'pointer' }}
                  onClick={() => setIsAssignOpen(true)}
                >
                  <UserCheck size={16} />
                  Assigner les Équipes
                </button>

                {selectedCmd.statut !== 'cloturee' && (
                  <button
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.1rem', background: '#0d9488', color: '#ffffff', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.825rem', border: 'none', cursor: 'pointer' }}
                    onClick={() => setIsClotureOpen(true)}
                  >
                    <Camera size={16} />
                    Clôturer (4 Photos)
                  </button>
                )}

                <button
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.1rem', background: '#ffffff', color: '#334155', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.825rem', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                  onClick={() => setIsObjetOpen(true)}
                >
                  <PackageSearch size={16} />
                  Déclarer Objet Trouvé
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODALE : ASSIGNATION INTERVENANTES ══════════ */}
      {isAssignOpen && selectedCmd && (
        <div className="dc-modal-overlay" onClick={() => setIsAssignOpen(false)}>
          <div className="dc-modal-box" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="dc-modal-header">
              <h3>Assignation des Équipes</h3>
              <button style={{ background: '#f1f5f9', border: 'none', borderRadius: '0.45rem', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setIsAssignOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAssign}>
              <div className="dc-modal-body">
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Intervenante Principale *
                  </label>
                  <select
                    required
                    value={assignIntervenante}
                    onChange={(e) => setAssignIntervenante(Number(e.target.value))}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    <option value="">Sélectionner une intervenante...</option>
                    {agentsList.map((a) => (
                      <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Intervenante 2 (Renfort Villa / Riad)
                  </label>
                  <select
                    value={assignIntervenante2}
                    onChange={(e) => setAssignIntervenante2(e.target.value ? Number(e.target.value) : '')}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    <option value="">Optionnel (requis pour Villa/Riad)...</option>
                    {agentsList.map((a) => (
                      <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Runner Logistique
                  </label>
                  <select
                    value={assignRunner}
                    onChange={(e) => setAssignRunner(e.target.value ? Number(e.target.value) : '')}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    <option value="">Optionnel (Tournée Runner)...</option>
                    {agentsList.map((a) => (
                      <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <button type="button" style={{ padding: '0.55rem 1.1rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }} onClick={() => setIsAssignOpen(false)}>
                  Annuler
                </button>
                <button type="submit" disabled={assignLoading} style={{ padding: '0.55rem 1.1rem', background: '#00473E', color: '#ffffff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                  {assignLoading ? 'Enregistrement...' : 'Valider l\'assignation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ MODALE : CLÔTURE 4 PHOTOS ══════════ */}
      {isClotureOpen && selectedCmd && (
        <div className="dc-modal-overlay" onClick={() => setIsClotureOpen(false)}>
          <div className="dc-modal-box" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div className="dc-modal-header">
              <h3>Clôture de Mission (4 Photos Obligatoires)</h3>
              <button style={{ background: '#f1f5f9', border: 'none', borderRadius: '0.45rem', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setIsClotureOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCloture}>
              <div className="dc-modal-body">
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '0.5rem', padding: '0.875rem', color: '#1e40af', fontSize: '0.8rem', marginBottom: '1rem' }}>
                  Conformément aux règles contractuelles Agence Ménage, 4 photos doivent être transmises pour attester de la conformité du ménage.
                </div>

                {['Photo 1 : Salon', 'Photo 2 : Chambre', 'Photo 3 : Salle de bain', 'Photo 4 : Cuisine'].map((label, idx) => (
                  <div key={idx} style={{ marginBottom: '0.875rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                      {label} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="URL ou repère photo (ex: https://storage.../salon.jpg)"
                      value={photos[idx]}
                      onChange={(e) => {
                        const newP = [...photos];
                        newP[idx] = e.target.value;
                        setPhotos(newP);
                      }}
                      style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <button type="button" style={{ padding: '0.55rem 1.1rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }} onClick={() => setIsClotureOpen(false)}>
                  Annuler
                </button>
                <button type="submit" disabled={clotureLoading} style={{ padding: '0.55rem 1.1rem', background: '#0d9488', color: '#ffffff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                  {clotureLoading ? 'Validation...' : 'Valider la Clôture'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════ MODALE : OBJET TROUVÉ ══════════ */}
      {isObjetOpen && selectedCmd && (
        <div className="dc-modal-overlay" onClick={() => setIsObjetOpen(false)}>
          <div className="dc-modal-box" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="dc-modal-header">
              <h3>Déclarer un Objet Trouvé</h3>
              <button style={{ background: '#f1f5f9', border: 'none', borderRadius: '0.45rem', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setIsObjetOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateObjet}>
              <div className="dc-modal-body">
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Description de l'objet *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Montre dorée oubliée sur la table de chevet"
                    value={descriptionObjet}
                    onChange={(e) => setDescriptionObjet(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Pièce / Emplacement
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Chambre parentale"
                    value={pieceObjet}
                    onChange={(e) => setPieceObjet(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                <button type="button" style={{ padding: '0.55rem 1.1rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }} onClick={() => setIsObjetOpen(false)}>
                  Annuler
                </button>
                <button type="submit" disabled={objetLoading} style={{ padding: '0.55rem 1.1rem', background: '#00473E', color: '#ffffff', border: 'none', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                  {objetLoading ? 'Enregistrement...' : 'Enregistrer l\'objet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
