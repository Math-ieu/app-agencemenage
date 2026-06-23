import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (err: unknown) => void }> = [];

const pendingRequests = new Set<string>();

const getRequestKey = (config: any) => {
  const method = config.method || '';
  const url = config.url || '';
  const data = typeof config.data === 'string' ? config.data : JSON.stringify(config.data || '');
  const params = typeof config.params === 'string' ? config.params : JSON.stringify(config.params || '');
  return `${method}:${url}:${data}:${params}`;
};

apiClient.interceptors.request.use((config) => {
  if (config.method === 'get') {
    config.params = { ...config.params, _t: Date.now() };
  } else {
    // Non-GET requests (POST, PUT, PATCH, DELETE):
    const key = getRequestKey(config);
    if (pendingRequests.has(key)) {
      // Cancel duplicate concurrent requests
      const source = axios.CancelToken.source();
      config.cancelToken = source.token;
      source.cancel('duplicate_request');
    } else {
      pendingRequests.add(key);
      (config as any)._dedupKey = key;
    }
  }
  return config;
});

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => {
    const key = (response.config as any)?._dedupKey;
    if (key) {
      pendingRequests.delete(key);
    }
    return response;
  },
  async (error) => {
    const key = (error.config as any)?._dedupKey;
    if (key) {
      pendingRequests.delete(key);
    }

    if (axios.isCancel(error) && error.message === 'duplicate_request') {
      // Silently discard double click duplicate cancels to keep UI clean
      return new Promise(() => {});
    }

    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/api/auth/login') || originalRequest.url?.includes('/api/auth/refresh')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return apiClient(originalRequest);
        }).catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(`${API_URL}/api/auth/refresh/`, {}, { withCredentials: true });
        processQueue(null);
        return apiClient(originalRequest);
      } catch (err) {
        processQueue(err);
        localStorage.removeItem('auth-storage');
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

// ─── Auth ────────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  apiClient.post('/api/auth/login/', { email, password });

export const logout = () => apiClient.post('/api/auth/logout/');

export const getMe = () => apiClient.get('/api/auth/me/');

export const updateMe = (data: { first_name?: string; last_name?: string }) =>
  apiClient.patch('/api/auth/me/', data);

export const changePassword = (data: { old_password?: string; new_password?: string }) =>
  apiClient.post('/api/auth/change-password/', data);

export const forgotPassword = (loginVal: string) =>
  apiClient.post('/api/auth/forgot-password/', { login: loginVal });

export const resetPassword = (data: { new_password?: string; uid?: string; token?: string; login?: string; code?: string }) =>
  apiClient.post('/api/auth/reset-password/', data);

export const getRolesPermissions = () =>
  apiClient.get('/api/auth/roles-permissions/');

export const updateRolesPermissions = (data: Record<string, string[]>) =>
  apiClient.post('/api/auth/roles-permissions/', data);

// ─── Demandes ─────────────────────────────────────────────────────────────────
export const getDemandes = (params?: Record<string, string | number>) =>
  apiClient.get('/api/demandes/', { params });

export const getNotificationsUrgentes = () =>
  apiClient.get('/api/demandes/notifications_urgentes/');

export const getDemandesHistorique = (params?: Record<string, string | number>) =>
  apiClient.get('/api/demandes/historique/', { params });

export const exportHistoriqueCsv = (params?: Record<string, string | number>) =>
  apiClient.get('/api/demandes/export_csv/', {
    params,
    responseType: 'blob',
  });

export const getDemande = (id: number) => apiClient.get(`/api/demandes/${id}/`);

export const createDemande = (data: Record<string, unknown>) =>
  apiClient.post('/api/demandes/', data);

export const updateDemande = (id: number, data: Record<string, unknown>) =>
  apiClient.patch(`/api/demandes/${id}/`, data);

export const deleteDemande = (id: number) =>
  apiClient.delete(`/api/demandes/${id}/`);

export const validerDemande = (id: number) =>
  apiClient.post(`/api/demandes/${id}/valider/`);

export const annulerDemande = (id: number, avis: string, cancelType?: 'besoin' | 'intervention') =>
  apiClient.post(`/api/demandes/${id}/annuler/`, { avis_annulation: avis, cancel_type: cancelType });

export const nrpDemande = (id: number, notes?: string) =>
  apiClient.post(`/api/demandes/${id}/nrp/`, { notes });

export const affecterDemande = (id: number, commercial_id: number) =>
  apiClient.post(`/api/demandes/${id}/affecter/`, { commercial_id });

export const affecterOperations = (id: number, operations_id: number) =>
  apiClient.post(`/api/demandes/${id}/affecter_operations/`, { operations_id });

export const sendProfilToDemande = (demandeId: number, agentId: number) =>
  apiClient.post(`/api/demandes/${demandeId}/envoyer_profil/`, { agent_id: agentId });

export const removeProfilFromDemande = (demandeId: number, agentId: number) =>
  apiClient.post(`/api/demandes/${demandeId}/retirer_profil/`, { agent_id: agentId });

export const confirmerCAO = (id: number) =>
  apiClient.post(`/api/demandes/${id}/confirmer_cao/`);

export const confirmerClient = (id: number) =>
  apiClient.post(`/api/demandes/${id}/confirmer_client/`);

export const nouveauClient = (id: number) =>
  apiClient.post(`/api/demandes/${id}/nouveau_client/`);

export const generateDocument = (id: number, type: 'devis' | 'png' | 'facture') =>
  apiClient.post(`/api/demandes/${id}/generate_document/`, { type });

export const sendWhatsApp = (
  id: number,
  type: 'devis' | 'png' | 'facture' | 'cao_profil' | 'feedback',
  profileAgentId?: number,
  mediaUrl?: string
) =>
  apiClient.post(`/api/demandes/${id}/send_whatsapp/`, {
    type,
    ...(profileAgentId ? { profile_agent_id: profileAgentId } : {}),
    ...(mediaUrl ? { media_url: mediaUrl } : {}),
  });

/**
 * Télécharge un document via l'endpoint sécurisé (authentifié).
 * Ne passe jamais par le chemin physique du fichier.
 * Retourne un blob URL utilisable dans un <iframe> ou <img>.
 */
export const fetchSecureDocBlob = async (downloadUrl: string): Promise<{ blobUrl: string; mimeType: string }> => {
  const response = await apiClient.get(downloadUrl, { responseType: 'blob' });
  const mimeType = response.headers['content-type'] || 'application/octet-stream';
  const blobUrl = URL.createObjectURL(response.data);
  return { blobUrl, mimeType };
};

// ─── Clients ─────────────────────────────────────────────────────────────────
export const getClients = (params?: Record<string, string | number>) =>
  apiClient.get('/api/clients/', { params });

export const getClient = (id: number) => apiClient.get(`/api/clients/${id}/`);

export const createClient = (data: Record<string, unknown>) =>
  apiClient.post('/api/clients/', data);

export const updateClient = (id: number, data: Record<string, unknown>) =>
  apiClient.patch(`/api/clients/${id}/`, data);

export const deleteClient = (id: number) =>
  apiClient.delete(`/api/clients/${id}/`);

// ─── Agents/Profils ───────────────────────────────────────────────────────────
export const getAgents = (params?: Record<string, string | number>) =>
  apiClient.get('/api/agents/', { params });

export const getAgent = (id: number) => apiClient.get(`/api/agents/${id}/`);

export const getAgentHistory = (id: number) => apiClient.get(`/api/agents/${id}/history/`);

export const createAgent = (data: FormData | Record<string, unknown>) => {
  const isFormData = data instanceof FormData;
  return apiClient.post('/api/agents/', data, {
    headers: isFormData ? { 'Content-Type': undefined } : {},
  });
};

export const updateAgent = (id: number, data: FormData | Record<string, unknown>) => {
  const isFormData = data instanceof FormData;
  return apiClient.patch(`/api/agents/${id}/`, data, {
    headers: isFormData ? { 'Content-Type': undefined } : {},
  });
};

export const deleteAgent = (id: number) =>
  apiClient.delete(`/api/agents/${id}/`);

// ─── Missions ────────────────────────────────────────────────────────────────
export const getMissions = (params?: Record<string, string | number>) =>
  apiClient.get('/api/missions/', { params });

export const updateMission = (id: number, data: FormData | Record<string, unknown>) => {
  const isFormData = data instanceof FormData;
  return apiClient.patch(`/api/missions/${id}/`, data, {
    headers: isFormData ? { 'Content-Type': undefined } : {},
  });
};

// ─── Finance ─────────────────────────────────────────────────────────────────
export const getFactures = (params?: Record<string, string | number>) =>
  apiClient.get('/api/finance/factures/', { params });

export const getCaisse = (params?: Record<string, string | number>) =>
  apiClient.get('/api/finance/caisse/', { params });

export const getCaisseSolde = (params?: Record<string, string | number>) =>
  apiClient.get('/api/finance/caisse/solde/', { params });

export const exportCaisseCsv = (params?: Record<string, string | number>) =>
  apiClient.get('/api/finance/caisse/export_csv/', {
    params,
    responseType: 'blob',
  });

export const createCaisseMouvement = (data: FormData | Record<string, unknown>) => {
  const isFormData = data instanceof FormData;
  return apiClient.post('/api/finance/caisse/', data, {
    headers: isFormData ? { 'Content-Type': undefined } : {},
  });
};

export const updateCaisseMouvement = (id: number, data: FormData | Record<string, unknown>) => {
  const isFormData = data instanceof FormData;
  return apiClient.patch(`/api/finance/caisse/${id}/`, data, {
    headers: isFormData ? { 'Content-Type': undefined } : {},
  });
};

export const deleteCaisseMouvement = (id: number) =>
  apiClient.delete(`/api/finance/caisse/${id}/`);

// ─── Feedback ────────────────────────────────────────────────────────────────
export const getFeedbacks = (params?: Record<string, string | number>) =>
  apiClient.get('/api/feedback/', { params });

export const getFeedbackStats = () =>
  apiClient.get('/api/feedback/stats/');

export const deleteFeedback = (id: number) =>
  apiClient.delete(`/api/feedback/${id}/`);

// ─── Users ───────────────────────────────────────────────────────────────────
export const getUsers = (params?: Record<string, string | number>) =>
  apiClient.get('/api/users/', { params });

export const createUser = (data: any) =>
  apiClient.post('/api/users/', data);

export const updateUser = (id: string | number, data: any) =>
  apiClient.patch(`/api/users/${id}/`, data);

export const deleteUser = (id: string | number) =>
  apiClient.delete(`/api/users/${id}/`);

// ─── Documents ───────────────────────────────────────────────────────────────
export const uploadDocument = (demandeId: number, file: File | Blob, type: string, name: string) => {
  const formData = new FormData();
  formData.append('demande', demandeId.toString());
  formData.append('fichier', file, name);
  formData.append('type_document', type);
  formData.append('nom', name);
  return apiClient.post('/api/documents/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

// ─── Audit ───────────────────────────────────────────────────────────────────
export const getAuditLogs = (params?: Record<string, string | number>) =>
  apiClient.get('/api/audit/', { params });

// ─── Blog ────────────────────────────────────────────────────────────────────
export const getBlogCategories = () => apiClient.get('/api/blog/categories/');

export const getBlogPosts = (params?: Record<string, string | number>) =>
  apiClient.get('/api/blog/posts/', { params });

export const getBlogPost = (slug: string) =>
  apiClient.get(`/api/blog/posts/${slug}/`);

export const createBlogPost = (data: FormData | Record<string, unknown>) => {
  const isFormData = data instanceof FormData;
  return apiClient.post('/api/blog/posts/', data, {
    headers: isFormData ? { 'Content-Type': undefined } : {},
  });
};

export const updateBlogPost = (slug: string, data: FormData | Record<string, unknown>) => {
  const isFormData = data instanceof FormData;
  return apiClient.patch(`/api/blog/posts/${slug}/`, data, {
    headers: isFormData ? { 'Content-Type': undefined } : {},
  });
};

export const deleteBlogPost = (slug: string) =>
  apiClient.delete(`/api/blog/posts/${slug}/`);

// MARKETING
export const getPromoCodes = (params?: Record<string, unknown>) => apiClient.get('/api/marketing/promos/', { params });
export const createPromoCode = (data: Record<string, unknown>) => apiClient.post('/api/marketing/promos/', data);
export const updatePromoCode = (id: number, data: Record<string, unknown>) => apiClient.patch(`/api/marketing/promos/${id}/`, data);
export const deletePromoCode = (id: number) => apiClient.delete(`/api/marketing/promos/${id}/`);

// FÊTES RELIGIEUSES / JOURS FÉRIÉS (Paramètres)
export const getFetesReligieuses = (params?: Record<string, unknown>) => apiClient.get('/api/fetes-religieuses/', { params });
export const createFeteReligieuse = (data: Record<string, unknown>) => apiClient.post('/api/fetes-religieuses/', data);
export const updateFeteReligieuse = (id: number, data: Record<string, unknown>) => apiClient.patch(`/api/fetes-religieuses/${id}/`, data);
export const deleteFeteReligieuse = (id: number) => apiClient.delete(`/api/fetes-religieuses/${id}/`);

export const getCommercialGestures = (params?: Record<string, unknown>) => apiClient.get('/api/marketing/gestes/', { params });
export const createCommercialGesture = (data: Record<string, unknown>) => apiClient.post('/api/marketing/gestes/', data);
export const updateCommercialGesture = (id: number, data: Record<string, unknown>) => apiClient.patch(`/api/marketing/gestes/${id}/`, data);
export const deleteCommercialGesture = (id: number) => apiClient.delete(`/api/marketing/gestes/${id}/`);

export const getCampaigns = (params?: Record<string, unknown>) => apiClient.get('/api/marketing/campagnes/', { params });
export const createCampaign = (data: Record<string, unknown>) => apiClient.post('/api/marketing/campagnes/', data);
export const updateCampaign = (id: number, data: Record<string, unknown>) => apiClient.patch(`/api/marketing/campagnes/${id}/`, data);
export const deleteCampaign = (id: number) => apiClient.delete(`/api/marketing/campagnes/${id}/`);

export const getClientActionLogs = (id: number) => apiClient.get(`/api/clients/${id}/action_logs/`);

// ─── Subscription Planning ───────────────────────────────────────────────────
export const getPlanning = (demandeId: number) =>
  apiClient.get(`/api/demandes/${demandeId}/planning/`);

export const savePlanning = (demandeId: number, data: Record<string, unknown>) =>
  apiClient.post(`/api/demandes/${demandeId}/planning/`, data);

export const updatePlanning = (demandeId: number, data: Record<string, unknown>) =>
  apiClient.patch(`/api/demandes/${demandeId}/planning/`, data);

export const createPlanningIntervention = (demandeId: number, data: { date: string; time: string; week_id: string; day_key: string }) =>
  apiClient.post(`/api/demandes/${demandeId}/create_planning_intervention/`, data);

// ─── App Notifications ────────────────────────────────────────────────────────
export const getAppNotifications = () =>
  apiClient.get('/api/notifications/');

export const markNotificationRead = (id: number) =>
  apiClient.patch(`/api/notifications/${id}/`, { is_read: true });
