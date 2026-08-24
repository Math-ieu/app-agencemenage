import React, { useState, useEffect } from 'react';
import { DollarSign, X, AlertCircle, FileText } from 'lucide-react';
import { Demande, Client } from '../../types';
import { updateDemande, generateDocument, getUsers, affecterDemande } from '../../api/client';
import { getDevisDiscountDetails, extractJoursPassage, getDynamicMonthPassagesCount, getDemandeStartDate } from '../../utils/pricing';

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
  const [commerciaux, setCommerciaux] = useState<any[]>([]);

  useEffect(() => {
    getUsers({ role: 'commercial' })
      .then(res => {
        const list = res.data?.results || res.data || [];
        setCommerciaux(Array.isArray(list) ? list : []);
      })
      .catch(console.error);
  }, []);

  const getInitialCommercial = () => {
    return (
      latest?.assigned_to_name ||
      latest?.commercial_name ||
      (latest as any)?.assigned_to_user_name ||
      (latest as any)?.assigned_to_detail?.full_name ||
      client?.assigned_commercial_name ||
      (client as any)?.assigned_commercial?.full_name ||
      latest?.formulaire_data?.commercial ||
      latest?.formulaire_data?.commercial_name ||
      latest?.formulaire_data?.com ||
      latest?.formulaire_data?.facturation?.commercial_name ||
      (latest as any)?.commission ||
      (latest as any)?.commercial ||
      ''
    );
  };

  const [invService, setInvService] = useState(() => latest?.service || latest?.type_prestation || 'Grand ménage');
  const [invFrequence, setInvFrequence] = useState(() => formatFrequenceOption(latest?.formulaire_data?.frequence || latest?.frequency_label || frequencyLabel, selectedDays?.length));
  const [invDateStart, setInvDateStart] = useState(() => dateDebut || latest?.date_intervention || '');
  const [invNbPersonnes, setInvNbPersonnes] = useState(() => String(latest?.nb_intervenants || latest?.formulaire_data?.nb_intervenants || 1));
  const [invDuree, setInvDuree] = useState(() => String(latest?.nb_heures || latest?.formulaire_data?.duree || 4));
  const [invModePaiement, setInvModePaiement] = useState(() => latest?.mode_paiement || 'Virement');
  const [invCommission, setInvCommission] = useState(() => String(getInitialCommercial()));
  const [invJoursPassage, setInvJoursPassage] = useState(() => selectedDays && selectedDays.length > 0 ? selectedDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(' + ') : 'Lundi + Jeudi');
  const [invProduitsInclus, setInvProduitsInclus] = useState(false);
  const [invInterventionsRecup, setInvInterventionsRecup] = useState('0');

  // ═══════════════════════════════════════════════════════════════
  // Tarification — dérivée du devis & TVA
  // ═══════════════════════════════════════════════════════════════
  const [invNbPassages, setInvNbPassages] = useState('4');
  const [invPrixUnitaire, setInvPrixUnitaire] = useState('0');
  const [devisReductionPct, setDevisReductionPct] = useState(0);
  const [devisReductionDh, setDevisReductionDh] = useState(0);
  const [devisReductionLabel, setDevisReductionLabel] = useState('');
  const [invApplyTva, setInvApplyTva] = useState<boolean>(() => {
    const formData = latest?.formulaire_data || {};
    if (formData.tva_active !== undefined) return Boolean(formData.tva_active);
    if (formData.apply_tva !== undefined) return Boolean(formData.apply_tva);
    if (formData.tva !== undefined && formData.tva !== null) return Number(formData.tva) > 0;
    const seg = client?.segment || latest?.segment || formData?.segment;
    if (seg && String(seg).toLowerCase() === 'entreprise') return true;
    return false;
  });
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

      const realStartDate = dateDebut || getDemandeStartDate(latest);
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

      // ── Mode paiement & commercial ──
      const realModePaiement = latest.mode_paiement || latest.mode_paiement_label || formData.mode_paiement || 'Virement';
      setInvModePaiement(realModePaiement);

      const realCom = getInitialCommercial();
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
      // DEVIS comme source unique de vérité & décomposition réduction
      // ═══════════════════════════════════════════════════════════
      const discountInfo = getDevisDiscountDetails(latest);
      setDevisTotal(discountInfo.devisTotal);
      setPassagesBase(discountInfo.passagesBase);
      setDevisReductionPct(discountInfo.reductionPct);
      setDevisReductionDh(discountInfo.reductionAmountBase);
      setDevisReductionLabel(discountInfo.reductionLabel);

      // Prix unitaire brut (avant réduction) par défaut du devis
      const derivedPU = Number(formData.prix_unitaire) > 0
        ? Number(formData.prix_unitaire)
        : discountInfo.prixUnitaireBrut;
      setInvPrixUnitaire(String(derivedPU));

      // Passages ce mois-ci (ex: 10 si mois à 5 semaines ou 5 si démarrage en cours de mois)
      const realMonthPassages = monthPassagesPlanifies !== undefined && monthPassagesPlanifies > 0
        ? monthPassagesPlanifies
        : discountInfo.passagesBase;
      setInvNbPassages(String(realMonthPassages));

      // TVA — Non par défaut pour les particuliers
      const isClientEntreprise = (client?.segment || latest.segment || formData.segment) === 'entreprise';
      const formDataTvaActive = formData.tva_active ?? formData.apply_tva;
      const initialTvaActive = formDataTvaActive !== undefined
        ? Boolean(formDataTvaActive)
        : (formData.tva !== undefined && formData.tva !== null ? Number(formData.tva) > 0 : isClientEntreprise);
      setInvApplyTva(initialTvaActive);
      setInvTvaPercent(String(Number(formData.tva) || 20));
    }
  }, [show, latest, monthDemandes, selectedDays, dateDebut, frequencyLabel, monthPassagesPlanifies, client?.segment]);

  // Synchronisation dynamique si le bouton "Produits ménagers inclus" est coché / décoché dans le modal
  const initialProduits = Boolean(latest?.avec_produit || latest?.formulaire_data?.produits_inclus || latest?.formulaire_data?.produits);
  useEffect(() => {
    if (!latest || !show) return;
    const discountInfo = getDevisDiscountDetails(latest);
    const passBase = discountInfo.passagesBase;
    const produitsDiff = (invProduitsInclus ? 90 : 0) - (initialProduits ? 90 : 0);
    const adjustedDevisTotal = Math.max(0, discountInfo.devisTotal + produitsDiff);
    setDevisTotal(adjustedDevisTotal);
    if (passBase > 0) {
      const brutBase = discountInfo.reductionPct > 0
        ? Math.round((adjustedDevisTotal / (1 - discountInfo.reductionPct / 100)) * 100) / 100
        : adjustedDevisTotal;
      setInvPrixUnitaire(String(Math.round((brutBase / passBase) * 100) / 100));
    }
  }, [invProduitsInclus, latest, show]);

  // Recalculate passages when days, start date, or frequency change
  useEffect(() => {
    if (!show || !latest) return;
    const parsedDays = extractJoursPassage(invJoursPassage);
    if (parsedDays.length === 0) return;

    // Build a synthetic demande with updated values to compute dynamic passages
    const freqMatch = invFrequence.match(/(\d+)/);
    const freqLabel = freqMatch ? `${freqMatch[1]}/sem` : (latest.frequency_label || latest.formulaire_data?.frequence || '2/sem');

    const syntheticDemande = {
      ...latest,
      frequency_label: freqLabel,
      date_intervention: invDateStart || getDemandeStartDate(latest),
      formulaire_data: {
        ...(latest.formulaire_data || {}),
        frequence: freqLabel,
        date_demarrage: invDateStart || getDemandeStartDate(latest),
        date_debut: invDateStart || getDemandeStartDate(latest),
        date: invDateStart || getDemandeStartDate(latest),
        schedulingDate: invDateStart || getDemandeStartDate(latest),
        jours_passage: invJoursPassage,
        jours_intervention: parsedDays,
        jours_intervention_detail: parsedDays.map(j => ({ jour: j, heure_debut: '09:00', heure_fin: '13:00' }))
      }
    };

    const newPassages = getDynamicMonthPassagesCount(syntheticDemande);
    if (newPassages > 0) {
      setInvNbPassages(String(newPassages));
      const discountInfo = getDevisDiscountDetails(latest);
      if (discountInfo.passagesBase > 0) {
        setInvPrixUnitaire(String(discountInfo.prixUnitaireBrut));
      }
    }
  }, [invJoursPassage, invDateStart, invFrequence, show]);

  if (!show) return null;

  // ═══════════════════════════════════════════════════════════════
  // Calculs dérivés — basés sur le devis
  // ═══════════════════════════════════════════════════════════════
  const numPassages = Math.max(0, Number(invNbPassages) || 0);
  const numRecup = Math.max(0, Number(invInterventionsRecup) || 0);
  const numNouvelles = Math.max(0, numPassages - numRecup);
  const pu = Math.max(0, Number(invPrixUnitaire) || 0);
  const tvaPct = invApplyTva ? Math.max(0, Number(invTvaPercent) || 0) : 0;

  // Montant brut du service = PU brut × passages facturables
  const montantBrut = Math.round(pu * numNouvelles * 100) / 100;

  // Réduction automatique issue du devis
  let remiseEffective = 0;
  if (devisReductionPct > 0) {
    remiseEffective = Math.round((montantBrut * devisReductionPct) / 100 * 100) / 100;
  } else if (devisReductionDh > 0 && passagesBase > 0) {
    remiseEffective = Math.round((devisReductionDh / passagesBase * numNouvelles) * 100) / 100;
  }
  const reductionLabel = devisReductionLabel || (devisReductionPct > 0 ? `${devisReductionPct}%` : '');

  // Total HT
  const totalHT = Math.max(0, Math.round((montantBrut - remiseEffective) * 100) / 100);

  // TVA
  const tvaAmount = invApplyTva ? Math.round((totalHT * tvaPct) / 100 * 100) / 100 : 0;

  // Net à payer
  const netAPayer = Math.round((totalHT + tvaAmount) * 100) / 100;

  // Montant mensuel de base (full month, pour référence)
  const mensuelBase = devisTotal || (pu * passagesBase) || 0;

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
                <select
                  value={invCommission}
                  onChange={e => setInvCommission(e.target.value)}
                  style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }}
                >
                  <option value="">Sélectionner un commercial</option>
                  {commerciaux.map(c => {
                    const cName = c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username;
                    return (
                      <option key={c.id} value={cName}>
                        {cName}
                      </option>
                    );
                  })}
                  {invCommission && !commerciaux.some(c => (c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username) === invCommission) && (
                    <option value={invCommission}>{invCommission}</option>
                  )}
                </select>
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
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Interventions déjà payées (lecture seule)</span>
                <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 10px', borderRadius: 6, fontWeight: 800, fontSize: 13 }}>{numPayees}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Crédits à récupérer restants</span>
                <span style={{ background: '#fef9c3', color: '#854d0e', padding: '2px 10px', borderRadius: 6, fontWeight: 800, fontSize: 13 }}>{numCreditsPending}</span>
              </div>
            </div>
          </div>

          {/* 4. Tarification & TVA — dérivée du devis */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#037265', marginBottom: 14 }}>
              Tarification & TVA
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>
                  Prix unitaire (DH) — du devis
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={invPrixUnitaire}
                  onChange={e => setInvPrixUnitaire(e.target.value)}
                  style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }}
                />
                {devisReductionPct > 0 && (
                  <div style={{ marginTop: 4, fontSize: 11, color: '#037265', fontWeight: 600 }}>
                    💡 Réduction du devis ({devisReductionPct}%) appliquée automatiquement
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>
                  Appliquer la TVA : Oui / Non
                </label>
                <div style={{ display: 'flex', gap: 6, height: 34 }}>
                  <button
                    type="button"
                    onClick={() => setInvApplyTva(false)}
                    style={{
                      flex: 1,
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: !invApplyTva ? '#037265' : '#cbd5e1',
                      background: !invApplyTva ? '#f0fdfa' : '#f8fafc',
                      color: !invApplyTva ? '#037265' : '#64748b',
                      fontWeight: !invApplyTva ? 800 : 600,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4
                    }}
                  >
                    Non (0%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvApplyTva(true)}
                    style={{
                      flex: 1,
                      borderRadius: 8,
                      border: '1px solid',
                      borderColor: invApplyTva ? '#037265' : '#cbd5e1',
                      background: invApplyTva ? '#f0fdfa' : '#f8fafc',
                      color: invApplyTva ? '#037265' : '#64748b',
                      fontWeight: invApplyTva ? 800 : 600,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4
                    }}
                  >
                    Oui ({invTvaPercent}%)
                  </button>
                </div>
                {invApplyTva && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>Taux TVA :</span>
                    <input
                      type="number"
                      value={invTvaPercent}
                      onChange={e => setInvTvaPercent(e.target.value)}
                      style={{ width: 55, padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 12, textAlign: 'center' }}
                    />
                    <span style={{ fontSize: 11, color: '#64748b' }}>%</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Montant du service ({numNouvelles} × {pu.toFixed(2).replace('.', ',')} DH) :</span>
                  <strong style={{ color: '#0f172a' }}>{montantBrut.toFixed(2).replace('.', ',')} DH</strong>
                </div>
                {remiseEffective > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b' }}>Réduction appliquée {reductionLabel ? `(${reductionLabel})` : ''} :</span>
                    <strong style={{ color: '#dc2626' }}>– {remiseEffective.toFixed(2).replace('.', ',')} DH</strong>
                  </div>
                )}
                {(remiseEffective > 0 || invApplyTva) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b' }}>Total HT :</span>
                    <strong style={{ color: '#0f172a' }}>{totalHT.toFixed(2).replace('.', ',')} DH</strong>
                  </div>
                )}
                {invApplyTva && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#64748b' }}>TVA ({tvaPct}%) :</span>
                    <strong style={{ color: '#0f172a' }}>{tvaAmount.toFixed(2).replace('.', ',')} DH</strong>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#037265' }}>
                  {invApplyTva ? 'Net à payer (TTC) :' : 'Net à payer :'}
                </span>
                <strong style={{ fontWeight: 800, fontSize: 18, color: '#037265' }}>
                  {netAPayer.toFixed(2).replace('.', ',')} DH
                </strong>
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
              {/* <div>Nouvelles interventions facturables : <strong>{numNouvelles}</strong></div> */}
              <div>Montant du service : <strong>{montantBrut.toFixed(2).replace('.', ',')} DH</strong></div>
              {remiseEffective > 0 && <div>Réduction appliquée : <strong style={{ color: '#dc2626' }}>– {remiseEffective.toFixed(2).replace('.', ',')} DH {reductionLabel ? `(${reductionLabel})` : ''}</strong></div>}
              <div>Total HT : <strong>{totalHT.toFixed(2).replace('.', ',')} DH</strong></div>
              {invApplyTva && <div>TVA ({tvaPct}%) : <strong>{tvaAmount.toFixed(2).replace('.', ',')} DH</strong></div>}
              <div>Net à payer : <strong>{netAPayer.toFixed(2).replace('.', ',')} DH</strong></div>
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

                const totalHTNum = totalHT;
                const totalTTCNum = netAPayer;
                const tvaPercentNum = invApplyTva ? (Number(invTvaPercent) || 0) : 0;
                const tvaAmountNum = tvaAmount;
                const finalMontantFacture = netAPayer;

                const parsedDays = extractJoursPassage(invJoursPassage);

                const clientDisplayName = client?.display_name || latest?.client_name || (latest?.formulaire_data as any)?.nom || 'Client';
                const monthNum = activeTabIndex + 1;
                const refName = `FACTURE_${clientDisplayName.replace(/\s+/g, '_')}_${latest.id}_M${monthNum}`;

                const currentFacturesValidees = Array.isArray(latest.formulaire_data?.factures_validees)
                  ? [...latest.formulaire_data.factures_validees]
                  : [];

                const filteredFactures = currentFacturesValidees.filter(
                  (f: any) => f.month_index !== monthNum && f.id !== `M${monthNum}`
                );

                filteredFactures.push({
                  id: `M${monthNum}`,
                  month_index: monthNum,
                  reference: refName,
                  periode: capitalizedMonthTitle || `Mois ${monthNum}`,
                  montant: finalMontantFacture,
                  montant_service: montantBrut,
                  montant_ht: totalHTNum,
                  montant_ttc: totalTTCNum,
                  prix_unitaire: Number(invPrixUnitaire) || 0,
                  nombre_passages: Number(invNbPassages) || 0,
                  remise: remiseEffective,
                  remise_dh: remiseEffective,
                  remise_pct: devisReductionPct,
                  reduction_label: reductionLabel,
                  tva_active: invApplyTva,
                  tva: tvaPercentNum,
                  tva_amount: tvaAmountNum,
                  date_validation: new Date().toISOString(),
                  date_envoi: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
                  statut: 'envoyee',
                  statut_label: 'Envoyée'
                });

                // Find matching commercial user if available
                const matchingComm = (commerciaux || []).find((c: any) => {
                  const cName = c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.username;
                  return cName.toLowerCase() === invCommission.trim().toLowerCase();
                });

                // Sync ALL changes bidirectionally back to formulaire_data
                const updatedFormData = {
                  ...(latest.formulaire_data || {}),
                  type_prestation: invService,
                  frequence: invFrequence,
                  date_demarrage: invDateStart,
                  date_debut: invDateStart,
                  date: invDateStart,
                  schedulingDate: invDateStart,
                  nb_personnes: invNbPersonnes,
                  nb_intervenants: invNbPersonnes,
                  duree: invDuree,
                  nb_heures: invDuree,
                  mode_paiement: invModePaiement,
                  com: invCommission,
                  commercial: invCommission,
                  commercial_name: invCommission,
                  nombre_passages: invNbPassages,
                  jours_passage: invJoursPassage,
                  jours_intervention: parsedDays,
                  produits_inclus: invProduitsInclus,
                  produits: invProduitsInclus,
                  interventions_recuperees: invInterventionsRecup,

                  // Standard devis & invoice properties
                  montant_devis: devisTotal,
                  montant_service: montantBrut,
                  montant_facture: finalMontantFacture,
                  factures_validees: filteredFactures,

                  // Tarification, Remise & TVA
                  prix_unitaire: invPrixUnitaire,
                  remise_dh: remiseEffective,
                  remise: remiseEffective,
                  remise_pct: devisReductionPct,
                  reduction_label: reductionLabel,
                  tva_active: invApplyTva,
                  apply_tva: invApplyTva,
                  tva: tvaPercentNum,
                  tva_amount: tvaAmountNum,
                  montant_ht: totalHTNum,
                  montant_ttc: totalTTCNum
                };

                const updatePayload: any = {
                  date_intervention: invDateStart || latest.date_intervention,
                  prix: Math.round(devisTotal) || latest.prix,
                  montant_devis: devisTotal || latest.montant_devis || latest.prix,
                  montant_facture: finalMontantFacture,
                  service: invService,
                  planning: {
                    ...(latest.planning || {}),
                    date_debut: invDateStart || latest.planning?.date_debut,
                    jours_intervention: parsedDays.length > 0 ? parsedDays : latest.planning?.jours_intervention
                  },
                  formulaire_data: updatedFormData
                };

                if (matchingComm?.id) {
                  updatePayload.assigned_to = matchingComm.id;
                }

                await updateDemande(latest.id, updatePayload);

                if (matchingComm?.id) {
                  try {
                    await affecterDemande(latest.id, matchingComm.id);
                  } catch (affErr) {
                    console.warn("affecterDemande:", affErr);
                  }
                }

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
