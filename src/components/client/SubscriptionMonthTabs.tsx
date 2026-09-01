import React from 'react';
import { RefreshCw } from 'lucide-react';

export interface SubscriptionMonthTabsProps {
  monthTabs: Array<{ id: string; label: string }>;
  activeMonthTab: string;
  onSelectTab: (tabId: string) => void;
  onAddNextMonthTab: () => void;
  canActivateNextMonth?: boolean;
  disabledReason?: string;
}

export const SubscriptionMonthTabs: React.FC<SubscriptionMonthTabsProps> = ({
  monthTabs,
  activeMonthTab,
  onSelectTab,
  onAddNextMonthTab,
  canActivateNextMonth = true,
  disabledReason
}) => {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#475569', marginRight: 6 }}>
          📅 Périodes :
        </span>
        {monthTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            style={{
              padding: '6px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              border: activeMonthTab === tab.id ? 'none' : '1px solid #cbd5e1',
              background: activeMonthTab === tab.id ? '#037265' : 'white',
              color: activeMonthTab === tab.id ? 'white' : '#334155',
              cursor: 'pointer',
              boxShadow: activeMonthTab === tab.id ? '0 2px 4px rgba(3, 114, 101, 0.2)' : 'none'
            }}
          >
            {tab.label}
          </button>
        ))}

        <button
          type="button"
          onClick={onAddNextMonthTab}
          title={!canActivateNextMonth ? (disabledReason || "Le statut de facturation doit être « Payé » pour activer le mois prochain.") : "Activer le mois prochain"}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: canActivateNextMonth ? 'white' : '#f1f5f9',
            border: canActivateNextMonth ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 700,
            color: canActivateNextMonth ? '#037265' : '#94a3b8',
            cursor: canActivateNextMonth ? 'pointer' : 'not-allowed',
            opacity: canActivateNextMonth ? 1 : 0.75,
            transition: 'all 0.15s ease'
          }}
        >
          <RefreshCw size={14} color={canActivateNextMonth ? '#037265' : '#94a3b8'} /> Activer le mois prochain
        </button>
      </div>
    </div>
  );
};
