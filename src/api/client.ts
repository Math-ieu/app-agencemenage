import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (err: unknown) => void }> = [];

apiClient.interceptors.request.use((config) => {
  if (config.method === 'get') {
    config.params = { ...config.params, _t: Date.now() };
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
  (response) => response,
  async (error) => {
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

// ─── Demandes ─────────────────────────────────────────────────────────────────
export const getDemandes = (params?: Record<string, string | number>) =>
  apiClient.get('/api/demandes/', { params });

export const getDemande = (id: number) => apiClient.get(`/api/demandes/${id}/`);

export const createDemande = (data: Record<string, unknown>) =>
  apiClient.post('/api/demandes/', data);

export const updateDemande = (id: number, data: Record<string, unknown>) =>
  apiClient.patch(`/api/demandes/${id}/`, data);

export const deleteDemande = (id: number) =>
  apiClient.delete(`/api/demandes/${id}/`);

export const validerDemande = (id: number) =>
  apiClient.post(`/api/demandes/${id}/valider/`);

export const annulerDemande = (id: number, avis: string) =>
  apiClient.post(`/api/demandes/${id}/annuler/`, { avis_annulation: avis });

export const nrpDemande = (id: number, notes?: string) =>
  apiClient.post(`/api/demandes/${id}/nrp/`, { notes });

export const affecterDemande = (id: number, commercial_id: number) =>
  apiClient.post(`/api/demandes/${id}/affecter/`, { commercial_id });

export const confirmerCAO = (id: number) =>
  apiClient.post(`/api/demandes/${id}/confirmer_cao/`);

export const generateDocument = (id: number, type: 'devis' | 'png') =>
  apiClient.post(`/api/demandes/${id}/generate_document/`, { type });

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

// ─── Agents/Profils ───────────────────────────────────────────────────────────
export const getAgents = (params?: Record<string, string | number>) =>
  apiClient.get('/api/agents/', { params });

export const getAgent = (id: number) => apiClient.get(`/api/agents/${id}/`);

export const createAgent = (data: Record<string, unknown>) =>
  apiClient.post('/api/agents/', data);

export const updateAgent = (id: number, data: Record<string, unknown>) =>
  apiClient.patch(`/api/agents/${id}/`, data);

// ─── Missions ────────────────────────────────────────────────────────────────
export const getMissions = (params?: Record<string, string | number>) =>
  apiClient.get('/api/missions/', { params });

// ─── Finance ─────────────────────────────────────────────────────────────────
export const getFactures = (params?: Record<string, string | number>) =>
  apiClient.get('/api/finance/factures/', { params });

export const getCaisse = (params?: Record<string, string | number>) =>
  apiClient.get('/api/finance/caisse/', { params });

export const getCaisseSolde = () =>
  apiClient.get('/api/finance/caisse/solde/');

// ─── Feedback ────────────────────────────────────────────────────────────────
export const getFeedbacks = (params?: Record<string, string | number>) =>
  apiClient.get('/api/feedback/', { params });

// ─── Users ───────────────────────────────────────────────────────────────────
export const getUsers = (params?: Record<string, string | number>) =>
  apiClient.get('/api/users/', { params });

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

// ─── Blog ────────────────────────────────────────────────────────────────────
export const getBlogCategories = () => apiClient.get('/api/blog/categories/');

export const getBlogPosts = (params?: Record<string, string | number>) =>
  apiClient.get('/api/blog/posts/', { params });

export const getBlogPost = (slug: string) =>
  apiClient.get(`/api/blog/posts/${slug}/`);

export const createBlogPost = (data: FormData | Record<string, unknown>) => {
  const isFormData = data instanceof FormData;
  return apiClient.post('/api/blog/posts/', data, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
  });
};

export const updateBlogPost = (slug: string, data: FormData | Record<string, unknown>) => {
  const isFormData = data instanceof FormData;
  return apiClient.patch(`/api/blog/posts/${slug}/`, data, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
  });
};

export const deleteBlogPost = (slug: string) =>
  apiClient.delete(`/api/blog/posts/${slug}/`);
