import React from 'react';
import { Demande } from '../types';

interface FormulaireRecapProps {
  demande: Demande;
}

export const FormulaireRecap: React.FC<FormulaireRecapProps> = ({ demande }) => {
  const data = demande.formulaire_data || {};

  return (
    <div id="recap-container" className="bg-white text-slate-800 relative" style={{ width: '800px', minHeight: '1000px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="bg-[#008080] p-6 text-white mb-8">
        <h1 className="text-3xl font-bold">Agence Ménage</h1>
        <p className="text-sm opacity-90">Récapitulatif de réservation</p>
      </div>

      <div className="px-10 space-y-10">
        {/* Client Section */}
        <div className="bg-[#f8f8f8] p-6 rounded-sm">
          <h2 className="text-lg font-bold text-slate-700 mb-4 border-b border-slate-200 pb-2">Client</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p><span className="text-slate-500">Nom:</span> <span className="font-medium">{demande.client_name || data.nom || '—'}</span></p>
              <p><span className="text-slate-500">Téléphone:</span> <span className="font-medium">{demande.client_phone || data.whatsapp_phone || '—'}</span></p>
            </div>
            <div>
              <p><span className="text-slate-500">Adresse:</span> <span className="font-medium">{data.ville || demande.client_city || 'Casablanca'}</span></p>
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div>
          <h2 className="bg-[#008080] text-white px-4 py-2 text-sm font-bold uppercase tracking-wider mb-0">Détails de la prestation</h2>
          <div className="border-x border-b border-slate-100">
            <div className="grid grid-cols-2 border-b border-slate-50 p-3 text-sm bg-white">
              <span className="font-bold text-slate-600">Service</span>
              <span>{demande.service}</span>
            </div>
            <div className="grid grid-cols-2 border-b border-slate-50 p-3 text-sm bg-slate-50/50">
              <span className="font-bold text-slate-600">Segment</span>
              <span className="capitalize">{demande.segment}</span>
            </div>
            <div className="grid grid-cols-2 border-b border-slate-50 p-3 text-sm bg-white">
              <span className="font-bold text-slate-600">Intervenants</span>
              <span>{data.nb_intervenants || 1}</span>
            </div>
            <div className="grid grid-cols-2 p-3 text-sm bg-slate-50/50">
              <span className="font-bold text-slate-600">Fréquence</span>
              <span>{demande.frequency_label || 'Ponctuel'}</span>
            </div>
          </div>
        </div>

        {/* Total Section */}
        <div className="flex justify-end">
          <div className="bg-[#008080] text-white px-8 py-4 min-w-[300px] text-right">
            <h3 className="text-2xl font-bold">Total: {demande.prix ? `${demande.prix} MAD` : 'Sur devis'}</h3>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 w-full bg-[#e5e5e5] p-2 text-center text-[10px] text-slate-500 flex justify-between px-10">
        <span>Agence Ménage — {new Date().toLocaleDateString('fr-FR')} — www.agencemenage.ma</span>
      </div>
    </div>
  );
};
