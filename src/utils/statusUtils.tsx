import React from 'react';

/**
 * Standardized demand status logic for the whole application.
 * Normalizes labels and visual badges (colors/classes).
 */

export interface StatusInfo {
  label: string | React.ReactNode;
  badgeClass: string;
}

export const getStatusInfo = (statut: string, cao?: boolean | 'reporte'): StatusInfo => {
  const s = (statut || '').toLowerCase().trim();

  switch (s) {
    case 'en_cours':
      if (cao === 'reporte') {
        return {
          label: 'Reportée',
          badgeClass: 'badge-orange'
        };
      }
      if (cao === true) {
        return { 
          label: 'Prestation confirmée', 
          badgeClass: 'badge-green' 
        };
      }
      return { 
        label: 'Client à appeler (Opé.)', 
        badgeClass: 'badge-nouveau' 
      };

    case 'pres_en_cours':
      return { 
        label: 'Prestation confirmée', 
        badgeClass: 'badge-purple' 
      };

    case 'pres_terminee':
      return { 
        label: 'Prestation terminée', 
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
        label: 'Client à appeler (Opé.)', 
        badgeClass: 'badge-status-attente' 
      };

    default:
      return { 
        label: 'Client à appeler (Opé.)', 
        badgeClass: 'badge-nouveau' 
      };
  }
};

/**
 * Helper to render the standardized status badge.
 */
export const renderStatusBadge = (statut: string, cao?: boolean | 'reporte') => {
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
  if (s === 'agence_payee_client' || s === 'agence payé / client' || s === 'agence payée / client') {
    return { label: 'Agence payée / Client', badgeClass: 'badge-orange' };
  }
  if (s === 'profil_paye_client' || s === 'profil payé / client') {
    return { label: 'Profil payé / Client', badgeClass: 'badge-orange' };
  }
  if (s === 'commercial_paye_client' || s === 'commercial payé / client' || s === 'commercial payé /client') {
    return { label: 'Commercial payé / client', badgeClass: 'badge-orange' };
  }
  if (s === 'paiement_partiel' || s === 'partiel' || s === 'paiement partiel') {
    return { label: 'Paiement partiel', badgeClass: 'badge-orange' };
  }
  if (s === 'paiement_en_attente' || s === 'acompte' || s === 'paiement en attente') {
    return { label: 'Paiement en attente', badgeClass: 'badge-orange' };
  }
  if (s === 'facturation_annulee' || s === 'facturation annulée' || s === 'facturation annulee') {
    return { label: 'Facturation annulée', badgeClass: 'badge-red' };
  }
  if (s === 'intervention_annulee' || s === 'intervention annulée' || s === 'intervention annulee') {
    return { label: 'Intervention annulée', badgeClass: 'badge-red' };
  }
  if (s === 'reporte' || s === 'reportée' || s === 'reporte_annule' || s === 'reporté_annulé' || s === 'reportée/annulée') {
    return { label: 'Reportée / Annulée', badgeClass: 'badge-orange' };
  }
  if (s === 'annule' || s === 'annulée') {
    return { label: 'Annulée', badgeClass: 'badge-red' };
  }
  if (s === 'intervention_gratuite') {
    return { label: 'Intervention gratuite', badgeClass: 'badge-green' };
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

/**
 * Règle de visibilité pour « Suivi des dus agence – profils » et « Suivi facturation » :
 * - Ne pas afficher les demandes annulées (interventions annulées).
 * - Afficher une facturation annulée si et seulement si l'agence doit payer le profil (profil_paye = oui).
 * - Si « Profil payé » = non, ne pas afficher.
 */
export const isFinanceRowVisible = (row: any): boolean => {
  if (!row) return false;

  const facturationData = row.originalDemande?.formulaire_data?.facturation || row.formulaire_data?.facturation || {};
  const statutUi = String(row.statutPaiementUi || facturationData.statut_paiement_ui || '').toLowerCase().trim();
  const statut = String(row.statut || '').toLowerCase().trim();
  const demandeStatut = String(row.originalDemande?.statut || row.statut_demande || '').toLowerCase().trim();
  const missionStatut = String(row.originalMission?.statut || '').toLowerCase().trim();

  // 1. Est-ce une facturation annulée ?
  const isFacturationAnnulee =
    statutUi === 'facturation_annulee' ||
    statutUi === 'facturation annulée' ||
    statutUi === 'facturation annulee' ||
    statut === 'facturation annulée' ||
    statut === 'facturation annulee' ||
    Boolean(facturationData.facturation_annulee) ||
    Boolean(row.facturation_annulee);

  // 2. Est-ce une demande / intervention annulée (qui n'est pas une facturation annulée) ?
  const isDemandeOrInterventionAnnulee =
    !isFacturationAnnulee && (
      statut === 'intervention annulée' ||
      statut === 'intervention annulee' ||
      statut === 'annulé' ||
      statut === 'annule' ||
      statut === 'annulée' ||
      statut === 'annulee' ||
      demandeStatut === 'annule' ||
      demandeStatut === 'annulée' ||
      demandeStatut === 'annulee' ||
      demandeStatut === 'refuse' ||
      demandeStatut === 'rejete' ||
      missionStatut === 'annulee' ||
      missionStatut === 'annulée' ||
      missionStatut === 'annule'
    );

  // Règle 1 : Ne pas afficher les demandes annulées (interventions annulées)
  if (isDemandeOrInterventionAnnulee) {
    return false;
  }

  // Règle 2 : Si la facturation est annulée
  if (isFacturationAnnulee) {
    const rawVal =
      row.profilSeraPaye !== undefined
        ? row.profilSeraPaye
        : row.originalDemande?.profil_sera_paye !== undefined
          ? row.originalDemande.profil_sera_paye
          : facturationData.profil_sera_paye;

    const isProfilPaye =
      rawVal === true ||
      rawVal === 1 ||
      rawVal === '1' ||
      String(rawVal).trim().toLowerCase() === 'oui' ||
      String(rawVal).trim().toLowerCase() === 'true';

    // Afficher si profil payé = oui, masquer si profil payé = non
    return isProfilPaye;
  }

  return true;
};

