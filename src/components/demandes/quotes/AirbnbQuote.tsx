import { useState, useEffect } from "react";
import { FormulaBox, B, s, OptRow, ResultBar, fmt } from "./QuoteShared";
import type { QuotePrestationLine } from "./QuoteSection";

const AB_PALIERS = [
  { label: "Studio", sub: "Pièce unique", h: 2 },
  { label: "1 chambre", sub: "Appart 2 pièces", h: 2.5 },
  { label: "2 chambres", sub: "Appart 3 pièces", h: 3 },
  { label: "3 chambres", sub: "Appart ou duplex", h: 4 },
  { label: "4 chambres", sub: "Grand duplex", h: 5 },
  { label: "Villa", sub: "5 chambres et plus", h: 6 },
];

interface AirbnbQuoteProps {
  demande: any;
  onPrestationsChange?: (prestations: QuotePrestationLine[], total: number, extra?: Record<string, any>) => void;
}

export default function AirbnbQuote({ demande, onPrestationsChange }: AirbnbQuoteProps) {
  const data = demande.formulaire_data || {};
  
  const initialPalier = () => {
    const rooms = (data.rooms?.chambre || 0) + (data.rooms?.suiteAvecBain || 0) + (data.rooms?.suiteSansBain || 0);
    if (rooms === 0) return 0;
    if (rooms === 1) return 1;
    if (rooms === 2) return 2;
    if (rooms === 3) return 3;
    if (rooms === 4) return 4;
    return 5;
  };

  const [palier, setPalier] = useState(initialPalier());
  const [formule, setFormule] = useState("A");
  const [conso, setConso] = useState(false);

  const p = AB_PALIERS[palier];
  const pA = Math.round(p.h * 65 / 5) * 5;
  const pB = pA + 90;
  const price = formule === "A" ? pA : pB;
  const total = price + (conso ? 25 : 0);

  useEffect(() => {
    if (!onPrestationsChange) return;
    const prestations: QuotePrestationLine[] = [
      { designation: `Ménage Airbnb — Formule ${formule} — ${p.label}`, montant: price },
    ];
    if (conso) {
      prestations.push({ designation: "Réassort consommables (savon, papier, etc.)", montant: 25 });
    }
    onPrestationsChange(prestations, total, {
      formule, palier_label: p.label, prix_passage: price, prix_base: price,
      consommables: conso ? 25 : 0, reassort: conso ? 25 : 0,
    });
  }, [palier, formule, conso, price, total]);

  return (
    <div className="quote-calculator">
      <FormulaBox>
        <B>Formule A</B> — Ménage seul · <B>Formule B</B> — Ménage + Linge (+90 DH)
      </FormulaBox>

      <div style={s.seg}>
        {["A", "B"].map(f => (
          <button key={f} onClick={() => setFormule(f)}
            className={`seg-btn ${formule === f ? 'active' : ''}`}
            style={{ ...s.segBtn, ...(formule === f ? s.segBtnOn : {}) }}>
            {f === "A" ? "Formule A" : "Formule B"}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7, marginBottom: 12 }}>
        {AB_PALIERS.map((p2, i) => {
          const a = Math.round(p2.h * 65 / 5) * 5;
          const b = a + 90;
          const selected = palier === i;
          return (
            <button key={i} onClick={() => setPalier(i)}
              style={{
                padding: "8px 6px", borderRadius: 8, border: `1px solid ${selected ? "#3B82F6" : "var(--c-bord)"}`,
                background: selected ? "#EFF6FF" : "transparent", cursor: "pointer",
                color: selected ? "#1D4ED8" : "inherit", textAlign: "left", transition: "all .15s"
              }}>
              <div style={{ fontWeight: 600, fontSize: 11 }}>{p2.label}</div>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{formule === "A" ? a : b} DH</div>
            </button>
          );
        })}
      </div>

      <OptRow label="Réassort consommables" price="+25 DH" checked={conso} onChange={setConso} />

      <ResultBar
        detail={`${p.label} — Formule ${formule}${conso ? " + réassort" : ""}`}
        total={`${fmt(total)} DH`}
        label="Prix par passage"
      />
    </div>
  );
}
