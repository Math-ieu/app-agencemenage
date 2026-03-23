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
        <div id="devis-container" className="bg-white text-slate-800 relative" style={{ width: '800px', minHeight: '1120px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>

          {/* Header */}
          <div className="bg-[#008080] p-8 text-white flex justify-between items-center mb-10">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tighter">DEVIS</h1>
              <p className="text-sm opacity-90 mt-1">N° D-{demande.id.toString().padStart(5, '0')}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold mb-1">Agence Ménage</div>
              <p className="text-xs opacity-80">Rabat / Casablanca, Maroc</p>
              <p className="text-xs opacity-80">www.agencemenage.ma</p>
            </div>
          </div>

          <div className="px-10">
            <div className="flex justify-between mb-12">
              <div className="w-1/2">
                <h3 className="font-bold text-[#008080] uppercase text-xs tracking-wider mb-3 border-b border-teal-50 pb-1">Détails du document</h3>
                <div className="space-y-1 text-sm">
                  <p><span className="text-slate-500 w-24 inline-block">Date :</span> {new Date(dateDevis).toLocaleDateString('fr-FR')}</p>
                  <p><span className="text-slate-500 w-24 inline-block">Validité :</span> {validite}</p>
                  <p><span className="text-slate-500 w-24 inline-block">Mode :</span> {demande.mode_paiement || 'Paiement à la livraison'}</p>
                </div>
              </div>

              <div className="w-1/2 bg-slate-50 p-5 rounded-sm border border-slate-100">
                <h3 className="font-bold text-slate-400 uppercase text-[10px] tracking-widest mb-2">Destinataire :</h3>
                <p className="font-bold text-lg text-[#008080]">{demande.client_name || data.nom}</p>
                <p className="text-sm text-slate-600 mt-1">{data.adresse || 'Casablanca, Maroc'}</p>
                <p className="text-sm text-slate-600 font-medium mt-2">Tél: {demande.client_phone || data.whatsapp_phone}</p>
              </div>
            </div>

            <table className="w-full mb-10 text-left border-collapse">
              <thead>
                <tr className="bg-[#008080] text-white text-[11px] uppercase tracking-widest">
                  <th className="py-3 px-4 w-[60%]">Désignation</th>
                  <th className="py-3 px-4 w-[10%] text-center">Qté</th>
                  <th className="py-3 px-4 w-[15%] text-right">P.U HT</th>
                  <th className="py-3 px-4 w-[15%] text-right">Total HT</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-slate-100">
                  <td className="py-5 px-4">
                    <p className="font-bold text-slate-800 mb-1">{descriptionTarif}</p>
                    <div className="text-[11px] text-slate-500 flex gap-3 italic">
                      {data.surface ? <span>Surface: {data.surface}m²</span> : null}
                      {data.duree ? <span>Durée: {data.duree}h</span> : null}
                      {data.nb_intervenants ? <span>Personnel: {data.nb_intervenants}</span> : null}
                    </div>
                  </td>
                  <td className="py-5 px-4 text-center">{demande.frequency_label || 1}</td>
                  <td className="py-5 px-4 text-right">{tarifUnitaire.toLocaleString()}</td>
                  <td className="py-5 px-4 text-right font-bold text-[#008080]">{tarifUnitaire.toLocaleString()}</td>
                </tr>
                {data.produits && (
                  <tr className="border-b border-slate-50 text-slate-600">
                    <td className="py-3 px-4">Pack Produits de nettoyage</td>
                    <td className="py-3 px-4 text-center">1</td>
                    <td className="py-3 px-4 text-right">90</td>
                    <td className="py-3 px-4 text-right font-semibold">90</td>
                  </tr>
                )}
                {data.torchons && (
                  <tr className="border-b border-slate-50 text-slate-600">
                    <td className="py-3 px-4">Kit Torchons et serpillères</td>
                    <td className="py-3 px-4 text-center">1</td>
                    <td className="py-3 px-4 text-right">40</td>
                    <td className="py-3 px-4 text-right font-semibold">40</td>
                  </tr>
                )}
                {fraisDeplacement > 0 && (
                  <tr className="border-b border-slate-50 text-slate-600">
                    <td className="py-3 px-4">Frais de déplacement / logistique</td>
                    <td className="py-3 px-4 text-center">1</td>
                    <td className="py-3 px-4 text-right">{fraisDeplacement}</td>
                    <td className="py-3 px-4 text-right font-semibold">{fraisDeplacement}</td>
                  </tr>
                )}
                {remise > 0 && (
                  <tr className="border-b border-slate-50 text-emerald-700 bg-emerald-50/30">
                    <td className="py-3 px-4 font-medium italic">Remise exceptionnelle</td>
                    <td className="py-3 px-4 text-center">1</td>
                    <td className="py-3 px-4 text-right">-{remise}</td>
                    <td className="py-3 px-4 text-right font-bold">-{remise}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="flex justify-between items-start mb-16">
              <div className="w-1/2 text-[11px] text-slate-400 italic mt-4">
                <p>Note: Ce devis est valable {validite}.</p>
                <p>Conditions: 50% à la commande, solde à la prestation.</p>
              </div>
              <div className="w-[35%]">
                <div className="space-y-2 border-t-2 border-[#008080] pt-4">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Total HT</span>
                    <span>{sstotal.toLocaleString()} MAD</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>TVA (20%)</span>
                    <span>{montantTva.toLocaleString()} MAD</span>
                  </div>
                  <div className="flex justify-between pt-3 mt-2 border-t border-slate-100 text-xl font-black text-[#008080]">
                    <span>TOTAL TTC</span>
                    <span>{totalTTC.toLocaleString()} MAD</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-20 text-center">
              <div className="inline-block border-t border-slate-200 px-10 pt-4">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Bon pour accord (Signature & Cachet)</p>
                <div className="h-20"></div>
              </div>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="absolute bottom-0 w-full bg-[#f1f5f9] p-3 text-center text-[9px] text-slate-400 flex justify-between px-10 border-t border-slate-200">
            <span>Agence Ménage — {new Date().toLocaleDateString('fr-FR')}</span>
            <span>ICE: 002345678900012 — RC: 45678 — IF: 345678</span>
            <span>www.agencemenage.ma</span>
          </div>
        </div>
      </div>
    </div>
  );
};
