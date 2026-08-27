import { apiClient } from './client';
import type { 
  AirbnbConfig, 
  Bien, 
  CommandeAirbnb, 
  FiletLinge, 
  ObjetTrouve, 
  AirbnbStats, 
  CommandeStats 
} from '../types/airbnb';

// ─── Configuration Airbnb ───────────────────────────────────────────────────
export const getAirbnbConfig = () => 
  apiClient.get<AirbnbConfig>('/api/airbnb/config/');

export const updateAirbnbConfig = (id: string, data: Partial<AirbnbConfig>) => 
  apiClient.patch<AirbnbConfig>(`/api/airbnb/config/${id}/`, data);

// ─── Biens & Logements ───────────────────────────────────────────────────────
export const getBiens = (params?: Record<string, unknown>) => 
  apiClient.get<Bien[]>('/api/airbnb/biens/', { params });

export const getBien = (id: string) => 
  apiClient.get<Bien>(`/api/airbnb/biens/${id}/`);

export const createBien = (data: Partial<Bien>) => 
  apiClient.post<Bien>('/api/airbnb/biens/', data);

export const updateBien = (id: string, data: Partial<Bien>) => 
  apiClient.patch<Bien>(`/api/airbnb/biens/${id}/`, data);

export const deleteBien = (id: string) => 
  apiClient.delete(`/api/airbnb/biens/${id}/`);

export const getBienStats = () => 
  apiClient.get<AirbnbStats>('/api/airbnb/biens/stats/');

export const previewBienCode = (clientId: number) => 
  apiClient.get<{ code: string }>('/api/airbnb/biens/generate_code_preview/', { params: { client_id: clientId } });

export const syncBienIcal = (id: string) => 
  apiClient.post<{ success: boolean; events_found?: number; created_turnovers?: number; error?: string }>(`/api/airbnb/biens/${id}/sync_ical/`);

// ─── Commandes & Turnovers ──────────────────────────────────────────────────
export const getCommandesAirbnb = (params?: Record<string, unknown>) => 
  apiClient.get<CommandeAirbnb[]>('/api/airbnb/commandes/', { params });

export const getCommandeAirbnb = (id: string) => 
  apiClient.get<CommandeAirbnb>(`/api/airbnb/commandes/${id}/`);

export const createCommandeAirbnb = (data: Partial<CommandeAirbnb>) => 
  apiClient.post<CommandeAirbnb>('/api/airbnb/commandes/', data);

export const updateCommandeAirbnb = (id: string, data: Partial<CommandeAirbnb>) => 
  apiClient.patch<CommandeAirbnb>(`/api/airbnb/commandes/${id}/`, data);

export const deleteCommandeAirbnb = (id: string) => 
  apiClient.delete(`/api/airbnb/commandes/${id}/`);

export const calculateCommandePrice = (data: {
  bien_id: string;
  typologie?: string;
  options?: Array<{ code: string; label: string; prix: number }>;
  remise_en_etat?: number;
  date_prestation?: string;
  heure_prestation?: string;
  creneau?: string;
}) => apiClient.post<{
  pricing: {
    typologie: string;
    prix_menage: number;
    is_zone_eloignee: boolean;
    supplement_zone: number;
    prix_options: number;
    remise_en_etat: number;
    total_ttc_hors_linge: number;
  };
  cutoff: {
    is_valid: boolean;
    is_late: boolean;
    message: string;
    cutoff_time: string;
  };
}>('/api/airbnb/commandes/calculate_price/', data);

export const assignerCommandeAirbnb = (id: string, data: {
  intervenante_id: number;
  intervenante_2_id?: number | null;
  runner_id?: number | null;
}) => apiClient.post<{ success: boolean; message: string; statut: string }>(`/api/airbnb/commandes/${id}/assigner/`, data);

export const cloturerCommandeAirbnb = (id: string, data: {
  photos: string[];
  rapport_notes?: string;
}) => apiClient.post<{ success: boolean; message: string; statut: string }>(`/api/airbnb/commandes/${id}/cloturer/`, data);

export const getMissionPdfData = (id: string) => 
  apiClient.get<Record<string, unknown>>(`/api/airbnb/commandes/${id}/mission_pdf_data/`);

export const getPlanningGrid = (params?: { start?: string; days?: number }) => 
  apiClient.get<{ start: string; end: string; commandes: CommandeAirbnb[] }>('/api/airbnb/commandes/planning_grid/', { params });

export const getCommandeStats = () => 
  apiClient.get<CommandeStats>('/api/airbnb/commandes/stats/');

// ─── Chaîne du Linge ────────────────────────────────────────────────────────
export const getFiletsLinge = (params?: Record<string, unknown>) => 
  apiClient.get<FiletLinge[]>('/api/airbnb/filets/', { params });

export const getFiletLinge = (id: string) => 
  apiClient.get<FiletLinge>(`/api/airbnb/filets/${id}/`);

export const createFiletLinge = (data: Partial<FiletLinge>) => 
  apiClient.post<FiletLinge>('/api/airbnb/filets/', data);

export const updateFiletLinge = (id: string, data: Partial<FiletLinge>) => 
  apiClient.patch<FiletLinge>(`/api/airbnb/filets/${id}/`, data);

export const figerMontantLinge = (id: string, data: { comptage_laverie?: Record<string, number> }) => 
  apiClient.post<{ success: boolean; message: string; filet: FiletLinge }>(`/api/airbnb/filets/${id}/figer_montant/`, data);

export const arbitrerEcartLinge = (id: string, data: { commentaire?: string }) => 
  apiClient.post<{ success: boolean; message: string }>(`/api/airbnb/filets/${id}/arbitrer_ecart/`, data);

export const getTourneeRunner = (params?: { date?: string }) => 
  apiClient.get<{ date: string; missions_runner: CommandeAirbnb[] }>('/api/airbnb/filets/tournee_runner/', { params });

// ─── Objets Trouvés ─────────────────────────────────────────────────────────
export const getObjetsTrouves = (params?: Record<string, unknown>) => 
  apiClient.get<ObjetTrouve[]>('/api/airbnb/objets-trouves/', { params });

export const createObjetTrouve = (data: Partial<ObjetTrouve>) => 
  apiClient.post<ObjetTrouve>('/api/airbnb/objets-trouves/', data);

export const updateObjetTrouve = (id: string, data: Partial<ObjetTrouve>) => 
  apiClient.patch<ObjetTrouve>(`/api/airbnb/objets-trouves/${id}/`, data);

export const restituerObjetTrouve = (id: string, data: { remis_a: string }) => 
  apiClient.post<{ success: boolean; message: string }>(`/api/airbnb/objets-trouves/${id}/restituer/`, data);

// ─── Upload & Stockage Photos (Bucket Railway / S3) ──────────────────────────
export const uploadAirbnbPhoto = (file: File, category: string = 'general') => {
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('category', category);
  return apiClient.post<{
    success: boolean;
    url: string;
    filename: string;
    path: string;
    size: number;
    content_type: string;
    category: string;
  }>('/api/airbnb/upload-photo/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

// ─── Utilitaire d'extraction paginée sécurisée ───────────────────────────────
export function extractResults<T>(data: any): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}
