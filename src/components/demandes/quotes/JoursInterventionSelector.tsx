import { Field } from "./QuoteShared";
import { extractJoursPassage } from "../../../utils/pricing";

export const ALL_DAYS = [
  { key: 'lundi', label: 'Lun', full: 'Lundi' },
  { key: 'mardi', label: 'Mar', full: 'Mardi' },
  { key: 'mercredi', label: 'Mer', full: 'Mercredi' },
  { key: 'jeudi', label: 'Jeu', full: 'Jeudi' },
  { key: 'vendredi', label: 'Ven', full: 'Vendredi' },
  { key: 'samedi', label: 'Sam', full: 'Samedi' },
  { key: 'dimanche', label: 'Dim', full: 'Dimanche' },
];

export const DOW_TO_KEY = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export const getDefaultDaysForCount = (count: number): string[] => {
  if (count <= 1) return ['samedi'];
  if (count === 2) return ['lundi', 'jeudi'];
  if (count === 3) return ['lundi', 'mercredi', 'vendredi'];
  if (count === 4) return ['lundi', 'mardi', 'mercredi', 'jeudi'];
  if (count === 5) return ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
  if (count === 6) return ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  return ALL_DAYS.map(d => d.key);
};

export const formatDaysSummary = (days: string[]): string => {
  if (!days || days.length === 0) return "";
  return days.map(k => {
    const match = ALL_DAYS.find(ad => ad.key === k);
    return match ? match.full : k.charAt(0).toUpperCase() + k.slice(1);
  }).join(' + ');
};

export const getInitialDays = (data: any, demande: any, isAbo: boolean, defaultCount = 2): string[] => {
  const sources = [
    data?.jours_intervention,
    data?.jours_intervention_detail,
    data?.jours_passage,
    demande?.planning?.jours_intervention,
  ];
  for (const src of sources) {
    if (src) {
      const parsed = extractJoursPassage(src);
      if (parsed.length > 0) return parsed;
    }
  }
  const dateStr = demande?.date_intervention || data?.date_intervention || data?.date || data?.schedulingDate || "";
  let knownDateDayKey = "";
  if (dateStr) {
    const dObj = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'));
    if (!isNaN(dObj.getTime())) {
      knownDateDayKey = DOW_TO_KEY[dObj.getDay()];
    }
  }

  if (!isAbo) {
    return knownDateDayKey ? [knownDateDayKey] : ['lundi'];
  }

  return getDefaultDaysForCount(defaultCount);
};

export const addHoursToTime = (timeStr: string, durationHours: number): string => {
  const [h, m] = (timeStr || '09:00').split(':').map(Number);
  const totalMinutes = (isNaN(h) ? 9 : h) * 60 + (isNaN(m) ? 0 : m) + durationHours * 60;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

interface JoursInterventionSelectorProps {
  selectedDays: string[];
  onChange: (days: string[]) => void;
  isAbo?: boolean;
  dateStr?: string;
  label?: string;
  disabled?: boolean;
}

export default function JoursInterventionSelector({
  selectedDays,
  onChange,
  isAbo = false,
  dateStr,
  label,
  disabled = false,
}: JoursInterventionSelectorProps) {
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

  const handleToggle = (dayKey: string) => {
    if (disabled) return;
    if (isAbo) {
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
      onChange(next);
    } else {
      onChange([dayKey]);
    }
  };

  const fieldLabel = label || (isAbo ? "Jours d'intervention dans la semaine" : "Jour d'intervention dans la semaine");
  const summaryText = formatDaysSummary(selectedDays) || "Aucun jour sélectionné";

  return (
    <Field label={fieldLabel}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 2, marginBottom: 5 }}>
        {ALL_DAYS.map(day => {
          const isSelected = selectedDays.includes(day.key);
          return (
            <button
              key={day.key}
              type="button"
              onClick={() => handleToggle(day.key)}
              title={day.full}
              disabled={disabled}
              style={{
                padding: '6px 0',
                borderRadius: 6,
                border: isSelected ? '1px solid #006654' : '1px solid #cbd5e1',
                backgroundColor: isSelected ? '#006654' : '#ffffff',
                color: isSelected ? '#ffffff' : '#334155',
                fontWeight: isSelected ? 700 : 500,
                fontSize: 11,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
                textAlign: 'center',
                opacity: disabled ? 0.6 : 1,
              }}
            >
              {day.label}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: '#006654', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{summaryText}</span>
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
  );
}
