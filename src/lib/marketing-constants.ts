/**
 * marketing-constants.ts
 * Constantes marketing : segments clients, canaux campagne, types de gestes, couleurs statuts.
 */
export const TYPES_REDUCTION = [
  { value: "pourcentage", label: "Pourcentage (%)" },
  { value: "montant_fixe", label: "Montant fixe (MAD)" },
] as const;

export const SEGMENTS_CLIENT = [
  { value: "particulier", label: "Particulier" },
  { value: "entreprise", label: "Entreprise" },
] as const;

export const STATUTS_CLIENT = [
  { value: "tous", label: "Tous les clients" },
  { value: "nouveau", label: "Nouveau client" },
  { value: "inactif", label: "Client inactif (2 mois et plus)" },
  { value: "regulier", label: "Client régulier (2 demandes et plus)" },
  { value: "abonne", label: "Client abonné (avec abonnement)" },
] as const;

export const STATUTS_CODE_PROMO = [
  { value: "brouillon", label: "Brouillon" },
  { value: "active", label: "Actif" },
  { value: "desactivee", label: "Inactif" },
  { value: "expiree", label: "Expiré" },
] as const;

export const CANAUX_DIFFUSION = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Mail" },
] as const;

export const TYPES_GESTE = [
  { value: "reduction_tarif", label: "Réduction sur le tarif" },
  { value: "facturation_annulee", label: "Facturation annulée" },
  { value: "intervention_gratuite", label: "Intervention gratuite" },
] as const;

export const STATUTS_GESTE = [
  { value: "en_attente", label: "En attente" },
  { value: "en_cours", label: "En cours" },
  { value: "cloture", label: "Clôturé" },
] as const;

export const STATUT_GESTE_COLORS: Record<string, { label: string; color: string }> = {
  en_attente: { label: "En attente", color: "bg-yellow-100 text-yellow-800" },
  en_cours: { label: "En cours", color: "bg-blue-100 text-blue-800" },
  cloture: { label: "Clôturé", color: "bg-gray-100 text-gray-800" },
};

export const CANAUX_CAMPAGNE = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
] as const;

export const SERVICES_PARTICULIER = [
  "Ménage standard",
  "Grand ménage",
  "Ménage Air BnB",
  "Nettoyage post-déménagement",
  "Ménage fin de chantier",
  "Auxiliaire de vie",
  "Ménage post-sinistre",
] as const;

export const SERVICES_ENTREPRISE = [
  "Ménage Bureaux",
  "Placement & gestion",
  "Ménage post-sinistre",
  "Ménage fin de chantier",
] as const;

export const SERVICES_MARKETING = [
  ...new Set([...SERVICES_PARTICULIER, ...SERVICES_ENTREPRISE]),
];

export const STATUT_OFFRE_COLORS: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-emerald-100 text-emerald-800" },
  planifiee: { label: "Planifiée", color: "bg-blue-100 text-blue-800" },
  expiree: { label: "Expirée", color: "bg-red-100 text-red-800" },
  desactivee: { label: "Désactivée", color: "bg-gray-100 text-gray-800" },
};

export const STATUT_CAMPAGNE_COLORS: Record<string, { label: string; color: string }> = {
  brouillon: { label: "Brouillon", color: "bg-gray-100 text-gray-800" },
  programmee: { label: "Programmée", color: "bg-blue-100 text-blue-800" },
  envoyee: { label: "Envoyée", color: "bg-emerald-100 text-emerald-800" },
  annulee: { label: "Annulée", color: "bg-red-100 text-red-800" },
};

export const STATUTS_CAMPAGNE = [
  { value: "brouillon", label: "Brouillon" },
  { value: "programmee", label: "Programmée" },
  { value: "envoyee", label: "Envoyée" },
  { value: "annulee", label: "Annulée" },
] as const;

export const CIBLES_CAMPAGNE = [
  { value: "client", label: "Client" },
  { value: "profil", label: "Profil" },
] as const;

export const CRITERES_CLIENT = [
  { value: "tous", label: "Tous les clients" },
  { value: "nouveau", label: "Nouveau client" },
  { value: "abonne", label: "Client abonné" },
  { value: "inactif", label: "Client inactif (depuis 2 mois)" },
  { value: "regulier", label: "Client régulier (2 demandes et +)" },
] as const;

export const CRITERES_PROFIL = [
  { value: "femme_de_menage", label: "Femme de ménage" },
  { value: "garde_malade", label: "Garde malade" },
] as const;
