import { useMemo } from 'react';
import { estimateResources } from '../utils/pricing';

export function useResourceEstimator(formData: any, selectedService: string) {
    const estimation = useMemo(() => {
        if (!selectedService) return null;
        return estimateResources(selectedService, formData);
    }, [
        selectedService,
        formData.surface,
        formData.rooms
    ]);

    return estimation;
}
