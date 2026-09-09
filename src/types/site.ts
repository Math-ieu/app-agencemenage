export interface SiteConfig {
  id: string;
  phone_mobile_1: string;
  phone_mobile_1_intl: string;
  phone_mobile_2: string;
  phone_mobile_2_intl: string;
  phone_fixe: string;
  phone_fixe_intl: string;
  whatsapp_number: string;
  email_contact: string;
  email_notifications: string;
  bureau_casa_label: string;
  bureau_casa_address: string;
  bureau_casa_maps_url: string;
  bureau_rabat_label: string;
  bureau_rabat_address: string;
  bureau_rabat_maps_url: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  whatsapp_notification_numbers?: string[];
  updated_at?: string;
}
