import { useState, useEffect } from "react";
import { FormulaBox, B, s, OptRow, ResultBar, fmt, Field } from "./QuoteShared";
import type { QuotePrestationLine } from "./QuoteSection";

const TX: Record<string, Record<string, number>> = {
  deau: { leger: 15, moyen: 28, grave: 45 },
  incendie: { leger: 28, moyen: 50, grave: 75 },
  inondation: { leger: 20, moyen: 35, grave: 58 },
};

const TYPE_LABELS: Record<string, string> = { deau: "Dégât des eaux", incendie: "Incendie", inondation: "Inondation" };

interface SinistreQuoteProps {
  demande: any;
  onPrestationsChange?: (prestations: QuotePrestationLine[], total: number, extra?: Record<string, any>) => void;
}

export default function SinistreQuote({ demande, onPrestationsChange }: SinistreQuoteProps) {
  const data = demande.formulaire_data || {};
  
  const [type, setType] = useState(data.interventionNature === 'incendie' ? 'incendie' : (data.interventionNature === 'inondation' ? 'inondation' : 'deau'));
  const [surface, setSurface] = useState(data.surface || data.surfaceArea || 60);
  const [niveau, setNiveau] = useState("moyen");
  const [urgence, setUrgence] = useState("1.00");
  const [opts, setOpts] = useState({ desod: false, evac: false, rapport: false });
  const tog = (k: keyof typeof opts) => setOpts(o => ({ ...o, [k]: !o[k] }));

  const MIN = 1200;
  const taux = TX[type][niveau];
  const baseRaw = surface * taux;
  const base = Math.max(baseRaw, MIN);
  const u = parseFloat(urgence);
  const op = (opts.desod ? 200 : 0) + (opts.evac ? 350 : 0) + (opts.rapport ? 150 : 0);
  const total = base * u + op;
  const majorationMontant = u > 1 ? Math.round(base * (u - 1)) : 0;

  useEffect(() => {
    if (!onPrestationsChange) return;
    const prestations: QuotePrestationLine[] = [
      { designation: `Nettoyage post-sinistre — ${TYPE_LABELS[type]} niveau ${niveau} — ${surface} m²`, montant: base },
    ];
    if (majorationMontant > 0) {
      const urgLabel = u === 1.25 ? "sous 48h" : "sous 24h";
      prestations.push({ designation: `Majoration intervention ${urgLabel} (x${u})`, montant: majorationMontant, isMajoration: true });
    }
    if (opts.desod) prestations.push({ designation: "Désodorisation et désinfection complète", montant: 200 });
    if (opts.evac) prestations.push({ designation: "Évacuation mobilier endommagé", montant: 350 });
    if (opts.rapport) prestations.push({ designation: "Rapport photographique PDF (avant / après par zone)", montant: 150 });
    onPrestationsChange(prestations, total, {
      type_sinistre: TYPE_LABELS[type], interventionNature: type, niveau, surface,
      prix_base: base, coefficient_majoration: u, urgence: u,
      majoration_montant: majorationMontant,
      desodorisation: opts.desod ? 200 : 0,
      evacuation: opts.evac ? 350 : 0, evacuation_mobilier: opts.evac ? 350 : 0,
      rapport_photo: opts.rapport ? 150 : 0,
    });
  }, [type, surface, niveau, urgence, opts, base, total, majorationMontant, u]);

  return (
    <div className="quote-calculator">
      <FormulaBox>
        <B>Base :</B> max(Surface × Taux, 1 200 DH) × Urgence
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label="Type">
            <select value={type} onChange={e => setType(e.target.value)} style={s.input as any}>
              <option value="deau">Dégât des eaux</option>
              <option value="incendie">Incendie</option>
              <option value="inondation">Inondation</option>
            </select>
          </Field>
          <Field label="Surface (m²)">
            <input type="number" value={surface} onChange={e => setSurface(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Gravité">
            <select value={niveau} onChange={e => setNiveau(e.target.value)} style={s.input as any}>
              <option value="leger">Léger</option>
              <option value="moyen">Moyen</option>
              <option value="grave">Grave</option>
            </select>
          </Field>
        </div>
        <div>
          <Field label="Urgence">
            <select value={urgence} onChange={e => setUrgence(e.target.value)} style={s.input as any}>
              <option value="1.00">Standard</option>
              <option value="1.25">Sous 48h (+25%)</option>
              <option value="1.50">Sous 24h (+50%)</option>
            </select>
          </Field>
          <div style={s.optTitle}>Options</div>
          <OptRow label="Désinfection" price="+200 DH" checked={opts.desod} onChange={() => tog("desod")} />
          <OptRow label="Évacuation mobilier" price="+350 DH" checked={opts.evac} onChange={() => tog("evac")} />
          <OptRow label="Rapport PDF" price="+150 DH" checked={opts.rapport} onChange={() => tog("rapport")} />
        </div>
      </div>
      <ResultBar
        detail={`${surface} m² × ${taux} DH${baseRaw < MIN ? ' (min)' : ''} × ${u}`}
        total={`${fmt(total)} DH`} label="Devis HT" />
    </div>
  );
}
