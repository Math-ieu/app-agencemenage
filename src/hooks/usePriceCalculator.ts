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
            scheduling_type: formData.scheduling_type,
            heure: formData.heure,
            preference_horaire: formData.preference_horaire,
            surface: formData.surface
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
        formData.scheduling_type,
        formData.heure,
        formData.preference_horaire,
        formData.surface
    ]);

    return calculatedPrice;
}
