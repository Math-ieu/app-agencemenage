import { useState, useEffect } from "react";
import { FormulaBox, B, s, OptRow, ResultBar, fmt, Field } from "./QuoteShared";
import type { QuotePrestationLine } from "./QuoteSection";

const visitsMap: Record<string, number> = {
  "1foisParSemaine": 1,
  "2foisParSemaine": 2,
  "3foisParSemaine": 3,
  "4foisParSemaine": 4,
  "5foisParSemaine": 5,
  "6foisParSemaine": 6,
  "7foisParSemaine": 7,
  "3foisParMois": 0.75,
  "2foisParMois": 0.5,
  "1foisParMois": 0.25,
  "4foisParMois": 1,
};

const PLACEMENT_FREQUENCES = [
  { value: "1foisParSemaine", label: "1 fois par semaine" },
  { value: "2foisParSemaine", label: "2 fois par semaine" },
  { value: "3foisParSemaine", label: "3 fois par semaine" },
  { value: "4foisParSemaine", label: "4 fois par semaine" },
  { value: "5foisParSemaine", label: "5 fois par semaine" },
  { value: "6foisParSemaine", label: "6 fois par semaine" },
  { value: "7foisParSemaine", label: "7 fois par semaine" },
  { value: "1foisParMois", label: "1 fois par mois" },
  { value: "2foisParMois", label: "2 fois par mois" },
  { value: "3foisParMois", label: "3 fois par mois" },
  { value: "4foisParMois", label: "4 fois par mois" },
];

interface PlacementQuoteProps {
  demande: any;
  onPrestationsChange?: (prestations: QuotePrestationLine[], total: number, extra?: Record<string, any>) => void;
}

export default function PlacementQuote({ demande, onPrestationsChange }: PlacementQuoteProps) {
  const initialMode = demande.formulaire_data?.service_type === 'premium' || demande.formulaire_data?.service_type === 'gestion360' ? 'g360' : 'flex';
  const [mode, setMode] = useState(initialMode);
  return (
    <div className="quote-calculator">
      <div style={s.subTabs}>
        {[["flex", "Flexible"], ["g360", "Gestion 360"]].map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)}
            style={{ ...s.subTab, ...(mode === k ? s.subTabOn : {}) }}>{l}</button>
        ))}
      </div>
      {mode === "flex" ? <FlexCalc demande={demande} onPrestationsChange={onPrestationsChange} /> : <G360Calc demande={demande} onPrestationsChange={onPrestationsChange} />}
    </div>
  );
}

function FlexCalc({ demande, onPrestationsChange }: PlacementQuoteProps) {
  const data = demande.formulaire_data || {};
  const [hj, setHj] = useState(data.heures_par_jour || 4);
  const [js, setJs] = useState(data.jours_par_semaine ? (data.jours_par_semaine === 7 ? "30" : data.jours_par_semaine === 6 ? "26" : "22") : "22");
  const [nb, setNb] = useState(data.nb_intervenantes || data.nb_intervenants || data.nb_personnel || 1);
  const [eng, setEng] = useState(data.engagement_mois === 12 ? "0.10" : data.engagement_mois === 6 ? "0.05" : "0");
  const [ferie, setFerie] = useState(Boolean(data.ferie || data.majoration_ferie));
  const [tenue, setTenue] = useState(Boolean(data.tenue_travail));
  const [frequency, setFrequency] = useState(data.frequency || "oneshot");
  const [subFrequency, setSubFrequency] = useState(data.subFrequency || "1foisParSemaine");

  const jm = frequency === "subscription" ? (visitsMap[subFrequency] * 4) : parseFloat(js);
  const hm = hj * jm;
  const base = hm * 32 * nb * (ferie ? 1.20 : 1);
  const reduction = parseFloat(eng);
  const frequencyDiscount = frequency === "subscription" ? 0.10 : 0.00;
  const frequencyDiscountMontant = Math.round(base * frequencyDiscount);
  const reductionMontant = Math.round(base * reduction);
  const tenueCost = tenue ? 200 * nb : 0;
  const total = Math.round(base * (1 - reduction - frequencyDiscount)) + tenueCost;
  const engLabel = eng === "0.05" ? "6 mois" : eng === "0.10" ? "12 mois" : "";
  const engPct = Math.round(reduction * 100);
  const jsSem = frequency === "subscription" ? (visitsMap[subFrequency] || 1) : (jm === 22 ? 5 : jm === 26 ? 6 : 7);

  useEffect(() => {
    if (!onPrestationsChange) return;
    
    const subFreqObj = PLACEMENT_FREQUENCES.find(f => f.value === subFrequency);
    const subFreqLabel = subFreqObj ? subFreqObj.label.toLowerCase() : "";
    const scheduleLabel = frequency === "subscription"
      ? `${hj}h/j, ${subFreqLabel} (${hm}h/mois)`
      : `${hj}h/j × ${jsSem}j/sem (${hm}h/mois)`;

    const prestations: QuotePrestationLine[] = [
      { designation: `Mise à disposition — ${nb} intervenante — ${scheduleLabel}`, montant: Math.round(base) },
    ];
    if (frequencyDiscountMontant > 0) {
      prestations.push({ designation: `Remise abonnement (–10%)`, montant: -frequencyDiscountMontant, isReduction: true });
    }
    if (reductionMontant > 0) {
      prestations.push({ designation: `Réduction engagement ${engLabel} (–${engPct}%)`, montant: -reductionMontant, isReduction: true });
    }
    if (tenueCost > 0) {
      prestations.push({ designation: `Tenue de travail fournie (${nb} personne${nb > 1 ? "s" : ""})`, montant: tenueCost });
    }
    if (ferie) {
      prestations.push({ designation: "Majoration jours fériés (+20%)", montant: "Inclus" });
    }
    onPrestationsChange(prestations, total, {
      heures_par_jour: hj, jours_par_semaine: jsSem, heures_par_mois: hm,
      nb_intervenantes: nb, nb_intervenants: nb, prix_base: Math.round(base),
      reduction: reductionMontant + frequencyDiscountMontant,
      reduction_montant: reductionMontant + frequencyDiscountMontant,
      reduction_pourcentage: engPct + (frequency === "subscription" ? 10 : 0),
      engagement_mois: eng === "0.05" ? 6 : eng === "0.10" ? 12 : 0,
      tenue_travail: tenueCost,
      service_type: "flexible",
      frequency,
      subFrequency,
    });
  }, [hj, js, nb, eng, ferie, tenue, base, total, reductionMontant, frequencyDiscountMontant, frequency, subFrequency, tenueCost, hm, jsSem, engLabel, engPct]);

  return (
    <div>
      <FormulaBox>
        <B>Modèle A — Facturation horaire :</B> Heures/mois × 32 DH/h × Nb personnes
        <br />Le client pilote les opérations. L'agence gère tout le back-office RH (contrats, paie, remplacements).
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label="Heures/jour">
            <input type="number" value={hj} onChange={e => setHj(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Jours/mois">
            <select value={js} onChange={e => setJs(e.target.value)} disabled={frequency === "subscription"} style={{ ...s.input, opacity: frequency === "subscription" ? 0.5 : 1 } as any}>
              <option value="22">22j (5j/sem)</option>
              <option value="26">26j (6j/sem)</option>
              <option value="30">30j (7j/sem)</option>
            </select>
          </Field>
          <Field label="Effectif">
            <input type="number" value={nb} onChange={e => setNb(+e.target.value)} style={s.input as any} />
          </Field>
        </div>
        <div>
          <Field label="Engagement">
            <select value={eng} onChange={e => setEng(e.target.value)} style={s.input as any}>
              <option value="0">Mensuel</option>
              <option value="0.05">6 mois (−5%)</option>
              <option value="0.10">12 mois (−10%)</option>
            </select>
          </Field>
          <Field label="Fréquence">
            <select value={frequency} onChange={e => setFrequency(e.target.value)} style={s.input as any}>
              <option value="oneshot">Une fois</option>
              <option value="subscription">Abonnement (-10%)</option>
            </select>
          </Field>
          {frequency === "subscription" && (
            <Field label="Cadence d'abonnement">
              <select value={subFrequency} onChange={e => setSubFrequency(e.target.value)} style={s.input as any}>
                <option value="1foisParSemaine">1 fois par semaine</option>
                <option value="2foisParSemaine">2 fois par semaine</option>
                <option value="3foisParSemaine">3 fois par semaine</option>
                <option value="4foisParSemaine">4 fois par semaine</option>
                <option value="5foisParSemaine">5 fois par semaine</option>
                <option value="6foisParSemaine">6 fois par semaine</option>
                <option value="7foisParSemaine">7 fois par semaine</option>
                <option value="1foisParMois">1 fois par mois</option>
                <option value="2foisParMois">2 fois par mois</option>
                <option value="3foisParMois">3 fois par mois</option>
                <option value="4foisParMois">4 fois par mois</option>
              </select>
            </Field>
          )}
          <OptRow label="Jours fériés" price="+20%" checked={ferie} onChange={setFerie} />
          <OptRow label="Tenue de travail fournie" note="+200 DH/pers — coût unique facturé au 1er mois" price="+200 DH/pers" checked={tenue} onChange={setTenue} />
        </div>
      </div>
      <ResultBar
        detail={`${hm.toFixed(0)}h × 32 DH × ${nb} pers${ferie ? " × 1,20" : ""}${frequencyDiscount > 0 ? " × 0,90" : ""}${reduction > 0 ? ` × ${(1 - reduction).toFixed(2)}` : ""}`}
        total={`${fmt(total)} DH`} label="Mensuel HT" />
    </div>
  );
}

function G360Calc({ demande, onPrestationsChange }: PlacementQuoteProps) {
  const data = demande.formulaire_data || {};
  const [hj, setHj] = useState(data.heures_par_jour || 4);
  const [js, setJs] = useState(data.jours_par_semaine ? (data.jours_par_semaine === 7 ? "30" : data.jours_par_semaine === 6 ? "26" : "22") : "22");
  const [nb, setNb] = useState(Math.max(2, data.nb_intervenantes || data.nb_intervenants || data.nb_personnel || 2));
  const [eng, setEng] = useState(data.engagement_mois === 12 ? "0.10" : data.engagement_mois === 6 ? "0.05" : "0");
  const [ferie, setFerie] = useState(Boolean(data.ferie || data.majoration_ferie));
  const [frequency, setFrequency] = useState(data.frequency || "oneshot");
  const [subFrequency, setSubFrequency] = useState(data.subFrequency || "1foisParSemaine");

  const nbS = Math.max(nb, 2);
  const jm = frequency === "subscription" ? (visitsMap[subFrequency] * 4) : parseFloat(js);
  const hm = hj * jm;
  const base = hm * 45 * nbS * (ferie ? 1.20 : 1);
  const reduction = parseFloat(eng);
  const frequencyDiscount = frequency === "subscription" ? 0.10 : 0.00;
  const frequencyDiscountMontant = Math.round(base * frequencyDiscount);
  const reductionMontant = Math.round(base * reduction);
  const superv = nbS < 3 ? 800 : 0;
  const total = Math.round(base * (1 - reduction - frequencyDiscount)) + superv;
  const engLabel = eng === "0.05" ? "6 mois" : eng === "0.10" ? "12 mois" : "";
  const engPct = Math.round(reduction * 100);
  const jsSem = frequency === "subscription" ? (visitsMap[subFrequency] || 1) : (jm === 22 ? 5 : jm === 26 ? 6 : 7);

  useEffect(() => {
    if (!onPrestationsChange) return;

    const subFreqObj = PLACEMENT_FREQUENCES.find(f => f.value === subFrequency);
    const subFreqLabel = subFreqObj ? subFreqObj.label.toLowerCase() : "";
    const scheduleLabel = frequency === "subscription"
      ? `${hj}h/j, ${subFreqLabel} (${hm}h/mois)`
      : `${hj}h/j × ${jsSem}j/sem (${hm}h/mois)`;

    const prestations: QuotePrestationLine[] = [
      { designation: `Gestion 360° — ${nbS} intervenante(s) — ${scheduleLabel}`, montant: Math.round(base) },
    ];
    if (frequencyDiscountMontant > 0) {
      prestations.push({ designation: `Remise abonnement (–10%)`, montant: -frequencyDiscountMontant, isReduction: true });
    }
    if (reductionMontant > 0) {
      prestations.push({ designation: `Réduction engagement ${engLabel} (–${engPct}%)`, montant: -reductionMontant, isReduction: true });
    }
    prestations.push({ designation: `Tenues de travail incluses (${nbS} personne${nbS > 1 ? "s" : ""})`, montant: "Inclus" });
    prestations.push({ designation: "Supervision qualité incluse (≥3 personnes)", montant: "Inclus" });
    if (superv > 0) {
      prestations.push({ designation: "Supplément supervision (< 3 personnes)", montant: superv });
    }
    onPrestationsChange(prestations, total, {
      heures_par_jour: hj, jours_par_semaine: jsSem, heures_par_mois: hm,
      nb_intervenantes: nbS, nb_intervenants: nbS, prix_base: Math.round(base),
      reduction: reductionMontant + frequencyDiscountMontant,
      reduction_montant: reductionMontant + frequencyDiscountMontant,
      reduction_pourcentage: engPct + (frequency === "subscription" ? 10 : 0),
      engagement_mois: eng === "0.05" ? 6 : eng === "0.10" ? 12 : 3,
      service_type: "gestion360",
      frequency,
      subFrequency,
    });
  }, [hj, js, nb, eng, ferie, base, total, reductionMontant, frequencyDiscountMontant, frequency, subFrequency, superv, hm, jsSem, nbS, engLabel, engPct]);

  return (
    <div>
      <FormulaBox>
        <B>Gestion 360 :</B> L'agence pilote de A à Z — équipes, méthodes, produits, supervision, reporting. <B>Taux :</B> 45 DH/h/personne
        <br /><span style={{ fontSize: 10, display: "block", marginTop: 3 }}>Inclus : tenues, check-lists qualité, remplacement le jour même, SLA réclamations 24h, reporting mensuel. Supervision gratuite dès 3 personnes.</span>
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label="Heures/jour">
            <input type="number" value={hj} onChange={e => setHj(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Jours/mois">
            <select value={js} onChange={e => setJs(e.target.value)} disabled={frequency === "subscription"} style={{ ...s.input, opacity: frequency === "subscription" ? 0.5 : 1 } as any}>
              <option value="22">22j (5j/sem)</option>
              <option value="26">26j (6j/sem)</option>
              <option value="30">30j (7j/sem)</option>
            </select>
          </Field>
          <Field label="Effectif (min 2)">
            <input type="number" value={nb} onChange={e => setNb(Math.max(2, +e.target.value))} style={s.input as any} />
          </Field>
        </div>
        <div>
          <Field label="Engagement">
            <select value={eng} onChange={e => setEng(e.target.value)} style={s.input as any}>
              <option value="0">3 mois</option>
              <option value="0.05">6 mois (−5%)</option>
              <option value="0.10">12 mois (−10%)</option>
            </select>
          </Field>
          <Field label="Fréquence">
            <select value={frequency} onChange={e => setFrequency(e.target.value)} style={s.input as any}>
              <option value="oneshot">Une fois</option>
              <option value="subscription">Abonnement (-10%)</option>
            </select>
          </Field>
          {frequency === "subscription" && (
            <Field label="Cadence d'abonnement">
              <select value={subFrequency} onChange={e => setSubFrequency(e.target.value)} style={s.input as any}>
                <option value="1foisParSemaine">1 fois par semaine</option>
                <option value="2foisParSemaine">2 fois par semaine</option>
                <option value="3foisParSemaine">3 fois par semaine</option>
                <option value="4foisParSemaine">4 fois par semaine</option>
                <option value="5foisParSemaine">5 fois par semaine</option>
                <option value="6foisParSemaine">6 fois par semaine</option>
                <option value="7foisParSemaine">7 fois par semaine</option>
                <option value="1foisParMois">1 fois par mois</option>
                <option value="2foisParMois">2 fois par mois</option>
                <option value="3foisParMois">3 fois par mois</option>
                <option value="4foisParMois">4 fois par mois</option>
              </select>
            </Field>
          )}
          <OptRow label="Jours fériés" price="+20%" checked={ferie} onChange={setFerie} />
          <div style={{ marginTop: 8, padding: "8px", background: "#F0FDF4", borderRadius: 8, fontSize: 10, color: "#166534" }}>
            ✓ Tenues fournies incluses ·<br></br>✓ Supervision incluse (≥3 personnes)
·{nbS < 3 && <div style={{ color: "#92400E" }}>⚠ 2 personnes : supervision +800 DH/mois</div>}✓ Engagement minimum 3 mois
            
          </div>
        </div>
      </div>
      <ResultBar
        detail={`${hm.toFixed(0)}h × 45 DH × ${nbS} pers${ferie ? " × 1,20" : ""}${frequencyDiscount > 0 ? " × 0,90" : ""}${reduction > 0 ? ` × ${(1 - reduction).toFixed(2)}` : ""}`}
        total={`${fmt(total)} DH`} label="Mensuel HT" />
    </div>
  );
}
