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
            A: { studio: 130, '1chambre': 165, '2chambres': 195, '2chambresDoubleSDB': 230, '3chambres': 260, '4chambres': 325, villa: 390 },
            B: { studio: 220, '1chambre': 255, '2chambres': 285, '2chambresDoubleSDB': 320, '3chambres': 350, '4chambres': 415, villa: 480 }
        } as const;

        // Tarif linge par set (brief) : 1er 50, 2ème 45, 3ème et + 40 DH
        const linenSetsCost = (n: number): number => {
            let c = 0;
            for (let i = 1; i <= n; i++) c += i === 1 ? 50 : i === 2 ? 45 : 40;
            return c;
        };

        const formula = input.formula || 'A';
        const sizeTier = (input.size_tier || '1chambre') as keyof typeof AIRBNB_PRICES.A;
        const conso = !!input.conso;
        const linenSets = Number(input.linen_sets || 0);

        const basePrice = AIRBNB_PRICES[formula]?.[sizeTier] ?? AIRBNB_PRICES.A['1chambre'];
        let total = basePrice;
        if (conso) total += 25;
        if (formula === 'B' && linenSets > 0) total += linenSetsCost(linenSets);
        
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

    // 3. Ménage Bureaux — base 60 DH HT/h ; produits/torchons en option flat (brief)
    if (serviceLower.includes('menage bureaux')) {
        const optionsPerVisit = (produits ? 90 : 0) + (torchons ? 40 : 0);
        const laborPerVisit = duree * nb_intervenants * 60 * multiplier;

        if (isSubscription && !isOneShot) {
            const laborMonthly = laborPerVisit * visitsPerWeek * 4;
            const discountAmount = laborMonthly * 0.1; // remise sur la main-d'œuvre uniquement
            // Options en ligne flat (une seule fois), conformément au brief
            return Math.round(laborMonthly - discountAmount + optionsPerVisit);
        } else {
            return Math.round(laborPerVisit + optionsPerVisit);
        }
    }

    // 4. Ménage Standard, Grand Ménage
    if (serviceLower.includes('menage standard') || serviceLower.includes('grand menage')) {
        const isGrand = serviceLower.includes('grand menage');
        const baseRate = isGrand ? 70 : 60;
        // Durée minimum facturable (brief) : standard 4h, grand ménage 6h
        const minHours = isGrand ? 6 : 4;
        const effDuree = Math.max(Number(duree) || 0, minHours);
        let totalServicePrice = 0;

        if (isSubscription && !isOneShot) {
            const monthlyHours = effDuree * visitsPerWeek * 4;
            const subtotalMonthly = monthlyHours * baseRate * nb_intervenants;
            const discountAmount = subtotalMonthly * 0.1;
            totalServicePrice = (subtotalMonthly - discountAmount) * multiplier;
        } else {
            totalServicePrice = effDuree * baseRate * nb_intervenants * multiplier;
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

    return null;
};

export const calculateSinglePassagePrice = (demande: any): number => {
    if (!demande) return 200;

    if (demande.formulaire_data?.prix_unitaire && Number(demande.formulaire_data.prix_unitaire) > 0) {
        return Number(demande.formulaire_data.prix_unitaire);
    }

    const formData = demande.formulaire_data || {};
    const service = String(demande.service || demande.type_prestation || formData.type_prestation || formData.service || '').toLowerCase();

    // Options (produits ménagers +90 DH, torchons +40 DH)
    const produits = Boolean(
        demande.avec_produit ||
        formData.produits_inclus ||
        formData.produits ||
        formData.avec_produit ||
        (typeof formData.options === 'object' && formData.options?.produits)
    );
    const torchons = Boolean(
        formData.torchons_inclus ||
        formData.torchons ||
        (typeof formData.options === 'object' && formData.options?.torchons)
    );
    const options = (produits ? 90 : 0) + (torchons ? 40 : 0);

    // 1. Ménage Bureaux
    if (service.includes('bureau') || service.includes('bureaux')) {
        const duree = Number(demande.nb_heures || formData.duree) || 4;
        const nbPersonnes = Math.max(1, Number(demande.nb_intervenants || formData.nb_personnes || formData.nb_intervenants) || 1);
        const baseRate = Number(formData.tarif_horaire) || 60;
        return Math.round(duree * baseRate * nbPersonnes + options);
    }

    // 2. Ménage Airbnb
    if (service.includes('airbnb') || service.includes('air bnb')) {
        const basePrice = Number(formData.base_price || formData.prix_base) || 165;
        return Math.round(basePrice + options);
    }

    // 3. Post-Déménagement
    if (service.includes('demenagement') || service.includes('déménagement')) {
        const basePrice = Number(formData.base_price || formData.prix_base) || 890;
        return Math.round(basePrice);
    }

    // 4. Standard / Grand Ménage / Autres services
    const isGrand = service.includes('grand');
    const baseRate = Number(formData.tarif_horaire) || (isGrand ? 70 : 60);
    const minHours = isGrand ? 6 : 4;
    const duree = Math.max(Number(demande.nb_heures || formData.duree) || 0, minHours);
    const nbPersonnes = Math.max(1, Number(demande.nb_intervenants || formData.nb_personnes || formData.nb_intervenants) || 1);

    const labor = duree * baseRate * nbPersonnes;
    return Math.round(labor + options);
};

/**
 * Calcul de la facture à partir du devis (source unique de vérité).
 *
 * Le devis total est stocké dans formulaire_data.total / demande.prix
 * par QuoteSection → handleQuoteUpdate lors de la préparation du devis.
 *
 * Le prix unitaire est dérivé : devisTotal / passagesBase.
 * Si le mois en cours a un nombre de passages différent (prorata),
 * le montant est ajusté proportionnellement.
 */
export interface DevisInvoiceResult {
    /** Montant total HT du devis (base mensuelle complète) */
    devisTotal: number;
    /** Nombre de passages de base du devis (ex: 8 pour 2/sem × 4) */
    passagesBase: number;
    /** Prix unitaire dérivé du devis = devisTotal / passagesBase */
    prixUnitaireDevis: number;
    /** Passages facturables ce mois (après déduction des récupérées) */
    passagesFacturables: number;
    /** Montant brut HT (PU × passages facturables) */
    montantBrut: number;
    /** Remise additionnelle en DH */
    remiseDh: number;
    /** Montant HT après remise */
    montantHT: number;
    /** Taux TVA en % */
    tvaPct: number;
    /** Montant TVA */
    tvaAmount: number;
    /** Total TTC final */
    totalTTC: number;
}

export const getContractBaselinePassages = (demande: any): number => {
    if (!demande) return 12;
    const formData = demande.formulaire_data || {};
    if (Number(formData.nb_passages_base) > 0) return Number(formData.nb_passages_base);
    if (Number(formData.nb_passages_devis) > 0) return Number(formData.nb_passages_devis);

    const freqStr = String(formData.frequence || (formData as any).subFrequency || demande.frequency_label || demande.frequency || '').toLowerCase();
    if (freqStr.includes('7/sem') || freqStr.includes('7_fois') || freqStr.includes('7 fois')) return 28;
    if (freqStr.includes('6/sem') || freqStr.includes('6_fois') || freqStr.includes('6 fois')) return 24;
    if (freqStr.includes('5/sem') || freqStr.includes('5_fois') || freqStr.includes('5 fois')) return 20;
    if (freqStr.includes('4/sem') || freqStr.includes('4_fois') || freqStr.includes('4 fois')) return 16;
    if (freqStr.includes('3/sem') || freqStr.includes('3_fois') || freqStr.includes('3 fois')) return 12;
    if (freqStr.includes('2/sem') || freqStr.includes('2_fois') || freqStr.includes('2 fois')) return 8;
    if (freqStr.includes('1/sem') || freqStr.includes('1_fois') || freqStr.includes('1 fois')) return 4;

    return 12;
};

export const calculateInvoiceFromDevis = (
    demande: any,
    monthPassages?: number,
    interventionsRecup?: number,
    remiseDhOverride?: number,
    tvaPctOverride?: number
): DevisInvoiceResult => {
    if (!demande) {
        return { devisTotal: 0, passagesBase: 0, prixUnitaireDevis: 0, passagesFacturables: 0, montantBrut: 0, remiseDh: 0, montantHT: 0, tvaPct: 0, tvaAmount: 0, totalTTC: 0 };
    }

    const formData = demande.formulaire_data || {};

    // ── 1. Devis total HT (source de vérité pour le contrat de base) ──
    const devisTotal = Number(formData.total) || Number(formData.montant) || Number(demande.prix) || 0;

    // ── 2. Nombre de passages de base du devis / contrat (FIXE) ──
    const passagesBase = getContractBaselinePassages(demande);

    // ── 3. Prix unitaire fixe par passage (FIXE) ──
    let prixUnitaireDevis = 0;
    if (formData.prix_unitaire && Number(formData.prix_unitaire) > 0) {
        prixUnitaireDevis = Number(formData.prix_unitaire);
    } else if (devisTotal > 0 && passagesBase > 0) {
        prixUnitaireDevis = Math.round((devisTotal / passagesBase) * 100) / 100;
    } else {
        prixUnitaireDevis = calculateSinglePassagePrice(demande);
    }

    // ── 4. Passages facturables ce mois (VARIABLE) ──
    const passagesMois = monthPassages ?? passagesBase;
    const recup = Math.max(0, interventionsRecup ?? 0);
    const passagesFacturables = Math.max(0, passagesMois - recup);

    // ── 5. Montant brut HT ce mois (prorata = PU fixe × passages du mois) ──
    const montantBrut = Math.round(prixUnitaireDevis * passagesFacturables);

    // ── 6. Remise additionnelle ──
    const remiseDh = Math.max(0, remiseDhOverride ?? 0);

    // ── 7. Total HT ──
    const montantHT = Math.max(0, montantBrut - remiseDh);

    // ── 8. TVA ──
    const tvaPct = tvaPctOverride ?? (Number(formData.tva) || 0);
    const tvaAmount = Math.round((montantHT * tvaPct) / 100);
    const totalTTC = montantHT + tvaAmount;

    return {
        devisTotal,
        passagesBase,
        prixUnitaireDevis,
        passagesFacturables,
        montantBrut,
        remiseDh,
        montantHT,
        tvaPct,
        tvaAmount,
        totalTTC
    };
};

/**
 * Raccourci : retourne le montant TTC de la facture basé sur le devis.
 * Utilisé par les composants qui affichent le montant TTC.
 */
export const getDevisBasedMonthlyAmount = (demande: any, monthPassages?: number): number => {
    if (!demande) return 0;
    const formData = demande.formulaire_data || {};
    const validatedTTC = Number(formData.total_ttc || formData.montant_ttc || formData.montant_facture || formData.montant_final);
    if (validatedTTC > 0) return validatedTTC;

    const result = calculateInvoiceFromDevis(demande, monthPassages);
    return result.totalTTC;
};
