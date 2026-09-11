/**
 * Module de synchronisation réactive globale (Finance & Règlements)
 * - Propage instantanément tout changement de paiement / règlement à tous les composants abonnés
 * - Fonctionne au sein de la même fenêtre (CustomEvent) et entre onglets (BroadcastChannel / storage)
 * - Fournit le hook `useFinanceSync` pour actualiser automatiquement les données sans rechargement
 */

import { useEffect, useRef } from 'react';

const SYNC_EVENT_NAME = 'app:finance_sync';
const CHANNEL_NAME = 'app_finance_sync_channel';

export interface FinanceSyncPayload {
  source?: string;
  demandeId?: number;
  missionId?: number;
  profilId?: number;
  timestamp: number;
}

let channel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch {
  // BroadcastChannel peut être indisponible ou restreint
}

/**
 * Déclenche une synchronisation globale après une modification de paiement ou règlement
 */
export const emitFinanceSync = (payload?: {
  source?: string;
  demandeId?: number;
  missionId?: number;
  profilId?: number;
}) => {
  const data: FinanceSyncPayload = {
    ...payload,
    timestamp: Date.now(),
  };

  if (typeof window !== 'undefined') {
    // 1. Dispatch intra-fenêtre / composants montés
    try {
      window.dispatchEvent(new CustomEvent(SYNC_EVENT_NAME, { detail: data }));
    } catch {}

    // 2. Broadcast vers les autres onglets du navigateur
    try {
      channel?.postMessage(data);
    } catch {}

    // 3. Fallback via localStorage (au cas où BroadcastChannel est bloqué)
    try {
      localStorage.setItem('app_finance_sync_ping', JSON.stringify(data));
    } catch {}
  }
};

/**
 * Souscription réactive à la synchronisation finance
 */
export const subscribeFinanceSync = (
  callback: (payload: FinanceSyncPayload) => void
): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (e: Event) => {
    const detail = (e as CustomEvent<FinanceSyncPayload>).detail;
    callback(detail || { timestamp: Date.now() });
  };

  const handleBroadcast = (e: MessageEvent) => {
    if (e.data && typeof e.data.timestamp === 'number') {
      callback(e.data);
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'app_finance_sync_ping' && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        callback(parsed);
      } catch {}
    }
  };

  window.addEventListener(SYNC_EVENT_NAME, handleCustomEvent);
  channel?.addEventListener('message', handleBroadcast);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(SYNC_EVENT_NAME, handleCustomEvent);
    channel?.removeEventListener('message', handleBroadcast);
    window.removeEventListener('storage', handleStorage);
  };
};

/**
 * Hook React pour synchroniser automatiquement une fonction de rechargement
 * avec dérebond (debounce) et rafraîchissement au focus
 */
export const useFinanceSync = (
  onRefresh: () => any | Promise<any>,
  options: { debounceMs?: number; refreshOnFocus?: boolean; ignoreSource?: string } = {}
) => {
  const { debounceMs = 200, refreshOnFocus = true, ignoreSource } = options;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRunRef = useRef<number>(0);

  useEffect(() => {
    const trigger = (payload?: FinanceSyncPayload) => {
      if (ignoreSource && payload?.source === ignoreSource) {
        return;
      }

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        lastRunRef.current = Date.now();
        void onRefreshRef.current();
      }, debounceMs);
    };

    const unsubscribe = subscribeFinanceSync(trigger);

    let handleFocus: (() => void) | null = null;
    if (refreshOnFocus && typeof window !== 'undefined') {
      handleFocus = () => {
        if (Date.now() - lastRunRef.current > 15000) {
          trigger();
        }
      };
      window.addEventListener('focus', handleFocus);
    }

    return () => {
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
      if (handleFocus) window.removeEventListener('focus', handleFocus);
    };
  }, [debounceMs, refreshOnFocus, ignoreSource]);
};
