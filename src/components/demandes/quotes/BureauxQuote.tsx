import { useState, useEffect } from "react";
import { FormulaBox, B, s, OptRow, ResultBar, fmt, Field } from "./QuoteShared";
import RemiseSection, { type RemiseValue } from "./RemiseSection";
import { SURCHARGE_CITIES } from "../../../utils/pricing";
import type { QuotePrestationLine } from "./QuoteSection";

const visitsMap: Record<string, number> = {
  "1foisParSemaine": 1,
  "2foisParSemaine": 2,
  "3foisParSemaine": 3,
  "4foisParSemaine": 4,
  "5foisParSemaine": 5,
  "6foisParSemaine": 6,
  "7foisParSemaine": 7,
  "3foisParMois": 0.75,
  "2foisParMois": 0.5,
  "1foisParMois": 0.25,
  "4foisParMois": 1,
};

const dbSubFreqMap: Record<string, string> = {
  "1foisParSemaine": "1/sem",
  "2foisParSemaine": "2/sem",
  "3foisParSemaine": "3/sem",
  "4foisParSemaine": "4/sem",
  "5foisParSemaine": "5/sem",
  "6foisParSemaine": "6/sem",
  "7foisParSemaine": "7/sem",
  "1foisParMois": "1/mois",
  "2foisParMois": "2/mois",
  "3foisParMois": "3/mois",
  "4foisParMois": "4/mois",
};

const uiSubFreqMap: Record<string, string> = {
  "1/sem": "1foisParSemaine",
  "2/sem": "2foisParSemaine",
  "3/sem": "3foisParSemaine",
  "4/sem": "4foisParSemaine",
  "5/sem": "5foisParSemaine",
  "6/sem": "6foisParSemaine",
  "7/sem": "7foisParSemaine",
  "1/mois": "1foisParMois",
  "2/mois": "2foisParMois",
  "3/mois": "3foisParMois",
  "4/mois": "4foisParMois",
};

const getCadenceLabel = (val: string) => {
  switch (val) {
    case "1foisParSemaine": return "1 fois par semaine";
    case "2foisParSemaine": return "2 fois par semaine";
    case "3foisParSemaine": return "3 fois par semaine";
    case "4foisParSemaine": return "4 fois par semaine";
    case "5foisParSemaine": return "5 fois par semaine";
    case "6foisParSemaine": return "6 fois par semaine";
    case "7foisParSemaine": return "7 fois par semaine";
    case "1foisParMois": return "1 fois par mois";
    case "2foisParMois": return "2 fois par mois";
    case "3foisParMois": return "3 fois par mois";
    case "4foisParMois": return "4 fois par mois";
    default: return "";
  }
};

// Brief Services 06/07 — base 60 DH HT/h ; options HT à la carte
const HOURLY_RATE = 60;
const OPT_PRODUITS = 90;
const OPT_TORCHONS = 40;
const OPT_PACK = 200;
const OPT_ZONE = 50;

interface BureauxQuoteProps {
  demande: any;
  onPrestationsChange?: (prestations: QuotePrestationLine[], total: number, extra?: Record<string, any>) => void;
}

export default function BureauxQuote({ demande, onPrestationsChange }: BureauxQuoteProps) {
  const data = demande.formulaire_data || {};

  // Ville concernée par le supplément zone éloignée ?
  const ville = data.ville || data.city || demande.client_city || "";
  const villeConcernee = SURCHARGE_CITIES.includes(ville);
  const zoneDefault = (d: any) => d.zone_eloignee !== undefined ? Boolean(d.zone_eloignee) : villeConcernee;

  const [opts, setOpts] = useState(() => ({
    produits: Boolean(data.produits),
    torchons: Boolean(data.torchons),
    pack: Boolean(data.pack_integral),
    zone: zoneDefault(data),
  }));
  const togOpt = (k: "produits" | "torchons" | "pack" | "zone") => setOpts(o => ({ ...o, [k]: !o[k] }));

  const [remise, setRemise] = useState<RemiseValue>(() => ({
    abonnement: data.reduction_abonnement ? true : (demande.frequency === "abonnement" || (demande.frequency_label && demande.frequency_label !== "une fois")),
    etenduePct: Number(data.remise_etendue_pct || 0),
    promoCode: data.code_promo || "",
    promoPct: Number(data.code_promo_pct || 0),
  }));

  const [heures, setHeures] = useState(() => data.nb_heures || data.heures || data.duree || data.duration || demande.nb_heures || 3);
  const [personnes, setPersonnes] = useState(() => data.nb_intervenantes || data.nb_intervenants || data.numberOfPeople || demande.nb_intervenants || 1);

  // frequency state
  const [frequency, setFrequency] = useState(() => {
    if (data.frequency) return data.frequency;
    if (data.frequence === "une fois" || data.frequence === "oneshot") return "oneshot";
    if (data.reduction_abonnement === 10 || (data.frequence && data.frequence !== "une fois")) return "subscription";
    if (demande.frequency === "oneshot" || demande.frequency_label === "une fois") return "oneshot";
    if (demande.frequency === "abonnement" || (demande.frequency_label && demande.frequency_label !== "une fois")) return "subscription";
    return "oneshot";
  });

  // subFrequency state
  const [subFrequency, setSubFrequency] = useState(() => {
    if (data.subFrequency) return data.subFrequency;
    if (data.frequence && data.frequence !== "une fois") {
      return uiSubFreqMap[data.frequence] || "1foisParSemaine";
    }
    if (demande.frequency_label && demande.frequency_label !== "une fois") {
      return uiSubFreqMap[demande.frequency_label] || "1foisParSemaine";
    }
    return "1foisParSemaine";
  });

  // Keep state in sync with prop updates (e.g. when modified via modal)
  useEffect(() => {
    const freshData = demande.formulaire_data || {};
    setOpts({
      produits: Boolean(freshData.produits),
      torchons: Boolean(freshData.torchons),
      pack: Boolean(freshData.pack_integral),
      zone: zoneDefault(freshData),
    });
    setRemise({
      abonnement: freshData.reduction_abonnement ? true : (demande.frequency === "abonnement" || (demande.frequency_label && demande.frequency_label !== "une fois")),
      etenduePct: Number(freshData.remise_etendue_pct || 0),
      promoCode: freshData.code_promo || "",
      promoPct: Number(freshData.code_promo_pct || 0),
    });
    setHeures(freshData.nb_heures || freshData.heures || freshData.duree || freshData.duration || demande.nb_heures || 3);
    setPersonnes(freshData.nb_intervenantes || freshData.nb_intervenants || freshData.numberOfPeople || demande.nb_intervenants || 1);

    const nextFrequency = (() => {
      if (freshData.frequency) return freshData.frequency;
      if (freshData.frequence === "une fois" || freshData.frequence === "oneshot") return "oneshot";
      if (freshData.reduction_abonnement === 10 || (freshData.frequence && freshData.frequence !== "une fois")) return "subscription";
      if (demande.frequency === "oneshot" || demande.frequency_label === "une fois") return "oneshot";
      if (demande.frequency === "abonnement" || (demande.frequency_label && demande.frequency_label !== "une fois")) return "subscription";
      return "oneshot";
    })();
    setFrequency(nextFrequency);

    const nextSubFrequency = (() => {
      if (freshData.subFrequency) return freshData.subFrequency;
      if (freshData.frequence && freshData.frequence !== "une fois") {
        return uiSubFreqMap[freshData.frequence] || "1foisParSemaine";
      }
      if (demande.frequency_label && demande.frequency_label !== "une fois") {
        return uiSubFreqMap[demande.frequency_label] || "1foisParSemaine";
      }
      return "1foisParSemaine";
    })();
    setSubFrequency(nextSubFrequency);
  }, [
    demande.id,
    demande.frequency,
    demande.frequency_label,
    demande.formulaire_data?.produits,
    demande.formulaire_data?.torchons,
    demande.formulaire_data?.pack_integral,
    demande.formulaire_data?.zone_eloignee,
    demande.formulaire_data?.duree,
    demande.formulaire_data?.duration,
    demande.formulaire_data?.nb_heures,
    demande.formulaire_data?.heures,
    demande.formulaire_data?.nb_intervenants,
    demande.formulaire_data?.nb_intervenantes,
    demande.formulaire_data?.numberOfPeople,
    demande.formulaire_data?.frequence,
    demande.formulaire_data?.frequency,
    demande.formulaire_data?.subFrequency
  ]);

  const minHours = frequency === "oneshot" ? 4 : 2;

  useEffect(() => {
    if (heures < minHours) {
      setHeures(minHours);
    }
  }, [minHours, heures]);

  const isAbo = frequency === "subscription";
  const nbPassages = isAbo ? (visitsMap[subFrequency] * 4) : 1;

  const optionsPerPassage = (opts.produits ? OPT_PRODUITS : 0) + (opts.torchons ? OPT_TORCHONS : 0)
    + (opts.pack ? OPT_PACK : 0) + (opts.zone ? OPT_ZONE : 0);

  const laborPerPassage = heures * personnes * HOURLY_RATE;
  const laborTotal = laborPerPassage * nbPassages;
  // Remise effective : −10% abonnement ou remise étendue (la plus avantageuse) — via RemiseSection
  const remisePct = isAbo ? Math.max(remise.abonnement ? 10 : 0, remise.etenduePct) : remise.etenduePct;
  const remiseMontant = Math.round(laborTotal * (remisePct / 100));
  const laborAfterDiscount = laborTotal - remiseMontant;
  const pricePerPassage = Math.round(laborPerPassage * (1 - remisePct / 100));
  // Brief : les options sont des lignes flat (une seule fois), y compris en abonnement
  const optionsTotal = optionsPerPassage;
  const baseTotal = laborAfterDiscount + optionsTotal;
  const promoMontant = remise.promoCode ? Math.round(laborAfterDiscount * (remise.promoPct / 100)) : 0;
  const total = baseTotal - promoMontant;
  const total1erMois = baseTotal - promoMontant;

  useEffect(() => {
    if (!onPrestationsChange) return;

    const prestations: QuotePrestationLine[] = [];
    const dbSubFrequency = dbSubFreqMap[subFrequency] || "1/sem";

    if (isAbo) {
      prestations.push({
        designation: `Ménage bureaux — ${heures}h × ${personnes} intervenante${personnes > 1 ? "s" : ""} × ${nbPassages} passages/mois`,
        montant: laborTotal,
      });
    } else {
      prestations.push({
        designation: `Ménage bureaux — ${heures}h × ${personnes} intervenante${personnes > 1 ? "s" : ""} (prestation ponctuelle)`,
        montant: laborPerPassage,
      });
    }
    if (remiseMontant > 0) {
      const rLabel = isAbo && remise.abonnement && remisePct === 10 ? "Remise abonnement (–10%)" : `Remise (–${remisePct}%)`;
      prestations.push({ designation: rLabel, montant: -remiseMontant, isReduction: true });
    }

    if (opts.produits) prestations.push({ designation: `Produits ménagers fournis par l'agence`, montant: OPT_PRODUITS });
    if (opts.torchons) prestations.push({ designation: `Torchons et serpières (usage unique)`, montant: OPT_TORCHONS });
    if (opts.pack) prestations.push({ designation: `Pack Intégral (produits + torchons + matériel)`, montant: OPT_PACK });
    if (opts.zone) prestations.push({ designation: `Zone éloignée (Bouskoura, Dar Bouazza, Mohammédia…)`, montant: OPT_ZONE });

    onPrestationsChange(prestations, total, {
      nb_heures: heures,
      heures,
      duree: heures,
      duration: heures,
      nb_intervenantes: personnes,
      nb_intervenants: personnes,
      nb_personnel: personnes,
      numberOfPeople: personnes,
      nb_passages_mois: nbPassages,
      reduction: remiseMontant,
      reduction_montant: remiseMontant,
      reduction_pourcentage: remisePct,
      reduction_abonnement: isAbo && remise.abonnement ? 10 : 0,
      remise_etendue_pct: remise.etenduePct,
      code_promo: remise.promoCode,
      code_promo_pct: remise.promoPct,
      montant_1er_mois: total1erMois,
      prix_base: isAbo ? laborTotal : laborPerPassage,
      prix_produits: opts.produits ? OPT_PRODUITS : 0,
      produits: opts.produits,
      torchons: opts.torchons,
      pack_integral: opts.pack,
      zone_eloignee: opts.zone,
      frequence: isAbo ? dbSubFrequency : "une fois",
      frequency,
      subFrequency
    });
  }, [heures, personnes, frequency, subFrequency, opts, remise, total, nbPassages, laborPerPassage, laborTotal, remiseMontant, remisePct, total1erMois, onPrestationsChange]);

  return (
    <div className="quote-calculator">
      <FormulaBox>
        <B>Base :</B> Heures × Personnes × 60 DH/h HT · <B>Abonnement :</B> −10% (sur la main-d'œuvre) · min {minHours}h/passage
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label="Heures par passage">
            <input type="number" value={heures} min={minHours} max={12} onChange={e => setHeures(Math.max(minHours, +e.target.value))} style={s.input as any} />
          </Field>
          <Field label="Nombre d'agents">
            <input type="number" value={personnes} min={1} max={20} onChange={e => setPersonnes(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Fréquence">
            <select value={frequency} onChange={e => setFrequency(e.target.value)} style={s.input as any}>
              <option value="oneshot">Une fois</option>
              <option value="subscription">Abonnement (-10%)</option>
            </select>
          </Field>
          {isAbo && (
            <Field label="Cadence d'abonnement">
              <select value={subFrequency} onChange={e => setSubFrequency(e.target.value)} style={s.input as any}>
                <option value="1foisParSemaine">1 fois par semaine</option>
                <option value="2foisParSemaine">2 fois par semaine</option>
                <option value="3foisParSemaine">3 fois par semaine</option>
                <option value="4foisParSemaine">4 fois par semaine</option>
                <option value="5foisParSemaine">5 fois par semaine</option>
                <option value="6foisParSemaine">6 fois par semaine</option>
                <option value="7foisParSemaine">7 fois par semaine</option>
                <option value="1foisParMois">1 fois par mois</option>
                <option value="2foisParMois">2 fois par mois</option>
                <option value="3foisParMois">3 fois par mois</option>
                <option value="4foisParMois">4 fois par mois</option>
              </select>
            </Field>
          )}
        </div>
        <div>
          <div style={s.optTitle}>Options (HT)</div>
          <OptRow label="Produits ménagers fournis" price="+90 DH" checked={opts.produits} onChange={() => togOpt("produits")} />
          <OptRow label="Torchons et serpières" note="usage unique, non laissés sur place" price="+40 DH" checked={opts.torchons} onChange={() => togOpt("torchons")} />
          <OptRow label="Pack Intégral" note="produits + torchons + serpière + raclette + balai + seau" price="+200 DH" checked={opts.pack} onChange={() => togOpt("pack")} />
          <OptRow label="Zone éloignée" note={villeConcernee ? `Activée — ${ville} est une zone concernée` : "Bouskoura, Dar Bouazza, Mohammédia…"} price="+50 DH" checked={opts.zone} onChange={() => togOpt("zone")} />
        </div>
      </div>

      <RemiseSection isAbo={isAbo} segment={demande.segment} montantBase={laborTotal} value={remise} onChange={setRemise} />

      <ResultBar
        detail={isAbo
          ? `${heures}h × ${personnes} agent(s) × 60 DH × 0,90 (${getCadenceLabel(subFrequency)}) = ${fmt(pricePerPassage)} DH/passage × ${nbPassages}${optionsPerPassage > 0 ? ` + options ${fmt(optionsTotal)} DH` : ""}${promoMontant > 0 ? ` · 1er mois : ${fmt(total1erMois)} DH (promo)` : ""}`
          : `${heures}h × ${personnes} agent(s) × 60 DH${optionsPerPassage > 0 ? ` + options ${fmt(optionsPerPassage)} DH` : ""}${promoMontant > 0 ? ` − ${fmt(promoMontant)} DH promo` : ""}`}
        total={`${fmt(total)} DH`} label={isAbo ? "Total mensuel HT" : "Total intervention HT"} />
    </div>
  );
}
