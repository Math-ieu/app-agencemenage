import { useState } from "react";
import { FormulaBox, B, s, OptRow, ResultBar, fmt, Field } from "./QuoteShared";

export default function ChantierQuote({ demande }: { demande: any }) {
  const data = demande.formulaire_data || {};
  
  const [surface, setSurface] = useState(data.surface || data.surfaceArea || 150);
  const [grattage, setGrattage] = useState("15");
  const [vitres, setVitres] = useState("0");
  const [surfVitres, setSurfVitres] = useState(15);
  const [dechets, setDechets] = useState("0");
  const [marbre, setMarbre] = useState(false);
  const [surfMarbre, setSurfMarbre] = useState(30);

  const MIN = 1500;
  const baseRaw = surface * parseFloat(grattage);
  const base = Math.max(baseRaw, MIN);
  const vitresCost = vitres === "150" ? 150 : vitres === "25" ? surfVitres * 25 : 0;
  const dechetsCost = dechets === "-1" ? 0 : (parseFloat(dechets) || 0);
  const devisSpe = dechets === "-1";
  const marbreCost = marbre ? surfMarbre * 25 : 0;
  const total = base + vitresCost + dechetsCost + marbreCost;

  const detail = `${surface} m² × ${grattage} DH = ${fmt(baseRaw)} DH${baseRaw < MIN ? ` (min ${fmt(MIN)})` : ""}` +
    (vitresCost ? ` + vitres` : "") +
    (dechetsCost ? ` + déchets` : "") +
    (marbreCost ? ` + marbre` : "");

  return (
    <div className="quote-calculator">
      <FormulaBox>
        <B>Base :</B> Surface × Grattage (min 1 500 DH)
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label="Surface (m²)">
            <input type="number" value={surface} onChange={e => setSurface(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Grattage">
            <select value={grattage} onChange={e => setGrattage(e.target.value)} style={s.input as any}>
              <option value="12">Sans (12 DH/m²)</option>
              <option value="15">Léger (15 DH/m²)</option>
              <option value="22">Profond (22 DH/m²)</option>
            </select>
          </Field>
          <Field label="Vitres">
            <select value={vitres} onChange={e => setVitres(e.target.value)} style={s.input as any}>
              <option value="0">Aucun</option>
              <option value="150">Léger (+150 DH)</option>
              <option value="25">Profond (25 DH/m²)</option>
            </select>
          </Field>
          {vitres === "25" && (
            <Field label="Surf. Vitrée">
              <input type="number" value={surfVitres} onChange={e => setSurfVitres(+e.target.value)} style={s.input as any} />
            </Field>
          )}
        </div>
        <div>
          <Field label="Déchets">
            <select value={dechets} onChange={e => setDechets(e.target.value)} style={s.input as any}>
              <option value="0">Non</option>
              <option value="200">&lt;100 kg (+200 DH)</option>
              <option value="380">100-300 kg (+380 DH)</option>
              <option value="650">300-500 kg (+650 DH)</option>
              <option value="-1">&gt;500 kg (Devis)</option>
            </select>
          </Field>
          <div style={s.optTitle}>Options</div>
          <OptRow label="Cristallisation marbre" price="25 DH/m²" checked={marbre} onChange={setMarbre} />
          {marbre && (
            <Field label="Surf. Marbre">
              <input type="number" value={surfMarbre} onChange={e => setSurfMarbre(+e.target.value)} style={s.input as any} />
            </Field>
          )}
        </div>
      </div>
      <ResultBar detail={detail} total={`${fmt(total)}${devisSpe ? " +" : ""} DH`} label="Devis HT" />
    </div>
  );
}
