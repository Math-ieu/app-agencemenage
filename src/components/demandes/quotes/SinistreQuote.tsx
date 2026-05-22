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
  
  const [type, setType] = useState(() => {
    const raw = data.interventionNature || data.intervention_nature || '';
    if (raw === 'incendie') return 'incendie';
    if (raw === 'inondation') return 'inondation';
    return 'deau'; // default — also covers 'sinistre' and any unknown value
  });
  const [surface, setSurface] = useState(data.surface || data.surfaceArea || 60);
  const [niveau, setNiveau] = useState(data.niveau || "moyen");
  const [urgence, setUrgence] = useState(data.urgence?.toString() || data.coefficient_majoration?.toString() || "1.00");
  const [opts, setOpts] = useState({ 
    desod: Boolean(data.desodorisation), 
    evac: Boolean(data.evacuation || data.evacuation_mobilier), 
    rapport: Boolean(data.rapport_photo) 
  });
  const tog = (k: keyof typeof opts) => setOpts(o => ({ ...o, [k]: !o[k] }));

  const MIN = 1200;
  const taux = (TX[type] || TX.deau)[niveau] || TX.deau.moyen;
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
        <B>Base :</B> max(Surface × Taux, 1 200 DH) × Coeff urgence + options
        <div style={{ overflowX: "auto", marginTop: 7 }}>
          <table style={{ fontSize: 10, borderCollapse: "collapse", minWidth: 300 }}>
            <thead><tr>{["Type", "Léger", "Moyen", "Grave"].map(h => <th key={h} style={{ padding: "3px 8px", borderBottom: "0.5px solid var(--c-bord)", textAlign: "left", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>)}</tr></thead>
            <tbody>
              {[["Dégât des eaux", "15", "28", "45"], ["Incendie", "28", "50", "75"], ["Inondation", "20", "35", "58"]].map(r => (
                <tr key={r[0]}>{r.map((c, i) => <td key={i} style={{ padding: "3px 8px", borderBottom: "0.5px solid var(--c-bord)" }}>{i > 0 ? c + " DH/m²" : c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
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
          <OptRow label="Désodorisation / désinfection" price="+200 DH" checked={opts.desod} onChange={() => tog("desod")} />
          <OptRow label="Évacuation mobilier endommagé" price="+350 DH" checked={opts.evac} onChange={() => tog("evac")} />
          <OptRow label="Rapport photographique PDF" note="Photos avant/après + dossier assurance" price="+150 DH" checked={opts.rapport} onChange={() => tog("rapport")} />
          <div style={{ marginTop: 10 }}>
            <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", borderRadius: 4, padding: "2px 8px" }}>Visite préalable recommandée</span>
          </div>
        </div>
      </div>
      <ResultBar
        detail={`${surface} m² × ${taux} DH/m²${baseRaw < MIN ? ` → min ${fmt(MIN)}` : ""} DH = ${fmt(base)} DH × ${u.toFixed(2)} + options ${fmt(op)} DH`}
        total={`${fmt(total)} DH`} label="Devis estimatif HT"
        warn="Brouillon — validation requise" />
    </div>
  );
}
