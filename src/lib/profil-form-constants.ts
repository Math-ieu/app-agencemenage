export const NIVEAUX_ETUDE = [
  'Sans diplôme', 'Primaire', 'Collège', 'Lycée', 'Bac', 'Bac+2', 'Bac+3', 'Bac+5', 'Autre',
] as const;

export const SITUATIONS_MATRIMONIALES = [
  'Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf/Veuve',
] as const;

export const NATIONALITES = [
  'Marocaine', 'Sénégalaise', 'Ivoirienne', 'Camerounaise', 'Guinéenne', 'Autre',
] as const;

export const PRESENTATIONS_PHYSIQUES = [
  { value: 'presentable', label: 'Présentable' },
  { value: 'passable', label: 'Passable' },
  { value: 'tres_presentable', label: 'Très présentable' },
] as const;

export const CORPULENCES = [
  { value: 'normale', label: 'Normale' },
  { value: 'forte', label: 'Forte corpulence' },
  { value: 'tres_forte', label: 'Très forte corpulence' },
  { value: 'petite', label: 'Petite corpulence' },
] as const;

export const TYPES_PROFIL = [
  'Femme de ménage', 'Garde malade', 'Auxiliaire de vie', 'Nounou',
] as const;

export const TYPES_POSTE_EXPERIENCE = [
  'Femme de ménage', 'Garde malade',
] as const;

export const LIEUX_TRAVAIL = [
  'Hôtel', 'Riad', 'Entreprise', 'Villa', 'Appartement', 'Duplex',
] as const;

export const TACHES_MENAGE = [
  'Faire le lit',
  "Passer l'aspirateur",
  'Laver le sol',
  'Dépoussiérer les meubles',
  'Nettoyer les vitres et miroirs',
  "Nettoyer le plan de travail et l'évier",
  'Nettoyer le réfrigérateur et les appareils électroménagers',
  'Nettoyage douche',
  'Nettoyage terrasse et balcon',
  'Repasser et plier les vêtements',
  'Ranger les placards',
] as const;

export const PROFIL_FILTER_TABS = [
  { value: 'all', label: 'Tout' },
  { value: 'grand_menage', label: 'Grand ménage' },
  { value: 'menage_chantier', label: 'Ménage chantier' },
  { value: 'nettoyage_vitres', label: 'Nettoyage de vitres' },
] as const;

export const STATUT_PROFIL_OPTIONS = [
  { value: 'disponible', label: 'Disponible', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'non_disponible', label: 'Non disponible', color: 'bg-rose-100 text-rose-800' },
] as const;
