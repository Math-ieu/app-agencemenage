import { apiClient } from './client';
import type { SiteConfig } from '../types/site';

export const getSiteConfig = () => 
  apiClient.get<SiteConfig>('/api/site/config/');

export const updateSiteConfig = (id: string, data: Partial<SiteConfig>) => 
  apiClient.patch<SiteConfig>(`/api/site/config/${id}/`, data);
