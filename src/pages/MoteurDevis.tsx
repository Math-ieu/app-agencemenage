import React, { useState } from "react";

const fmt = (n: number) => Math.round(n).toLocaleString("fr-MA");

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <label style={{ display: "block", fontSize: 11, color: "var(--c-muted)", marginBottom: 3 }}>{label}</label>
      {children}
    </div>
  );
}

function OptRow({ label, price, checked, onChange, note }: { label: string; price: string; checked: boolean; onChange: (val: boolean) => void; note?: string }) {
  return (
    <div style={s.optRow}>
      <label style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 11, cursor: "pointer", flex: 1 }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
          style={{ width: 13, height: 13, marginTop: 1, cursor: "pointer", flexShrink: 0 }} />
        <span>{label}{note && <span style={{ fontSize: 10, color: "var(--c-muted)", display: "block" }}>{note}</span>}</span>
      </label>
      <span style={{ fontSize: 10, color: "var(--c-muted)", whiteSpace: "nowrap", marginLeft: 8 }}>{price}</span>
    </div>
  );
}

function ResultBar({ detail, total, label, warn }: { detail: string; total: string; label: string; warn?: string }) {
  return (
    <div style={s.resultBar}>
      <div style={{ fontSize: 11, color: "var(--c-muted)", flex: 1, lineHeight: 1.6 }}>{detail}</div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: "var(--c-muted)" }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>{total}</div>
        {warn && <span style={{ display: "inline-block", fontSize: 10, background: "#FEF3C7", color: "#92400E", borderRadius: 4, padding: "2px 8px", marginTop: 3 }}>{warn}</span>}
      </div>
    </div>
  );
}

function FormulaBox({ children }: { children: React.ReactNode }) {
  return <div style={s.fb}>{children}</div>;
}

const B = ({ children }: { children: React.ReactNode }) => <strong style={{ fontWeight: 600, color: "inherit", opacity: .9 }}>{children}</strong>;

// ─── AIRBNB ───────────────────────────────────────────────────────────────────
const AB_PALIERS = [
  { label: "Studio", sub: "Pièce unique", h: 2 },
  { label: "1 chambre", sub: "Appart 2 pièces", h: 2.5 },
  { label: "2 chambres", sub: "Appart 3 pièces", h: 3 },
  { label: "3 chambres", sub: "Appart ou duplex", h: 4 },
  { label: "4 chambres", sub: "Grand duplex", h: 5 },
  { label: "Villa", sub: "5 chambres et plus", h: 6 },
];

function AirbnbCalc() {
  const [palier, setPalier] = useState(0);
  const [formule, setFormule] = useState("A");
  const [conso, setConso] = useState(false);

  const p = AB_PALIERS[palier];
  const pA = Math.round(p.h * 65 / 5) * 5;
  const pB = pA + 90;
  const price = formule === "A" ? pA : pB;
  const total = price + (conso ? 25 : 0);

  return (
    <div>
      <FormulaBox>
        <B>Formule A</B> — Ménage seul · <B>Formule B</B> — Ménage + collecte linge + lavage + repassage (+90 DH)
        <br /><span style={{ fontSize: 10, marginTop: 4, display: "block" }}>Base horaire : 65 DH/h (usage interne uniquement — ne pas communiquer au client)</span>
      </FormulaBox>

      <div style={s.seg}>
        {["A", "B"].map(f => (
          <button key={f} onClick={() => setFormule(f)}
            style={{ ...s.segBtn, ...(formule === f ? s.segBtnOn : {}) }}>
            {f === "A" ? "Formule A — Ménage seul" : "Formule B — Ménage + Linge"}
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
                padding: "10px 8px", borderRadius: 8, border: `1px solid ${selected ? "#3B82F6" : "var(--c-bord)"}`,
                background: selected ? "#EFF6FF" : "transparent", cursor: "pointer",
                color: selected ? "#1D4ED8" : "inherit", textAlign: "left", transition: "all .15s"
              }}>
              <div style={{ fontWeight: 600, fontSize: 12 }}>{p2.label}</div>
              <div style={{ fontSize: 10, opacity: .7, marginBottom: 4 }}>{p2.sub}</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{formule === "A" ? a : b} DH</div>
            </button>
          );
        })}
      </div>

      <div style={s.optTitle}>Option</div>
      <OptRow label="Réassort consommables" note="Savon liquide, café, papier toilette..." price="+25 DH" checked={conso} onChange={setConso} />

      <ResultBar
        detail={`${p.label} — Formule ${formule} : ${price} DH${conso ? " + consommables 25 DH" : ""}`}
        total={`${fmt(total)} DH`}
        label="Prix par passage"
      />
    </div>
  );
}

// ─── FIN DE CHANTIER ─────────────────────────────────────────────────────────
function ChantierCalc() {
  const [surface, setSurface] = useState(150);
  const [grattage, setGrattage] = useState("15");
  const [vitres, setVitres] = useState("0");
  const [surfVitres, setSurfVitres] = useState(15);
  const [dechets, setDechets] = useState("0");
  const [marbre, setMarbre] = useState(false);
  const [surfMarbre, setSurfMarbre] = useState(30);

  const MIN = 1500;
  const baseRaw = surface * parseFloat(grattage);
  const base = Math.max(baseRaw, MIN);
  const vitresCost = vitres === "150" ? 150 : vitres === "25" ? surfVitres * 25 : 0;
  const dechetsCost = dechets === "-1" ? 0 : (parseFloat(dechets) || 0);
  const devisSpe = dechets === "-1";
  const marbreCost = marbre ? surfMarbre * 25 : 0;
  const total = base + vitresCost + dechetsCost + marbreCost;

  const detail = `${surface} m² × ${grattage} DH/m² = ${fmt(baseRaw)} DH${baseRaw < MIN ? ` → min ${fmt(MIN)} DH` : ""}` +
    (vitresCost ? ` + vitres ${fmt(vitresCost)} DH` : "") +
    (dechetsCost ? ` + déchets ${fmt(dechetsCost)} DH` : "") +
    (marbreCost ? ` + marbre ${fmt(marbreCost)} DH` : "") +
    (devisSpe ? " + déchets >500kg → devis séparé" : "");

  return (
    <div>
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
            <Field label="Surface marbre à traiter (m²)">
              <input type="number" value={surfMarbre} min={1} onChange={e => setSurfMarbre(+e.target.value)} style={s.input as any} />
            </Field>
          )}
          <p style={{ fontSize: 10, color: "var(--c-muted)", marginTop: 10, lineHeight: 1.5 }}>
            Terrasse et rooftop inclus dans le forfait au même taux/m².
          </p>
        </div>
      </div>
      <ResultBar detail={detail} total={`${fmt(total)}${devisSpe ? " + déchets" : ""} DH`}
        label="Devis estimatif HT" warn="Brouillon — validation manager requise" />
    </div>
  );
}

// ─── AUXILIAIRE DE VIE ────────────────────────────────────────────────────────
function AuxvieCalc() {
  const [mode, setMode] = useState("240");
  const [jours, setJours] = useState(5);
  const [semaines, setSemaines] = useState(4);
  const [duree, setDuree] = useState("1.00");
  const [opts, setOpts] = useState({ toilette: false, repas: false, medic: false, sortie: false });
  const tog = (k: keyof typeof opts) => setOpts(o => ({ ...o, [k]: !o[k] }));

  const tarif = parseFloat(mode);
  const cd = parseFloat(duree);
  const totalJ = jours * semaines;
  const opj = (opts.toilette ? 50 : 0) + (opts.repas ? 40 : 0) + (opts.medic ? 30 : 0) + (opts.sortie ? 80 : 0);
  const base = tarif * totalJ * cd;
  const total = base + opj * totalJ;

  const modeLabels: Record<string, string> = { "240": "Accompagnement journée (8h)", "420": "Présence nuit (12h)", "580": "Assistance 24h" };

  return (
    <div>
      <FormulaBox>
        <B>Base :</B> Tarif × Nb jours × Nb semaines × Coeff durée · Options facturées par jour de présence
        <br /><span style={{ fontSize: 10, display: "block", marginTop: 3 }}>Tarifs affichés client sans mention des heures : "Journée", "Nuit", "24h"</span>
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label="Mode de présence">
            <select value={mode} onChange={e => setMode(e.target.value)} style={s.input as any}>
              <option value="240">Accompagnement journée — 240 DH</option>
              <option value="420">Présence nuit — 420 DH</option>
              <option value="580">Assistance 24h — 580 DH</option>
            </select>
          </Field>
          <Field label="Jours / semaine">
            <input type="number" value={jours} min={1} max={7} onChange={e => setJours(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Durée de la mission (semaines)">
            <input type="number" value={semaines} min={1} max={52} onChange={e => setSemaines(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Durée mission">
            <select value={duree} onChange={e => setDuree(e.target.value)} style={s.input as any}>
              <option value="1.20">Ponctuelle — moins d'1 semaine (×1,20)</option>
              <option value="1.00">Court terme — 1 à 4 semaines (×1,00)</option>
              <option value="0.90">Long terme — plus d'1 mois (×0,90)</option>
            </select>
          </Field>
        </div>
        <div>
          <div style={s.optTitle}>Options / jour de présence</div>
          <OptRow label="Aide à la toilette" price="+50 DH/j" checked={opts.toilette} onChange={() => tog("toilette")} />
          <OptRow label="Préparation des repas" price="+40 DH/j" checked={opts.repas} onChange={() => tog("repas")} />
          <OptRow label="Suivi prise de médicaments" price="+30 DH/j" checked={opts.medic} onChange={() => tog("medic")} />
          <OptRow label="Accompagnement sorties" price="+80 DH/j" checked={opts.sortie} onChange={() => tog("sortie")} />
        </div>
      </div>
      <ResultBar
        detail={`${modeLabels[mode]} × ${totalJ} j × ${cd.toFixed(2)} = ${fmt(base)} DH + options ${fmt(opj * totalJ)} DH`}
        total={`${fmt(total)} DH`} label="Total mission" />
    </div>
  );
}

// ─── POST-SINISTRE ────────────────────────────────────────────────────────────
const TX: Record<string, Record<string, number>> = {
  deau: { leger: 15, moyen: 28, grave: 45 },
  incendie: { leger: 28, moyen: 50, grave: 75 },
  inondation: { leger: 20, moyen: 35, grave: 58 },
};

function SinistreCalc() {
  const [type, setType] = useState("deau");
  const [surface, setSurface] = useState(60);
  const [niveau, setNiveau] = useState("moyen");
  const [urgence, setUrgence] = useState("1.00");
  const [opts, setOpts] = useState({ desod: false, evac: false, rapport: false });
  const tog = (k: keyof typeof opts) => setOpts(o => ({ ...o, [k]: !o[k] }));

  const MIN = 1200;
  const taux = TX[type][niveau];
  const baseRaw = surface * taux;
  const base = Math.max(baseRaw, MIN);
  const u = parseFloat(urgence);
  const op = (opts.desod ? 200 : 0) + (opts.evac ? 350 : 0) + (opts.rapport ? 150 : 0);
  const total = base * u + op;

  return (
    <div>
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
          <Field label="Type de sinistre">
            <select value={type} onChange={e => setType(e.target.value)} style={s.input as any}>
              <option value="deau">Dégât des eaux</option>
              <option value="incendie">Incendie</option>
              <option value="inondation">Inondation</option>
            </select>
          </Field>
          <Field label="Surface affectée (m²)">
            <input type="number" value={surface} min={5} onChange={e => setSurface(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Niveau de dégâts">
            <select value={niveau} onChange={e => setNiveau(e.target.value)} style={s.input as any}>
              <option value="leger">Léger</option>
              <option value="moyen">Moyen</option>
              <option value="grave">Grave</option>
            </select>
          </Field>
          <Field label="Délai d'intervention">
            <select value={urgence} onChange={e => setUrgence(e.target.value)} style={s.input as any}>
              <option value="1.00">Standard (×1,00)</option>
              <option value="1.25">Sous 48h (×1,25)</option>
              <option value="1.50">Sous 24h (×1,50)</option>
            </select>
          </Field>
        </div>
        <div>
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

// ─── BUREAUX ─────────────────────────────────────────────────────────────────
function BureauxCalc() {
  const [prestationType, setPrestationType] = useState("sans_produit");
  const [heures, setHeures] = useState(3);
  const [personnes, setPersonnes] = useState(1);
  const [frequency, setFrequency] = useState("oneshot");
  const [subFrequency, setSubFrequency] = useState("1foisParSemaine");

  const minHours = frequency === "oneshot" ? 4 : 2;

  React.useEffect(() => {
    if (heures < minHours) {
      setHeures(minHours);
    }
  }, [minHours, heures]);

  const hourlyRate = prestationType === "avec_produit" ? 70 : 60;
  const frequencyDiscount = frequency === "subscription" ? 0.10 : 0.00;
  const pricePerPassage = Math.round(heures * personnes * hourlyRate * (1 - frequencyDiscount));

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

  return (
    <div>
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
          {frequency === "subscription" && (
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
        detail={frequency === "subscription"
          ? `${heures}h x ${personnes} agent(s) x ${hourlyRate} DH x 0,90 (abonnement - ${getCadenceLabel(subFrequency)})`
          : `${heures}h x ${personnes} agent(s) x ${hourlyRate} DH`}
        total={`${fmt(pricePerPassage)} DH`} label="PRIX PAR PASSAGE" />
    </div>
  );
}

// ─── PLACEMENT FLEXIBLE (Approche A) ─────────────────────────────────────────
function PlacementCalc() {
  const [mode, setMode] = useState("flex");
  return (
    <div>
      <div style={s.subTabs}>
        {[["flex", "Mise à disposition flexible"], ["g360", "Gestion 360 — all inclusive"]].map(([k, l]) => (
          <button key={k} onClick={() => setMode(k)}
            style={{ ...s.subTab, ...(mode === k ? s.subTabOn : {}) }}>{l}</button>
        ))}
      </div>
      {mode === "flex" ? <FlexCalc /> : <G360Calc />}
    </div>
  );
}

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

function FlexCalc() {
  const [hj, setHj] = useState(4);
  const [js, setJs] = useState("22");
  const [nb, setNb] = useState(1);
  const [eng, setEng] = useState("0");
  const [ferie, setFerie] = useState(false);
  const [tenue, setTenue] = useState(true);
  const [frequency, setFrequency] = useState("oneshot");
  const [subFrequency, setSubFrequency] = useState("1foisParSemaine");

  const jm = frequency === "subscription" ? (visitsMap[subFrequency] * 4) : parseFloat(js);
  const hm = hj * jm;
  const base = hm * 32 * nb * (ferie ? 1.20 : 1);
  const reduction = parseFloat(eng);
  const frequencyDiscount = frequency === "subscription" ? 0.10 : 0.00;
  const totalDiscount = reduction + frequencyDiscount;
  const mensuel = Math.round(base * (1 - totalDiscount));
  const tenueCost = tenue ? 200 * nb : 0;
  const total = mensuel + tenueCost;

  return (
    <div>
      <FormulaBox>
        <B>Modèle A — Facturation horaire :</B> Heures/mois × 32 DH/h × Nb personnes
        <br />Le client pilote les opérations. L'agence gère tout le back-office RH (contrats, paie, remplacements).
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label="Heures de présence / jour">
            <input type="number" value={hj} min={1} max={12} onChange={e => setHj(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Jours de travail / semaine">
            <select value={js} onChange={e => setJs(e.target.value)} disabled={frequency === "subscription"} style={{ ...s.input, opacity: frequency === "subscription" ? 0.5 : 1 } as any}>
              <option value="22">5 j/semaine — 22 j/mois</option>
              <option value="26">6 j/semaine — 26 j/mois</option>
              <option value="30">7 j/semaine — 30 j/mois</option>
            </select>
          </Field>
          <Field label="Nombre de personnes">
            <input type="number" value={nb} min={1} max={50} onChange={e => setNb(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Durée d'engagement">
            <select value={eng} onChange={e => setEng(e.target.value)} style={s.input as any}>
              <option value="0">Mensuel — sans engagement</option>
              <option value="0.05">6 mois (−5%)</option>
              <option value="0.10">12 mois (−10%)</option>
            </select>
          </Field>
          <Field label="Fréquence">
            <select value={frequency} onChange={e => setFrequency(e.target.value)} style={s.input as any}>
              <option value="oneshot">Une fois</option>
              <option value="subscription">Abonnement (-10%)</option>
            </select>
          </Field>
          {frequency === "subscription" && (
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
          <div style={s.optTitle}>Options</div>
          <OptRow label="Couverture jours fériés" price="+20% mensuel" checked={ferie} onChange={setFerie} />
          <OptRow label="Tenue de travail fournie" note="+200 DH/pers — coût unique facturé au 1er mois" price="+200 DH/pers" checked={tenue} onChange={setTenue} />
          <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--c-surf)", borderRadius: 8, border: "0.5px solid var(--c-bord)", fontSize: 11, lineHeight: 1.6 }}>
            <strong>Inclus :</strong> zéro gestion RH, remplacement organisé, planning adapté (matin / soir / week-end)
          </div>
        </div>
      </div>
      <ResultBar
        detail={`${hm.toFixed(0)}h/mois × 32 DH × ${nb} pers${ferie ? " × 1,20" : ""}${frequencyDiscount > 0 ? " × 0,90 (Abonnement)" : ""}${reduction > 0 ? ` × ${(1 - reduction).toFixed(2)}` : ""} = ${fmt(mensuel)} DH/mois${tenueCost ? ` + tenue ${fmt(tenueCost)} DH (1er mois)` : ""}`}
        total={`${fmt(total)} DH`} label="Total / mois HT" />
    </div>
  );
}

function G360Calc() {
  const [hj, setHj] = useState(4);
  const [js, setJs] = useState("22");
  const [nb, setNb] = useState(2);
  const [eng, setEng] = useState("0");
  const [ferie, setFerie] = useState(false);
  const [frequency, setFrequency] = useState("oneshot");
  const [subFrequency, setSubFrequency] = useState("1foisParSemaine");

  const nbS = Math.max(nb, 2);
  const jm = frequency === "subscription" ? (visitsMap[subFrequency] * 4) : parseFloat(js);
  const hm = hj * jm;
  const base = hm * 45 * nbS * (ferie ? 1.20 : 1);
  const reduction = parseFloat(eng);
  const frequencyDiscount = frequency === "subscription" ? 0.10 : 0.00;
  const totalDiscount = reduction + frequencyDiscount;
  const superv = nbS < 3 ? 800 : 0;
  const total = Math.round(base * (1 - totalDiscount)) + superv;

  return (
    <div>
      <FormulaBox>
        <B>Gestion 360 :</B> L'agence pilote de A à Z — équipes, méthodes, produits, supervision, reporting. <B>Taux :</B> 45 DH/h/personne
        <br /><span style={{ fontSize: 10, display: "block", marginTop: 3 }}>Inclus : tenues, check-lists qualité, remplacement le jour même, SLA réclamations 24h, reporting mensuel. Supervision gratuite dès 3 personnes.</span>
      </FormulaBox>
      <div style={s.grid2}>
        <div>
          <Field label="Heures de présence / jour">
            <input type="number" value={hj} min={1} max={12} onChange={e => setHj(+e.target.value)} style={s.input as any} />
          </Field>
          <Field label="Jours de travail / semaine">
            <select value={js} onChange={e => setJs(e.target.value)} disabled={frequency === "subscription"} style={{ ...s.input, opacity: frequency === "subscription" ? 0.5 : 1 } as any}>
              <option value="22">5 j/semaine — 22 j/mois</option>
              <option value="26">6 j/semaine — 26 j/mois</option>
              <option value="30">7 j/semaine — 30 j/mois</option>
            </select>
          </Field>
          <Field label="Nombre de personnes (min 2)">
            <input type="number" value={nb} min={2} max={100} onChange={e => setNb(Math.max(2, +e.target.value))} style={s.input as any} />
          </Field>
          <Field label="Engagement (min 3 mois)">
            <select value={eng} onChange={e => setEng(e.target.value)} style={s.input as any}>
              <option value="0">3 mois — tarif plein</option>
              <option value="0.05">6 mois (−5%)</option>
              <option value="0.10">12 mois (−10%)</option>
            </select>
          </Field>
          <Field label="Fréquence">
            <select value={frequency} onChange={e => setFrequency(e.target.value)} style={s.input as any}>
              <option value="oneshot">Une fois</option>
              <option value="subscription">Abonnement (-10%)</option>
            </select>
          </Field>
          {frequency === "subscription" && (
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
          <div style={s.optTitle}>Options</div>
          <OptRow label="Couverture jours fériés" price="+20% mensuel" checked={ferie} onChange={setFerie} />
          <div style={{ marginTop: 12, padding: "10px 12px", background: "#F0FDF4", borderRadius: 8, border: "0.5px solid #86EFAC", fontSize: 11, lineHeight: 1.7, color: "#166534" }}>
            ✓ Tenues fournies incluses<br />
            ✓ Supervision incluse (≥3 personnes)<br />
            {nbS < 3 && <span style={{ color: "#92400E" }}>⚠ 2 personnes : supervision +800 DH/mois<br /></span>}
            ✓ Engagement minimum 3 mois
          </div>
        </div>
      </div>
      <ResultBar
        detail={`${hm.toFixed(0)}h/mois × 45 DH × ${nbS} pers${ferie ? " × 1,20" : ""}${frequencyDiscount > 0 ? " × 0,90 (Abonnement)" : ""}${reduction > 0 ? ` × ${(1 - reduction).toFixed(2)}` : ""} = ${fmt(Math.round(base * (1 - totalDiscount)))} DH${superv ? ` + supervision ${fmt(superv)} DH` : ""}`}
        total={`${fmt(total)} DH`} label="Total / mois HT" />
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "ab", label: "Airbnb", badge: "Particulier" },
  { id: "chantier", label: "Fin de chantier", badge: "Particulier / Entreprise" },
  { id: "auxvie", label: "Auxiliaire de vie", badge: "Particulier" },
  { id: "sinistre", label: "Post-sinistre", badge: "Particulier / Entreprise" },
  { id: "bureaux", label: "Bureaux", badge: "Entreprise" },
  { id: "placement", label: "Placement & 360", badge: "Entreprise" },
];

const PANELS: Record<string, React.ComponentType> = { 
  ab: AirbnbCalc, 
  chantier: ChantierCalc, 
  auxvie: AuxvieCalc, 
  sinistre: SinistreCalc, 
  bureaux: BureauxCalc, 
  placement: PlacementCalc 
};

export default function MoteurDevis() {
  const [active, setActive] = useState("ab");
  const Panel = PANELS[active];

  return (
    <div style={s.root as any}>
      <style>{`
        * { box-sizing: border-box; }
        :root { --c-muted:#6B7280; --c-bord:rgba(0,0,0,0.1); --c-surf:#F9FAFB; }
        input[type=number], select { outline:none; }
        input[type=number]:focus, select:focus { border-color:#3B82F6 !important; box-shadow:0 0 0 2px rgba(59,130,246,.15); }
        input[type=checkbox] { accent-color:#3B82F6; }
      `}</style>

      {/* Header */}
      <div style={{ padding: "14px 16px 12px", borderBottom: "0.5px solid var(--c-bord)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: .3 }}>Agence Ménage</div>
          <div style={{ fontSize: 11, color: "var(--c-muted)" }}>Moteur de devis — usage interne</div>
        </div>
        <div style={{ fontSize: 10, background: "#EFF6FF", color: "#1D4ED8", borderRadius: 5, padding: "3px 9px", fontWeight: 500 }}>v3.0</div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, flexWrap: "wrap", borderBottom: "0.5px solid var(--c-bord)", padding: "0 12px" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActive(t.id)}
            style={{ ...s.tab, ...(active === t.id ? s.tabOn : {}) } as any}>
            {t.label}
            <span style={{ fontSize: 9, display: "block", opacity: .6, fontWeight: 400 }}>{t.badge}</span>
          </button>
        ))}
      </div>

      {/* Panel */}
      <div style={{ padding: "16px 14px" }}>
        <Panel />
      </div>
    </div>
  );
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  root: { fontFamily: "system-ui,-apple-system,sans-serif", fontSize: 13, maxWidth: 780, margin: "0 auto", background: "#fff", borderRadius: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
  fb: { background: "var(--c-surf)", border: "0.5px solid var(--c-bord)", borderRadius: 8, padding: "9px 12px", marginBottom: 12, fontSize: 11, color: "var(--c-muted)", lineHeight: 1.65 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  input: { width: "100%", padding: "6px 9px", border: "0.5px solid var(--c-bord)", borderRadius: 7, background: "transparent", color: "inherit", fontSize: 12, fontFamily: "inherit", transition: "border-color .15s, box-shadow .15s" },
  optTitle: { fontSize: 10, fontWeight: 600, color: "var(--c-muted)", textTransform: "uppercase", letterSpacing: ".05em", margin: "11px 0 5px" },
  optRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "6px 0", borderTop: "0.5px solid var(--c-bord)", gap: 6 },
  resultBar: { marginTop: 14, background: "var(--c-surf)", border: "0.5px solid var(--c-bord)", borderRadius: 10, padding: "12px 15px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  seg: { display: "flex", border: "0.5px solid var(--c-bord)", borderRadius: 8, overflow: "hidden", marginBottom: 13 },
  segBtn: { flex: 1, padding: "7px 6px", fontSize: 11, textAlign: "center", cursor: "pointer", background: "transparent", border: "none", color: "var(--c-muted)", transition: "all .15s" },
  segBtnOn: { background: "#EFF6FF", color: "#1D4ED8", fontWeight: 600 },
  subTabs: { display: "flex", gap: 6, marginBottom: 13 },
  subTab: { fontSize: 11, padding: "5px 13px", borderRadius: 7, cursor: "pointer", border: "0.5px solid var(--c-bord)", color: "var(--c-muted)", background: "transparent", transition: "all .15s" },
  subTabOn: { background: "#EFF6FF", color: "#1D4ED8", borderColor: "transparent", fontWeight: 600 },
  tab: { fontSize: 11, padding: "9px 12px", cursor: "pointer", border: "none", background: "transparent", color: "var(--c-muted)", borderBottom: "2px solid transparent", transition: "all .15s", whiteSpace: "nowrap" },
  tabOn: { color: "#2563EB", fontWeight: 600, borderBottom: "2px solid #2563EB" },
};
