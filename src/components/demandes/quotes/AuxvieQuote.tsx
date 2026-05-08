import { useState } from "react";
import { FormulaBox, B, s, OptRow, ResultBar, fmt, Field } from "./QuoteShared";

export default function AuxvieQuote({ demande }: { demande: any }) {
  const data = demande.formulaire_data || {};
  
  const [mode, setMode] = useState("240");
  const [jours, setJours] = useState(data.nb_jours || data.numberOfDays || 5);
  const [semaines, setSemaines] = useState(4);
  const [duree, setDuree] = useState("1.00");
  const [opts, setOpts] = useState({ toilette: false, repas: false, medic: false, sortie: false });
  const tog = (k: keyof typeof opts) => setOpts(o => ({ ...o, [k]: !o[k] }));

  const tarif = parseFloat(mode);
  const cd = parseFloat(duree);
  const totalJ = jours * semaines;
  const opj = (opts.toilette ? 50 : 0) + (opts.repas ? 40 : 0) + (opts.medic ? 30 : 0) + (opts.sortie ? 80 : 0);
  const base = tarif * totalJ * cd;
  const total = base + opj * totalJ;

  return (
    <div className="quote-calculator">
      <FormulaBox>
        <B>Base :</B> Tarif × Jours × Semaines × Coeff
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label="Présence">
            <select value={mode} onChange={e => setMode(e.target.value)} style={s.input as any}>
              <option value="240">Journée (8h) — 240 DH</option>
              <option value="420">Nuit (12h) — 420 DH</option>
              <option value="580">24h — 580 DH</option>
            </select>
          </Field>
          <Field label="Jours/sem">
            <input type="number" value={jours} min={1} max={7} onChange={e => setJours(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Semaines">
            <input type="number" value={semaines} min={1} onChange={e => setSemaines(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Durée mission">
            <select value={duree} onChange={e => setDuree(e.target.value)} style={s.input as any}>
              <option value="1.20">Ponctuelle (&lt; 1 sem) (×1,20)</option>
              <option value="1.00">Court terme (1 à 4 sem) (×1,00)</option>
              <option value="0.90">Long terme (&gt; 1 mois) (×0,90)</option>
            </select>
          </Field>
        </div>
        <div>
          <div style={s.optTitle}>Options / jour</div>
          <OptRow label="Toilette" price="+50 DH" checked={opts.toilette} onChange={() => tog("toilette")} />
          <OptRow label="Repas" price="+40 DH" checked={opts.repas} onChange={() => tog("repas")} />
          <OptRow label="Médicaments" price="+30 DH" checked={opts.medic} onChange={() => tog("medic")} />
          <OptRow label="Sorties" price="+80 DH" checked={opts.sortie} onChange={() => tog("sortie")} />
        </div>
      </div>
      <ResultBar
        detail={`${totalJ}j × ${cd === 1 ? '' : cd + ' × '}${fmt(tarif)} DH + options`}
        total={`${fmt(total)} DH`} label="Total mission" />
    </div>
  );
}
