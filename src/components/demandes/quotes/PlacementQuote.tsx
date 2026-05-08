import { useState } from "react";
import { FormulaBox, B, s, OptRow, ResultBar, fmt, Field } from "./QuoteShared";

export default function PlacementQuote({ demande }: { demande: any }) {
  const [mode, setMode] = useState("flex");
  return (
    <div className="quote-calculator">
      <div style={s.subTabs}>
        {[["flex", "Flexible"], ["g360", "Gestion 360"]].map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)}
            style={{ ...s.subTab, ...(mode === k ? s.subTabOn : {}) }}>{l}</button>
        ))}
      </div>
      {mode === "flex" ? <FlexCalc demande={demande} /> : <G360Calc demande={demande} />}
    </div>
  );
}

function FlexCalc({ demande }: { demande: any }) {
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

function G360Calc({ demande }: { demande: any }) {
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
