import { useRef, useCallback } from "react";
import { Eye, Send } from "lucide-react";
import AirbnbQuote from "./AirbnbQuote";
import ChantierQuote from "./ChantierQuote";
import AuxvieQuote from "./AuxvieQuote";
import SinistreQuote from "./SinistreQuote";
import BureauxQuote from "./BureauxQuote";
import PlacementQuote from "./PlacementQuote";

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
}

export default function QuoteSection({ demande, onPreview, onSend }: QuoteSectionProps) {
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

  const handlePrestationsChange = useCallback((
    prestations: QuotePrestationLine[],
    total: number,
    extraData?: Record<string, any>
  ) => {
    prestationsRef.current = prestations;
    totalRef.current = total;
    if (extraData) extraDataRef.current = extraData;
  }, []);

  const handlePreview = () => {
    // Inject the calculator prestations into the demande before preview
    const enrichedDemande = {
      ...demande,
      prix: totalRef.current || demande.prix,
      formulaire_data: {
        ...(demande.formulaire_data || {}),
        ...extraDataRef.current,
        prestations: prestationsRef.current.length > 0 ? prestationsRef.current : undefined,
        total: totalRef.current || undefined,
      },
    };
    onPreview(enrichedDemande, type);
  };

  const handleSend = () => {
    const enrichedDemande = {
      ...demande,
      prix: totalRef.current || demande.prix,
      formulaire_data: {
        ...(demande.formulaire_data || {}),
        ...extraDataRef.current,
        prestations: prestationsRef.current.length > 0 ? prestationsRef.current : undefined,
        total: totalRef.current || undefined,
      },
    };
    onSend(enrichedDemande, type);
  };

  const getComponent = () => {
    if (service.includes("air bnb") || service.includes("airbnb")) return <AirbnbQuote demande={demande} onPrestationsChange={handlePrestationsChange} />;
    if (service.includes("chantier")) return <ChantierQuote demande={demande} onPrestationsChange={handlePrestationsChange} />;
    if (service.includes("auxiliaire")) return <AuxvieQuote demande={demande} onPrestationsChange={handlePrestationsChange} />;
    if (service.includes("sinistre")) return <SinistreQuote demande={demande} onPrestationsChange={handlePrestationsChange} />;
    if (service.includes("bureaux")) return <BureauxQuote demande={demande} onPrestationsChange={handlePrestationsChange} />;
    if (service.includes("placement") || service.includes("gestion")) return <PlacementQuote demande={demande} onPrestationsChange={handlePrestationsChange} />;
    return null;
  };

  const component = getComponent();
  if (!component) return null;

  return (
    <div className="quote-section-card" style={{ marginTop: 12, borderTop: "1px dashed var(--border-color)", paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: "var(--text-main)" }}>
        <div style={{ width: 4, height: 16, background: "var(--primary)", borderRadius: 2 }}></div>
        <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>Estimation Devis Interne</h4>
      </div>
      
      {component}

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
