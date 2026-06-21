import { useState, useEffect } from "react";
import { FormulaBox, B, s, OptRow, ResultBar, fmt, Field } from "./QuoteShared";
import RemiseSection, { type RemiseValue } from "./RemiseSection";
import { SURCHARGE_CITIES } from "../../../utils/pricing";
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
  const villeConcernee = SURCHARGE_CITIES.includes(data.ville || data.city || demande.client_city || "");
  const [opts, setOpts] = useState({
    evac: Boolean(data.evacuation || data.evacuation_mobilier),
    rapport: Boolean(data.rapport_photo),
    zone: data.zone_eloignee !== undefined ? Boolean(data.zone_eloignee) : villeConcernee,
  });
  const tog = (k: keyof typeof opts) => setOpts(o => ({ ...o, [k]: !o[k] }));

  const MIN = 1200;
  const taux = (TX[type] || TX.deau)[niveau] || TX.deau.moyen;
  const baseRaw = surface * taux;
  const base = Math.max(baseRaw, MIN);
  // Pas de coefficient d'urgence (brief) : un seul tarif quelle que soit la date d'intervention.
  const op = (opts.evac ? 350 : 0) + (opts.rapport ? 150 : 0) + (opts.zone ? 200 : 0);
  const [remise, setRemise] = useState<RemiseValue>(() => ({
    abonnement: false,
    etenduePct: Number(data.remise_etendue_pct || 0),
    promoCode: data.code_promo || "",
    promoPct: Number(data.code_promo_pct || 0),
  }));
  const preRemise = base + op;
  const remiseMontant = Math.round(preRemise * remise.etenduePct / 100);
  const promoMontant = remise.promoCode ? Math.round((preRemise - remiseMontant) * remise.promoPct / 100) : 0;
  const total = preRemise - remiseMontant - promoMontant;

  useEffect(() => {
    if (!onPrestationsChange) return;
    const prestations: QuotePrestationLine[] = [
      { designation: `Nettoyage post-sinistre — ${TYPE_LABELS[type]} niveau ${niveau} — ${surface} m²`, montant: base },
    ];
    if (opts.evac) prestations.push({ designation: "Évacuation mobilier endommagé", montant: 350 });
    if (opts.rapport) prestations.push({ designation: "Rapport photographique PDF (avant / après par zone)", montant: 150 });
    if (opts.zone) prestations.push({ designation: "Zone éloignée (Bouskoura, Dar Bouazza, Mohammédia…)", montant: 200 });
    if (remiseMontant > 0) prestations.push({ designation: `Remise (–${remise.etenduePct}%)`, montant: -remiseMontant, isReduction: true });
    if (promoMontant > 0) prestations.push({ designation: `Code promo ${remise.promoCode} (–${remise.promoPct}%)`, montant: -promoMontant, isReduction: true });
    onPrestationsChange(prestations, total, {
      type_sinistre: TYPE_LABELS[type], interventionNature: type, niveau, surface,
      prix_base: base,
      // Neutralisation des valeurs résiduelles (plus de coefficient d'urgence ni de désodorisation)
      coefficient_majoration: 1, urgence: 1, majoration_montant: 0, desodorisation: 0,
      evacuation: opts.evac ? 350 : 0, evacuation_mobilier: opts.evac ? 350 : 0,
      rapport_photo: opts.rapport ? 150 : 0,
      zone_eloignee: opts.zone ? 200 : 0,
      reduction: remiseMontant + promoMontant,
      reduction_montant: remiseMontant + promoMontant,
      reduction_pourcentage: remise.etenduePct,
      remise_etendue_pct: remise.etenduePct,
      code_promo: remise.promoCode,
      code_promo_pct: remise.promoPct,
    });
  }, [type, surface, niveau, opts, base, remise, remiseMontant, promoMontant, total]);

  return (
    <div className="quote-calculator">
      <FormulaBox>
        <B>Base :</B> max(Surface × Taux, 1 200 DH) + options · <B>Tarif unique</B> (pas de coefficient d'urgence)
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
          <div style={s.optTitle}>Options</div>
          <OptRow label="Évacuation mobilier endommagé" price="+350 DH" checked={opts.evac} onChange={() => tog("evac")} />
          <OptRow label="Rapport photographique PDF" note="Photos avant/après + dossier assurance" price="+150 DH" checked={opts.rapport} onChange={() => tog("rapport")} />
          <OptRow label="Zone éloignée" note="Bouskoura, Dar Bouazza, Mohammédia…" price="+200 DH" checked={opts.zone} onChange={() => tog("zone")} />
          <div style={{ marginTop: 10 }}>
            <span style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E", borderRadius: 4, padding: "2px 8px" }}>Visite préalable recommandée</span>
          </div>
        </div>
      </div>
      <RemiseSection isAbo={false} segment={demande.segment} montantBase={preRemise} value={remise} onChange={setRemise} />
      <ResultBar
        detail={`${surface} m² × ${taux} DH/m²${baseRaw < MIN ? ` → min ${fmt(MIN)}` : ""} = ${fmt(base)} DH + options ${fmt(op)} DH${remiseMontant > 0 ? ` − ${fmt(remiseMontant)} remise` : ""}${promoMontant > 0 ? ` − ${fmt(promoMontant)} promo` : ""}`}
        total={`${fmt(total)} DH`} label="Devis estimatif HT"
        warn="Brouillon — validation requise" />
    </div>
  );
}
