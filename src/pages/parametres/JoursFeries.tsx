/**
 * JoursFeries.tsx
 * Page Paramètres > Jours fériés (fêtes religieuses)
 * L'admin saisit chaque année les 3 dates (Aïd el Kébir, Aïd el Fitr, Mawlid Ennabawi).
 * Règle de suspension : 1 jour avant + 2 jours après — passages suspendus + notification client/CC.
 */
import { useState, useEffect, CSSProperties } from "react";
import { getFetesReligieuses, createFeteReligieuse, updateFeteReligieuse, deleteFeteReligieuse } from "../../api/client";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Save, Trash2 } from "lucide-react";

const TYPES = [
  { value: "aid_kebir", label: "Aïd el Kébir" },
  { value: "aid_fitr", label: "Aïd el Fitr" },
  { value: "mawlid", label: "Mawlid Ennabawi" },
];

interface Fete {
  id?: number;
  _tempId?: string;
  type: string;
  date: string;
  annee: number;
  jours_avant: number;
  jours_apres: number;
  actif: boolean;
  debut_suspension?: string;
  fin_suspension?: string;
}

const T = {
  teal: "#0d9488", border: "#e4e4e7", text: "#18181b", textMuted: "#71717a",
  bgInput: "#f9fafb", radius: "12px",
};
const S: Record<string, CSSProperties> = {
  page: { maxWidth: 860, margin: "0 auto", paddingTop: 32, paddingBottom: 60 },
  card: { background: "#fff", border: `1px solid ${T.border}`, borderRadius: T.radius, padding: 22, marginBottom: 18 },
  label: { display: "block", fontSize: 12, color: T.textMuted, marginBottom: 4 },
  input: { width: "100%", padding: "8px 10px", border: `1px solid ${T.border}`, borderRadius: 8, background: T.bgInput, fontSize: 13, fontFamily: "inherit" },
  btn: { display: "inline-flex", alignItems: "center", gap: 8, background: T.teal, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  row: { display: "grid", gridTemplateColumns: "1.4fr 1fr 0.7fr 0.7fr auto", gap: 12, alignItems: "end", paddingBottom: 14, marginBottom: 14, borderBottom: `1px solid ${T.border}` },
};

const fmtDate = (d?: string) => {
  if (!d) return "—";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
};

const shiftDate = (iso: string, days: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function JoursFeries() {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [annee, setAnnee] = useState<number>(currentYear);
  const [rows, setRows] = useState<Record<string, Fete>>({});
  const [customRows, setCustomRows] = useState<Fete[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const blankRow = (type: string, year: number): Fete => ({ type, date: "", annee: year, jours_avant: 1, jours_apres: 2, actif: true });

  const load = async (year: number) => {
    setLoading(true);
    try {
      const res = await getFetesReligieuses({ annee: year });
      const list: Fete[] = Array.isArray(res.data) ? res.data : (res.data?.results || []);
      const map: Record<string, Fete> = {};
      TYPES.forEach(t => { map[t.value] = list.find(f => f.type === t.value) || blankRow(t.value, year); });
      setRows(map);

      const customList = list.filter(f => !TYPES.some(t => t.value === f.type));
      setCustomRows(customList);
    } catch {
      toast({ title: "Erreur de chargement des jours fériés", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(annee); /* eslint-disable-next-line */ }, [annee]);

  const setField = (type: string, patch: Partial<Fete>) =>
    setRows(prev => ({ ...prev, [type]: { ...prev[type], ...patch } }));

  const saveRow = async (type: string) => {
    const f = rows[type];
    if (!f.date) { toast({ title: "Indiquez une date avant d'enregistrer", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const payload = { type: f.type, date: f.date, annee, jours_avant: f.jours_avant, jours_apres: f.jours_apres, actif: f.actif };
      const res = f.id ? await updateFeteReligieuse(f.id, payload) : await createFeteReligieuse(payload);
      setField(type, res.data);
      toast({ title: `${TYPES.find(t => t.value === type)?.label} enregistré` });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.response?.data?.detail || err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeRow = async (type: string) => {
    const f = rows[type];
    if (!f.id) { setField(type, blankRow(type, annee)); return; }
    setSaving(true);
    try {
      await deleteFeteReligieuse(f.id);
      setField(type, blankRow(type, annee));
      toast({ title: "Date supprimée" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const addCustomRow = () => {
    const newRow: Fete = {
      _tempId: Math.random().toString(36).substring(2, 9),
      type: "",
      date: "",
      annee,
      jours_avant: 1,
      jours_apres: 2,
      actif: true
    };
    setCustomRows(prev => [...prev, newRow]);
  };

  const setCustomField = (index: number, patch: Partial<Fete>) => {
    setCustomRows(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const saveCustomRow = async (index: number) => {
    const f = customRows[index];
    if (!f.type.trim()) {
      toast({ title: "Indiquez un nom pour le jour férié", variant: "destructive" });
      return;
    }
    if (!f.date) {
      toast({ title: "Indiquez une date avant d'enregistrer", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = { 
        type: f.type, 
        date: f.date, 
        annee, 
        jours_avant: f.jours_avant, 
        jours_apres: f.jours_apres, 
        actif: f.actif 
      };
      const res = f.id ? await updateFeteReligieuse(f.id, payload) : await createFeteReligieuse(payload);
      
      setCustomRows(prev => {
        const copy = [...prev];
        copy[index] = res.data;
        return copy;
      });
      toast({ title: `Jour férié « ${f.type} » enregistré` });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.response?.data?.detail || err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeCustomRow = async (index: number) => {
    const f = customRows[index];
    if (!f.id) {
      setCustomRows(prev => prev.filter((_, idx) => idx !== index));
      return;
    }
    setSaving(true);
    try {
      await deleteFeteReligieuse(f.id);
      setCustomRows(prev => prev.filter((_, idx) => idx !== index));
      toast({ title: "Jour férié supprimé" });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  return (
    <div style={S.page}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <CalendarDays size={22} color={T.teal} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0 }}>Jours fériés — Fêtes religieuses</h1>
      </div>
      <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 22, lineHeight: 1.6 }}>
        Les dates des fêtes islamiques varient chaque année (calendrier hégirien) et doivent être saisies annuellement.
        Règle de suspension par défaut : <strong>1 jour avant + 2 jours après</strong>. Tout passage d'abonnement tombant dans cette
        période est suspendu et déclenche une notification automatique au client et à la chargée de clientèle.
      </p>

      <div style={{ marginBottom: 18 }}>
        <label style={S.label}>Année</label>
        <select value={annee} onChange={e => setAnnee(+e.target.value)} style={{ ...S.input, maxWidth: 160 }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div style={S.card}>
        {loading ? (
          <p style={{ color: T.textMuted, fontSize: 13 }}>Chargement…</p>
        ) : (
          TYPES.map(t => {
            const f = rows[t.value] || blankRow(t.value, annee);
            return (
              <div key={t.value} style={S.row}>
                <div>
                  <label style={S.label}>Fête</label>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text, padding: "8px 0" }}>{t.label}</div>
                </div>
                <div>
                  <label style={S.label}>Date</label>
                  <input type="date" value={f.date || ""} onChange={e => setField(t.value, { date: e.target.value })} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Jours avant</label>
                  <input type="number" min={0} max={7} value={f.jours_avant} onChange={e => setField(t.value, { jours_avant: +e.target.value })} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Jours après</label>
                  <input type="number" min={0} max={7} value={f.jours_apres} onChange={e => setField(t.value, { jours_apres: +e.target.value })} style={S.input} />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => saveRow(t.value)} disabled={saving} title="Enregistrer"
                    style={{ ...S.btn, padding: "8px 12px", fontSize: 13 }}>
                    <Save size={15} />
                  </button>
                  <button onClick={() => removeRow(t.value)} disabled={saving} title="Supprimer"
                    style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, padding: "8px 12px", cursor: "pointer" }}>
                    <Trash2 size={15} />
                  </button>
                </div>
                {f.date && (
                  <div style={{ gridColumn: "1 / -1", fontSize: 12, color: T.textMuted, marginTop: -6 }}>
                    Période suspendue : <strong>{fmtDate(f.debut_suspension || shiftDate(f.date, -f.jours_avant))}</strong> → <strong>{fmtDate(f.fin_suspension || shiftDate(f.date, f.jours_apres))}</strong>
                    {!f.actif && <span style={{ color: "#dc2626" }}> · inactif</span>}
                    <label style={{ marginLeft: 14, cursor: "pointer" }}>
                      <input type="checkbox" checked={f.actif} onChange={e => setField(t.value, { actif: e.target.checked })} style={{ marginRight: 5 }} />
                      Actif
                    </label>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28, marginBottom: 12 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: T.text, margin: 0 }}>Autres jours fériés</h2>
        <button onClick={addCustomRow} style={{ ...S.btn, padding: "8px 14px", fontSize: 13 }}>
          + Ajouter un jour férié
        </button>
      </div>

      <div style={S.card}>
        {loading ? (
          <p style={{ color: T.textMuted, fontSize: 13 }}>Chargement…</p>
        ) : customRows.length === 0 ? (
          <p style={{ color: T.textMuted, fontSize: 13, textAlign: "center", padding: "10px 0", margin: 0 }}>
            Aucun autre jour férié configuré pour cette année.
          </p>
        ) : (
          customRows.map((f, idx) => {
            const key = f.id ? f.id.toString() : f._tempId;
            return (
              <div key={key} style={S.row}>
                <div>
                  <label style={S.label}>Nom du jour férié</label>
                  <input type="text" placeholder="ex: Fête du Trône" value={f.type} onChange={e => setCustomField(idx, { type: e.target.value })} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Date</label>
                  <input type="date" value={f.date || ""} onChange={e => setCustomField(idx, { date: e.target.value })} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Jours avant</label>
                  <input type="number" min={0} max={7} value={f.jours_avant} onChange={e => setCustomField(idx, { jours_avant: +e.target.value })} style={S.input} />
                </div>
                <div>
                  <label style={S.label}>Jours après</label>
                  <input type="number" min={0} max={7} value={f.jours_apres} onChange={e => setCustomField(idx, { jours_apres: +e.target.value })} style={S.input} />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => saveCustomRow(idx)} disabled={saving} title="Enregistrer"
                    style={{ ...S.btn, padding: "8px 12px", fontSize: 13 }}>
                    <Save size={15} />
                  </button>
                  <button onClick={() => removeCustomRow(idx)} disabled={saving} title="Supprimer"
                    style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 10, padding: "8px 12px", cursor: "pointer" }}>
                    <Trash2 size={15} />
                  </button>
                </div>
                {f.date && (
                  <div style={{ gridColumn: "1 / -1", fontSize: 12, color: T.textMuted, marginTop: -6 }}>
                    Période suspendue : <strong>{fmtDate(f.debut_suspension || shiftDate(f.date, -f.jours_avant))}</strong> → <strong>{fmtDate(f.fin_suspension || shiftDate(f.date, f.jours_apres))}</strong>
                    {!f.actif && <span style={{ color: "#dc2626" }}> · inactif</span>}
                    <label style={{ marginLeft: 14, cursor: "pointer" }}>
                      <input type="checkbox" checked={f.actif} onChange={e => setCustomField(idx, { actif: e.target.checked })} style={{ marginRight: 5 }} />
                      Actif
                    </label>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
