import React, { useState, useEffect } from "react";
import { getSiteConfig, updateSiteConfig } from "../../api/site";
import type { SiteConfig } from "../../types/site";
import { useToast } from "@/hooks/use-toast";
import {
  Globe,
  Phone,
  Mail,
  MapPin,
  Share2,
  Bell,
  Save,
  Loader2,
  Info,
  Plus,
  Trash2,
  Building2
} from "lucide-react";
import "./ParametresSite.css";

export default function ParametresSite() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newWaNumber, setNewWaNumber] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { data } = await getSiteConfig();
      setConfig(data);
    } catch (err: any) {
      console.error("Erreur de chargement des paramètres du site:", err);
      toast({
        title: "Erreur de chargement",
        description: "Impossible de récupérer les paramètres du site.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof SiteConfig, value: any) => {
    if (!config) return;
    setConfig({
      ...config,
      [field]: value,
    });
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!config) return;

    try {
      setSaving(true);
      const { data } = await updateSiteConfig(config.id, config);
      setConfig(data);
      toast({
        title: "Paramètres enregistrés",
        description: "Les informations du site web ont été mises à jour avec succès.",
      });
    } catch (err: any) {
      console.error("Erreur d'enregistrement:", err);
      toast({
        title: "Erreur d'enregistrement",
        description: err.response?.data?.detail || err.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addWaNotificationNumber = () => {
    if (!newWaNumber.trim() || !config) return;
    const formatted = newWaNumber.trim();
    const currentList = config.whatsapp_notification_numbers || [];
    if (!currentList.includes(formatted)) {
      handleChange("whatsapp_notification_numbers", [...currentList, formatted]);
    }
    setNewWaNumber("");
  };

  const removeWaNotificationNumber = (index: number) => {
    if (!config) return;
    const currentList = config.whatsapp_notification_numbers || [];
    const updated = currentList.filter((_, idx) => idx !== index);
    handleChange("whatsapp_notification_numbers", updated);
  };

  if (loading) {
    return (
      <div className="ps-loading">
        <div className="ps-spinner" />
        <span style={{ fontSize: "14px", color: "#64748b", fontWeight: 500 }}>
          Chargement des paramètres du site...
        </span>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="ps-loading">
        <p style={{ color: "#ef4444", fontWeight: 600, marginBottom: "16px" }}>
          Impossible de charger la configuration du site.
        </p>
        <button type="button" onClick={loadConfig} className="ps-btn-primary">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="ps-wrapper">
      <div className="ps-container">
        {/* En-tête */}
        <div className="ps-header">
          <div className="ps-header-left">
            <div className="ps-header-icon">
              <Globe size={24} />
            </div>
            <div>
              <h1 className="ps-title">Paramètres du site</h1>
              <p className="ps-subtitle">
                Gérez les coordonnées, adresses et informations affichées en direct sur le site web.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className="ps-btn-primary"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        </div>

        {/* Bannière d'information */}
        <div className="ps-notice">
          <Info size={20} className="ps-notice-icon" />
          <div>
            <strong>Adaptabilité automatique :</strong> Si vous laissez un champ vide (ex: téléphone fixe, un bureau, ou un réseau social), l'icône, le bloc ou le lien correspondant sera <strong>automatiquement masqué</strong> sur le site web agencemenage.
          </div>
        </div>

        <form onSubmit={handleSave}>
          {/* Section 1: Téléphones & WhatsApp */}
          <div className="ps-card">
            <div className="ps-card-header">
              <div className="ps-card-header-icon">
                <Phone size={20} />
              </div>
              <div>
                <h2 className="ps-card-title">Numéros de téléphone & WhatsApp</h2>
                <p className="ps-card-subtitle">Affichés dans l'en-tête, le pied de page et les pages de contact</p>
              </div>
            </div>

            <div className="ps-card-body">
              {/* Mobile 1 */}
              <div className="ps-subbox">
                <div className="ps-subbox-header">
                  <Phone size={15} className="ps-subbox-header-icon" />
                  <span>Premier numéro mobile</span>
                </div>
                <div className="ps-grid-2">
                  <div className="ps-form-group">
                    <label className="ps-label">Téléphone Mobile 1 (Texte affiché)</label>
                    <input
                      type="text"
                      value={config.phone_mobile_1}
                      onChange={(e) => handleChange("phone_mobile_1", e.target.value)}
                      placeholder="06 64 22 67 90"
                      className="ps-input"
                    />
                  </div>
                  <div className="ps-form-group">
                    <label className="ps-label">Mobile 1 — Format d'appel (tel:+)</label>
                    <input
                      type="text"
                      value={config.phone_mobile_1_intl}
                      onChange={(e) => handleChange("phone_mobile_1_intl", e.target.value)}
                      placeholder="+212664226790"
                      className="ps-input font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Mobile 2 */}
              <div className="ps-subbox">
                <div className="ps-subbox-header">
                  <Phone size={15} className="ps-subbox-header-icon" />
                  <span>Deuxième numéro mobile</span>
                </div>
                <div className="ps-grid-2">
                  <div className="ps-form-group">
                    <label className="ps-label">Téléphone Mobile 2 (Texte affiché)</label>
                    <input
                      type="text"
                      value={config.phone_mobile_2}
                      onChange={(e) => handleChange("phone_mobile_2", e.target.value)}
                      placeholder="06 64 33 14 63"
                      className="ps-input"
                    />
                  </div>
                  <div className="ps-form-group">
                    <label className="ps-label">Mobile 2 — Format d'appel (tel:+)</label>
                    <input
                      type="text"
                      value={config.phone_mobile_2_intl}
                      onChange={(e) => handleChange("phone_mobile_2_intl", e.target.value)}
                      placeholder="+212664331463"
                      className="ps-input font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Fixe */}
              <div className="ps-subbox">
                <div className="ps-subbox-header">
                  <Phone size={15} className="ps-subbox-header-icon" />
                  <span>Téléphone Fixe de l'agence</span>
                </div>
                <div className="ps-grid-2">
                  <div className="ps-form-group">
                    <label className="ps-label">Téléphone Fixe (Texte affiché)</label>
                    <input
                      type="text"
                      value={config.phone_fixe}
                      onChange={(e) => handleChange("phone_fixe", e.target.value)}
                      placeholder="05 22 20 02 39"
                      className="ps-input"
                    />
                  </div>
                  <div className="ps-form-group">
                    <label className="ps-label">Téléphone Fixe — Format d'appel (tel:+)</label>
                    <input
                      type="text"
                      value={config.phone_fixe_intl}
                      onChange={(e) => handleChange("phone_fixe_intl", e.target.value)}
                      placeholder="+212522200177"
                      className="ps-input font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* WhatsApp Principal */}
              <div className="ps-form-group" style={{ maxWidth: "480px" }}>
                <label className="ps-label">Numéro WhatsApp Principal</label>
                <input
                  type="text"
                  value={config.whatsapp_number}
                  onChange={(e) => handleChange("whatsapp_number", e.target.value)}
                  placeholder="+212664331463"
                  className="ps-input font-mono"
                />
                <p className="ps-hint">
                  Utilisé pour le bouton flottant WhatsApp en bas à droite et le lien direct wa.me.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Adresses E-mail */}
          <div className="ps-card" style={{ marginTop: "24px" }}>
            <div className="ps-card-header">
              <div className="ps-card-header-icon">
                <Mail size={20} />
              </div>
              <div>
                <h2 className="ps-card-title">Adresses E-mail</h2>
                <p className="ps-card-subtitle">Contact public et réception interne des messages</p>
              </div>
            </div>

            <div className="ps-card-body">
              <div className="ps-grid-2">
                <div className="ps-form-group">
                  <label className="ps-label">Email de Contact Public (Affiché sur le site)</label>
                  <input
                    type="email"
                    value={config.email_contact}
                    onChange={(e) => handleChange("email_contact", e.target.value)}
                    placeholder="contact@agencemenage.ma"
                    className="ps-input"
                  />
                  <p className="ps-hint">Visible dans le header, le footer et la page de contact.</p>
                </div>

                <div className="ps-form-group">
                  <label className="ps-label">Email de Réception des Notifications (Interne)</label>
                  <input
                    type="email"
                    value={config.email_notifications}
                    onChange={(e) => handleChange("email_notifications", e.target.value)}
                    placeholder="notification@agencemenage.ma"
                    className="ps-input"
                  />
                  <p className="ps-hint">Reçoit les demandes de contact, devis et formulaires du site.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Bureaux physiques & Google Maps */}
          <div className="ps-card" style={{ marginTop: "24px" }}>
            <div className="ps-card-header">
              <div className="ps-card-header-icon">
                <Building2 size={20} />
              </div>
              <div>
                <h2 className="ps-card-title">Bureaux & Adresses physiques</h2>
                <p className="ps-card-subtitle">Adresses et intégration de la carte interactive (Google Maps iframe)</p>
              </div>
            </div>

            <div className="ps-card-body">
              {/* Casablanca */}
              <div className="ps-subbox">
                <div className="ps-subbox-header">
                  <MapPin size={15} className="ps-subbox-header-icon" />
                  <span>Premier Bureau (Casablanca)</span>
                </div>

                <div className="ps-grid-2">
                  <div className="ps-form-group">
                    <label className="ps-label">Libellé du Bureau</label>
                    <input
                      type="text"
                      value={config.bureau_casa_label}
                      onChange={(e) => handleChange("bureau_casa_label", e.target.value)}
                      placeholder="Bureau Casablanca"
                      className="ps-input"
                    />
                  </div>

                  <div className="ps-form-group">
                    <label className="ps-label">Adresse Postale Complète</label>
                    <input
                      type="text"
                      value={config.bureau_casa_address}
                      onChange={(e) => handleChange("bureau_casa_address", e.target.value)}
                      placeholder="36 boulevard d’anfa, résidence Anafe A, etage 7"
                      className="ps-input"
                    />
                  </div>
                </div>

                <div className="ps-form-group">
                  <label className="ps-label">URL Google Maps Embed (iframe Casablanca)</label>
                  <textarea
                    rows={2}
                    value={config.bureau_casa_maps_url}
                    onChange={(e) => handleChange("bureau_casa_maps_url", e.target.value)}
                    placeholder="https://www.google.com/maps/embed?pb=..."
                    className="ps-textarea"
                  />
                  <p className="ps-hint">Lien d'intégration iframe Google Maps affiché dans l'onglet Casablanca.</p>
                </div>
              </div>

              {/* Rabat */}
              <div className="ps-subbox">
                <div className="ps-subbox-header">
                  <MapPin size={15} className="ps-subbox-header-icon" />
                  <span>Deuxième Bureau (Rabat)</span>
                </div>

                <div className="ps-grid-2">
                  <div className="ps-form-group">
                    <label className="ps-label">Libellé du Bureau</label>
                    <input
                      type="text"
                      value={config.bureau_rabat_label}
                      onChange={(e) => handleChange("bureau_rabat_label", e.target.value)}
                      placeholder="Bureau Rabat"
                      className="ps-input"
                    />
                  </div>

                  <div className="ps-form-group">
                    <label className="ps-label">Adresse Postale Complète</label>
                    <input
                      type="text"
                      value={config.bureau_rabat_address}
                      onChange={(e) => handleChange("bureau_rabat_address", e.target.value)}
                      placeholder="Avenue Hassan II, centre commercial Reda, porte G, appt. 49"
                      className="ps-input"
                    />
                  </div>
                </div>

                <div className="ps-form-group">
                  <label className="ps-label">URL Google Maps Embed (iframe Rabat)</label>
                  <textarea
                    rows={2}
                    value={config.bureau_rabat_maps_url}
                    onChange={(e) => handleChange("bureau_rabat_maps_url", e.target.value)}
                    placeholder="https://maps.google.com/maps?q=...&output=embed"
                    className="ps-textarea"
                  />
                  <p className="ps-hint">Lien d'intégration iframe Google Maps affiché dans l'onglet Rabat.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Réseaux Sociaux */}
          <div className="ps-card" style={{ marginTop: "24px" }}>
            <div className="ps-card-header">
              <div className="ps-card-header-icon">
                <Share2 size={20} />
              </div>
              <div>
                <h2 className="ps-card-title">Réseaux Sociaux</h2>
                <p className="ps-card-subtitle">Liens affichés dans le pied de page du site</p>
              </div>
            </div>

            <div className="ps-card-body">
              <div className="ps-form-group">
                <label className="ps-label">Page Facebook</label>
                <input
                  type="url"
                  value={config.facebook_url}
                  onChange={(e) => handleChange("facebook_url", e.target.value)}
                  placeholder="https://www.facebook.com/..."
                  className="ps-input"
                />
              </div>

              <div className="ps-form-group">
                <label className="ps-label">Compte Instagram</label>
                <input
                  type="url"
                  value={config.instagram_url}
                  onChange={(e) => handleChange("instagram_url", e.target.value)}
                  placeholder="https://www.instagram.com/..."
                  className="ps-input"
                />
              </div>

              <div className="ps-form-group">
                <label className="ps-label">Compte TikTok</label>
                <input
                  type="text"
                  value={config.tiktok_url}
                  onChange={(e) => handleChange("tiktok_url", e.target.value)}
                  placeholder="https://www.tiktok.com/@..."
                  className="ps-input"
                />
                <p className="ps-hint">Si laissé vide, l'icône TikTok sera automatiquement masquée dans le pied de page.</p>
              </div>
            </div>
          </div>

          {/* Section 5: Numéros WhatsApp internes */}
          <div className="ps-card" style={{ marginTop: "24px" }}>
            <div className="ps-card-header">
              <div className="ps-card-header-icon">
                <Bell size={20} />
              </div>
              <div>
                <h2 className="ps-card-title">Numéros WhatsApp de notification interne</h2>
                <p className="ps-card-subtitle">
                  Destinataires administratifs qui reçoivent les alertes lors d'une nouvelle réservation
                </p>
              </div>
            </div>

            <div className="ps-card-body">
              <div className="ps-tag-input-row" style={{ maxWidth: "480px" }}>
                <input
                  type="text"
                  value={newWaNumber}
                  onChange={(e) => setNewWaNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addWaNotificationNumber();
                    }
                  }}
                  placeholder="+2126XXXXXXXX"
                  className="ps-input font-mono"
                />
                <button
                  type="button"
                  onClick={addWaNotificationNumber}
                  className="ps-btn-secondary"
                >
                  <Plus size={15} />
                  Ajouter
                </button>
              </div>

              <div className="ps-tags-container">
                {(config.whatsapp_notification_numbers || []).map((num, idx) => (
                  <div key={idx} className="ps-tag">
                    <span>{num}</span>
                    <button
                      type="button"
                      onClick={() => removeWaNotificationNumber(idx)}
                      className="ps-tag-btn-remove"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {(!config.whatsapp_notification_numbers || config.whatsapp_notification_numbers.length === 0) && (
                  <p className="ps-hint" style={{ fontStyle: "italic" }}>
                    Aucun numéro enregistré pour les alertes WhatsApp.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Action inférieure */}
          <div className="ps-footer">
            <button
              type="submit"
              disabled={saving}
              className="ps-btn-primary"
              style={{ padding: "13px 28px", fontSize: "15px" }}
            >
              {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              {saving ? "Enregistrement en cours..." : "Enregistrer les modifications"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
