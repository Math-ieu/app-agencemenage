import { useState, useEffect } from "react";
import { FormulaBox, B, s, OptRow, ResultBar, fmt, Field } from "./QuoteShared";
import RemiseSection, { type RemiseValue } from "./RemiseSection";
import { SURCHARGE_CITIES } from "../../../utils/pricing";
import type { QuotePrestationLine } from "./QuoteSection";

// Brief Services 02–05 — Ménage standard (60 DH/h, min 4h) & Grand ménage (70 DH/h, min 6h)
const OPT_PRODUITS = 90;
const OPT_TORCHONS = 40;
const OPT_PACK = 200;
const OPT_ZONE = 50;

interface StandardQuoteProps {
  demande: any;
  onPrestationsChange?: (prestations: QuotePrestationLine[], total: number, extra?: Record<string, any>) => void;
}

export default function StandardQuote({ demande, onPrestationsChange }: StandardQuoteProps) {
  const data = demande.formulaire_data || {};
  const service = (demande.service || "").toLowerCase();
  const isGrand = service.includes("grand");
  const rate = isGrand ? 70 : 60;
  const minHours = isGrand ? 6 : 4;

  // Ville concernée par le supplément zone éloignée ?
  const ville = data.ville || data.city || demande.client_city || "";
  const villeConcernee = SURCHARGE_CITIES.includes(ville);

  const [heures, setHeures] = useState<number>(() => Math.max(minHours, Number(data.duree || data.nb_heures || data.heures || minHours)));
  const [personnes, setPersonnes] = useState<number>(() => Number(data.nb_intervenants || data.nb_intervenantes || 1));
  const [frequency, setFrequency] = useState<string>(() => {
    if (data.frequency) return data.frequency === "abonnement" || data.frequency === "subscription" ? "subscription" : "oneshot";
    if (demande.frequency === "abonnement") return "subscription";
    return "oneshot";
  });
  const [joursSemaine, setJoursSemaine] = useState<number>(() => Number(data.jours_par_semaine || 2));

  const [opts, setOpts] = useState(() => ({
    produits: Boolean(data.produits),
    torchons: Boolean(data.torchons),
    pack: Boolean(data.pack_integral),
    // Zone activée par défaut si une ville concernée a été choisie sur la demande
    zone: data.zone_eloignee !== undefined ? Boolean(data.zone_eloignee) : villeConcernee,
  }));
  const togOpt = (k: "produits" | "torchons" | "pack" | "zone") => setOpts(o => ({ ...o, [k]: !o[k] }));

  const [remise, setRemise] = useState<RemiseValue>(() => ({
    abonnement: data.reduction_abonnement ? true : (demande.frequency === "abonnement"),
    etenduePct: Number(data.remise_etendue_pct || 0),
    promoCode: data.code_promo || "",
    promoPct: Number(data.code_promo_pct || 0),
  }));

  useEffect(() => {
    if (heures < minHours) setHeures(minHours);
  }, [minHours, heures]);

  const isAbo = frequency === "subscription";
  const nbPassages = isAbo ? joursSemaine * 4 : 1;

  const optionsTotal = (opts.produits ? OPT_PRODUITS : 0) + (opts.torchons ? OPT_TORCHONS : 0)
    + (opts.pack ? OPT_PACK : 0) + (opts.zone ? OPT_ZONE : 0);

  const laborPerPassage = heures * personnes * rate;
  const laborBase = laborPerPassage * nbPassages; // mensuel si abo, sinon par passage

  // Remise effective : −10% abonnement ou remise étendue (la plus avantageuse)
  const remisePct = isAbo
    ? Math.max(remise.abonnement ? 10 : 0, remise.etenduePct)
    : remise.etenduePct;
  const remiseMontant = Math.round(laborBase * (remisePct / 100));
  const laborAfterRemise = laborBase - remiseMontant;

  const total = laborAfterRemise + optionsTotal;
  // Code promo 1er mois (sur la base après remise abonnement)
  const promoMontant = remise.promoCode ? Math.round(laborAfterRemise * (remise.promoPct / 100)) : 0;
  const total1erMois = total - promoMontant;

  useEffect(() => {
    if (!onPrestationsChange) return;
    const label = isGrand ? "Grand ménage" : "Ménage standard";
    const prestations: QuotePrestationLine[] = [];

    if (isAbo) {
      prestations.push({
        designation: `${label} — ${heures}h × ${personnes} intervenante${personnes > 1 ? "s" : ""} × ${nbPassages} passages/mois`,
        montant: laborBase,
      });
    } else {
      prestations.push({
        designation: `${label} — ${heures}h × ${personnes} intervenante${personnes > 1 ? "s" : ""} (prestation ponctuelle)`,
        montant: laborBase,
      });
    }

    if (remiseMontant > 0) {
      const rLabel = isAbo && remise.abonnement && remisePct === 10
        ? "Remise abonnement (–10%)"
        : `Remise (–${remisePct}%)`;
      prestations.push({ designation: rLabel, montant: -remiseMontant, isReduction: true });
    }

    if (opts.produits) prestations.push({ designation: "Produits ménagers fournis par l'agence", montant: OPT_PRODUITS });
    if (opts.torchons) prestations.push({ designation: "Torchons et serpières (usage unique)", montant: OPT_TORCHONS });
    if (opts.pack) prestations.push({ designation: "Pack Intégral (produits + torchons + matériel)", montant: OPT_PACK });
    if (opts.zone) prestations.push({ designation: "Zone éloignée (Bouskoura, Dar Bouazza, Mohammédia…)", montant: OPT_ZONE });

    onPrestationsChange(prestations, total, {
      nb_heures: heures,
      heures,
      duree: heures,
      nb_intervenants: personnes,
      nb_intervenantes: personnes,
      jours_par_semaine: isAbo ? joursSemaine : 0,
      prix_base: laborBase,
      produits: opts.produits,
      torchons: opts.torchons,
      pack_integral: opts.pack,
      zone_eloignee: opts.zone ? OPT_ZONE : 0,
      reduction: remiseMontant,
      reduction_montant: remiseMontant,
      reduction_pourcentage: remisePct,
      reduction_abonnement: isAbo && remise.abonnement ? 10 : 0,
      remise_etendue_pct: remise.etenduePct,
      code_promo: remise.promoCode,
      code_promo_pct: remise.promoPct,
      montant_1er_mois: total1erMois,
      frequence: isAbo ? `${joursSemaine}/sem` : "une fois",
      frequency,
    });
  }, [heures, personnes, frequency, joursSemaine, opts, remise, total, isAbo, nbPassages, laborBase, remiseMontant, remisePct, total1erMois, isGrand, onPrestationsChange]);

  return (
    <div className="quote-calculator">
      <FormulaBox>
        <B>Base :</B> Heures × Intervenantes × {rate} DH/h · min {minHours}h/passage{isGrand ? " (grand ménage)" : ""} · <B>Abonnement :</B> −10%
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label={`Heures par passage (min ${minHours}h)`}>
            <input type="number" value={heures} min={minHours} max={12} onChange={e => setHeures(Math.max(minHours, +e.target.value))} style={s.input as any} />
          </Field>
          <Field label="Nombre d'intervenantes">
            <input type="number" value={personnes} min={1} max={10} onChange={e => setPersonnes(Math.max(1, +e.target.value))} style={s.input as any} />
          </Field>
          <Field label="Fréquence">
            <select value={frequency} onChange={e => setFrequency(e.target.value)} style={s.input as any}>
              <option value="oneshot">Une fois (intervention ponctuelle)</option>
              <option value="subscription">Abonnement mensuel (-10%)</option>
            </select>
          </Field>
          {isAbo && (
            <Field label="Passages par semaine">
              <input type="number" value={joursSemaine} min={1} max={7} onChange={e => setJoursSemaine(Math.min(7, Math.max(1, +e.target.value)))} style={s.input as any} />
            </Field>
          )}
        </div>
        <div>
          <div style={s.optTitle}>Options</div>
          <OptRow label="Produits ménagers fournis" price="+90 DH" checked={opts.produits} onChange={() => togOpt("produits")} />
          <OptRow label="Torchons et serpières" note="usage unique, non laissés sur place" price="+40 DH" checked={opts.torchons} onChange={() => togOpt("torchons")} />
          <OptRow label="Pack Intégral" note="produits + torchons + serpière + raclette + balai + seau" price="+200 DH" checked={opts.pack} onChange={() => togOpt("pack")} />
          <OptRow
            label="Zone éloignée"
            note={villeConcernee ? `Activée — ${ville} est une zone concernée` : "Bouskoura, Dar Bouazza, Mohammédia…"}
            price="+50 DH"
            checked={opts.zone}
            onChange={() => togOpt("zone")}
          />
        </div>
      </div>

      <RemiseSection isAbo={isAbo} segment={demande.segment} montantBase={laborBase} value={remise} onChange={setRemise} />

      <ResultBar
        detail={`${heures}h × ${personnes} × ${rate} DH${isAbo ? ` × ${nbPassages} passages` : ""}${remiseMontant > 0 ? ` − ${fmt(remiseMontant)} DH remise` : ""}${optionsTotal > 0 ? ` + options ${fmt(optionsTotal)} DH` : ""}${promoMontant > 0 ? ` · 1er mois : ${fmt(total1erMois)} DH (promo)` : ""}`}
        total={`${fmt(total)} DH`}
        label={isAbo ? "Total mensuel" : "Total intervention"} />
    </div>
  );
}
