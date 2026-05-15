import { useState, useEffect } from "react";
import { FormulaBox, B, s, OptRow, ResultBar, fmt, Field } from "./QuoteShared";
import type { QuotePrestationLine } from "./QuoteSection";

interface AuxvieQuoteProps {
  demande: any;
  onPrestationsChange?: (prestations: QuotePrestationLine[], total: number, extra?: Record<string, any>) => void;
}

export default function AuxvieQuote({ demande, onPrestationsChange }: AuxvieQuoteProps) {
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
  const optionsTotal = opj * totalJ;
  const total = base + optionsTotal;

  const modeLabel = mode === "240" ? "Journée (8h)" : mode === "420" ? "Nuit (12h)" : "24h";
  const dureeLabel = cd === 1.2 ? "Ponctuelle" : cd === 1 ? "Court terme" : "Long terme (−10%)";

  useEffect(() => {
    if (!onPrestationsChange) return;
    const prestations: QuotePrestationLine[] = [
      { designation: `Auxiliaire de vie — ${modeLabel} — ${totalJ} jours — ${dureeLabel}`, montant: Math.round(base) },
    ];
    if (opts.toilette) prestations.push({ designation: `Aide à la toilette (${totalJ} jours × 50 DH)`, montant: 50 * totalJ });
    if (opts.repas) prestations.push({ designation: `Préparation repas (${totalJ} jours × 40 DH)`, montant: 40 * totalJ });
    if (opts.medic) prestations.push({ designation: `Suivi médicaments (${totalJ} jours × 30 DH)`, montant: 30 * totalJ });
    if (opts.sortie) prestations.push({ designation: `Accompagnement sorties (${totalJ} jours × 80 DH)`, montant: 80 * totalJ });
    onPrestationsChange(prestations, total, {
      tarif_journalier: tarif, nb_jours: jours, nb_semaines: semaines,
      coefficient_duree: cd, duree: dureeLabel,
    });
  }, [mode, jours, semaines, duree, opts, base, total, totalJ]);

  return (
    <div className="quote-calculator">
      <FormulaBox>
        <B>Base :</B> Tarif × Jours × Semaines × Coeff
        <br /><span style={{ fontSize: 10, display: "block", marginTop: 3 }}>Usage interne : tarification basée sur les forfaits 8h/12h/24h.</span>
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
          <Field label="Jours / semaine">
            <input type="number" value={jours} min={1} max={7} onChange={e => setJours(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Durée de la mission (semaines)">
            <input type="number" value={semaines} min={1} max={52} onChange={e => setSemaines(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Durée mission">
            <select value={duree} onChange={e => setDuree(e.target.value)} style={s.input as any}>
              <option value="1.20">Ponctuelle — moins d'1 semaine (×1,20)</option>
              <option value="1.00">Court terme — 1 à 4 semaines (×1,00)</option>
              <option value="0.90">Long terme — plus d'1 mois (×0,90)</option>
            </select>
          </Field>
        </div>
        <div>
          <div style={s.optTitle}>Options / jour de présence</div>
          <OptRow label="Aide à la toilette" price="+50 DH/j" checked={opts.toilette} onChange={() => tog("toilette")} />
          <OptRow label="Préparation des repas" price="+40 DH/j" checked={opts.repas} onChange={() => tog("repas")} />
          <OptRow label="Suivi prise de médicaments" price="+30 DH/j" checked={opts.medic} onChange={() => tog("medic")} />
          <OptRow label="Accompagnement sorties" price="+80 DH/j" checked={opts.sortie} onChange={() => tog("sortie")} />
        </div>
      </div>
      <ResultBar
        detail={`${mode === "240" ? "8h" : mode === "420" ? "12h" : "24h"} × ${totalJ} j × ${cd.toFixed(2)} = ${fmt(base)} DH + options ${fmt(opj * totalJ)} DH`}
        total={`${fmt(total)} DH`} label="Total mission HT" />
    </div>
  );
}
