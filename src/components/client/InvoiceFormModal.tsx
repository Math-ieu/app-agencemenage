import React, { useState, useEffect } from 'react';
import { DollarSign, X, AlertCircle, FileText } from 'lucide-react';
import { Demande, Client } from '../../types';
import { updateDemande, generateDocument } from '../../api/client';
import { calculateSinglePassagePrice } from '../../utils/pricing';

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

  // Form States
  const [invService, setInvService] = useState(() => latest?.service || latest?.type_prestation || 'Grand ménage');
  const [invFrequence, setInvFrequence] = useState(() => formatFrequenceOption(latest?.formulaire_data?.frequence || latest?.frequency_label || frequencyLabel, selectedDays?.length));
  const [invDateStart, setInvDateStart] = useState(() => dateDebut || latest?.date_intervention || '');
  const [invNbPersonnes, setInvNbPersonnes] = useState(() => String(latest?.nb_intervenants || 1));
  const [invDuree, setInvDuree] = useState(() => String(latest?.nb_heures || 4));
  const [invMontantTotal, setInvMontantTotal] = useState(() => String(latest?.prix || 0));
  const [invModePaiement, setInvModePaiement] = useState(() => latest?.mode_paiement || 'Virement');
  const [invCommission, setInvCommission] = useState(() => String((latest as any)?.commission || ''));
  const [invNbPassages, setInvNbPassages] = useState(() => String(monthPassagesPlanifies || monthDemandes?.length || 4));
  const [invTarifHoraire, setInvTarifHoraire] = useState(() => String(latest?.formulaire_data?.tarif_horaire || 0));
  const [invMensuelBase, setInvMensuelBase] = useState(() => String(latest?.prix || 0));
  const [invJoursPassage, setInvJoursPassage] = useState(() => selectedDays && selectedDays.length > 0 ? selectedDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(' + ') : 'Lundi + Jeudi');
  const [invProduitsInclus, setInvProduitsInclus] = useState(false);
  const [invTauxRemise, setInvTauxRemise] = useState('10');
  const [invInterventionsRecup, setInvInterventionsRecup] = useState('0');

  // Tarification States
  const [invPrixUnitaire, setInvPrixUnitaire] = useState(() => String(calculateSinglePassagePrice(latest)));
  const [invRemiseDh, setInvRemiseDh] = useState('0');
  const [invTvaPercent, setInvTvaPercent] = useState('20');

  const recalculatePrices = (overrides: {
    service?: string;
    duree?: string;
    nbPersonnes?: string;
    tarifHoraire?: string;
    produitsInclus?: boolean;
    tauxRemise?: string;
    nbPassages?: string;
    interventionsRecup?: string;
  }) => {
    const s = overrides.service !== undefined ? overrides.service : invService;
    const durStr = overrides.duree !== undefined ? overrides.duree : invDuree;
    const persStr = overrides.nbPersonnes !== undefined ? overrides.nbPersonnes : invNbPersonnes;
    const thStr = overrides.tarifHoraire !== undefined ? overrides.tarifHoraire : invTarifHoraire;
    const prod = overrides.produitsInclus !== undefined ? overrides.produitsInclus : invProduitsInclus;
    const txStr = overrides.tauxRemise !== undefined ? overrides.tauxRemise : invTauxRemise;
    const passStr = overrides.nbPassages !== undefined ? overrides.nbPassages : invNbPassages;
    const recupStr = overrides.interventionsRecup !== undefined ? overrides.interventionsRecup : invInterventionsRecup;

    const isGrand = String(s || '').toLowerCase().includes('grand');
    const baseRate = Number(thStr) || (isGrand ? 70 : 60);
    const minHours = isGrand ? 6 : 4;
    const duree = Math.max(Number(durStr) || 0, minHours);
    const nbPersonnes = Math.max(1, Number(persStr) || 1);
    const remisePct = Number(txStr) !== undefined && !isNaN(Number(txStr)) ? Number(txStr) : 10;
    const numPassages = Math.max(0, Number(passStr) || 0);
    const numRecup = Math.max(0, Number(recupStr) || 0);

    // Prix unitaire brut d'un passage (Audio 1: sans réduction, la réduction s'applique sur le total)
    const labor = duree * baseRate * nbPersonnes;
    const options = prod ? 90 : 0;
    const pu = Math.round(labor + options);

    // Interventions facturables (Audio 2: déduction des interventions récupérées de l'ancien mois)
    const numFacturables = Math.max(0, numPassages - numRecup);
    const subtotal = numFacturables * pu;
    const remiseDh = Math.round((subtotal * remisePct) / 100);
    const montantTotal = Math.max(0, subtotal - remiseDh);
    const mensuelBase = Math.round(4 * pu);

    setInvPrixUnitaire(String(pu));
    setInvMontantTotal(String(montantTotal));
    setInvMensuelBase(String(mensuelBase));
    setInvRemiseDh(String(remiseDh));
  };

  useEffect(() => {
    if (show && latest) {
      const realService = latest.service || latest.type_prestation || latest?.formulaire_data?.type_prestation || latest?.formulaire_data?.service || 'Grand ménage';
      setInvService(realService);
      
      const rawFreq = latest.frequency_label || latest?.formulaire_data?.frequence || frequencyLabel;
      setInvFrequence(formatFrequenceOption(rawFreq, selectedDays?.length));

      const realStartDate = dateDebut || latest.planning?.date_debut || latest.formulaire_data?.date_demarrage || latest.formulaire_data?.date_debut || latest.date_intervention || (latest.created_at ? latest.created_at.slice(0, 10) : '');
      setInvDateStart(realStartDate);

      const realNbPersonnes = latest.nb_intervenants || latest?.formulaire_data?.nb_personnes || 1;
      setInvNbPersonnes(String(realNbPersonnes));

      const isGrand = String(realService).toLowerCase().includes('grand');
      const realDuree = latest.nb_heures || latest?.formulaire_data?.duree || (isGrand ? 6 : 4);
      setInvDuree(String(realDuree));

      // PRE-FILL numPassages WITH REAL MONTH PASSAGE COUNT (monthPassagesPlanifies)
      const numPassages = monthPassagesPlanifies !== undefined && monthPassagesPlanifies > 0
        ? monthPassagesPlanifies
        : (monthDemandes?.length > 0 ? monthDemandes.length : (latest.planning?.nombre_passages_mois || latest?.formulaire_data?.nombre_passages || 4));
      setInvNbPassages(String(numPassages));

      const th = latest?.formulaire_data?.tarif_horaire || (isGrand ? 70 : 60);
      setInvTarifHoraire(String(th));

      const realProduitsInclus = Boolean(latest.avec_produit || latest?.formulaire_data?.produits_inclus);
      setInvProduitsInclus(realProduitsInclus);

      const realTauxRemise = latest?.formulaire_data?.taux_reduction || latest.geste_commercial?.reduction_value || (latest as any)?.remise || 10;
      setInvTauxRemise(String(realTauxRemise));

      const dateOverrides = latest?.formulaire_data?.date_overrides || {};
      const recupCount = Object.values(dateOverrides).filter((v: any) => v?.statut === 'a_recuperer' && v?.reprogrammed_to).length;
      const initialRecup = String(latest?.formulaire_data?.interventions_recuperees || recupCount);
      setInvInterventionsRecup(initialRecup);

      // Audio 1: Prix unitaire brut (sans réduction)
      const pu = latest?.formulaire_data?.prix_unitaire || calculateSinglePassagePrice(latest);
      setInvPrixUnitaire(String(pu));

      const numRecup = Math.max(0, Number(initialRecup) || 0);
      const numFacturables = Math.max(0, numPassages - numRecup);
      const subtotal = numFacturables * pu;
      const realRemiseDh = Math.round((subtotal * Number(realTauxRemise)) / 100);
      setInvRemiseDh(String(realRemiseDh));

      const realMontantTotal = Math.max(0, subtotal - realRemiseDh);
      setInvMontantTotal(String(realMontantTotal));

      const realMensuelBase = (pu > 0)
        ? Math.round(4 * pu)
        : (latest?.formulaire_data?.mensuel_base || latest.prix || 0);
      setInvMensuelBase(String(realMensuelBase));

      const realModePaiement = latest.mode_paiement || latest.mode_paiement_label || latest?.formulaire_data?.mode_paiement || 'Virement';
      setInvModePaiement(realModePaiement);

      const realCom = latest.commercial_name || (latest as any)?.commission || (latest as any)?.commercial || latest?.formulaire_data?.com || '';
      setInvCommission(String(realCom));

      const planningJours = latest.planning?.jours_intervention && Array.isArray(latest.planning.jours_intervention) && latest.planning.jours_intervention.length > 0
        ? latest.planning.jours_intervention
        : selectedDays;

      const joursFormatted = planningJours && planningJours.length > 0 
        ? planningJours.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1)).join(' + ') 
        : (latest?.formulaire_data?.jours_passage || 'Lundi + Jeudi');
      setInvJoursPassage(joursFormatted);

      const realTva = latest?.formulaire_data?.tva || 20;
      setInvTvaPercent(String(realTva));
    }
  }, [show, latest, monthDemandes, selectedDays, dateDebut, frequencyLabel, monthPassagesPlanifies]);

  if (!show) return null;

  const numPassages = Math.max(0, Number(invNbPassages) || 0);
  const numRecup = Math.max(0, Number(invInterventionsRecup) || 0);

  // Real BDD derived counts
  const dateOverrides = latest?.formulaire_data?.date_overrides || {};
  const numPayees = (monthDemandes || []).filter(d => ['integral', 'paye', 'payee'].includes((d.statut_paiement || '').toLowerCase()) || ['termine', 'terminee'].includes((d.statut || '').toLowerCase())).length;
  const numCreditsPending = Object.values(dateOverrides).filter((ov: any) => ov?.statut === 'a_recuperer' && !ov?.reprogrammed_to).length;

  // Interventions facturables = Nombre total de passages - Interventions récupérées
  const numNouvelles = Math.max(0, numPassages - numRecup);
  const pu = Math.max(0, Number(invPrixUnitaire) || 0);
  const tauxRemisePct = Math.max(0, Number(invTauxRemise) || 0);

  // Sous-total brut pour les interventions à facturer
  const sousTotalHT = numNouvelles * pu;

  // Calcul du montant de la réduction sur le total
  const remiseCalculated = Math.round((sousTotalHT * tauxRemisePct) / 100);
  const remise = Number(invRemiseDh) > 0 && invRemiseDh !== '0' ? Number(invRemiseDh) : remiseCalculated;

  const totalHT = Math.max(0, sousTotalHT - remise);
  const tvaPct = Math.max(0, Number(invTvaPercent) || 0);
  const tvaAmount = (totalHT * tvaPct) / 100;
  const totalTTC = totalHT + tvaAmount;

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
                <input type="text" value={invService} onChange={e => { const v = e.target.value; setInvService(v); recalculatePrices({ service: v }); }} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Type de fréquence</label>
                <select value={invFrequence} onChange={e => setInvFrequence(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }}>
                  <option value="1 fois / semaine">1 fois / semaine</option>
                  <option value="1 fois par semaine">1 fois par semaine</option>
                  <option value="2 fois / semaine">2 fois / semaine</option>
                  <option value="2 fois par semaine">2 fois par semaine</option>
                  <option value="3 fois / semaine">3 fois / semaine</option>
                  <option value="3 fois par semaine">3 fois par semaine</option>
                  <option value="4 fois / semaine">4 fois / semaine</option>
                  <option value="4 fois par semaine">4 fois par semaine</option>
                  <option value="5 fois / semaine">5 fois / semaine</option>
                  <option value="5 fois par semaine">5 fois par semaine</option>
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
                <input type="number" value={invNbPersonnes} onChange={e => { const v = e.target.value; setInvNbPersonnes(v); recalculatePrices({ nbPersonnes: v }); }} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Durée / passage (h)</label>
                <input type="number" value={invDuree} onChange={e => { const v = e.target.value; setInvDuree(v); recalculatePrices({ duree: v }); }} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Montant total (DH)</label>
                <input type="number" value={invMontantTotal} onChange={e => setInvMontantTotal(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Nombre total de passages / mois</label>
                <input type="number" value={invNbPassages} onChange={e => { const v = e.target.value; setInvNbPassages(v); recalculatePrices({ nbPassages: v }); }} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Tarif horaire (DH / heure)</label>
                <input type="number" value={invTarifHoraire} onChange={e => { const v = e.target.value; setInvTarifHoraire(v); recalculatePrices({ tarifHoraire: v }); }} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Mensuel de base (DH)</label>
                <input type="number" value={invMensuelBase} onChange={e => setInvMensuelBase(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Jours de passage</label>
                <input type="text" value={invJoursPassage} onChange={e => setInvJoursPassage(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="produitsInclus" checked={invProduitsInclus} onChange={e => { const v = e.target.checked; setInvProduitsInclus(v); recalculatePrices({ produitsInclus: v }); }} style={{ cursor: 'pointer' }} />
              <label htmlFor="produitsInclus" style={{ fontSize: 13, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>Produits ménagers inclus</label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Taux de réduction (%)</label>
                <input type="number" value={invTauxRemise} onChange={e => { const v = e.target.value; setInvTauxRemise(v); recalculatePrices({ tauxRemise: v }); }} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Interventions récupérées</label>
                <input type="number" value={invInterventionsRecup} onChange={e => { const v = e.target.value; setInvInterventionsRecup(v); recalculatePrices({ interventionsRecup: v }); }} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
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
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Total interventions planifiées</span>
                <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 10px', borderRadius: 6, fontWeight: 800, fontSize: 13 }}>{numPassages}</span>
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

          {/* 4. Tarification */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#037265', marginBottom: 14 }}>
              Tarification
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Prix unitaire (DH)</label>
                <input type="number" value={invPrixUnitaire} onChange={e => setInvPrixUnitaire(e.target.value)} style={{ width: '100%', padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#f8fafc' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#037265', marginBottom: 4 }}>Remise (DH)</label>
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
                  <span style={{ color: '#64748b' }}>Montant nouvelles interventions</span>
                  <strong style={{ color: '#0f172a' }}>{sousTotalHT.toFixed(2).replace('.', ',')} DH</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Remise</span>
                  <strong style={{ color: '#0f172a' }}>– {remise.toFixed(2).replace('.', ',')} DH</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>Total HT</span>
                  <strong style={{ color: '#0f172a' }}>{totalHT.toFixed(2).replace('.', ',')} DH</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>TVA ({tvaPct}%)</span>
                  <strong style={{ color: '#0f172a' }}>{tvaAmount.toFixed(2).replace('.', ',')} DH</strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#037265' }}>Total TTC</span>
                <strong style={{ fontWeight: 800, fontSize: 18, color: '#037265' }}>{totalTTC.toFixed(2).replace('.', ',')} DH</strong>
              </div>
            </div>
          </div>

          {/* 5. Aperçu de la facturation */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#15803d', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={16} color="#15803d" /> Aperçu de la facturation
            </div>
            <div style={{ fontSize: 13, color: '#166534', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>Interventions prévues ce mois : <strong>{numPassages}</strong></div>
              <div>Interventions reportées (déjà payées) : <strong>0</strong></div>
              <div>Nouvelles interventions facturables : <strong>{numNouvelles}</strong></div>
              <div>Prix unitaire : <strong>{pu.toFixed(2).replace('.', ',')} DH</strong></div>
              <div>Montant à facturer : <strong>{numNouvelles} × {pu.toFixed(2).replace('.', ',')} DH = {totalTTC.toFixed(2).replace('.', ',')} DH</strong></div>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: '#15803d', fontStyle: 'italic' }}>
              Interventions déjà réglées : 0 · Interventions facturées ce mois : {numNouvelles}
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
                const numPassages = Math.max(0, Number(invNbPassages) || 0);
                const pu = Math.max(0, Number(invPrixUnitaire) || 0);
                const remise = Math.max(0, Number(invRemiseDh) || 0);
                const tvaPct = Math.max(0, Number(invTvaPercent) || 0);
                const totalHT = Math.max(0, (numPassages * pu) - remise);
                const tvaAmount = (totalHT * tvaPct) / 100;
                const totalTTC = totalHT + tvaAmount;

                const updatedFormData = {
                  ...(latest.formulaire_data || {}),
                  type_prestation: invService,
                  frequence: invFrequence,
                  date_demarrage: invDateStart,
                  nb_personnes: invNbPersonnes,
                  duree: invDuree,
                  montant_total: invMontantTotal,
                  mode_paiement: invModePaiement,
                  com: invCommission,
                  nombre_passages: invNbPassages,
                  tarif_horaire: invTarifHoraire,
                  mensuel_base: invMensuelBase,
                  jours_passage: invJoursPassage,
                  produits_inclus: invProduitsInclus,
                  taux_reduction: invTauxRemise,
                  interventions_recuperees: invInterventionsRecup,
                  prix_unitaire: invPrixUnitaire,
                  remise_dh: invRemiseDh,
                  tva: invTvaPercent,
                  total_ht: totalHT,
                  total_ttc: totalTTC
                };

                await updateDemande(latest.id, {
                  prix: Number(invMontantTotal) || latest.prix,
                  service: invService,
                  formulaire_data: updatedFormData
                } as any);

                await generateDocument(latest.id, 'facture', activeTabIndex + 1);
                addToast("Facture enregistrée en BDD et générée avec succès.", "success");
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
