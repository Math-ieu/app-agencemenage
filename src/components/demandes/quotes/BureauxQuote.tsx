import { useState } from "react";
import { FormulaBox, B, s, OptRow, ResultBar, fmt, Field } from "./QuoteShared";

export default function BureauxQuote({ demande }: { demande: any }) {
  const data = demande.formulaire_data || {};
  
  const [heures, setHeures] = useState(data.duree || data.duration || 3);
  const [personnes, setPersonnes] = useState(data.nb_intervenants || data.numberOfPeople || 1);
  const [freq, setFreq] = useState(demande.frequency === 'abonnement' ? "0.90" : "1.00");
  const [opts, setOpts] = useState({ produits: Boolean(data.produits), serpiere: Boolean(data.torchons), zone: false });
  const tog = (k: keyof typeof opts) => setOpts(o => ({ ...o, [k]: !o[k] }));

  const base = heures * personnes * 60 * parseFloat(freq);
  const op = (opts.produits ? 90 : 0) + (opts.serpiere ? 40 : 0) + (opts.zone ? 50 : 0);
  const total = base + op;

  return (
    <div className="quote-calculator">
      <FormulaBox>
        <B>Base :</B> Heures × Pers × 60 DH · <B>Abo :</B> −10%
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label="Heures">
            <input type="number" value={heures} onChange={e => setHeures(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Personnes">
            <input type="number" value={personnes} onChange={e => setPersonnes(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Fréquence">
            <select value={freq} onChange={e => setFreq(e.target.value)} style={s.input as any}>
              <option value="1.00">Ponctuel</option>
              <option value="0.90">Abonnement (−10%)</option>
            </select>
          </Field>
        </div>
        <div>
          <div style={s.optTitle}>Options</div>
          <OptRow label="Produits fournis" price="+90 DH" checked={opts.produits} onChange={() => tog("produits")} />
          <OptRow label="Torchons / Serpières" price="+40 DH" checked={opts.serpiere} onChange={() => tog("serpiere")} />
          <OptRow label="Zone éloignée" price="+50 DH" checked={opts.zone} onChange={() => tog("zone")} />
        </div>
      </div>
      <ResultBar
        detail={`${heures}h × ${personnes} pers × 60 DH${parseFloat(freq) < 1 ? ' × 0.9' : ''} + options`}
        total={`${fmt(total)} DH`} label="Total mission HT" />
    </div>
  );
}
