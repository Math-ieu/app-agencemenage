import { useState, useEffect } from "react";
import { FormulaBox, B, s, OptRow, ResultBar, fmt, Field } from "./QuoteShared";
import type { QuotePrestationLine } from "./QuoteSection";

interface ChantierQuoteProps {
  demande: any;
  onPrestationsChange?: (prestations: QuotePrestationLine[], total: number, extra?: Record<string, any>) => void;
}

export default function ChantierQuote({ demande, onPrestationsChange }: ChantierQuoteProps) {
  const data = demande.formulaire_data || {};
  
  const [surface, setSurface] = useState(data.surface || data.surfaceArea || 150);
  const [grattage, setGrattage] = useState("15");
  const [vitres, setVitres] = useState("0");
  const [surfVitres, setSurfVitres] = useState(15);
  const [dechets, setDechets] = useState("0");
  const [marbre, setMarbre] = useState(false);
  const [surfMarbre, setSurfMarbre] = useState(30);
  const [terrasse, setTerrasse] = useState(false);

  const MIN = 1500;
  const baseRaw = surface * parseFloat(grattage);
  const base = Math.max(baseRaw, MIN);
  const vitresCost = vitres === "150" ? 150 : vitres === "25" ? surfVitres * 25 : 0;
  const dechetsCost = dechets === "-1" ? 0 : (parseFloat(dechets) || 0);
  const devisSpe = dechets === "-1";
  const marbreCost = marbre ? surfMarbre * 25 : 0;
  const total = base + vitresCost + dechetsCost + marbreCost;

  const grattageLabel = parseFloat(grattage) <= 12 ? 'sans grattage' : parseFloat(grattage) <= 15 ? 'grattage léger' : 'rénovation totale';

  // Notify parent of prestation changes
  useEffect(() => {
    if (!onPrestationsChange) return;
    const prestations: QuotePrestationLine[] = [
      { designation: `Nettoyage fin de chantier — ${surface} m² (${grattageLabel})`, montant: base },
    ];
    if (terrasse) {
      prestations.push({ designation: "Terrasse et rooftop (inclus dans forfait)", montant: "Inclus" });
    }
    if (vitresCost > 0) {
      prestations.push({
        designation: vitres === "150" ? "Grattage vitres léger" : `Grattage vitres profond — ${surfVitres} m² vitrés`,
        montant: vitresCost,
      });
    }
    if (dechetsCost > 0) {
      const poidsLabel = dechets === "200" ? "< 100 kg" : dechets === "380" ? "100-300 kg" : dechets === "650" ? "300-500 kg" : "";
      prestations.push({ designation: `Ramassage et évacuation déchets — ${poidsLabel}`, montant: dechetsCost });
    }
    if (marbreCost > 0) {
      prestations.push({ designation: `Cristallisation du marbre — ${surfMarbre} m²`, montant: marbreCost });
    }
    onPrestationsChange(prestations, total, {
      surface, grattage: parseFloat(grattage), grattage_rate: parseFloat(grattage),
      surface_vitres: vitres === "25" ? surfVitres : 0,
      prix_vitres: vitresCost,
      poids_dechets: dechetsCost > 0 ? (dechets === "200" ? 100 : dechets === "380" ? 200 : dechets === "650" ? 400 : 0) : 0,
      prix_dechets: dechetsCost,
      surface_marbre: marbre ? surfMarbre : 0,
      prix_marbre: marbreCost,
      terrasse_incluse: terrasse,
      prix_base: base,
    });
  }, [surface, grattage, vitres, surfVitres, dechets, marbre, surfMarbre, terrasse, base, vitresCost, dechetsCost, marbreCost, total]);

  const detail = `${surface} m² × ${grattage} DH = ${fmt(baseRaw)} DH${baseRaw < MIN ? ` (min ${fmt(MIN)})` : ""}` +
    (vitresCost ? ` + vitres` : "") +
    (dechetsCost ? ` + déchets` : "") +
    (marbreCost ? ` + marbre` : "");

  return (
    <div className="quote-calculator">
      <FormulaBox>
        <B>Base :</B> max(Surface × taux grattage, 1 500 DH) · <B>Terrasse / rooftop :</B> inclus au même taux · <B>Minimum facturable :</B> 1 500 DH
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label="Surface totale (m²)">
            <input type="number" value={surface} min={20} onChange={e => setSurface(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="État général — grattage murs / sols">
            <select value={grattage} onChange={e => setGrattage(e.target.value)} style={s.input as any}>
              <option value="12">Sans grattage (12 DH/m²)</option>
              <option value="15">Grattage léger — peinture, résidus (15 DH/m²)</option>
              <option value="22">Grattage profond — béton, décappage (22 DH/m²)</option>
            </select>
          </Field>
          <Field label="Grattage vitres / marquages">
            <select value={vitres} onChange={e => setVitres(e.target.value)} style={s.input as any}>
              <option value="0">Aucun</option>
              <option value="150">Léger — stickers, traces (forfait +150 DH)</option>
              <option value="25">Profond — silicone, béton (25 DH/m² vitrage)</option>
            </select>
          </Field>
          {vitres === "25" && (
            <Field label="Surface vitrée concernée (m²)">
              <input type="number" value={surfVitres} min={1} onChange={e => setSurfVitres(+e.target.value)} style={s.input as any} />
            </Field>
          )}
        </div>
        <div>
          <Field label="Ramassage de déchets">
            <select value={dechets} onChange={e => setDechets(e.target.value)} style={s.input as any}>
              <option value="0">Pas de ramassage</option>
              <option value="200">Moins de 100 kg (+200 DH)</option>
              <option value="380">100 à 300 kg (+380 DH)</option>
              <option value="650">300 à 500 kg (+650 DH)</option>
              <option value="-1">Plus de 500 kg → devis spécifique</option>
            </select>
          </Field>
          <div style={s.optTitle}>Option premium</div>
          <OptRow label="Cristallisation marbre" note="25 DH/m² — résultat brillant garanti" price="25 DH/m²" checked={marbre} onChange={setMarbre} />
          {marbre && (
            <Field label="Surf. Marbre">
              <input type="number" value={surfMarbre} onChange={e => setSurfMarbre(+e.target.value)} style={s.input as any} />
            </Field>
          )}
          <OptRow label="Terrasse / Rooftop" price="Inclus" checked={terrasse} onChange={setTerrasse} />
        </div>
      </div>
      <ResultBar detail={detail} total={`${fmt(total)}${devisSpe ? " +" : ""} DH`} label="Devis HT" />
    </div>
  );
}
