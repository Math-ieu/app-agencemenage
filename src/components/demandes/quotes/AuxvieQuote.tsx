import { useState, useEffect } from "react";
import { FormulaBox, B, s, ResultBar, fmt, Field } from "./QuoteShared";
import RemiseSection, { type RemiseValue } from "./RemiseSection";
import type { QuotePrestationLine } from "./QuoteSection";

interface AuxvieQuoteProps {
  demande: any;
  onPrestationsChange?: (prestations: QuotePrestationLine[], total: number, extra?: Record<string, any>) => void;
}

// Brief Service 10 — Auxiliaire de vie / garde malade
const WEEKDAY_RATE = 100; // DH/h — lundi à samedi
const SUNDAY_RATE = 150;  // DH/h — dimanche & jours fériés civils (+50%)

export default function AuxvieQuote({ demande, onPrestationsChange }: AuxvieQuoteProps) {
  const data = demande.formulaire_data || {};

  const [hSemaine, setHSemaine] = useState<number>(data.heures_semaine ?? 24);
  const [hDimanche, setHDimanche] = useState<number>(data.heures_dimanche ?? 0);
  const [semaines, setSemaines] = useState<number>(data.nb_semaines || 4);

  const [remise, setRemise] = useState<RemiseValue>(() => ({
    abonnement: false,
    etenduePct: Number(data.remise_etendue_pct || 0),
    promoCode: data.code_promo || "",
    promoPct: Number(data.code_promo_pct || 0),
  }));

  const baseWeek = hSemaine * WEEKDAY_RATE;
  const baseSun = hDimanche * SUNDAY_RATE;
  const base = (baseWeek + baseSun) * semaines;
  const remiseMontant = Math.round(base * remise.etenduePct / 100);
  const promoMontant = remise.promoCode ? Math.round((base - remiseMontant) * remise.promoPct / 100) : 0;
  const total = base - remiseMontant - promoMontant;

  useEffect(() => {
    if (!onPrestationsChange) return;
    const prestations: QuotePrestationLine[] = [
      {
        designation: `Accompagnement auxiliaire de vie — ${hSemaine}h/sem (lun.–sam.) × ${semaines} sem. × ${WEEKDAY_RATE} DH/h`,
        montant: Math.round(baseWeek * semaines),
      },
    ];
    if (hDimanche > 0) {
      prestations.push({
        designation: `Majoration dimanche / jours fériés — ${hDimanche}h/sem × ${semaines} sem. × ${SUNDAY_RATE} DH/h`,
        montant: Math.round(baseSun * semaines),
      });
    }
    if (remiseMontant > 0) prestations.push({ designation: `Remise (–${remise.etenduePct}%)`, montant: -remiseMontant, isReduction: true });
    if (promoMontant > 0) prestations.push({ designation: `Code promo ${remise.promoCode} (–${remise.promoPct}%)`, montant: -promoMontant, isReduction: true });
    onPrestationsChange(prestations, total, {
      tarif_horaire: WEEKDAY_RATE,
      heures_semaine: hSemaine,
      heures_dimanche: hDimanche,
      nb_semaines: semaines,
      duree: `${hSemaine + hDimanche}h/sem`,
      reduction: remiseMontant + promoMontant,
      reduction_montant: remiseMontant + promoMontant,
      reduction_pourcentage: remise.etenduePct,
      remise_etendue_pct: remise.etenduePct,
      code_promo: remise.promoCode,
      code_promo_pct: remise.promoPct,
    });
  }, [hSemaine, hDimanche, semaines, base, remise, remiseMontant, promoMontant, total]);

  return (
    <div className="quote-calculator">
      <FormulaBox>
        <B>Base :</B> Heures × Tarif horaire × Semaines · <B>100 DH/h</B> en semaine, <B>150 DH/h</B> dimanche &amp; jours fériés (+50%)
        <br /><span style={{ fontSize: 10, display: "block", marginTop: 3 }}>
          Facturation par tranches de 30 min · minimum 0,5h par passage · frais de mise à disposition offerts. Hygiène, suivi des médicaments et cahier de liaison inclus.
        </span>
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label="Heures / semaine (lun.–sam., 100 DH/h)">
            <input type="number" value={hSemaine} min={0.5} step={0.5} onChange={e => setHSemaine(Math.max(0.5, +e.target.value))} style={s.input as any} />
          </Field>
          <Field label="Heures / semaine dimanche &amp; fériés (150 DH/h)">
            <input type="number" value={hDimanche} min={0} step={0.5} onChange={e => setHDimanche(Math.max(0, +e.target.value))} style={s.input as any} />
          </Field>
          <Field label="Durée de la mission (semaines)">
            <input type="number" value={semaines} min={1} max={52} onChange={e => setSemaines(+e.target.value)} style={s.input as any} />
          </Field>
        </div>
        <div>
          <div style={s.optTitle}>Inclus dans la prestation</div>
          <ul style={{ fontSize: 11, lineHeight: 1.7, paddingLeft: 16, margin: 0 }}>
            <li>Présence, accompagnement et surveillance</li>
            <li>Aide à l'hygiène et au confort</li>
            <li>Aide à la prise des médicaments (selon ordonnance)</li>
            <li>Cahier de liaison + suivi WhatsApp famille</li>
          </ul>
        </div>
      </div>
      <RemiseSection isAbo={false} segment={demande.segment} montantBase={base} value={remise} onChange={setRemise} />
      <ResultBar
        detail={`${hSemaine}h × ${WEEKDAY_RATE} DH${hDimanche > 0 ? ` + ${hDimanche}h × ${SUNDAY_RATE} DH` : ""} × ${semaines} sem.${remiseMontant > 0 ? ` − ${fmt(remiseMontant)} remise` : ""}${promoMontant > 0 ? ` − ${fmt(promoMontant)} promo` : ""}`}
        total={`${fmt(total)} DH`} label="Total mission" />
    </div>
  );
}
