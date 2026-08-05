import React, { useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { Demande } from '../../types';

export interface SubscriptionHeaderCardProps {
  latest: Demande;
  capitalizedMonthTitle: string;
  selectedDays: string[];
  monthPassagesPlanifies: number;
  monthPassagesRealises: number;
  monthPassagesReport: number;
  monthPassagesAnnules: number;
  fifthWeekInfo: {
    fifthWeekDay: string | null;
    fifthWeekDateStr: string | null;
    fifthWeekIso: string | null;
  };
}

export const SubscriptionHeaderCard: React.FC<SubscriptionHeaderCardProps> = ({
  latest,
  capitalizedMonthTitle,
  selectedDays,
  monthPassagesRealises,
  monthPassagesReport,
  fifthWeekInfo
}) => {
  const assiduiteLabel = useMemo(() => {
    const denom = monthPassagesRealises + monthPassagesReport;
    if (denom === 0) return '100%';
    const rate = (monthPassagesRealises / denom) * 100;
    const formatted = Number.isInteger(rate) ? rate.toString() : (Math.round(rate * 10) / 10).toString().replace('.', ',');
    return `${formatted}%`;
  }, [monthPassagesRealises, monthPassagesReport]);

  const impayeCount = useMemo(() => {
    if ((latest as any)?.statut_facturation === 'Non payé' || (latest as any)?.statut_facturation === 'unpaid') return 1;
    return 0;
  }, [latest]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ── Dark Teal KPI Banner ── */}
      <div style={{ background: '#034a3e', borderRadius: 12, padding: '1.25rem 1.5rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', opacity: 0.8, letterSpacing: '0.05em' }}>
            STATUT ABONNEMENT ({capitalizedMonthTitle.toUpperCase()})
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>Actif ({latest.service || latest.type_prestation || 'Grand ménage'})</span>
            <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
              {selectedDays.length} jours / sem
            </span>
          </div>
        </div>

        {/* 4 KPIs matching user screenshot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {/* KPI 1 : PASSAGES RÉALISÉS */}
          <div style={{ padding: '0 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>
              {monthPassagesRealises}
            </div>
            <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
              PASSAGES RÉALISÉS
            </div>
          </div>

          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.25)' }} />

          {/* KPI 2 : REPORT */}
          <div style={{ padding: '0 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>
              {monthPassagesReport}
            </div>
            <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
              REPORT
            </div>
          </div>

          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.25)' }} />

          {/* KPI 3 : IMPAYÉ */}
          <div style={{ padding: '0 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>
              {impayeCount}
            </div>
            <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
              IMPAYÉ
            </div>
          </div>

          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.25)' }} />

          {/* KPI 4 : ASSIDUITÉ */}
          <div style={{ padding: '0 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#facc15' }}>
              {assiduiteLabel}
            </div>
            <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
              ASSIDUITÉ
            </div>
          </div>
        </div>
      </div>

      {/* ── 5th Week Detection Notice Banner ── */}
      {fifthWeekInfo.fifthWeekDay && (
        <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <AlertCircle size={20} color="#6d28d9" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#5b21b6' }}>
              5ème semaine détectée — {capitalizedMonthTitle}
            </div>
            <div style={{ fontSize: 12, color: '#6d28d9', marginTop: 2 }}>
              Le mois contient 5 {fifthWeekInfo.fifthWeekDay}s. Le passage du {fifthWeekInfo.fifthWeekDateStr} est facturé en complément au prorata.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
