import React from 'react';
import { Settings } from 'lucide-react';
import { Demande } from '../../types';
import { calculateInvoiceFromDevis } from '../../utils/pricing';

export interface SubscriptionParamsCardProps {
  latest: Demande;
  frequencyLabel?: string;
  selectedDays: string[];
  dateDebut?: string;
  monthPassagesPlanifies: number;
  monthPassagesAnnules?: number;
  interventionsRecuperees?: number;
  creditsEnAttente?: number;
  tauxReduction?: string | number;
  tarifHoraire?: string | number;
  mensuelBase?: string | number;
  onOpenModifyModal: () => void;
}

export const SubscriptionParamsCard: React.FC<SubscriptionParamsCardProps> = ({
  latest,
  frequencyLabel,
  selectedDays,
  dateDebut,
  monthPassagesPlanifies,
  monthPassagesAnnules = 0,
  interventionsRecuperees = 0,
  creditsEnAttente = 0,
  tauxReduction,
  tarifHoraire,
  mensuelBase,
  onOpenModifyModal
}) => {
  const formatSafeValue = (val: any, fallback = '—') => {
    if (val === null || val === undefined || val === '') return fallback;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) {
      if (val.length === 0) return fallback;
      const items = val.map((item: any) => {
        if (item && typeof item === 'object') {
          return item.label || item.name || item.title || item.key || String(item);
        }
        return String(item);
      });
      return items.join(', ');
    }
    if (typeof val === 'object') {
      return val.label || val.name || val.title || val.key || fallback;
    }
    return String(val);
  };

  const serviceValue = `${latest.service || latest.type_prestation || 'Grand ménage'} — ${latest.segment || ((latest as any).type_service === 'SPP' ? 'particulier' : 'particulier')}`;
  
  const rawFreq = frequencyLabel || latest.frequency_label || (selectedDays.length > 0 ? `${selectedDays.length} fois par semaine` : (latest.frequency ? `${latest.frequency}` : '—'));

  const startDateFormatted = dateDebut 
    ? new Date(dateDebut.includes('T') ? dateDebut : `${dateDebut.slice(0, 10)}T00:00:00`).toLocaleDateString('fr-FR') 
    : (latest.planning?.date_debut ? new Date(latest.planning.date_debut).toLocaleDateString('fr-FR') : (latest.date_intervention ? new Date(latest.date_intervention).toLocaleDateString('fr-FR') : '—'));

  const daysLabel = selectedDays.length > 0 
    ? selectedDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(' + ') 
    : '—';

  const nbPersonnes = latest.nb_intervenants ? `${latest.nb_intervenants} personne(s)` : `${latest.formulaire_data?.nb_personnes || 1} personne(s)`;

  const isGrand = String(latest.service || latest.type_prestation || '').toLowerCase().includes('grand');
  const realDuree = latest.nb_heures || latest.formulaire_data?.duree || (isGrand ? 6 : 4);
  const dureePassage = `${realDuree} heure(s)`;

  const realTarifHoraire = tarifHoraire || latest.formulaire_data?.tarif_horaire || (isGrand ? 70 : 60);

  const formData = latest.formulaire_data || {};
  const hasProduits = Boolean(
    latest.avec_produit ||
    formData.produits_inclus ||
    formData.produits ||
    formData.avec_produit ||
    (typeof formData.options === 'object' && formData.options?.produits)
  );
  const hasTorchons = Boolean(
    formData.torchons_inclus ||
    formData.torchons ||
    (typeof formData.options === 'object' && formData.options?.torchons)
  );
  const hasPack = Boolean(
    formData.pack_integral ||
    formData.pack ||
    (typeof formData.options === 'object' && formData.options?.pack_integral)
  );
  const hasZone = Boolean(
    formData.zone_eloignee ||
    formData.zone ||
    (typeof formData.options === 'object' && formData.options?.zone_eloignee)
  );

  const activeOptionLabels: string[] = [];
  if (hasProduits) activeOptionLabels.push('Produits ménagers inclus (+90 DH)');
  if (hasTorchons) activeOptionLabels.push('Torchons & serpillières (+40 DH)');
  if (hasPack) activeOptionLabels.push('Pack Intégral (+200 DH)');
  if (hasZone) activeOptionLabels.push('Zone éloignée (+50 DH)');

  let formattedOptions = activeOptionLabels.length > 0
    ? activeOptionLabels.join(' · ')
    : (formData.options ? formatSafeValue(formData.options) : 'Aucune option');

  if (formattedOptions === '—') formattedOptions = 'Aucune option';

  const rawModePaiement = latest.mode_paiement || latest.mode_paiement_label || latest.formulaire_data?.mode_paiement;
  const formattedModePaiement = formatSafeValue(rawModePaiement, 'Virement');

  const rawCom = latest.commercial_name || (latest as any).commission || (latest as any).commercial || latest.formulaire_data?.com;
  const formattedCom = formatSafeValue(rawCom, '—');

  const formattedTauxReduc = tauxReduction !== undefined && tauxReduction !== null ? `${tauxReduction}%` : (latest.formulaire_data?.taux_reduction || latest.geste_commercial?.reduction_value ? `${latest.formulaire_data?.taux_reduction || latest.geste_commercial?.reduction_value}%` : '10%');

  const formattedRecup = `${interventionsRecuperees} récupérée(s)${creditsEnAttente > 0 ? ` · ${creditsEnAttente} crédit(s) en attente` : ''}`;

  return (
    <div style={{ background: 'white', border: '1px solid #d0e3e0', borderRadius: 16, padding: '16px 20px', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
      
      {/* Header matching screenshot */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid #e6f2f0', paddingBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#034a3e', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={18} color="#037265" /> Paramètres de l'abonnement
        </div>
        <button
          type="button"
          onClick={onOpenModifyModal}
          style={{ background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, padding: '5px 14px', fontSize: 12, fontWeight: 700, color: '#334155', cursor: 'pointer' }}
        >
          Modifier
        </button>
      </div>

      {/* 14 Lines List matching screenshot order */}
      <div style={{ display: 'flex', flexDirection: 'column', fontSize: 13 }}>
        
        {/* 1. Service */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Service</span>
          <strong style={{ color: '#034a3e', fontWeight: 700 }}>{serviceValue}</strong>
        </div>

        {/* 2. Type de fréquence */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Type de fréquence</span>
          <strong style={{ color: '#034a3e', fontWeight: 700 }}>{rawFreq}</strong>
        </div>

        {/* 3. Date de démarrage */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Date de démarrage</span>
          <strong style={{ color: '#034a3e', fontWeight: 700 }}>{startDateFormatted}</strong>
        </div>

        {/* 4. Jours de passage */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Jours de passage</span>
          <strong style={{ color: '#034a3e', fontWeight: 700 }}>{daysLabel}</strong>
        </div>

        {/* 5. Nbre de personnes */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Nbre de personnes</span>
          <strong style={{ color: '#034a3e', fontWeight: 700 }}>{nbPersonnes}</strong>
        </div>

        {/* 6. Nombre total de passages */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', padding: '10px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Nombre total de passages</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong style={{ color: '#034a3e', fontWeight: 700 }}>{monthPassagesPlanifies} passage(s) / mois</strong>
            {monthPassagesAnnules > 0 && (
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>({monthPassagesAnnules} annulée(s))</span>
            )}
          </div>
        </div>

        {/* 7. Durée / passage */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Durée / passage</span>
          <strong style={{ color: '#034a3e', fontWeight: 700 }}>{dureePassage}</strong>
        </div>

        {/* 8. Tarif horaire */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Tarif horaire</span>
          <strong style={{ color: '#034a3e', fontWeight: 700 }}>{realTarifHoraire ? `${realTarifHoraire} DH / heure` : '—'}</strong>
        </div>

        {/* 9. Options */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Options</span>
          <strong style={{ color: '#034a3e', fontWeight: 700 }}>{formattedOptions}</strong>
        </div>

        {/* 10. Mensuel de base (devis — montant constant) */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Mensuel de base (devis)</span>
          <strong style={{ color: '#034a3e', fontWeight: 700 }}>
            {(() => {
              // Toujours afficher le montant CONSTANT du devis, pas le prorata du mois
              const inv = calculateInvoiceFromDevis(latest);
              if (inv.devisTotal > 0 && inv.passagesBase > 0) {
                return `${inv.devisTotal.toLocaleString('fr-FR')} DH (${inv.passagesBase} passages × ${inv.prixUnitaireDevis.toFixed(2).replace('.', ',')} DH)`;
              }
              return inv.devisTotal > 0 ? `${inv.devisTotal.toLocaleString('fr-FR')} DH` : (mensuelBase ? `${mensuelBase} DH` : (latest.prix ? `${latest.prix} DH` : '—'));
            })()}
          </strong>
        </div>

        {/* 11. Mode de paiement */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Mode de paiement</span>
          <strong style={{ color: '#034a3e', fontWeight: 700 }}>{formattedModePaiement}</strong>
        </div>

        {/* 12. Com */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Com</span>
          <strong style={{ color: '#034a3e', fontWeight: 700 }}>{formattedCom}</strong>
        </div>

        {/* 13. Taux de réduction */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Taux de réduction</span>
          <strong style={{ color: '#034a3e', fontWeight: 700 }}>{formattedTauxReduc}</strong>
        </div>

        {/* 14. Interventions récupérées */}
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', padding: '10px 0' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Interventions récupérées</span>
          <strong style={{ color: '#034a3e', fontWeight: 700 }}>{formattedRecup}</strong>
        </div>

      </div>
    </div>
  );
};
