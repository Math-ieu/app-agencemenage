import React from 'react';
import { Demande } from '../types';

interface FormulaireRecapProps {
  demande: Demande;
}

export const FormulaireRecap: React.FC<FormulaireRecapProps> = ({ demande }) => {
  const data = demande.formulaire_data || {};
  
  return (
    <div id="recap-container" className="bg-white p-8 text-slate-800" style={{ width: '800px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-teal-700">Récapitulatif de Demande</h1>
          <p className="text-sm text-slate-500">Réf: #{demande.id} — Date: {new Date().toLocaleDateString('fr-FR')}</p>
        </div>
        <div className="text-right">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${demande.segment === 'particulier' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
            {demande.segment === 'particulier' ? 'SPP' : 'SPE'}
          </span>
          <h2 className="text-lg font-bold mt-2 text-teal-900">{demande.service}</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-6">
        <div>
          <h3 className="text-base font-bold mb-3 border-b border-teal-100 pb-1 text-teal-800">Informations Client</h3>
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold text-slate-500">Nom :</span> {demande.client_name || data.nom || '—'}</p>
            <p><span className="font-semibold text-slate-500">Téléphone :</span> {demande.client_phone || data.whatsapp_phone || '—'}</p>
            <p><span className="font-semibold text-slate-500">Ville :</span> {data.ville || demande.client_city || '—'}</p>
            <p><span className="font-semibold text-slate-500">Quartier :</span> {data.quartier || demande.client_neighborhood || '—'}</p>
            <p><span className="font-semibold text-slate-500">Adresse exacte :</span> {data.adresse || '—'}</p>
          </div>
        </div>
        
        <div>
          <h3 className="text-base font-bold mb-3 border-b border-teal-100 pb-1 text-teal-800">Détails Prestation</h3>
          <div className="space-y-2 text-sm">
            <p><span className="font-semibold text-slate-500">Date d'intervention :</span> {demande.date_intervention || '—'}</p>
            <p><span className="font-semibold text-slate-500">Heure d'intervention :</span> {demande.heure_intervention || '—'}</p>
            <p><span className="font-semibold text-slate-500">Préférence horaire :</span> {data.preference_horaire === 'matin' ? 'Matin' : (data.preference_horaire === 'apres_midi' ? 'Après-midi' : '—')}</p>
            <p><span className="font-semibold text-slate-500">Fréquence :</span> {demande.frequency_label || demande.frequency || '—'}</p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-base font-bold mb-3 border-b border-teal-100 pb-1 text-teal-800">Caractéristiques du lieu / du besoin</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {data.type_habitation && <p><span className="font-semibold text-slate-500">Type de bien :</span> {data.type_habitation}</p>}
          {data.structure_type && <p><span className="font-semibold text-slate-500">Structure :</span> {data.structure_type}</p>}
          {(data.surface || data.surface === 0) && <p><span className="font-semibold text-slate-500">Surface :</span> {data.surface} m²</p>}
          {(data.duree || data.duree === 0) && <p><span className="font-semibold text-slate-500">Durée :</span> {data.duree}h</p>}
          {data.nb_intervenants && <p><span className="font-semibold text-slate-500">Nb intervenants :</span> {data.nb_intervenants}</p>}
          {data.nb_personnel && <p><span className="font-semibold text-slate-500">Nb de personnel :</span> {data.nb_personnel}</p>}
          
          {/* Auxiliaire de vie / garde spécifique */}
          {data.age_personne && <p><span className="font-semibold text-slate-500">Âge de la personne :</span> {data.age_personne} ans</p>}
          {data.sexe_personne && <p><span className="font-semibold text-slate-500">Sexe :</span> {data.sexe_personne === 'homme' ? 'Homme' : 'Femme'}</p>}
          {data.mobilite && <p><span className="font-semibold text-slate-500">Mobilité :</span> {data.mobilite}</p>}
          {data.lieu_garde && <p><span className="font-semibold text-slate-500">Lieu de garde :</span> {data.lieu_garde}</p>}
          {data.nb_jours && <p><span className="font-semibold text-slate-500">Nombre de jours :</span> {data.nb_jours} j</p>}
        </div>
        
        {data.details_pieces && (
          <div className="mt-3 text-sm">
            <span className="font-semibold text-slate-500 block mb-1">Détails des pièces :</span> 
            <p className="bg-slate-50 p-2 rounded">{data.details_pieces}</p>
          </div>
        )}
        
        {data.situation_medicale && (
          <div className="mt-3 text-sm">
            <span className="font-semibold text-slate-500 block mb-1">Situation médicale :</span> 
            <p className="bg-slate-50 p-2 rounded">{data.situation_medicale}</p>
          </div>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-base font-bold mb-3 border-b border-teal-100 pb-1 text-teal-800">Options & Tarification</h3>
        <div className="bg-teal-50 p-4 rounded-lg">
          <div className="flex justify-between border-b border-teal-100 pb-2 mb-2 text-sm">
            <span>Prestation de base</span>
            <span className="font-semibold">- MAD</span>
          </div>
          {data.produits && (
            <div className="flex justify-between border-b border-teal-100 pb-2 mb-2 text-sm">
              <span>Produits de nettoyage</span>
              <span>+ 90 MAD</span>
            </div>
          )}
          {data.torchons && (
            <div className="flex justify-between border-b border-teal-100 pb-2 mb-2 text-sm">
              <span>Torchons et serpillères</span>
              <span>+ 40 MAD</span>
            </div>
          )}
          <div className="flex justify-between pt-2 text-lg font-bold text-teal-900">
            <span>Montant estimatif total</span>
            <span>{demande.prix ? `${demande.prix} MAD` : 'Sur devis'}</span>
          </div>
        </div>
      </div>
      
      {data.notes && (
        <div className="mt-4 pt-4 border-t text-sm">
          <span className="font-bold text-slate-600">Notes / Informations complémentaires : </span>
          <span>{data.notes}</span>
        </div>
      )}
      
      <div className="mt-12 pt-4 border-t border-dashed text-center text-xs text-slate-400">
        Ce document récapitule les informations saisies lors de la demande. Il ne constitue pas un contrat définitif.
      </div>
    </div>
  );
};
