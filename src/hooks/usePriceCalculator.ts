import { useMemo } from 'react';
import { calculateTotalPrice, PricingInput } from '../utils/pricing';

export function usePriceCalculator(formData: any, selectedService: string) {
    const calculatedPrice = useMemo(() => {
        if (!selectedService) return '';

        const input: PricingInput = {
            service: selectedService,
            duree: formData.duree,
            nb_intervenants: formData.nb_intervenants,
            frequence: formData.frequence,
            produits: formData.produits,
            torchons: formData.torchons,
            ville: formData.ville,
            date: formData.date,
            date_demarrage: formData.date_demarrage || formData.date_debut || formData.date,
            date_debut: formData.date_demarrage || formData.date_debut || formData.date,
            jours_passage: formData.jours_passage || formData.jours_intervention,
            jours_intervention: formData.jours_intervention || formData.jours_passage,
            jours_intervention_detail: formData.jours_intervention_detail,
            tarif_horaire: formData.tarif_horaire || formData.tarif_base,
            tarif_base: formData.tarif_horaire || formData.tarif_base,
            rate: formData.rate || formData.tarif_horaire,
            scheduling_type: formData.scheduling_type,
            heure: formData.heure,
            preference_horaire: formData.preference_horaire,
            surface: formData.surface,
            formula: formData.formula,
            size_tier: formData.size_tier || formData.sizeTier,
            conso: formData.conso,
            linen_sets: formData.linen_sets || formData.linenSets
        };

        const result = calculateTotalPrice(input);
        return result === 'Sur devis' ? 'Sur devis' : result.toString();
    }, [
        selectedService,
        formData.duree,
        formData.nb_intervenants,
        formData.frequence,
        formData.produits,
        formData.torchons,
        formData.ville,
        formData.date,
        formData.date_demarrage,
        formData.date_debut,
        formData.jours_passage,
        formData.jours_intervention,
        formData.jours_intervention_detail,
        formData.tarif_horaire,
        formData.tarif_base,
        formData.rate,
        formData.scheduling_type,
        formData.heure,
        formData.preference_horaire,
        formData.surface,
        formData.formula,
        formData.size_tier,
        formData.sizeTier,
        formData.conso,
        formData.linen_sets,
        formData.linenSets
    ]);

    return calculatedPrice;
}
