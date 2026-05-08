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
        label: 'Annulé', 
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
