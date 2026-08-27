import React, { useState, useRef, useCallback } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Trash2, 
  ZoomIn, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ExternalLink, 
  RefreshCw
} from 'lucide-react';
import { uploadAirbnbPhoto } from '../../api/airbnb';

export interface AirbnbPhotoUploaderProps {
  label?: string;
  value?: string;
  onChange: (url: string) => void;
  category?: 'cloture' | 'bien' | 'objet_trouve' | 'incident' | 'linge' | 'general';
  required?: boolean;
  compact?: boolean;
  allowUrlInput?: boolean;
  placeholder?: string;
  helpText?: string;
  className?: string;
}

export const AirbnbPhotoUploader: React.FC<AirbnbPhotoUploaderProps> = ({
  label,
  value,
  onChange,
  category = 'general',
  required = false,
  compact = false,
  allowUrlInput = true,
  placeholder = 'Glissez une photo ici ou cliquez pour parcourir...',
  helpText,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlDraft, setUrlDraft] = useState(value || '');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync draft URL when value changes
  React.useEffect(() => {
    setUrlDraft(value || '');
  }, [value]);

  const handleUploadFile = async (file: File) => {
    // Check type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|pdf)$/i)) {
      setUploadError('Format non supporté. Veuillez sélectionner une image (JPG, PNG, WEBP, HEIC).');
      return;
    }

    // Check size (max 15MB)
    if (file.size > 15 * 1024 * 1024) {
      setUploadError(`Fichier trop lourd (${(file.size / (1024 * 1024)).toFixed(1)} Mo). Max 15 Mo.`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const res = await uploadAirbnbPhoto(file, category);
      if (res.data && res.data.url) {
        onChange(res.data.url);
      } else {
        throw new Error('Réponse serveur invalide');
      }
    } catch (err: any) {
      console.error('Erreur téléversement photo:', err);
      const errMsg = err.response?.data?.error || err.message || 'Erreur lors du téléversement vers le stockage';
      setUploadError(errMsg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUploadFile(e.target.files[0]);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUploadFile(e.dataTransfer.files[0]);
    }
  }, [category]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setUploadError(null);
  };

  const handleApplyUrl = () => {
    onChange(urlDraft.trim());
    setUploadError(null);
  };

  const previewUrl = value || '';

  return (
    <div className={`airbnb-photo-uploader ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Header with Label and Mode Toggle */}
      {(label || allowUrlInput) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
          {label && (
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {label}
              {required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
          )}

          {allowUrlInput && !value && (
            <div style={{ display: 'flex', gap: '2px', background: '#f1f5f9', padding: '2px', borderRadius: '6px' }}>
              <button
                type="button"
                onClick={() => setMode('upload')}
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: '4px',
                  border: 'none',
                  background: mode === 'upload' ? '#ffffff' : 'transparent',
                  color: mode === 'upload' ? '#00473e' : '#64748b',
                  boxShadow: mode === 'upload' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <UploadCloud size={12} /> Téléverser
              </button>
              <button
                type="button"
                onClick={() => setMode('url')}
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: '4px',
                  border: 'none',
                  background: mode === 'url' ? '#ffffff' : 'transparent',
                  color: mode === 'url' ? '#00473e' : '#64748b',
                  boxShadow: mode === 'url' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <LinkIcon size={12} /> URL
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Main Upload Box / Preview */}
      {previewUrl ? (
        /* Image Preview Box */
        <div
          style={{
            position: 'relative',
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1.5px solid #cbd5e1',
            background: '#0f172a',
            height: compact ? '110px' : '150px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <img
            src={previewUrl}
            alt={label || 'Photo'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />

          {/* Action Overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.4) 100%)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '8px'
            }}
          >
            {/* Top Bar of Overlay */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#ffffff',
                  background: 'rgba(0,71,62,0.85)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <CheckCircle2 size={12} color="#4ade80" /> Stocké
              </span>

              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(true)}
                  title="Agrandir la photo"
                  style={{
                    background: 'rgba(255,255,255,0.9)',
                    border: 'none',
                    borderRadius: '6px',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#0f172a'
                  }}
                >
                  <ZoomIn size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  title="Supprimer la photo"
                  style={{
                    background: 'rgba(239,68,68,0.9)',
                    border: 'none',
                    borderRadius: '6px',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#ffffff'
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Bottom Bar: Replace Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'rgba(255,255,255,0.9)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '3px 8px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={12} /> Remplacer
              </button>

              <span
                style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.8)',
                  maxWidth: '160px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {previewUrl.split('/').pop()}
              </span>
            </div>
          </div>
        </div>
      ) : mode === 'upload' ? (
        /* Drag & Drop Upload Zone */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          style={{
            border: isDragging ? '2px dashed #00473e' : '2px dashed #cbd5e1',
            background: isDragging ? '#e6f2f0' : isUploading ? '#f8fafc' : '#f8fafc',
            borderRadius: '10px',
            padding: compact ? '14px 10px' : '20px 16px',
            textAlign: 'center',
            cursor: isUploading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            minHeight: compact ? '110px' : '140px'
          }}
        >
          {isUploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={24} className="animate-spin" color="#00473e" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#00473e' }}>
                Téléversement vers le bucket Railway...
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Stockage physique en cours</span>
            </div>
          ) : (
            <>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: isDragging ? '#00473e' : '#e2e8f0',
                  color: isDragging ? '#ffffff' : '#00473e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
              >
                <UploadCloud size={20} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                  {placeholder}
                </p>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  JPG, PNG, WEBP ou HEIC (Max 15 Mo)
                </p>
              </div>
            </>
          )}
        </div>
      ) : (
        /* Manual URL Input Mode */
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="url"
            placeholder="https://..."
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            className="cb-form-input"
            style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }}
          />
          <button
            type="button"
            onClick={handleApplyUrl}
            className="cb-btn-primary"
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            Valider
          </button>
        </div>
      )}

      {/* Error Message */}
      {uploadError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontSize: '0.775rem', marginTop: '2px' }}>
          <AlertCircle size={14} />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Help text */}
      {helpText && !uploadError && (
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{helpText}</span>
      )}

      {/* Full-Screen Lightbox Modal */}
      {isLightboxOpen && previewUrl && (
        <div
          onClick={() => setIsLightboxOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: '#0f172a',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Lightbox Header */}
            <div
              style={{
                padding: '12px 16px',
                background: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#ffffff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ImageIcon size={16} color="#00473e" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  {label || 'Visualisation de la photo'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  style={{
                    color: '#94a3b8',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                    borderRadius: '4px'
                  }}
                  title="Ouvrir dans un nouvel onglet"
                >
                  <ExternalLink size={16} />
                </a>
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Lightbox Body Image */}
            <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }}>
              <img
                src={previewUrl}
                alt={label || 'Plein écran'}
                style={{
                  maxWidth: '85vw',
                  maxHeight: '75vh',
                  objectFit: 'contain',
                  borderRadius: '6px'
                }}
              />
            </div>

            {/* Lightbox Footer */}
            <div
              style={{
                padding: '10px 16px',
                background: '#1e293b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.75rem',
                color: '#94a3b8'
              }}
            >
              <span>Emplacement : {previewUrl}</span>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="cb-btn-secondary"
                style={{ padding: '4px 12px', fontSize: '0.75rem' }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
