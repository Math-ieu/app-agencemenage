import React from 'react';
import { FileText, DollarSign, Send } from 'lucide-react';
import { Demande } from '../../types';

export interface SubscriptionStatusBarProps {
  latest: Demande;
  statutMoisEnCours: string;
  statutMoisProchain: string;
  statutFacturation: string;
  onMoisProchainChange: (val: string) => void;
  onFacturationChange: (val: string) => void;
  onGenerateInvoice: () => void;
  onOpenInvoiceModal: () => void;
  onSendInvoice: () => void;
  onSavePlanning?: () => void;
  savingPlanning?: boolean;
}

export const SubscriptionStatusBar: React.FC<SubscriptionStatusBarProps> = ({
  latest: _latest,
  statutMoisEnCours,
  statutMoisProchain,
  statutFacturation,
  onMoisProchainChange,
  onFacturationChange,
  onGenerateInvoice,
  onOpenInvoiceModal,
  onSendInvoice
}) => {
  return (
    <div
      className="sub-status-bar"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
        gap: 16,
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '14px 18px'
      }}
    >
      {/* 3 Status Dropdowns */}
      <div className="sub-status-dropdowns" style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        {/* 1. MOIS EN COURS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            MOIS EN COURS
          </span>
          <select
            value={statutMoisEnCours}
            disabled
            title="Statut défini automatiquement par le système et ne peut pas être modifié manuellement."
            style={{ padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#475569', background: '#f1f5f9', cursor: 'not-allowed', outline: 'none', height: 36 }}
          >
            <option value="Actif">Actif</option>
            <option value="Terminé">Terminé</option>
            <option value="Suspendu">Suspendu</option>
            <option value="Résilié">Résilié</option>
          </select>
        </div>

        {/* 2. MOIS PROCHAIN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            MOIS PROCHAIN
          </span>
          <select
            value={statutMoisProchain}
            onChange={e => onMoisProchainChange(e.target.value)}
            style={{ padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#0f172a', background: 'white', cursor: 'pointer', outline: 'none', height: 36 }}
          >
            <option value="Non défini">Non défini</option>
            <option value="Actif">Actif</option>
            <option value="Facture envoyée">Facture envoyée</option>
            <option value="1er rappel">1er rappel</option>
            <option value="2e rappel">2e rappel</option>
            <option value="Suspendu">Suspendu</option>
            <option value="Stand-by">Stand-by</option>
            <option value="Résilié">Résilié</option>
          </select>
        </div>

        {/* 3. STATUT FACTURATION */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            STATUT FACTURATION
          </span>
          <select
            value={statutFacturation}
            onChange={e => onFacturationChange(e.target.value)}
            style={{ padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 13, fontWeight: 700, color: statutFacturation === 'Payé' ? '#15803d' : '#b45309', background: statutFacturation === 'Payé' ? '#f0fdf4' : '#fffbeb', cursor: 'pointer', outline: 'none', height: 36 }}
          >
            <option value="Non défini">Non défini</option>
            <option value="Facture générée">Facture générée</option>
            <option value="En attente">En attente</option>
            <option value="Payé">Payé</option>
            <option value="Non payé">Non payé</option>
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="sub-status-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={onGenerateInvoice} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, padding: '0 14px', height: 36, fontSize: 13, fontWeight: 600, color: '#037265', cursor: 'pointer' }}>
          <FileText size={15} /> Générer facture
        </button>
        <button type="button" onClick={onOpenInvoiceModal} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, padding: '0 14px', height: 36, fontSize: 13, fontWeight: 600, color: '#034a3e', cursor: 'pointer' }}>
          <DollarSign size={15} /> Formulaire facture
        </button>
        <button type="button" onClick={onSendInvoice} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, padding: '0 14px', height: 36, fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
          <Send size={15} /> Envoyer facture
        </button>
      </div>
    </div>
  );
};
