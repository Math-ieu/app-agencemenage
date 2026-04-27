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
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  whatsapp?: string;
  address: string;
  city: string;
  neighborhood: string;
  segment: 'particulier' | 'entreprise';
  demandes_count: number;
  created_at: string;
  avis_commercial?: string;
  avis_operationnel?: string;
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
  situation?: string;
  has_children: boolean;
  poste: string;
  experience?: string;
  experience_years: number;
  experience_months: number;
  education_level: string;
  languages: string[];
  nationality: string;
  cin: string;
  type_profil: string;
  training_details?: string;
  can_read_write: boolean;
  health_issues?: string;
  physical_appearance?: string;
  corpulence?: string;
  avail_emergencies: boolean;
  avail_7_7: boolean;
  avail_day: boolean;
  avail_holidays: boolean;
  avail_evening: boolean;
  city: string;
  neighborhood: string;
  statut: string;
  photo?: string;
  cin_file?: string;
  attestation_file?: string;
  fiche_antropometrique?: string;
  operator_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Demande {
  id: number;
  client?: number | null;
  client_name: string;
  client_phone: string;
  client_whatsapp?: string;
  client_city?: string;
  client_neighborhood?: string;
  client_address?: string;
  client_details?: Client;
  assigned_to_name: string;
  assigned_to_id?: number;
  commercial_name?: string;
  nrp_count?: number;
  service: string;
  type_prestation?: string;
  segment: 'particulier' | 'entreprise';
  statut: string;
  statut_besoin?: string;
  date_intervention: string;
  heure_intervention?: string;
  nb_heures?: number;
  preference_horaire?: string;
  frequency: string;
  frequency_label?: string;
  neighborhood_city?: string;
  avec_produit?: boolean;
  tarif_produit?: number;
  prix: number | string;
  is_devis: boolean;
  tarif_total?: number;
  reste_a_payer?: number;
  mode_paiement: string;
  mode_paiement_label?: string;
  statut_paiement: string;
  statut_paiement_label?: string;
  profils_envoyes?: Agent[];
  profil_share_link?: string;
  profil_share_links?: Array<{
    agent_id: number;
    agent_name: string;
    link: string;
  }>;
  cao: boolean;
  prochaine_alerte_cao?: string;
  note_commercial?: string;
  note_operationnel?: string;
  formulaire_data?: Record<string, any>;
  source?: string;
  documents?: Document[];
  created_at: string;
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
