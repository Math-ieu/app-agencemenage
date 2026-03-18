import React, { useState } from 'react';
import { Demande } from '../types';

interface DevisPreviewProps {
  demande: Demande;
}

export const DevisPreview: React.FC<DevisPreviewProps> = ({ demande }) => {
  const data = demande.formulaire_data || {};
  
  // Champs modifiables par le commercial
  const [dateDevis, setDateDevis] = useState(new Date().toISOString().split('T')[0]);
  const [validite, setValidite] = useState('30 jours');
  const [descriptionTarif, setDescriptionTarif] = useState(
    `Prestation de ${demande.service} - ${data.type_habitation || data.structure_type || 'Sur mesure'}`
  );
  const [tarifUnitaire, setTarifUnitaire] = useState(demande.prix || 0);
  const [fraisDeplacement, setFraisDeplacement] = useState(0);
  const [remise, setRemise] = useState(0);

  const tva = 0.20; // 20% TVA default
  
  const sstotal = Number(tarifUnitaire) + Number(fraisDeplacement) - Number(remise);
  const montantTva = sstotal * tva;
  const totalTTC = sstotal + montantTva;

  return (
    <div className="flex gap-6">
      <div className="w-1/3 bg-slate-50 p-4 border rounded shadow-sm flex flex-col gap-4">
        <h3 className="font-bold text-teal-800 border-b pb-2">Informations Devis</h3>
        
        <div className="form-group">
          <label className="text-sm font-semibold">Date du devis</label>
          <input 
            type="date" 
            className="w-full border rounded px-3 py-2 text-sm" 
            value={dateDevis} 
            onChange={(e) => setDateDevis(e.target.value)} 
          />
        </div>
        
        <div className="form-group">
          <label className="text-sm font-semibold">Validité de l'offre</label>
          <input 
            type="text" 
            className="w-full border rounded px-3 py-2 text-sm" 
            value={validite} 
            onChange={(e) => setValidite(e.target.value)} 
          />
        </div>

        <div className="form-group">
          <label className="text-sm font-semibold">Description de la ligne tarifaire</label>
          <textarea 
            className="w-full border rounded px-3 py-2 text-sm" 
            rows={2}
            value={descriptionTarif} 
            onChange={(e) => setDescriptionTarif(e.target.value)} 
          />
        </div>
        
        <div className="form-group">
          <label className="text-sm font-semibold">Tarif de base (HT)</label>
          <div className="flex align-center gap-2">
            <input 
              type="number" 
              className="w-full border rounded px-3 py-2 text-sm" 
              value={tarifUnitaire} 
              onChange={(e) => setTarifUnitaire(Number(e.target.value))} 
            />
            <span className="py-2 text-slate-500">MAD</span>
          </div>
        </div>

        <div className="form-group flex justify-between gap-4">
          <div className="w-1/2">
            <label className="text-sm font-semibold">Frais Déplacement</label>
            <input 
              type="number" 
              className="w-full border rounded px-3 py-2 text-sm" 
              value={fraisDeplacement} 
              onChange={(e) => setFraisDeplacement(Number(e.target.value))} 
            />
          </div>
          <div className="w-1/2">
            <label className="text-sm font-semibold">Remise</label>
            <input 
              type="number" 
              className="w-full border rounded px-3 py-2 text-sm" 
              value={remise} 
              onChange={(e) => setRemise(Number(e.target.value))} 
            />
          </div>
        </div>
      </div>

      <div className="w-2/3 max-h-[70vh] overflow-y-auto border shadow-sm rounded">
        {/* Zone capturée par html2canvas */}
        <div id="devis-container" className="bg-white p-8 text-slate-800" style={{ width: '800px', minHeight: '1120px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
          
          <div className="flex justify-between items-start mb-12">
            <div>
              <h1 className="text-3xl font-extrabold text-teal-800 tracking-tight">DEVIS</h1>
              <p className="text-slate-500 mt-1 font-medium">N° D-{demande.id.toString().padStart(5, '0')}</p>
            </div>
            <div className="text-right">
              {/* Fake Logo Place */}
              <div className="inline-block bg-teal-800 text-white font-bold px-4 py-2 rounded mb-2">AGENCE MENAGE</div>
              <p className="text-sm text-slate-600">contact@agencemenage.ma</p>
              <p className="text-sm text-slate-600">+212 6 00 00 00 00</p>
              <p className="text-sm text-slate-600">Casablanca, Maroc</p>
            </div>
          </div>

          <div className="flex justify-between mb-12">
            <div className="w-1/2">
              <h3 className="font-bold text-slate-400 uppercase text-xs tracking-wider mb-2">Détails du document</h3>
              <p className="text-sm"><span className="font-semibold w-24 inline-block">Date :</span> {new Date(dateDevis).toLocaleDateString('fr-FR')}</p>
              <p className="text-sm"><span className="font-semibold w-24 inline-block">Validité :</span> {validite}</p>
              <p className="text-sm mt-3"><span className="font-semibold w-24 inline-block">Statut :</span> {demande.statut}</p>
            </div>
            
            <div className="w-1/2 bg-slate-50 p-4 rounded border border-slate-100">
              <h3 className="font-bold text-slate-400 uppercase text-xs tracking-wider mb-2">Devis pour :</h3>
              <p className="font-bold text-lg text-teal-900">{demande.client_name || data.nom}</p>
              <p className="text-sm text-slate-600 mt-1">{data.adresse}</p>
              <p className="text-sm text-slate-600">{data.quartier}, {data.ville || demande.client_city}</p>
              <p className="text-sm text-slate-600 mt-2 font-medium">Tél: {demande.client_phone || data.whatsapp_phone}</p>
            </div>
          </div>

          <table className="w-full mb-8 text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-800 text-sm">
                <th className="py-3 px-2 w-[55%]">Description</th>
                <th className="py-3 px-2 w-[15%] text-center">Quantité/Fréq.</th>
                <th className="py-3 px-2 w-[15%] text-right">Prix rés. (MAD)</th>
                <th className="py-3 px-2 w-[15%] text-right">Total HT (MAD)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200 text-sm">
                <td className="py-4 px-2">
                  <p className="font-bold text-slate-800">{descriptionTarif}</p>
                  <ul className="text-xs text-slate-500 mt-1 list-disc list-inside">
                    {data.surface ? <li>Surface: {data.surface}m²</li> : null}
                    {data.duree ? <li>Durée estimée: {data.duree}h</li> : null}
                    {data.nb_intervenants ? <li>Intervenants: {data.nb_intervenants}</li> : null}
                    {data.nb_personnel ? <li>Personnel: {data.nb_personnel}</li> : null}
                  </ul>
                </td>
                <td className="py-4 px-2 text-center text-slate-700">{demande.frequency_label || 1}</td>
                <td className="py-4 px-2 text-right text-slate-700">{tarifUnitaire.toString()}</td>
                <td className="py-4 px-2 text-right font-semibold">{tarifUnitaire.toString()}</td>
              </tr>
              {data.produits && (
                <tr className="border-b border-slate-200 text-sm">
                  <td className="py-4 px-2 text-slate-600">Produits de nettoyage</td>
                  <td className="py-4 px-2 text-center text-slate-700">1</td>
                  <td className="py-4 px-2 text-right text-slate-700">90</td>
                  <td className="py-4 px-2 text-right font-semibold">90</td>
                </tr>
              )}
              {data.torchons && (
                <tr className="border-b border-slate-200 text-sm">
                  <td className="py-4 px-2 text-slate-600">Torchons et serpillères</td>
                  <td className="py-4 px-2 text-center text-slate-700">1</td>
                  <td className="py-4 px-2 text-right text-slate-700">40</td>
                  <td className="py-4 px-2 text-right font-semibold">40</td>
                </tr>
              )}
              {fraisDeplacement > 0 && (
                <tr className="border-b border-slate-200 text-sm">
                  <td className="py-4 px-2 text-slate-600">Frais de déplacement</td>
                  <td className="py-4 px-2 text-center text-slate-700">1</td>
                  <td className="py-4 px-2 text-right text-slate-700">{fraisDeplacement}</td>
                  <td className="py-4 px-2 text-right font-semibold">{fraisDeplacement}</td>
                </tr>
              )}
              {remise > 0 && (
                <tr className="border-b border-slate-200 text-sm text-green-700">
                  <td className="py-4 px-2">Remise / Geste commercial</td>
                  <td className="py-4 px-2 text-center">1</td>
                  <td className="py-4 px-2 text-right">-{remise}</td>
                  <td className="py-4 px-2 text-right font-semibold">-{remise}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex justify-end mb-12">
            <div className="w-1/2 bg-slate-50 p-4 rounded">
              <div className="flex justify-between py-1 text-sm text-slate-600">
                <span>Total HT</span>
                <span>{sstotal.toFixed(2)} MAD</span>
              </div>
              <div className="flex justify-between py-1 text-sm text-slate-600">
                <span>TVA (20%)</span>
                <span>{montantTva.toFixed(2)} MAD</span>
              </div>
              <div className="flex justify-between py-3 mt-2 border-t border-slate-200 text-lg font-bold text-teal-900">
                <span>NET À PAYER (TTC)</span>
                <span>{totalTTC.toFixed(2)} MAD</span>
              </div>
            </div>
          </div>

          <div className="mt-20 pt-8 border-t border-slate-200 text-sm text-slate-500 text-center">
            <p className="font-bold text-slate-700 mb-1">Conditions de paiement</p>
            <p>Paiement {demande.mode_paiement || 'par virement bancaire'} à la réception de la facture.</p>
            <p className="mt-4 italic">Merci de votre confiance !</p>
          </div>

        </div>
      </div>
    </div>
  );
};
