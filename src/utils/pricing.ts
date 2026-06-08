export const SURCHARGE_CITIES = [
    "Bouskoura",
    "Dar Bouazza",
    "Mansouria",
    "Almaz",
    "Sidi Rahal",
    "Benslimane",
    "Mohammédia",
    "Ville Verte"
];

export const calculateSurchargeMultiplier = (
    dateStr: string,
    schedulingType: string,
    fixedTime: string,
    preferenceHoraire: string
): number => {
    if (!dateStr) return 1;

    const date = new Date(dateStr);
    const isSunday = date.getDay() === 0;

    let isEvening = false;
    if (schedulingType === "fixed" && fixedTime) {
        const [hours] = fixedTime.split(":").map(Number);
        if (hours >= 18) {
            isEvening = true;
        }
    } else if (schedulingType === "flexible" && (preferenceHoraire === "apres_midi" || preferenceHoraire === "soir")) {
        // En backoffice, on a 'apres_midi' et parfois 'soir'
        if (preferenceHoraire === "soir") isEvening = true;
    }

    if (isEvening) {
        return 1.5;
    }

    if (isSunday) {
        return 1.25;
    }

    return 1;
};

export interface PricingInput {
    service: string;
    duree: number;
    nb_intervenants: number;
    frequence: string;
    produits: boolean;
    torchons: boolean;
    ville: string;
    date: string;
    scheduling_type: string;
    heure: string;
    preference_horaire: string;
    surface?: number | string;
    formula?: 'A' | 'B';
    size_tier?: string;
    conso?: boolean;
    linen_sets?: number;
}

export const calculateTotalPrice = (input: PricingInput): number | 'Sur devis' => {
    const {
        service,
        duree,
        nb_intervenants,
        frequence,
        produits,
        torchons,
        ville,
        date,
        scheduling_type,
        heure,
        preference_horaire,
        surface
    } = input;

    const normalizeService = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const serviceLower = normalizeService(service);

    // Services "Sur Devis" by default
    const surDevisServices = [
        'post-sinistre',
        'post sinistre',
        'auxiliaire de vie',
        'fin de chantier',
        'fin chantier',
        'nettoyage fin de chantier',
        'garde malade',
        'placement & gestion',
        'placement et gestion'
    ];

    if (surDevisServices.some(s => serviceLower.includes(s))) {
        return 'Sur devis';
    }

    // Common options and surcharges
    const locationSurcharge = SURCHARGE_CITIES.includes(ville) ? 50 : 0;
    const multiplier = calculateSurchargeMultiplier(date, scheduling_type, heure, preference_horaire);

    // 1. Post-Déménagement (Fixed tiered pricing)
    if (serviceLower.includes('post-demenagement') || serviceLower.includes('post demenagement') || serviceLower.includes('demenagement')) {
        const s = Number(surface) || 0;
        let basePrice = 0;
        if (s <= 50) basePrice = 590;
        else if (s <= 80) basePrice = 890;
        else if (s <= 120) basePrice = 1290;
        else if (s <= 180) basePrice = 1790;
        else if (s <= 250) basePrice = 2490;
        else return 'Sur devis';

        const corePrice = basePrice * multiplier;
        return Math.round(corePrice);
    }

    // 1.5. Ménage Airbnb
    if (serviceLower.includes('airbnb') || serviceLower.includes('air bnb')) {
        const AIRBNB_PRICES = {
            A: { studio: 130, '1chambre': 165, '2chambres': 195, '3chambres': 260, '4chambres': 325, villa: 390 },
            B: { studio: 220, '1chambre': 255, '2chambres': 285, '3chambres': 350, '4chambres': 415, villa: 480 }
        } as const;
        
        const formula = input.formula || 'A';
        const sizeTier = (input.size_tier || '1chambre') as keyof typeof AIRBNB_PRICES.A;
        const conso = !!input.conso;
        const linenSets = Number(input.linen_sets || 0);

        const basePrice = AIRBNB_PRICES[formula]?.[sizeTier] ?? AIRBNB_PRICES.A['1chambre'];
        let total = basePrice;
        if (conso) total += 25;
        if (formula === 'B' && linenSets > 0) total += linenSets * 90;
        
        // Add location surcharge
        total += locationSurcharge;

        return Math.round(total * multiplier);
    }

    // 2. Subscriptions setup
    const isSubscription = frequence.toLowerCase().includes('mensuel') || 
                           frequence.toLowerCase().includes('abonnement') || 
                           frequence.toLowerCase().includes('semaine') || 
                           frequence.toLowerCase().includes('mois') ||
                           frequence.includes('/');
    const isOneShot = frequence.toLowerCase().includes('une fois') || frequence.toLowerCase() === 'oneshot' || frequence === '';

    let visitsPerWeek = 1;
    if (isSubscription && !isOneShot) {
        if (frequence.includes('1/sem')) visitsPerWeek = 1;
        else if (frequence.includes('2/sem')) visitsPerWeek = 2;
        else if (frequence.includes('3/sem')) visitsPerWeek = 3;
        else if (frequence.includes('4/sem')) visitsPerWeek = 4;
        else if (frequence.includes('5/sem')) visitsPerWeek = 5;
        else if (frequence.includes('6/sem')) visitsPerWeek = 6;
        else if (frequence.includes('7/sem')) visitsPerWeek = 7;
        else if (frequence.includes('1/mois')) visitsPerWeek = 0.25;
        else if (frequence.includes('2/mois')) visitsPerWeek = 0.5;
        else if (frequence.includes('3/mois')) visitsPerWeek = 0.75;
        else if (frequence.includes('4/mois')) visitsPerWeek = 1;
    }

    // 3. Ménage Bureaux
    if (serviceLower.includes('menage bureaux')) {
        const hourlyRate = produits ? 70 : 60;
        const perVisitBasePrice = duree * nb_intervenants * hourlyRate * multiplier;
        const perVisitTotal = perVisitBasePrice;
        
        if (isSubscription && !isOneShot) {
            const subtotalMonthly = perVisitTotal * visitsPerWeek * 4;
            const discountAmount = subtotalMonthly * 0.1;
            return Math.round(subtotalMonthly - discountAmount);
        } else {
            return Math.round(perVisitTotal);
        }
    }

    // 4. Ménage Standard, Grand Ménage
    if (serviceLower.includes('menage standard') || serviceLower.includes('grand menage')) {
        const baseRate = serviceLower.includes('grand menage') ? 70 : 60;
        let totalServicePrice = 0;

        if (isSubscription && !isOneShot) {
            const monthlyHours = duree * visitsPerWeek * 4;
            const subtotalMonthly = monthlyHours * baseRate * nb_intervenants;
            const discountAmount = subtotalMonthly * 0.1;
            totalServicePrice = (subtotalMonthly - discountAmount) * multiplier;
        } else {
            totalServicePrice = duree * baseRate * nb_intervenants * multiplier;
        }

        let price = totalServicePrice;
        if (produits) price += 90;
        if (locationSurcharge > 0) price += 50;
        if (torchons) price += 40;

        return Math.round(price);
    }

    return 'Sur devis';
};

export const estimateResources = (service: string, input: any): { duration: number, people: number } | null => {
    const normalizeService = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const serviceLower = normalizeService(service);


    if (serviceLower.includes('menage standard') || serviceLower.includes('airbnb')) {
        const rooms = input.rooms || {};
        const roomsSelected = Object.values(rooms).some(count => (count as number) > 0);

        if (roomsSelected) {
            const roomTimes: Record<string, number> = {
                cuisine: 45,
                suiteAvecBain: 75,
                suiteSansBain: 45,
                salleDeBain: 30,
                chambre: 40,
                salonMarocain: 35,
                salonEuropeen: 35,
                toilettesLavabo: 25,
                rooftop: 30,
                escalier: 25
            };

            let totalMinutes = 0;
            Object.entries(rooms).forEach(([key, count]) => {
                totalMinutes += (roomTimes[key] || 0) * (count as number);
            });

            const calculatedHours = Math.ceil(totalMinutes / 60);
            return { duration: Math.max(4, calculatedHours), people: 1 };
        }
        
        // Default for standard/airbnb if no rooms
        return { duration: 4, people: 1 };
    }

    if (serviceLower.includes('grand menage') || 
        serviceLower.includes('fin de chantier') || 
        serviceLower.includes('post-sinistre') || 
        serviceLower.includes('post-demenagement') ||
        serviceLower.includes('demenagement')) {
        
        const surface = input.surface || 0;
        if (surface <= 70) return { duration: 6, people: 1 };
        if (surface <= 150) return { duration: 4, people: 2 };
        if (surface < 300) return { duration: 8, people: 2 };
        return { duration: 8, people: 3 };
    }

    if (serviceLower.includes('menage bureaux')) {
        const s = input.surface;
        if (typeof s === 'string') {
            if (s === '0-70') return { duration: 2, people: 1 };
            if (s === '71-150') return { duration: 4, people: 1 };
            if (s === '151-300') return { duration: 8, people: 1 };
            if (s === '300+') return { duration: 8, people: 2 };
        }
        
        const numS = Number(s) || 0;
        if (numS <= 70) return { duration: 2, people: 1 };
        if (numS <= 150) return { duration: 4, people: 1 };
        if (numS <= 300) return { duration: 8, people: 1 };
        return { duration: 8, people: 2 };
    }

    return null;
};
