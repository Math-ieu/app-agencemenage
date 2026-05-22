import React from 'react';

/**
 * Standardized demand status logic for the whole application.
 * Normalizes labels and visual badges (colors/classes).
 */

export interface StatusInfo {
  label: string | React.ReactNode;
  badgeClass: string;
}

export const getStatusInfo = (statut: string, cao?: boolean): StatusInfo => {
  const s = (statut || '').toLowerCase().trim();

  switch (s) {
    case 'en_cours':
      if (cao) {
        return { 
          label: 'Confirmé', 
          badgeClass: 'badge-green' 
        };
      }
      return { 
        label: (
          <React.Fragment>
            <span>Nouveau</span>
            <span>besoin</span>
          </React.Fragment>
        ), 
        badgeClass: 'badge-nouveau' 
      };

    case 'pres_en_cours':
      return { 
        label: 'Pres. en cours', 
        badgeClass: 'badge-purple' 
      };

    case 'pres_terminee':
      return { 
        label: 'Pres. terminée', 
        badgeClass: 'badge-orange' 
      };

    case 'termine':
      return { 
        label: 'Terminé', 
        badgeClass: 'badge-green' 
      };

    case 'annule':
      return { 
        label: 'Annulée', 
        badgeClass: 'badge-red' 
      };

    case 'en_attente':
      return { 
        label: 'En attente', 
        badgeClass: 'badge-status-attente' 
      };

    default:
      // Si le statut est inconnu mais semble être un nouveau besoin
      return { 
        label: (
          <React.Fragment>
            <span>Nouveau</span>
            <span>besoin</span>
          </React.Fragment>
        ), 
        badgeClass: 'badge-nouveau' 
      };
  }
};

/**
 * Helper to render the standardized status badge.
 */
export const renderStatusBadge = (statut: string, cao?: boolean) => {
  const { label, badgeClass } = getStatusInfo(statut, cao);
  return <span className={`badge ${badgeClass}`}>{label}</span>;
};

/**
 * Standardized payment status logic.
 * Normalizes labels and visual badges (colors/classes).
 */
export const getPaymentStatusInfo = (statutUi: string | undefined, legacyStatut?: string): StatusInfo => {
  const s = (statutUi || legacyStatut || '').toLowerCase().trim();

  // Mapping specialized labels
  if (s === 'paye' || s === 'integral' || s === 'effectue') {
    return { label: 'Payé', badgeClass: 'badge-green' };
  }
  if (s === 'agence_payee_client' || s === 'agence payé / client') {
    return { label: 'Agence payé / Client', badgeClass: 'badge-orange' };
  }
  if (s === 'profil_paye_client' || s === 'profil payé / client') {
    return { label: 'Profil payé / Client', badgeClass: 'badge-orange' };
  }
  if (s === 'paiement_partiel' || s === 'partiel' || s === 'paiement partiel') {
    return { label: 'Paiement partiel', badgeClass: 'badge-orange' };
  }
  if (s === 'paiement_en_attente' || s === 'acompte' || s === 'paiement en attente') {
    return { label: 'Paiement en attente', badgeClass: 'badge-orange' };
  }
  if (s === 'facturation_annulee') {
    return { label: 'Facturation annulée', badgeClass: 'badge-red' };
  }
  if (s === 'non_confirme' || s === 'non_paye' || s === 'non payé') {
    return { label: 'Non confirmé', badgeClass: 'badge-gray' };
  }

  // Fallback
  return { 
    label: s ? s.replace(/_/g, ' ') : 'Non confirmé', 
    badgeClass: 'badge-gray' 
  };
};

/**
 * Helper to render the standardized payment status badge.
 */
export const renderPaymentStatusBadge = (statutUi: string | undefined, legacyStatut?: string) => {
  const { label, badgeClass } = getPaymentStatusInfo(statutUi, legacyStatut);
  return <span className={`badge ${badgeClass}`}>{label}</span>;
};
