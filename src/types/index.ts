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
  full_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  neighborhood: string;
  segment: 'particulier' | 'entreprise';
  created_at: string;
}

export interface Agent {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  email: string;
  role: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Demande {
  id: number;
  client_name: string;
  client_phone: string;
  client_details: Client;
  assigned_to_name: string;
  assigned_to_id?: number;
  commercial_name?: string;
  service: string;
  type_prestation: string;
  segment: 'particulier' | 'entreprise';
  statut: string;
  statut_besoin: string;
  date_intervention: string;
  heure_intervention?: string;
  nb_heures: number;
  frequency: 'une_fois' | 'abonnement';
  neighborhood_city: string;
  avec_produit: boolean;
  tarif_produit: number;
  prix: number | string;
  is_devis: boolean;
  tarif_total: number;
  reste_a_payer: number;
  mode_paiement: string;
  statut_paiement: string;
  profils_envoyes: Agent[];
  cao: boolean;
  prochaine_alerte_cao?: string;
  note_commerciale?: string;
  note_operationnelle?: string;
  formulaire_data?: any;
  created_at: string;
}
