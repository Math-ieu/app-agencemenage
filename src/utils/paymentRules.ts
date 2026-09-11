/**
 * Utilitaires & règles métier pour les paiements (Agence Ménage)
 * - Correspondance bidirectionnelle Mode de paiement <-> Statut de paiement
 * - Nouveaux modes : Virement Ag, Virement Com
 * - Vérification Multi-FDM pour le passage au statut "Payé"
 * - Calcul des soldes croisés pour Virement / Espèces
 */

export interface PaymentModeOption {
  value: string;
  label: string;
  description?: string;
}

export const PAYMENT_MODES: PaymentModeOption[] = [
  { value: 'virement_ag', label: 'Virement Ag', description: 'Virement bancaire vers l\'agence' },
  { value: 'virement_com', label: 'Virement Com', description: 'Virement bancaire encaissé par le commercial' },
  { value: 'virement_especes', label: 'Virement / Espèces', description: 'Partie virement agence et solde en espèces à la FDM' },
  { value: 'especes', label: 'Espèces', description: 'Règlement intégral en espèces au profil' },
  { value: 'carte', label: 'Carte bancaire', description: 'Solution de paiement en ligne' },
  { value: 'cheque', label: 'Par chèque', description: 'Paiement par chèque bancaire' },
];

/**
 * Correspondance Mode de paiement -> Statut de paiement initial
 */
export const getStatutPaiementFromMode = (mode?: string): string => {
  const m = (mode || '').trim().toLowerCase();
  if (m === 'especes' || m === 'espece' || m === 'espèces') return 'profil_paye_client';
  if (m === 'virement_especes' || m === 'virement / espèces' || m === 'virement / espèce') return 'paiement_partiel';
  if (m === 'virement_ag' || m === 'virement' || m === 'carte') return 'agence_payee_client';
  if (m === 'virement_com') return 'commercial_paye_client';
  return 'non_confirme';
};

/**
 * Correspondance Statut de paiement -> Mode de paiement (règle inverse)
 * Note : 'facturation_annulee' et 'intervention_gratuite' restent indépendants et ne changent pas le mode.
 */
export const getModePaiementFromStatut = (statutUi?: string, currentMode?: string): string => {
  const s = (statutUi || '').trim().toLowerCase();
  if (s === 'profil_paye_client' || s === 'profil payé / client') return 'especes';
  if (s === 'paiement_partiel' || s === 'paiement partiel') return 'virement_especes';
  if (s === 'commercial_paye_client' || s === 'commercial payé / client') return 'virement_com';
  if (s === 'agence_payee_client' || s === 'agence payée / client') {
    if (currentMode === 'carte') return 'carte';
    return 'virement_ag';
  }
  // Pour facturation_annulee, intervention_gratuite, ou autre, préserver le mode actuel
  return currentMode || '';
};

/**
 * Formate le code d'un mode de paiement en libellé lisible
 */
export const formatModePaiement = (mode?: string): string => {
  if (!mode) return '—';
  const m = mode.trim().toLowerCase();
  if (m === 'virement_ag' || m === 'virement') return 'Virement Ag';
  if (m === 'virement_com') return 'Virement Com';
  if (m === 'virement_especes' || m === 'virement / espèce' || m === 'virement / espèces') return 'Virement / Espèces';
  if (m === 'especes' || m === 'espece' || m === 'espèces') return 'Espèces';
  if (m === 'carte') return 'Carte bancaire';
  if (m === 'cheque') return 'Par chèque';
  if (m === 'sur_place') return 'Sur place';
  if (m === 'agence') return 'À l\'agence';
  return mode;
};

/**
 * Vérifie si TOUTES les FDM rattachées à la demande ont été réglées ("À jour").
 * En cas de demande avec 2 FDM ou plus, toutes les entrées de parts_repartition doivent avoir part_profil_versee = true.
 */
export const areAllProfilesSettled = (
  parts?: any[],
  fallbackSingleProfilePaid: boolean = false
): boolean => {
  if (Array.isArray(parts) && parts.length > 0) {
    return parts.every((p: any) => Boolean(p.part_profil_versee));
  }
  return fallbackSingleProfilePaid;
};

/**
 * Calcul dynamique des montants dus croisés pour « Virement / Espèces »
 * - Si montant_especes > totalParts : la FDM a encaissé plus que sa part -> FDM doit à l'agence (esp - totalParts).
 * - Si montant_especes < totalParts : le client a payé plus par virement -> Agence doit à la FDM (totalParts - esp).
 */
export const computeVirementEspecesDues = (
  montantEspeces: number,
  totalParts: number,
  hasSupplement: boolean = false,
  suppMontant: number = 0,
  supplementEncaissePar: string = 'femme_de_menage'
): { montant_profil_doit_agence: number; montant_agence_doit_profil: number } => {
  const esp = Math.max(0, Number(montantEspeces) || 0);
  const parts = Math.max(0, Number(totalParts) || 0);

  let doitAgence = 0;
  let agenceDoit = 0;

  if (esp > parts) {
    doitAgence = Math.round((esp - parts) * 100) / 100;
  } else if (esp < parts) {
    agenceDoit = Math.round((parts - esp) * 100) / 100;
  }

  // Traitement du supplément éventuel
  if (hasSupplement && suppMontant > 0) {
    if (supplementEncaissePar === 'femme_de_menage') {
      doitAgence = Math.round((doitAgence + suppMontant) * 100) / 100;
    }
  }

  return {
    montant_profil_doit_agence: doitAgence,
    montant_agence_doit_profil: agenceDoit,
  };
};
