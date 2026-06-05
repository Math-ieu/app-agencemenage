import { useRef, useCallback, useState, useEffect } from "react";
import { Eye, Send } from "lucide-react";
import AirbnbQuote from "./AirbnbQuote";
import ChantierQuote from "./ChantierQuote";
import AuxvieQuote from "./AuxvieQuote";
import SinistreQuote from "./SinistreQuote";
import BureauxQuote from "./BureauxQuote";
import PlacementQuote from "./PlacementQuote";
import { fmt, Field, s } from "./QuoteShared";

export interface QuotePrestationLine {
  designation: string;
  montant: number | string;
  isReduction?: boolean;
  isMajoration?: boolean;
}

interface QuoteSectionProps {
  demande: any;
  onPreview: (demande: any, type: 'devis' | 'png') => void;
  onSend: (demande: any, type: 'devis' | 'png') => void;
  formData?: any;
  setFormData?: (data: any) => void;
  onUpdateDemandeData?: (demandeId: number, patch: Record<string, any>) => void;
}

export default function QuoteSection({ demande, onPreview, onSend, formData, setFormData, onUpdateDemandeData }: QuoteSectionProps) {
  const service = (demande.service || "").toLowerCase();
  const isDevis = demande.segment === 'entreprise' || 
    service.includes('air bnb') || service.includes('airbnb') || 
    service.includes('sinistre') || service.includes('auxiliaire') || 
    service.includes('chantier') || service.includes('placement') || service.includes('gestion');
  
  const type = isDevis ? 'devis' : 'png';

  // Store the latest prestations from the calculator
  const prestationsRef = useRef<QuotePrestationLine[]>([]);
  const totalRef = useRef<number>(0);
  const extraDataRef = useRef<Record<string, any>>({});

  const data = demande.formulaire_data || {};
  
  // State for AVANCE REQUISE
  const [avanceActive, setAvanceActive] = useState<boolean>(Boolean(data.avance_active));
  const [avanceType, setAvanceType] = useState<'pourcentage' | 'fixe'>(data.avance_type || 'pourcentage');
  const [avancePourcentage, setAvancePourcentage] = useState<number>(data.avance_pourcentage !== undefined ? Number(data.avance_pourcentage) : 30);
  const [avanceFixe, setAvanceFixe] = useState<number>(data.avance_fixe !== undefined ? Number(data.avance_fixe) : 0);

  // Sync state when switching demandes
  useEffect(() => {
    const freshData = demande.formulaire_data || {};
    setAvanceActive(Boolean(freshData.avance_active));
    setAvanceType(freshData.avance_type || 'pourcentage');
    setAvancePourcentage(freshData.avance_pourcentage !== undefined ? Number(freshData.avance_pourcentage) : 30);
    setAvanceFixe(freshData.avance_fixe !== undefined ? Number(freshData.avance_fixe) : 0);
  }, [demande.id]);

  // Helper to trigger database update
  const triggerUpdate = (
    active: boolean,
    type: 'pourcentage' | 'fixe',
    pct: number,
    fixe: number
  ) => {
    if (!onUpdateDemandeData) return;
    
    const totalDevis = totalRef.current || Number(demande.prix || 0);
    let calculatedAmount = 0;
    if (active) {
      if (type === 'pourcentage') {
        calculatedAmount = Math.round((totalDevis * pct) / 100);
      } else {
        calculatedAmount = fixe;
      }
    }
    
    onUpdateDemandeData(demande.id, {
      avance_active: active,
      avance_type: type,
      avance_pourcentage: pct,
      avance_fixe: fixe,
      avance_paiement: calculatedAmount
    });
  };

  const handleAvanceActiveChange = (val: boolean) => {
    setAvanceActive(val);
    triggerUpdate(val, avanceType, avancePourcentage, avanceFixe);
  };

  const handleAvanceTypeChange = (val: 'pourcentage' | 'fixe') => {
    setAvanceType(val);
    triggerUpdate(avanceActive, val, avancePourcentage, avanceFixe);
  };

  const handleAvancePourcentageChange = (val: number) => {
    setAvancePourcentage(val);
    triggerUpdate(avanceActive, avanceType, val, avanceFixe);
  };

  const handleAvanceFixeChange = (val: number) => {
    setAvanceFixe(val);
    triggerUpdate(avanceActive, avanceType, avancePourcentage, val);
  };

  const handlePrestationsChange = useCallback((
    prestations: QuotePrestationLine[],
    total: number,
    extraData?: Record<string, any>
  ) => {
    let hasChanged = total !== totalRef.current;
    
    if (JSON.stringify(prestationsRef.current) !== JSON.stringify(prestations)) {
      hasChanged = true;
    }
    prestationsRef.current = prestations;

    if (extraData) {
      if (JSON.stringify(extraDataRef.current) !== JSON.stringify(extraData)) {
        hasChanged = true;
      }
      extraDataRef.current = extraData;
    }
    totalRef.current = total;

    if (hasChanged && onUpdateDemandeData) {
      // Calculate advance amount based on new total
      let calculatedAmount = 0;
      if (avanceActive) {
        if (avanceType === 'pourcentage') {
          calculatedAmount = Math.round((total * avancePourcentage) / 100);
        } else {
          calculatedAmount = avanceFixe;
        }
      }

      onUpdateDemandeData(demande.id, { 
        ...extraData, 
        montant: total,
        total: total,
        prestations: prestations.length > 0 ? prestations : undefined,
        avance_active: avanceActive,
        avance_type: avanceType,
        avance_pourcentage: avancePourcentage,
        avance_fixe: avanceFixe,
        avance_paiement: calculatedAmount
      });
    }
  }, [demande.id, onUpdateDemandeData, avanceActive, avanceType, avancePourcentage, avanceFixe]);

  const handlePreview = () => {
    const totalDevis = totalRef.current || Number(demande.prix || 0);
    let avanceMontant = 0;
    if (avanceActive) {
      if (avanceType === 'pourcentage') {
        avanceMontant = Math.round((totalDevis * avancePourcentage) / 100);
      } else {
        avanceMontant = avanceFixe;
      }
    }
    // Inject the calculator prestations into the demande before preview
    const enrichedDemande = {
      ...demande,
      prix: totalDevis,
      formulaire_data: {
        ...(demande.formulaire_data || {}),
        ...extraDataRef.current,
        prestations: prestationsRef.current.length > 0 ? prestationsRef.current : undefined,
        total: totalDevis || undefined,
        avance_active: avanceActive,
        avance_type: avanceType,
        avance_pourcentage: avancePourcentage,
        avance_fixe: avanceFixe,
        avance_paiement: avanceMontant,
      },
    };
    onPreview(enrichedDemande, type);
  };

  const handleSend = () => {
    const totalDevis = totalRef.current || Number(demande.prix || 0);
    let avanceMontant = 0;
    if (avanceActive) {
      if (avanceType === 'pourcentage') {
        avanceMontant = Math.round((totalDevis * avancePourcentage) / 100);
      } else {
        avanceMontant = avanceFixe;
      }
    }
    const enrichedDemande = {
      ...demande,
      prix: totalDevis,
      formulaire_data: {
        ...(demande.formulaire_data || {}),
        ...extraDataRef.current,
        prestations: prestationsRef.current.length > 0 ? prestationsRef.current : undefined,
        total: totalDevis || undefined,
        avance_active: avanceActive,
        avance_type: avanceType,
        avance_pourcentage: avancePourcentage,
        avance_fixe: avanceFixe,
        avance_paiement: avanceMontant,
      },
    };
    onSend(enrichedDemande, type);
  };

  const getComponent = () => {
    if (service.includes("air bnb") || service.includes("airbnb")) return <AirbnbQuote demande={demande} onPrestationsChange={handlePrestationsChange} formData={formData} setFormData={setFormData} onUpdateDemandeData={patch => onUpdateDemandeData?.(demande.id, patch)} />;
    if (service.includes("chantier")) return <ChantierQuote demande={demande} onPrestationsChange={handlePrestationsChange} />;
    if (service.includes("auxiliaire")) return <AuxvieQuote demande={demande} onPrestationsChange={handlePrestationsChange} />;
    if (service.includes("sinistre")) return <SinistreQuote demande={demande} onPrestationsChange={handlePrestationsChange} />;
    if (service.includes("bureaux")) return <BureauxQuote demande={demande} onPrestationsChange={handlePrestationsChange} />;
    if (service.includes("placement") || service.includes("gestion")) return <PlacementQuote demande={demande} onPrestationsChange={handlePrestationsChange} />;
    return null;
  };

  const component = getComponent();
  if (!component) return null;

  const totalDevis = totalRef.current || Number(demande.prix || 0);
  let avanceMontant = 0;
  if (avanceActive) {
    if (avanceType === 'pourcentage') {
      avanceMontant = Math.round((totalDevis * avancePourcentage) / 100);
    } else {
      avanceMontant = avanceFixe;
    }
  }
  const soldeRestant = Math.max(0, totalDevis - avanceMontant);

  return (
    <div className="quote-section-card" style={{ marginTop: 12, borderTop: "1px dashed var(--border-color)", paddingTop: 12 }}>
      {component}

      {/* ── Avance requise section ── */}
      <div style={{ marginTop: 16, borderTop: "1px dashed var(--border-color)", paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.05em" }}>AVANCE REQUISE</span>
          <div style={{ display: "flex", border: "1px solid var(--border-color)", borderRadius: 6, overflow: "hidden", background: "#f8fafc" }}>
            <button 
              type="button" 
              onClick={() => handleAvanceActiveChange(false)}
              style={{ 
                padding: "4px 16px", 
                fontSize: 12, 
                fontWeight: 600, 
                border: "none", 
                cursor: "pointer", 
                transition: "all 0.15s", 
                background: !avanceActive ? "#2563EB" : "transparent", 
                color: !avanceActive ? "white" : "#475569" 
              }}
            >
              Non
            </button>
            <button 
              type="button" 
              onClick={() => handleAvanceActiveChange(true)}
              style={{ 
                padding: "4px 16px", 
                fontSize: 12, 
                fontWeight: 600, 
                border: "none", 
                cursor: "pointer", 
                transition: "all 0.15s", 
                background: avanceActive ? "#2563EB" : "transparent", 
                color: avanceActive ? "white" : "#475569" 
              }}
            >
              Oui
            </button>
          </div>
        </div>

        {avanceActive && (
          <div style={{ animation: "fadeIn 0.2s ease" }}>
            <div style={{ display: "flex", border: "1px solid var(--border-color)", borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
              <button 
                type="button" 
                onClick={() => handleAvanceTypeChange('pourcentage')}
                style={{ 
                  flex: 1, 
                  padding: "8px 6px", 
                  fontSize: 11, 
                  fontWeight: 600, 
                  border: "none", 
                  cursor: "pointer", 
                  transition: "all 0.15s", 
                  background: avanceType === 'pourcentage' ? "#2563EB" : "#f8fafc", 
                  color: avanceType === 'pourcentage' ? "white" : "#475569" 
                }}
              >
                En pourcentage (%)
              </button>
              <button 
                type="button" 
                onClick={() => handleAvanceTypeChange('fixe')}
                style={{ 
                  flex: 1, 
                  padding: "8px 6px", 
                  fontSize: 11, 
                  fontWeight: 600, 
                  border: "none", 
                  cursor: "pointer", 
                  transition: "all 0.15s", 
                  background: avanceType === 'fixe' ? "#2563EB" : "#f8fafc", 
                  color: avanceType === 'fixe' ? "white" : "#475569" 
                }}
              >
                Montant fixe (DH)
              </button>
            </div>

            {avanceType === 'pourcentage' ? (
              <Field label="Pourcentage du devis (%)">
                <input 
                  type="number" 
                  value={avancePourcentage} 
                  onChange={e => handleAvancePourcentageChange(Number(e.target.value))} 
                  style={s.input as any} 
                />
              </Field>
            ) : (
              <Field label="Montant de l'avance (DH)">
                <input 
                  type="number" 
                  value={avanceFixe} 
                  onChange={e => handleAvanceFixeChange(Number(e.target.value))} 
                  style={s.input as any} 
                />
              </Field>
            )}

            <div style={{ background: "#2563EB", color: "white", borderRadius: 8, padding: "12px 16px", marginTop: 12, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span>Montant total du devis</span>
                <strong>{fmt(totalDevis)} DH</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span>Avance requise {avanceType === 'pourcentage' ? `(${avancePourcentage}%)` : ''}</span>
                <strong>{fmt(avanceMontant)} DH</strong>
              </div>
              <hr style={{ borderColor: "rgba(255,255,255,0.2)", margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>Solde restant à payer</span>
                <strong>{fmt(soldeRestant)} DH</strong>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button 
          onClick={handlePreview}
          style={{ 
            flex: 1, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: 6, 
            padding: "8px 12px", 
            background: "#f1f5f9", 
            border: "1px solid #e2e8f0", 
            borderRadius: 6, 
            fontSize: 12, 
            fontWeight: 600, 
            color: "#475569", 
            cursor: "pointer" 
          }}
        >
          <Eye size={14} /> Aperçu {isDevis ? "Devis" : "Récap"}
        </button>
        <button 
          onClick={handleSend}
          style={{ 
            flex: 1, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: 6, 
            padding: "8px 12px", 
            background: "var(--primary)", 
            border: "none", 
            borderRadius: 6, 
            fontSize: 12, 
            fontWeight: 600, 
            color: "white", 
            cursor: "pointer" 
          }}
        >
          <Send size={14} /> Envoyer Client
        </button>
      </div>
    </div>
  );
}
