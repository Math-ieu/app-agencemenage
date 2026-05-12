import { useState, useEffect } from "react";
import { FormulaBox, B, s, OptRow, ResultBar, fmt, Field } from "./QuoteShared";
import type { QuotePrestationLine } from "./QuoteSection";

interface PlacementQuoteProps {
  demande: any;
  onPrestationsChange?: (prestations: QuotePrestationLine[], total: number, extra?: Record<string, any>) => void;
}

export default function PlacementQuote({ demande, onPrestationsChange }: PlacementQuoteProps) {
  const [mode, setMode] = useState("flex");
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
  const [hj, setHj] = useState(4);
  const [js, setJs] = useState("22");
  const [nb, setNb] = useState(data.nb_personnel || 1);
  const [eng, setEng] = useState("0");
  const [ferie, setFerie] = useState(false);
  const [tenue, setTenue] = useState(false);

  const jm = parseFloat(js);
  const hm = hj * jm;
  const base = hm * 32 * nb * (ferie ? 1.20 : 1);
  const reduction = parseFloat(eng);
  const mensuel = Math.round(base * (1 - reduction));
  const tenueCost = tenue ? 200 * nb : 0;
  const total = mensuel + tenueCost;
  const reductionMontant = Math.round(base * reduction);
  const engLabel = eng === "0.05" ? "6 mois" : eng === "0.10" ? "12 mois" : "";
  const engPct = Math.round(reduction * 100);
  const jsSem = jm === 22 ? 5 : jm === 26 ? 6 : 7;

  useEffect(() => {
    if (!onPrestationsChange) return;
    const prestations: QuotePrestationLine[] = [
      { designation: `Mise à disposition — ${nb} intervenante — ${hj}h/j × ${jsSem}j/sem (${hm}h/mois)`, montant: Math.round(base) },
    ];
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
      reduction: reductionMontant, reduction_montant: reductionMontant,
      reduction_pourcentage: engPct, engagement_mois: eng === "0.05" ? 6 : eng === "0.10" ? 12 : 0,
      tenue_travail: tenueCost,
      service_type: "flexible",
    });
  }, [hj, js, nb, eng, ferie, tenue, base, total, reductionMontant, tenueCost, hm, jsSem]);

  return (
    <div>
      <FormulaBox>
        <B>Modèle Flexible :</B> Heures/mois × 32 DH/h
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label="Heures/jour">
            <input type="number" value={hj} onChange={e => setHj(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Jours/mois">
            <select value={js} onChange={e => setJs(e.target.value)} style={s.input as any}>
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
          <OptRow label="Jours fériés" price="+20%" checked={ferie} onChange={setFerie} />
          <OptRow label="Tenues" price="+200 DH/p" checked={tenue} onChange={setTenue} />
        </div>
      </div>
      <ResultBar
        detail={`${hm.toFixed(0)}h × 32 DH × ${nb} pers × ${(1 - reduction).toFixed(2)}`}
        total={`${fmt(total)} DH`} label="Mensuel HT" />
    </div>
  );
}

function G360Calc({ demande, onPrestationsChange }: PlacementQuoteProps) {
  const data = demande.formulaire_data || {};
  const [hj, setHj] = useState(4);
  const [js, setJs] = useState("22");
  const [nb, setNb] = useState(Math.max(2, data.nb_personnel || 2));
  const [eng, setEng] = useState("0");
  const [ferie, setFerie] = useState(false);

  const nbS = Math.max(nb, 2);
  const jm = parseFloat(js);
  const hm = hj * jm;
  const base = hm * 45 * nbS * (ferie ? 1.20 : 1);
  const reduction = parseFloat(eng);
  const superv = nbS < 3 ? 800 : 0;
  const total = Math.round(base * (1 - reduction)) + superv;
  const reductionMontant = Math.round(base * reduction);
  const engLabel = eng === "0.05" ? "6 mois" : eng === "0.10" ? "12 mois" : "";
  const engPct = Math.round(reduction * 100);
  const jsSem = jm === 22 ? 5 : jm === 26 ? 6 : 7;

  useEffect(() => {
    if (!onPrestationsChange) return;
    const prestations: QuotePrestationLine[] = [
      { designation: `Gestion 360° — ${nbS} intervenante(s) — ${hj}h/j × ${jsSem}j/sem (${hm}h/mois)`, montant: Math.round(base) },
    ];
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
      reduction: reductionMontant, reduction_montant: reductionMontant,
      reduction_pourcentage: engPct, engagement_mois: eng === "0.05" ? 6 : eng === "0.10" ? 12 : 3,
      service_type: "gestion360",
    });
  }, [hj, js, nb, eng, ferie, base, total, reductionMontant, superv, hm, jsSem, nbS]);

  return (
    <div>
      <FormulaBox>
        <B>Gestion 360 :</B> All-inclusive · <B>Taux :</B> 45 DH/h
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label="Heures/jour">
            <input type="number" value={hj} onChange={e => setHj(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Jours/mois">
            <select value={js} onChange={e => setJs(e.target.value)} style={s.input as any}>
              <option value="22">22j (5j/sem)</option>
              <option value="26">26j (6j/sem)</option>
              <option value="30">30j (7j/sem)</option>
            </select>
          </Field>
          <Field label="Effectif (min 2)">
            <input type="number" value={nb} onChange={e => setNb(Math.max(2, +e.target.value))} style={s.input as any} />
          </Field>
          <Field label="Engagement">
            <select value={eng} onChange={e => setEng(e.target.value)} style={s.input as any}>
              <option value="0">3 mois</option>
              <option value="0.05">6 mois (−5%)</option>
              <option value="0.10">12 mois (−10%)</option>
            </select>
          </Field>
        </div>
        <div>
          <OptRow label="Jours fériés" price="+20%" checked={ferie} onChange={setFerie} />
          <div style={{ marginTop: 8, padding: "8px", background: "#F0FDF4", borderRadius: 8, fontSize: 10, color: "#166534" }}>
            ✓ Tenues incluses · ✓ Supervision incluse (≥3 pers)
            {nbS < 3 && <div style={{ color: "#92400E" }}>⚠ &lt; 3 pers : supervision +800 DH</div>}
          </div>
        </div>
      </div>
      <ResultBar
        detail={`${hm.toFixed(0)}h × 45 DH × ${nbS} pers × ${(1 - reduction).toFixed(2)}`}
        total={`${fmt(total)} DH`} label="Mensuel HT" />
    </div>
  );
}
