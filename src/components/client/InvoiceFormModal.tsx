import React, { useState, useEffect } from 'react';
import { DollarSign, X, AlertCircle, FileText } from 'lucide-react';
import { Demande, Client } from '../../types';
import { updateDemande, generateDocument } from '../../api/client';
import { getContractBaselinePassages, calculateSinglePassagePrice } from '../../utils/pricing';

export interface InvoiceFormModalProps {
  show: boolean;
  onClose: () => void;
  latest: Demande;
  client?: Client;
  monthDemandes: Demande[];
  selectedDays: string[];
  activeTabIndex: number;
  capitalizedMonthTitle: string;
  frequencyLabel?: string;
  dateDebut?: string;
  monthPassagesPlanifies?: number;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  fetchData?: () => Promise<void>;
}

export const InvoiceFormModal: React.FC<InvoiceFormModalProps> = ({
  show,
  onClose,
  latest,
  client,
  monthDemandes,
  selectedDays,
  activeTabIndex,
  capitalizedMonthTitle,
  frequencyLabel,
  dateDebut,
  monthPassagesPlanifies,
  addToast,
  fetchData
}) => {
  const formatFrequenceOption = (raw?: string, daysCount?: number): string => {
    const str = String(raw || '').toLowerCase();
    if (daysCount && daysCount >= 1 && daysCount <= 7) return `${daysCount} fois / semaine`;
    if (str.includes('1')) return '1 fois / semaine';
    if (str.includes('2')) return '2 fois / semaine';
    if (str.includes('3')) return '3 fois / semaine';
    if (str.includes('4')) return '4 fois / semaine';
    if (str.includes('5')) return '5 fois / semaine';
    if (str.includes('6')) return '6 fois / semaine';
    if (str.includes('7')) return '7 fois / semaine';
    return '2 fois / semaine';
  };

  // ═══════════════════════════════════════════════════════════════
  // Form States — Paramètres de l'abonnement
  // ═══════════════════════════════════════════════════════════════
  const [invService, setInvService] = useState(() => latest?.service || latest?.type_prestation || 'Grand ménage');
  const [invFrequence, setInvFrequence] = useState(() => formatFrequenceOption(latest?.formulaire_data?.frequence || latest?.frequency_label || frequencyLabel, selectedDays?.length));
  const [invDateStart, setInvDateStart] = useState(() => dateDebut || latest?.date_intervention || '');
  const [invNbPersonnes, setInvNbPersonnes] = useState(() => String(latest?.nb_intervenants || latest?.formulaire_data?.nb_intervenants || 1));
  const [invDuree, setInvDuree] = useState(() => String(latest?.nb_heures || latest?.formulaire_data?.duree || 4));
  const [invModePaiement, setInvModePaiement] = useState(() => latest?.mode_paiement || 'Virement');
  const [invCommission, setInvCommission] = useState(() => String((latest as any)?.commission || ''));
  const [invJoursPassage, setInvJoursPassage] = useState(() => selectedDays && selectedDays.length > 0 ? selectedDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(' + ') : 'Lundi + Jeudi');
  const [invProduitsInclus, setInvProduitsInclus] = useState(false);
  const [invInterventionsRecup, setInvInterventionsRecup] = useState('0');

  // ═══════════════════════════════════════════════════════════════
  // Tarification — dérivée du devis
  // ═══════════════════════════════════════════════════════════════
  const [invNbPassages, setInvNbPassages] = useState('4');
  const [invPrixUnitaire, setInvPrixUnitaire] = useState('0');
  const [invRemiseDh, setInvRemiseDh] = useState('0');
  const [invTvaPercent, setInvTvaPercent] = useState('20');

  // ═══════════════════════════════════════════════════════════════
  // Devis reference (read-only display)
  // ═══════════════════════════════════════════════════════════════
  const [devisTotal, setDevisTotal] = useState(0);
  const [passagesBase, setPassagesBase] = useState(4);

  // ═══════════════════════════════════════════════════════════════
  // Initialization from devis data
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (show && latest) {
      const formData = latest.formulaire_data || {};

      // ── Service & fréquence ──
      const realService = latest.service || latest.type_prestation || formData.type_prestation || formData.service || 'Grand ménage';
      setInvService(realService);

      const rawFreq = latest.frequency_label || formData.frequence || frequencyLabel;
      setInvFrequence(formatFrequenceOption(rawFreq, selectedDays?.length));

      const realStartDate = dateDebut || latest.planning?.date_debut || formData.date_demarrage || formData.date_debut || latest.date_intervention || (latest.created_at ? latest.created_at.slice(0, 10) : '');
      setInvDateStart(realStartDate);

      const realNbPersonnes = latest.nb_intervenants || formData.nb_personnes || formData.nb_intervenants || formData.nb_intervenantes || 1;
      setInvNbPersonnes(String(realNbPersonnes));

      const isGrand = String(realService).toLowerCase().includes('grand');
      const realDuree = latest.nb_heures || formData.duree || formData.nb_heures || (isGrand ? 6 : 4);
      setInvDuree(String(realDuree));

      const realProduitsInclus = Boolean(latest.avec_produit || formData.produits_inclus || formData.produits);
      setInvProduitsInclus(realProduitsInclus);

      // ── Interventions récupérées ──
      const dateOverrides = formData.date_overrides || {};
      const recupCount = Object.values(dateOverrides).filter((v: any) => v?.statut === 'a_recuperer' && v?.reprogrammed_to).length;
      const initialRecup = String(formData.interventions_recuperees || recupCount);
      setInvInterventionsRecup(initialRecup);

      // ── Mode paiement & commission ──
      const realModePaiement = latest.mode_paiement || latest.mode_paiement_label || formData.mode_paiement || 'Virement';
      setInvModePaiement(realModePaiement);

      const realCom = latest.commercial_name || (latest as any)?.commission || (latest as any)?.commercial || formData.com || '';
      setInvCommission(String(realCom));

      // ── Jours de passage ──
      const planningJours = latest.planning?.jours_intervention && Array.isArray(latest.planning.jours_intervention) && latest.planning.jours_intervention.length > 0
        ? latest.planning.jours_intervention
        : selectedDays;
      const joursFormatted = planningJours && planningJours.length > 0
        ? planningJours.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1)).join(' + ')
        : (formData.jours_passage || 'Lundi + Jeudi');
      setInvJoursPassage(joursFormatted);

      // ═══════════════════════════════════════════════════════════
      // DEVIS comme source unique de vérité
      // ═══════════════════════════════════════════════════════════

      // Devis total HT de référence (baseline contrat — APRÈS remise abonnement)
      // formData.total / formData.montant are saved by QuoteSection with the post-discount total
      const rawDevisTotal = Number(latest.montant_devis) || Number(formData.montant_devis_base) || Number(formData.devis_total_base) || Number(formData.mensuel_base) || Number(formData.montant_devis) || Number(formData.total) || Number(formData.montant) || Number(latest.prix) || 0;
      setDevisTotal(rawDevisTotal);

      // Passages de base du contrat (diviseur fixe du devis, ex: 8 pour 2 fois/semaine)
      const contractPassagesBase = getContractBaselinePassages(latest);
      setPassagesBase(contractPassagesBase);

      // Prix unitaire dérivé du devis = devisTotal / contractPassagesBase
      const derivedPU = Number(formData.prix_unitaire) > 0
        ? Number(formData.prix_unitaire)
        : (contractPassagesBase > 0 && rawDevisTotal > 0
          ? Math.round((rawDevisTotal / contractPassagesBase) * 100) / 100
          : calculateSinglePassagePrice(latest));
      setInvPrixUnitaire(String(derivedPU));

      // Passages ce mois-ci (ex: 10 si mois à 5 semaines ou 5 si démarrage en cours de mois)
      const realMonthPassages = monthPassagesPlanifies !== undefined && monthPassagesPlanifies > 0
        ? monthPassagesPlanifies
        : contractPassagesBase;
      setInvNbPassages(String(realMonthPassages));

      // Remise additionnelle = 0 par défaut (la remise abonnement est déjà dans le devis total)
      setInvRemiseDh('0');

      // TVA — lue depuis formulaire_data.tva (synchronisée bidirectionnellement)
      const realTva = formData.tva !== undefined && formData.tva !== null ? Number(formData.tva) : 20;
      setInvTvaPercent(String(realTva));
    }
  }, [show, latest, monthDemandes, selectedDays, dateDebut, frequencyLabel, monthPassagesPlanifies]);

  if (!show) return null;

  // ═══════════════════════════════════════════════════════════════
  // Calculs dérivés — basés sur le devis
  // ═══════════════════════════════════════════════════════════════
  const numPassages = Math.max(0, Number(invNbPassages) || 0);
  const numRecup = Math.max(0, Number(invInterventionsRecup) || 0);
  const numNouvelles = Math.max(0, numPassages - numRecup);
  const pu = Math.max(0, Number(invPrixUnitaire) || 0);
  const remise = Math.max(0, Number(invRemiseDh) || 0);
  const tvaPct = Math.max(0, Number(invTvaPercent) || 0);

  // Montant HT = PU × passages facturables - remise
  const montantBrut = Math.round(pu * numNouvelles * 100) / 100;
  const totalHT = Math.max(0, Math.round((montantBrut - remise) * 100) / 100);
  const tvaAmount = Math.round((totalHT * tvaPct) / 100);
  const totalTTC = Math.round((totalHT + tvaAmount) * 100) / 100;

  // Montant mensuel de base (full month, pour référence)
  const mensuelBase = Math.round(pu * passagesBase);

  // BDD derived counts
  const dateOverrides = latest?.formulaire_data?.date_overrides || {};
  const numPayees = (monthDemandes || []).filter(d => ['integral', 'paye', 'payee'].includes((d.statut_paiement || '').toLowerCase()) || ['termine', 'terminee'].includes((d.statut || '').toLowerCase())).length;
  const numCreditsPending = Object.values(dateOverrides).filter((ov: any) => ov?.statut === 'a_recuperer' && !ov?.reprogrammed_to).length;

  // Prorata actif ?
  const isProrata = numPassages !== passagesBase;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 850, maxHeight: '92vh', overflowY: 'auto', border: '1px solid #cbd5e1', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'flex', flexDirection: 'column' }}>

        {/* Modal Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#ffffff', position: 'sticky', top: 0, zIndex: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0fdfa', border: '1px solid #ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#037265' }}>
                <DollarSign size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#034a3e' }}>
                Formulaire de facturation — Abonnement
              </h3>
            </div>
            <p style={{ margin: '4px 0 0 42px', fontSize: 12, color: '#64748b', fontWeight: 500 }}>
              Une intervention n'est facturée qu'une seule fois. Les interventions reportées (déjà payées) sont exclues du montant.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>



          {/* 1. Informations générales */}
          <div style={{ background: '#f0fdfa', border: '1px solid #ccfbf1', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#037265', marginBottom: 12 }}>
              Informations générales
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px', fontSize: 13 }}>
              <div><span style={{ color: '#64748b' }}>Client :</span> <strong style={{ color: '#0f172a' }}>{client?.display_name || latest?.client_detail?.display_name || latest?.formulaire_data?.nom || 'Client'}</strong></div>
              <div><span style={{ color: '#64748b' }}>N° abonnement :</span> <strong style={{ color: '#0f172a' }}>#{latest?.id}</strong></div>
              <div><span style={{ color: '#64748b' }}>Période :</span> <strong style={{ color: '#0f172a' }}>{capitalizedMonthTitle}</strong></div>
              <div><span style={{ color: '#64748b' }}>Type prestation :</span> <strong style={{ color: '#0f172a' }}>{invService}</strong></div>
              <div><span style={{ color: '#64748b' }}>Fréquence :</span> <strong style={{ color: '#0f172a' }}>{invFrequence}</strong></div>
              <div><span style={{ color: '#64748b' }}>Interventions prévues :</span> <strong style={{ color: '#0f172a' }}>{numPassages}</strong></div>
            </div>
          </div>

          {/* 2. Paramètres de l'abonnement */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#037265', marginBottom: 14 }}>
              Paramètres de l'abonnement
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Service</label>
                <input type="text" value={invService} onChange={e => setInvService(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Type de fréquence</label>
                <select value={invFrequence} onChange={e => setInvFrequence(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }}>
                  <option value="1 fois / semaine">1 fois / semaine</option>
                  <option value="2 fois / semaine">2 fois / semaine</option>
                  <option value="3 fois / semaine">3 fois / semaine</option>
                  <option value="4 fois / semaine">4 fois / semaine</option>
                  <option value="5 fois / semaine">5 fois / semaine</option>
                  <option value="6 fois / semaine">6 fois / semaine</option>
                  <option value="7 fois / semaine">7 fois / semaine</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Date de démarrage</label>
                <input type="date" value={invDateStart} onChange={e => setInvDateStart(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Nbre de personnes</label>
                <input type="number" value={invNbPersonnes} onChange={e => setInvNbPersonnes(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Durée / passage (h)</label>
                <input type="number" value={invDuree} onChange={e => setInvDuree(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Montant mensuel devis (DH)</label>
                <input type="number" value={mensuelBase} readOnly style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#64748b', background: '#f1f5f9', cursor: 'not-allowed' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Mode de paiement</label>
                <input type="text" value={invModePaiement} onChange={e => setInvModePaiement(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Com</label>
                <input type="text" value={invCommission} onChange={e => setInvCommission(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Nombre de passages ce mois</label>
                <input type="number" value={invNbPassages} onChange={e => setInvNbPassages(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Jours de passage</label>
                <input type="text" value={invJoursPassage} onChange={e => setInvJoursPassage(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="produitsInclus" checked={invProduitsInclus} onChange={e => setInvProduitsInclus(e.target.checked)} style={{ cursor: 'pointer' }} />
              <label htmlFor="produitsInclus" style={{ fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>Produits ménagers inclus</label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14, marginTop: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Interventions récupérées (à déduire)</label>
                <input type="number" value={invInterventionsRecup} onChange={e => setInvInterventionsRecup(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
            </div>
          </div>

          {/* 3. Calcul des interventions */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#037265', marginBottom: 14 }}>
              Calcul des interventions
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Interventions prévues</span>
                <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 10px', borderRadius: 6, fontWeight: 800, fontSize: 13 }}>{numPassages}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Interventions récupérées (à déduire)</span>
                <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '2px 10px', borderRadius: 6, fontWeight: 800, fontSize: 13 }}>{numRecup}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Passages base devis / mois</span>
                <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 10px', borderRadius: 6, fontWeight: 800, fontSize: 13 }}>{passagesBase}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Nouvelles interventions à facturer</span>
                <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 10px', borderRadius: 6, fontWeight: 800, fontSize: 13 }}>{numNouvelles}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Interventions déjà payées (lecture seule)</span>
                <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 10px', borderRadius: 6, fontWeight: 800, fontSize: 13 }}>{numPayees}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Crédits à récupérer restants</span>
                <span style={{ background: '#fef9c3', color: '#854d0e', padding: '2px 10px', borderRadius: 6, fontWeight: 800, fontSize: 13 }}>{numCreditsPending}</span>
              </div>
            </div>
          </div>

          {/* 4. Tarification — dérivée du devis */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#037265', marginBottom: 14 }}>
              Tarification
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Prix unitaire (DH) — du devis</label>
                <input type="number" step="0.01" value={invPrixUnitaire} onChange={e => setInvPrixUnitaire(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Remise additionnelle (DH)</label>
                <input type="number" value={invRemiseDh} onChange={e => setInvRemiseDh(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>TVA (%)</label>
                <input type="number" value={invTvaPercent} onChange={e => setInvTvaPercent(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Montant brut ({numNouvelles} × {pu.toFixed(2).replace('.', ',')} DH)</span>
                  <strong style={{ color: '#0f172a' }}>{montantBrut.toFixed(2).replace('.', ',')} DH</strong>
                </div>
                {remise > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b' }}>Remise additionnelle</span>
                    <strong style={{ color: '#dc2626' }}>– {remise.toFixed(2).replace('.', ',')} DH</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Total HT</span>
                  <strong style={{ color: '#0f172a' }}>{totalHT.toFixed(2).replace('.', ',')} DH</strong>
                </div>
                {tvaPct > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b' }}>TVA ({tvaPct}%)</span>
                    <strong style={{ color: '#0f172a' }}>{tvaAmount.toFixed(2).replace('.', ',')} DH</strong>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#037265' }}>{tvaPct > 0 ? 'Total TTC' : 'Total HT'}</span>
                <strong style={{ fontWeight: 800, fontSize: 18, color: '#037265' }}>{(tvaPct > 0 ? totalTTC : totalHT).toFixed(2).replace('.', ',')} DH</strong>
              </div>
            </div>
          </div>

          {/* 5. Aperçu de la facturation */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#15803d', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={16} color="#15803d" /> Aperçu de la facturation
            </div>
            <div style={{ fontSize: 13, color: '#166534', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>Devis mensuel de référence : <strong>{devisTotal.toLocaleString('fr-FR')} DH</strong> ({passagesBase} passages/mois)</div>
              <div>Interventions ce mois : <strong>{numPassages}</strong>{isProrata ? ` (prorata ${numPassages}/${passagesBase})` : ''}</div>
              <div>Interventions récupérées : <strong>{numRecup}</strong></div>
              <div>Nouvelles interventions facturables : <strong>{numNouvelles}</strong></div>
              <div>Prix unitaire (du devis) : <strong>{pu.toFixed(2).replace('.', ',')} DH</strong></div>
              <div>Montant à facturer : <strong>{numNouvelles} × {pu.toFixed(2).replace('.', ',')} DH = {montantBrut.toFixed(2).replace('.', ',')} DH HT</strong></div>
              {tvaPct > 0 && <div>Total TTC : <strong>{totalTTC.toFixed(2).replace('.', ',')} DH</strong></div>}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: '#15803d', fontStyle: 'italic' }}>
              Interventions déjà réglées : {numPayees} · Interventions facturées ce mois : {numNouvelles}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 12, background: '#fafafa', position: 'sticky', bottom: 0 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #cbd5e1', background: 'white', fontWeight: 600, fontSize: 13, color: '#334155', cursor: 'pointer' }}
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                addToast("Enregistrement et génération de la facture...", "info");

                const totalHTNum = Number(totalHT) || 0;
                const totalTTCNum = Number(totalTTC) || 0;
                const tvaPercentNum = Number(invTvaPercent) || 0;
                const tvaAmountNum = Math.round((totalHTNum * tvaPercentNum) / 100 * 100) / 100;
                const finalMontantFacture = tvaPercentNum > 0 ? totalTTCNum : totalHTNum;

                // Sync ALL changes bidirectionally back to formulaire_data
                const updatedFormData = {
                  ...(latest.formulaire_data || {}),
                  type_prestation: invService,
                  frequence: invFrequence,
                  date_demarrage: invDateStart,
                  nb_personnes: invNbPersonnes,
                  nb_intervenants: invNbPersonnes,
                  duree: invDuree,
                  nb_heures: invDuree,
                  mode_paiement: invModePaiement,
                  com: invCommission,
                  nombre_passages: invNbPassages,
                  jours_passage: invJoursPassage,
                  produits_inclus: invProduitsInclus,
                  produits: invProduitsInclus,
                  interventions_recuperees: invInterventionsRecup,

                  // 1. Stockage distinct et séparé du devis de référence et de la facture
                  devis_total_base: devisTotal,
                  montant_devis_base: devisTotal,
                  montant_devis: devisTotal,
                  montant_facture: finalMontantFacture,

                  // 2. Tarification complète et TVA pour le backend & le frontend
                  prix_unitaire: invPrixUnitaire,
                  remise_dh: invRemiseDh,
                  tva: tvaPercentNum,
                  tva_pct: tvaPercentNum,
                  tva_pourcentage: tvaPercentNum,
                  tax_rate: tvaPercentNum,
                  tva_amount: tvaAmountNum,
                  tva_montant: tvaAmountNum,
                  tax_amount: tvaAmountNum,
                  total_ht: totalHTNum,
                  montant_ht: totalHTNum,
                  total_ttc: totalTTCNum,
                  montant_ttc: totalTTCNum,
                  montant_total: finalMontantFacture,
                  montant_final: finalMontantFacture,
                  mensuel_base: devisTotal
                };

                await updateDemande(latest.id, {
                  prix: Math.round(devisTotal) || latest.prix,
                  montant_devis: devisTotal || latest.montant_devis || latest.prix,
                  montant_facture: finalMontantFacture,
                  service: invService,
                  formulaire_data: updatedFormData
                } as any);

                try {
                  await generateDocument(latest.id, 'facture', activeTabIndex + 1);
                } catch (docErr) {
                  console.warn("Génération PDF backend non disponible, enregistrement BDD conservé:", docErr);
                }

                addToast("Facture enregistrée en BDD avec succès.", "success");
                onClose();
                if (fetchData) await fetchData();
              } catch (err) {
                console.error("Erreur lors de la validation de la facture:", err);
                addToast("Erreur lors de la validation de la facture.", "error");
              }
            }}
            style={{ padding: '8px 22px', borderRadius: 8, border: 'none', background: '#037265', fontWeight: 700, fontSize: 13, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <FileText size={16} /> Valider la facture
          </button>
        </div>

      </div>
    </div>
  );
};
