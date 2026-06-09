import { useState, useEffect } from "react";
import { FormulaBox, B, s, ResultBar, fmt, Field } from "./QuoteShared";
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

interface BureauxQuoteProps {
  demande: any;
  onPrestationsChange?: (prestations: QuotePrestationLine[], total: number, extra?: Record<string, any>) => void;
}

export default function BureauxQuote({ demande, onPrestationsChange }: BureauxQuoteProps) {
  const data = demande.formulaire_data || {};

  const [prestationType, setPrestationType] = useState(() => data.produits ? "avec_produit" : "sans_produit");
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
    setPrestationType(freshData.produits ? "avec_produit" : "sans_produit");
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

  const hourlyRate = prestationType === "avec_produit" ? 70 : 60;
  const isAbo = frequency === "subscription";
  const frequencyDiscount = isAbo ? 0.10 : 0.00;
  
  const pricePerPassage = Math.round(heures * personnes * hourlyRate * (1 - frequencyDiscount));
  const nbPassages = isAbo ? (visitsMap[subFrequency] * 4) : 1;
  const total = isAbo ? (pricePerPassage * nbPassages) : pricePerPassage;

  useEffect(() => {
    if (!onPrestationsChange) return;

    const prestations: QuotePrestationLine[] = [];
    const dbSubFrequency = dbSubFreqMap[subFrequency] || "1/sem";
    const typeLabel = prestationType === "avec_produit" ? "avec produit" : "sans produit";

    if (isAbo) {
      const baseMonthly = Math.round(heures * personnes * hourlyRate * nbPassages);
      const discountAmount = Math.round(baseMonthly * 0.10);
      
      prestations.push({
        designation: `Ménage bureaux ${typeLabel} — ${heures}h × ${personnes} intervenante${personnes > 1 ? "s" : ""} × ${nbPassages} passages/mois`,
        montant: baseMonthly
      });
      prestations.push({
        designation: `Remise abonnement (–10%)`,
        montant: -discountAmount,
        isReduction: true
      });
    } else {
      prestations.push({
        designation: `Ménage bureaux ${typeLabel} — ${heures}h × ${personnes} intervenante${personnes > 1 ? "s" : ""} (prestation ponctuelle)`,
        montant: pricePerPassage
      });
    }

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
      reduction_abonnement: isAbo ? 10 : 0,
      prix_base: isAbo ? Math.round(heures * personnes * hourlyRate * nbPassages) : total,
      prix_produits: 0,
      produits: prestationType === "avec_produit",
      torchons: false,
      zone_eloignee: false,
      frequence: isAbo ? dbSubFrequency : "une fois",
      frequency,
      subFrequency
    });
  }, [heures, personnes, frequency, subFrequency, prestationType, total, nbPassages, pricePerPassage, hourlyRate, onPrestationsChange]);

  return (
    <div className="quote-calculator">
      <FormulaBox>
        <B>Base :</B> Heures × Personnes × {hourlyRate} DH/h · <B>Abonnement :</B> −10%
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label="Type de prestation">
            <select value={prestationType} onChange={e => setPrestationType(e.target.value)} style={s.input as any}>
              <option value="sans_produit">Ménage bureaux sans produit — 60 DH/h</option>
              <option value="avec_produit">Ménage bureaux avec produit — 70 DH/h</option>
            </select>
          </Field>
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
          {prestationType === "sans_produit" ? (
            <div style={{
              padding: "16px",
              background: "#E8F5E9",
              border: "1px solid #C8E6C9",
              borderRadius: "12px",
              fontSize: "13px",
              lineHeight: "1.6",
              color: "#2E7D32"
            }}>
              Sans produit de ménage et serpillères fournis.<br />
              L'intervenant fera le ménage avec vos produits.
            </div>
          ) : (
            <div style={{
              padding: "16px",
              background: "#E3F2FD",
              border: "1px solid #BBDEFB",
              borderRadius: "12px",
              fontSize: "13px",
              lineHeight: "1.6",
              color: "#1565C0"
            }}>
              Avec option produit de ménage et serpillière, l'intervenant interviendra équipé de produits de ménage.
            </div>
          )}
        </div>
      </div>
      <ResultBar
        detail={isAbo
          ? `${heures}h × ${personnes} agent(s) × ${hourlyRate} DH × 0,90 (abonnement - ${getCadenceLabel(subFrequency)}) = ${fmt(pricePerPassage)} DH/passage (${nbPassages} passages/mois)`
          : `${heures}h × ${personnes} agent(s) × ${hourlyRate} DH`}
        total={`${fmt(total)} DH`} label={isAbo ? "Total mensuel HT" : "Total intervention HT"} />
    </div>
  );
}

