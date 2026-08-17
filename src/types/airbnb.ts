export type TypologieBien = 'studio' | '2ch' | '3ch' | '4ch' | '5ch' | 'villa_riad';

export type AccesType = 'boite_cle' | 'serrure_connectee' | 'gardien' | 'physique';

export type StatutCommande = 
  | 'saisie' 
  | 'remontee_tdb' 
  | 'assignee' 
  | 'en_cours' 
  | 'cloturee' 
  | 'ecart_linge' 
  | 'annulee';

export type CreneauCommande = 'matin' | 'apres_midi';

export type NatureLinge = 'depot_ramassage' | 'depot_seul' | 'ramassage_seul' | 'sans_linge';

export type StatutFiletLinge = 
  | 'compte_runner' 
  | 'en_laverie' 
  | 'en_traitement' 
  | 'pret' 
  | 'remis_runner' 
  | 'depose';

export type StatutObjetTrouve = 'trouve' | 'signale_client' | 'restitue' | 'conserve_agence';

export interface AirbnbConfig {
  id: string;
  prix_studio: number;
  prix_2ch: number;
  prix_3ch: number;
  prix_4ch: number;
  prix_5ch: number;
  prix_villa_riad: number;
  supplement_zone_eloignee: number;
  zones_eloignees_list: string[];
  prix_set_linge_standard: number;
  prix_piece_supp_linge: number;
  forfait_min_linge: number;
  cutoff_matin: string;
  cutoff_apres_midi: string;
  updated_at: string;
}

export interface Bien {
  id: string;
  code: string;
  client: number;
  client_name?: string;
  client_phone?: string;
  client_whatsapp?: string;
  client_email?: string;
  client_segment?: string;
  nom_bien?: string;
  ville: string;
  quartier: string;
  adresse: string;
  complement_adresse?: string;
  etage_porte?: string;
  zone_eloignee: boolean;
  typologie: TypologieBien;
  chambres: number;
  couchages: Array<{ type: string; quantite: number; description?: string }>;
  salles_de_bain: number;
  acces_type: AccesType;
  acces_detail?: string;
  consignes: string[];
  set_composition?: Record<string, number>;
  sets_rechange_client: number;
  ical_url?: string;
  ical_derniere_lecture?: string;
  commandes_actives_count?: number;
  stock_filets_count?: number;
  total_biens_client?: number;
  is_seuil_conciergerie?: boolean;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface OptionCommande {
  code: string;
  label: string;
  prix: number;
  quantite?: number;
}

export interface CommandeAirbnb {
  id: string;
  numero: string;
  bien: string;
  bien_code?: string;
  bien_nom?: string;
  bien_quartier?: string;
  bien_details?: Bien;
  client_name?: string;
  date_prestation: string;
  heure_prestation: string;
  creneau: CreneauCommande;
  nature_linge: NatureLinge;
  options: OptionCommande[];
  prix_menage: number;
  supplement_zone: number;
  prix_options: number;
  montant_linge: number;
  remise_en_etat: number;
  total_ttc: number;
  statut: StatutCommande;
  intervenante?: number | null;
  intervenante_name?: string;
  intervenante_2?: number | null;
  intervenante_2_name?: string;
  runner?: number | null;
  runner_name?: string;
  photos_cloture: string[];
  rapport_notes?: string;
  source?: 'manuel' | 'portail_client' | 'ical_auto';
  facture?: number | null;
  objets_trouves?: ObjetTrouve[];
  filets_ramasses?: FiletLinge[];
  filets_deposes?: FiletLinge[];
  created_at: string;
  updated_at?: string;
}

export interface FiletLinge {
  id: string;
  code_filet: string;
  bien: string;
  bien_code?: string;
  client_name?: string;
  commande_ramassage?: string | null;
  commande_ramassage_numero?: string;
  commande_depot?: string | null;
  commande_depot_numero?: string;
  comptage_runner: Record<string, number>;
  comptage_laverie: Record<string, number>;
  ecart: number;
  ecart_arbitre: boolean;
  ecart_commentaire?: string;
  total_pieces: number;
  sets_calcules: number;
  pieces_supp_calculees: number;
  montant: number;
  montant_fige_le?: string | null;
  fige_par?: number | null;
  fige_par_name?: string;
  statut: StatutFiletLinge;
  created_at: string;
  updated_at?: string;
}

export interface ObjetTrouve {
  id: string;
  commande: string;
  commande_numero?: string;
  bien: string;
  bien_code?: string;
  description: string;
  piece?: string;
  photo_url?: string;
  statut: StatutObjetTrouve;
  remis_a?: string;
  date_restitution?: string | null;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface AirbnbStats {
  total_biens: number;
  biens_actifs: number;
  clients_conciergerie: number;
  biens_zone_eloignee: number;
  clients_sous_seuil_alerte: number;
}

export interface CommandeStats {
  total_mois: number;
  today_count: number;
  a_assigner_demain_18h: number;
  ecarts_linge_en_cours: number;
}
