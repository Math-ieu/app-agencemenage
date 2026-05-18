import { useState, useEffect } from "react";
import { FormulaBox, B, s, OptRow, ResultBar, fmt, Field } from "./QuoteShared";
import type { QuotePrestationLine } from "./QuoteSection";

interface BureauxQuoteProps {
  demande: any;
  onPrestationsChange?: (prestations: QuotePrestationLine[], total: number, extra?: Record<string, any>) => void;
}

export default function BureauxQuote({ demande, onPrestationsChange }: BureauxQuoteProps) {
  const data = demande.formulaire_data || {};
  
  const [heures, setHeures] = useState(data.nb_heures || data.heures || data.duree || data.duration || 3);
  const [personnes, setPersonnes] = useState(data.nb_intervenantes || data.nb_intervenants || data.numberOfPeople || 1);
  const [freq, setFreq] = useState(data.reduction_abonnement === 10 ? "0.90" : (demande.frequency === 'abonnement' ? "0.90" : "1.00"));
  const [opts, setOpts] = useState({ produits: Boolean(data.produits), serpiere: Boolean(data.torchons), zone: Boolean(data.zone_eloignee) });
  const tog = (k: keyof typeof opts) => setOpts(o => ({ ...o, [k]: !o[k] }));

  const isAbo = parseFloat(freq) < 1;
  const base = heures * personnes * 60 * parseFloat(freq);
  const op = (opts.produits ? 90 : 0) + (opts.serpiere ? 40 : 0) + (opts.zone ? 50 : 0);
  const total = base + op;

  useEffect(() => {
    if (!onPrestationsChange) return;
    const prestations: QuotePrestationLine[] = [
      { designation: `Ménage bureaux — ${heures}h × ${personnes} intervenante × 4 passages/mois${isAbo ? " (abonnement –10%)" : ""}`, montant: Math.round(base) },
    ];
    if (opts.produits) prestations.push({ designation: "Produits ménagers professionnels fournis par l'agence", montant: 90 });
    if (opts.serpiere) prestations.push({ designation: "Torchons et serpillières fournis", montant: 40 });
    if (opts.zone) prestations.push({ designation: "Supplément zone éloignée", montant: 50 });
    onPrestationsChange(prestations, total, {
      nb_heures: heures, heures, nb_intervenantes: personnes, nb_intervenants: personnes,
      nb_passages_mois: 4, reduction_abonnement: isAbo ? 10 : 0,
      prix_base: Math.round(base), prix_produits: opts.produits ? 90 : 0,
      produits: opts.produits, torchons: opts.serpiere, zone_eloignee: opts.zone
    });
  }, [heures, personnes, freq, opts, base, total, isAbo]);

  return (
    <div className="quote-calculator">
      <FormulaBox>
        <B>Base :</B> Heures × Personnes × 60 DH/h · <B>Abonnement :</B> −10% · <B>Zone éloignée :</B> +50 DH
        <br /><span style={{ fontSize: 10, marginTop: 3, display: "block" }}>Tarification identique au site actuel agencemenage.ma</span>
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
          <OptRow label="Produits fournis par l'agence" note="Nettoyants multi-usage, désinfectants, vitres..." price="+90 DH" checked={opts.produits} onChange={() => tog("produits")} />
          <OptRow label="Torchons et serpillères" price="+40 DH" checked={opts.serpiere} onChange={() => tog("serpiere")} />
          <OptRow label="Supplément zone éloignée" note="Bouskoura, Dar Bouazza, Mohammédia..." price="+50 DH" checked={opts.zone} onChange={() => tog("zone")} />
        </div>
      </div>
      <ResultBar
        detail={`${heures}h × ${personnes} pers × 60 DH${parseFloat(freq) < 1 ? ` × abo ${freq}` : ""} = ${fmt(base)} DH + options ${fmt(op)} DH`}
        total={`${fmt(total)} DH`} label="Total intervention HT" />
    </div>
  );
}
