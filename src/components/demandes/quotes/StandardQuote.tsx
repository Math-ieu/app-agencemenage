import { useState, useEffect } from "react";
import { FormulaBox, B, s, OptRow, ResultBar, fmt, Field } from "./QuoteShared";
import RemiseSection, { type RemiseValue } from "./RemiseSection";
import { SURCHARGE_CITIES, getDynamicMonthPassagesCount, estimateResources, extractJoursPassage } from "../../../utils/pricing";
import type { QuotePrestationLine } from "./QuoteSection";

// Brief Services 02–05 — Ménage standard (60 DH/h, min 4h) & Grand ménage (70 DH/h, min 6h)
const OPT_PRODUITS = 90;
const OPT_TORCHONS = 40;
const OPT_PACK = 200;
const OPT_ZONE = 50;

const ALL_DAYS = [
  { key: 'lundi', label: 'Lun', full: 'Lundi' },
  { key: 'mardi', label: 'Mar', full: 'Mardi' },
  { key: 'mercredi', label: 'Mer', full: 'Mercredi' },
  { key: 'jeudi', label: 'Jeu', full: 'Jeudi' },
  { key: 'vendredi', label: 'Ven', full: 'Vendredi' },
  { key: 'samedi', label: 'Sam', full: 'Samedi' },
  { key: 'dimanche', label: 'Dim', full: 'Dimanche' },
];

const DOW_TO_KEY = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

const getDefaultDaysForCount = (count: number): string[] => {
  if (count <= 1) return ['samedi'];
  if (count === 2) return ['lundi', 'jeudi'];
  if (count === 3) return ['lundi', 'mercredi', 'vendredi'];
  if (count === 4) return ['lundi', 'mardi', 'mercredi', 'jeudi'];
  if (count === 5) return ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
  if (count === 6) return ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  return ALL_DAYS.map(d => d.key);
};

const addHoursToTime = (timeStr: string, durationHours: number): string => {
  const [h, m] = (timeStr || '09:00').split(':').map(Number);
  const totalMinutes = (isNaN(h) ? 9 : h) * 60 + (isNaN(m) ? 0 : m) + durationHours * 60;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

interface StandardQuoteProps {
  demande: any;
  onPrestationsChange?: (prestations: QuotePrestationLine[], total: number, extra?: Record<string, any>) => void;
}

export default function StandardQuote({ demande, onPrestationsChange }: StandardQuoteProps) {
  const data = demande.formulaire_data || {};
  const service = (demande.service || "").toLowerCase();
  const isGrand = service.includes("grand");
  const defaultRate = isGrand ? 70 : 60;
  const rate = Number(data.tarif_horaire || data.tarif_base || data.rate) || defaultRate;
  const minHours = isGrand ? 6 : 4;

  // Ville concernée par le supplément zone éloignée ?
  const ville = data.ville || data.city || demande.client_city || "";
  const villeConcernee = SURCHARGE_CITIES.includes(ville);

  const [surface, setSurface] = useState<number | "">(data.surface !== undefined && data.surface !== null && data.surface !== "" ? Number(data.surface) : "");

  const initialEst = (surface !== "" && surface > 0) ? estimateResources(service, { surface }) : null;
  const initialHeures = initialEst ? initialEst.duration : Math.max(minHours, Number(data.duree || data.nb_heures || data.heures || minHours));
  const initialPersonnes = initialEst ? initialEst.people : Math.max(1, Number(data.nb_intervenants || data.nb_intervenantes || 1));

  const [heures, setHeures] = useState<number>(initialHeures);
  const [personnes, setPersonnes] = useState<number>(initialPersonnes);

  const handleSurfaceChange = (val: number | "") => {
    setSurface(val);
    if (val !== "" && val > 0) {
      const est = estimateResources(service, { surface: val });
      if (est) {
        setHeures(est.duration);
        setPersonnes(est.people);
      }
    }
  };

  const dateStr = demande.date_intervention || data.date_intervention || data.date || data.schedulingDate || "";
  const knownDateDayKey = (() => {
    if (!dateStr) return "";
    const dObj = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'));
    if (!isNaN(dObj.getTime())) {
      return DOW_TO_KEY[dObj.getDay()];
    }
    return "";
  })();

  const knownDateFormatted = (() => {
    if (!dateStr) return "";
    try {
      const dObj = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'));
      if (!isNaN(dObj.getTime())) {
        return dObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      }
    } catch {}
    return dateStr;
  })();

  const [frequency, setFrequency] = useState<string>(() => {
    if (data.frequency) return data.frequency === "abonnement" || data.frequency === "subscription" ? "subscription" : "oneshot";
    if (demande.frequency === "abonnement") return "subscription";
    return "oneshot";
  });

  const [joursSemaine, setJoursSemaine] = useState<number>(() => {
    const rawJours = Number(data.jours_par_semaine);
    if (rawJours && rawJours > 0) return rawJours;
    const freqVal = data.frequence || demande.frequency_label || "";
    if (freqVal.includes("/sem")) {
      const parts = freqVal.split("/");
      const num = parseInt(parts[0]);
      if (!isNaN(num) && num > 0) return num;
    }
    return 2;
  });

  const [selectedDays, setSelectedDays] = useState<string[]>(() => {
    const sources = [
      data.jours_intervention,
      data.jours_intervention_detail,
      data.jours_passage,
      demande.planning?.jours_intervention,
    ];
    for (const src of sources) {
      if (src) {
        const parsed = extractJoursPassage(src);
        if (parsed.length > 0) {
          return parsed;
        }
      }
    }
    const isAboInit = (data.frequency === "abonnement" || data.frequency === "subscription" || demande.frequency === "abonnement");
    if (!isAboInit) {
      if (knownDateDayKey) return [knownDateDayKey];
      return ['lundi'];
    }
    const initCount = (() => {
      const rawJours = Number(data.jours_par_semaine);
      if (rawJours && rawJours > 0) return rawJours;
      const freqVal = data.frequence || demande.frequency_label || "";
      if (freqVal.includes("/sem")) {
        const num = parseInt(freqVal.split("/")[0]);
        if (!isNaN(num) && num > 0) return num;
      }
      return 2;
    })();
    return getDefaultDaysForCount(initCount);
  });

  const handleFrequencyChange = (newFreq: string) => {
    setFrequency(newFreq);
    if (newFreq === "subscription") {
      if (selectedDays.length < joursSemaine) {
        setSelectedDays(getDefaultDaysForCount(joursSemaine));
      }
    } else {
      if (selectedDays.length > 1) {
        const keep = (knownDateDayKey && selectedDays.includes(knownDateDayKey))
          ? knownDateDayKey
          : selectedDays[0];
        setSelectedDays([keep]);
      } else if (selectedDays.length === 0) {
        setSelectedDays([knownDateDayKey || 'lundi']);
      }
    }
  };

  const handleToggleDay = (dayKey: string) => {
    if (frequency === "subscription") {
      let next: string[];
      if (selectedDays.includes(dayKey)) {
        if (selectedDays.length > 1) {
          next = selectedDays.filter(d => d !== dayKey);
        } else {
          next = selectedDays;
        }
      } else {
        next = [...selectedDays, dayKey];
      }
      next.sort((a, b) => ALL_DAYS.findIndex(d => d.key === a) - ALL_DAYS.findIndex(d => d.key === b));
      setSelectedDays(next);
      setJoursSemaine(next.length);
    } else {
      setSelectedDays([dayKey]);
    }
  };

  const handleJoursSemaineChange = (count: number) => {
    const clamped = Math.min(7, Math.max(1, count));
    setJoursSemaine(clamped);
    if (selectedDays.length < clamped) {
      const remaining = ALL_DAYS.filter(d => !selectedDays.includes(d.key));
      const needed = clamped - selectedDays.length;
      const toAdd = remaining.slice(0, needed).map(d => d.key);
      const next = [...selectedDays, ...toAdd];
      next.sort((a, b) => ALL_DAYS.findIndex(d => d.key === a) - ALL_DAYS.findIndex(d => d.key === b));
      setSelectedDays(next);
    } else if (selectedDays.length > clamped) {
      setSelectedDays(selectedDays.slice(0, clamped));
    }
  };

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
  const dynamicPassages = getDynamicMonthPassagesCount(demande);
  const nbPassages = isAbo ? (dynamicPassages > 0 ? dynamicPassages : joursSemaine * 4) : 1;

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
    const surfStr = surface !== "" && surface > 0 ? ` (${surface} m²)` : "";

    const daysFormatted = selectedDays.map(k => {
      const match = ALL_DAYS.find(ad => ad.key === k);
      return match ? match.full : k.charAt(0).toUpperCase() + k.slice(1);
    }).join(' + ');

    if (isAbo) {
      prestations.push({
        designation: `${label}${surfStr} — ${heures}h × ${personnes} intervenante${personnes > 1 ? "s" : ""} × ${nbPassages} passages/mois${daysFormatted ? ` (${daysFormatted})` : ""}`,
        montant: laborBase,
      });
    } else {
      prestations.push({
        designation: `${label}${surfStr} — ${heures}h × ${personnes} intervenante${personnes > 1 ? "s" : ""} (prestation ponctuelle${daysFormatted ? ` — ${daysFormatted}` : ""})`,
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
      surface: surface === "" ? 0 : surface,
      nb_heures: heures,
      heures,
      duree: heures,
      nb_intervenants: personnes,
      nb_intervenantes: personnes,
      jours_par_semaine: isAbo ? selectedDays.length : 1,
      jours_intervention: selectedDays,
      jours_passage: daysFormatted,
      jours_intervention_detail: selectedDays.map(j => ({
        jour: j,
        heure_debut: data.heure || demande.heure_intervention || '09:00',
        heure_fin: addHoursToTime(data.heure || demande.heure_intervention || '09:00', heures)
      })),
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
      frequence: isAbo ? `${selectedDays.length}/sem` : "une fois",
      frequency,
    });
  }, [surface, heures, personnes, frequency, joursSemaine, selectedDays, opts, remise, total, isAbo, nbPassages, laborBase, remiseMontant, remisePct, total1erMois, isGrand, onPrestationsChange]);

  return (
    <div className="quote-calculator">
      <FormulaBox>
        <B>Base :</B> Heures × Intervenantes × {rate} DH/h · min {minHours}h/passage{isGrand ? " (grand ménage)" : ""} · <B>Abonnement :</B> −10%
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label="Superficie du logement (m²)">
            <input
              type="number"
              placeholder="ex: 120"
              value={surface}
              onChange={e => handleSurfaceChange(e.target.value === "" ? "" : Math.max(0, +e.target.value))}
              style={s.input as any}
            />
          </Field>
          <Field label={`Heures par passage (min ${minHours}h)`}>
            <input type="number" value={heures} min={minHours} max={12} onChange={e => setHeures(Math.max(minHours, +e.target.value))} style={s.input as any} />
          </Field>
          <Field label="Nombre d'intervenantes">
            <input type="number" value={personnes} min={1} max={10} onChange={e => setPersonnes(Math.max(1, +e.target.value))} style={s.input as any} />
          </Field>
          <Field label="Fréquence">
            <select value={frequency} onChange={e => handleFrequencyChange(e.target.value)} style={s.input as any}>
              <option value="oneshot">Une fois (intervention ponctuelle)</option>
              <option value="subscription">Abonnement mensuel (-10%)</option>
            </select>
          </Field>
          {isAbo && (
            <Field label="Passages par semaine">
              <input type="number" value={joursSemaine} min={1} max={7} onChange={e => handleJoursSemaineChange(Math.min(7, Math.max(1, +e.target.value)))} style={s.input as any} />
            </Field>
          )}
          <Field label={isAbo ? "Jours d'intervention dans la semaine" : "Jour d'intervention dans la semaine"}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 2, marginBottom: 5 }}>
              {ALL_DAYS.map(day => {
                const isSelected = selectedDays.includes(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => handleToggleDay(day.key)}
                    title={day.full}
                    style={{
                      padding: '6px 0',
                      borderRadius: 6,
                      border: isSelected ? '1px solid #006654' : '1px solid #cbd5e1',
                      backgroundColor: isSelected ? '#006654' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#334155',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: 11,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'center'
                    }}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: '#006654', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                {selectedDays.length > 0
                  ? selectedDays.map(k => ALL_DAYS.find(ad => ad.key === k)?.full || k).join(' + ')
                  : "Aucun jour sélectionné"}
              </span>
              {isAbo ? (
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 500 }}>
                  ({selectedDays.length} j/sem)
                </span>
              ) : knownDateFormatted ? (
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 500 }}>
                  Date : {knownDateFormatted}
                </span>
              ) : null}
            </div>
          </Field>
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
