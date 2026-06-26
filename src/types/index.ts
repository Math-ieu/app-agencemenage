export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  full_name: string;
}

export interface Client {
  id: number;
  display_name: string;
  full_name?: string;
  first_name: string;
  last_name: string;
  entity_name?: string;
  phone: string;
  whatsapp?: string;
  assigned_commercial?: string;
  email: string;
  segment: 'particulier' | 'entreprise';
  city: string;
  neighborhood: string;
  address: string;
  created_at: string;
  demandes_count?: number;
  avis_commercial?: string;
  avis_operationnel?: string;
  is_blacklisted?: boolean;
}

export interface Agent {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  gender: string;
  birth_date: string;
  marital_status?: string;
  has_children: boolean;
  poste: string;
  experience: string;
  experience_years: number;
  experience_months: number;
  education_level: string;
  languages: string[];
  nationality: string;
  cin: string;
  situation: string;
  type_profil: string;
  training_details: string;
  can_read_write: boolean;
  health_issues: string;
  physical_appearance: string;
  corpulence: string;
  avail_emergencies: boolean;
  avail_7_7: boolean;
  avail_day: boolean;
  avail_holidays: boolean;
  average_rating?: number;
  avail_evening: boolean;
  city: string;
  neighborhood: string;
  statut: string;
  photo?: string;
  photo2?: string;
  photo3?: string;
  active_photo?: string;
  cin_file?: string;
  attestation_file?: string;
  fiche_antropometrique?: string;
  operator_notes?: string;
  created_at: string;
  updated_at: string;
  is_assigned_active?: boolean;
  is_blacklisted?: boolean;
  assigned_to?: number | null;
  assigned_to_name?: string | null;
}

export interface Demande {
  id: number;
  client?: number | null;
  client_name: string;
  client_phone: string;
  client_whatsapp?: string;
  client_email?: string;
  client_entity?: string;
  client_contact?: string;
  client_city?: string;
  client_neighborhood?: string;
  client_address?: string;
  client_detail?: Client;
  assigned_to_name: string;
  assigned_to?: number | null;
  assigned_to_id?: number;
  assigned_to_operations?: number | null;
  assigned_to_operations_name?: string;
  created_by?: number | null;
  commercial_name?: string;
  nrp_count?: number;
  service: string;
  service_label?: string;
  type_prestation?: string;
  segment: 'particulier' | 'entreprise';
  statut: string;
  statut_besoin?: string;
  statut_besoin_label?: string;
  date_intervention: string;
  heure_intervention?: string;
  nb_heures?: number;
  nb_intervenants?: number;
  preference_horaire?: string;
  frequency: string;
  frequency_label?: string;
  neighborhood_city?: string;
  avec_produit?: boolean;
  tarif_produit?: number;
  prix: number | string;
  is_devis: boolean;
  devis_statut?: 'brouillon' | 'en_attente_validation' | 'valide' | 'envoye' | 'accepte' | 'refuse';
  tarif_total?: number;
  reste_a_payer?: number;
  avance_paiement?: number | string | null;
  mode_paiement: string;
  mode_paiement_label?: string;
  statut_paiement: string;
  statut_paiement_label?: string;
  statut_paiement_ui?: string;
  profils_envoyes?: Agent[];
  profil_share_link?: string;
  profil_share_links?: Array<{
    agent_id: number;
    agent_name: string;
    link: string;
  }>;
  cao: boolean | 'reporte';
  prochaine_alerte_cao?: string;
  note_commercial?: string;
  note_operationnel?: string;
  formulaire_data?: Record<string, any>;
  source?: string;
  identification_statut: 'nouvelle' | 'existant_valide' | 'verification_requise';
  potential_duplicate_client?: number;
  potential_duplicate_detail?: Client;
  documents?: Document[];
  geste_commercial?: CommercialGestureShort | null;
  planning?: SubscriptionPlanning | null;
  parent_demande?: number | null;
  part_agence?: number;
  parts_repartition?: any[];
  promo_code?: number | null;
  promo_code_name?: string;
  promo_code_code?: string;
  created_at: string;
}

export interface SubscriptionPlanning {
  id?: number;
  demande: number;
  jours_intervention: string[];
  semaines?: any[];
  heure_debut: string | null;
  heure_fin: string | null;
  date_debut: string;
  date_fin?: string | null;
  statut: 'en_cours' | 'termine';
  notes?: string;
  notification_sent_dates?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface AppNotification {
  id: number;
  type: 'rappel_intervention' | 'info';
  title: string;
  message: string;
  demande?: number | null;
  demande_service?: string;
  demande_client_name?: string;
  is_read: boolean;
  target_roles: string[];
  created_at: string;
}

export interface CommercialGestureShort {
  id: number;
  gesture_type: 'reduction_tarif' | 'facturation_annulee' | 'intervention_gratuite';
  status: 'en_attente' | 'en_cours' | 'cloture';
  reduction_type: 'montant' | 'pourcentage';
  reduction_value: number;
}

export interface Document {
  id: number;
  demande: number;
  type_document: string;
  nom: string;
  created_at: string;
  download_url: string | null;
}

export interface Feedback {
  id: number;
  demande: number;
  client: number | null;
  note_intervenant: number;
  note_agence: number;
  commentaire: string;
  opt_out: boolean;
  date: string;
  source: string;
  client_name: string;
  agent_name: string;
  agent_id: number | null;
  service: string;
  city: string;
  neighborhood: string;
  segment: string;
  date_prestation: string | null;
}
