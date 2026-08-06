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
    if (!demande) return 8;
    const formData = demande.formulaire_data || {};

    // 1. Explicit baseline fields saved in form or demande
    if (Number(formData.nb_passages_base) > 0) return Number(formData.nb_passages_base);
    if (Number(formData.nb_passages_devis) > 0) return Number(formData.nb_passages_devis);
    if (Number(formData.passages_base) > 0) return Number(formData.passages_base);
    if (Number(formData.passages_devis) > 0) return Number(formData.passages_devis);

    // 2. Derive from active days selected in the planning / form (extractJoursPassage)
    let days: string[] = [];
    const detail = (formData as any)?.jours_intervention_detail;
    if (Array.isArray(detail) && detail.length > 0) {
        days = extractJoursPassage(detail);
    }
    if (days.length === 0) {
        days = extractJoursPassage(formData.jours_intervention || demande.planning?.jours_intervention);
    }
    if (days.length === 0) {
        days = extractJoursPassage(formData.jours_passage || demande.jours_passage);
    }
    if (days.length === 0 && Array.isArray(demande.planning?.semaines)) {
        const dayNames = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
        const found = new Set<string>();
        demande.planning.semaines.forEach((w: any) => {
            if (w.jours && typeof w.jours === 'object') {
                Object.keys(w.jours).forEach((k: string) => {
                    if (w.jours[k]?.selected && dayNames.includes(k.toLowerCase())) {
                        found.add(k.toLowerCase());
                    }
                });
            }
        });
        if (found.size > 0) days = Array.from(found);
    }
    if (days.length > 0) {
        return days.length * 4;
    }

    // 3. Robust string parsing of frequency (handles "2 fois / semaine", "2 fois par semaine", "2/sem", etc.)
    const freqStr = String(
        formData.frequence ||
        formData.frequency_label ||
        (formData as any).subFrequency ||
        demande.frequency_label ||
        demande.frequency ||
        ''
    ).toLowerCase().trim();

    const weekMatch = freqStr.match(/(\d+)\s*(?:fois|j|x)?\s*(?:\/|par)?\s*(?:semaine|sem|week)/i) ||
                      freqStr.match(/(\d+)\s*(?:fois|_fois|\/sem)/i);
    if (weekMatch && weekMatch[1]) {
        const perWeek = Number(weekMatch[1]);
        if (perWeek >= 1 && perWeek <= 7) {
            return perWeek * 4;
        }
    }

    const monthMatch = freqStr.match(/(\d+)\s*(?:fois|j|x)?\s*(?:\/|par)?\s*(?:mois|month)/i);
    if (monthMatch && monthMatch[1]) {
        const perMonth = Number(monthMatch[1]);
        if (perMonth >= 1 && perMonth <= 31) {
            return perMonth;
        }
    }

    // 4. Derive from devis total & single passage price if available
    const devisTotal = Number(demande.montant_devis) || Number(formData.montant_devis_base) || Number(formData.devis_total_base) || Number(formData.mensuel_base) || Number(formData.montant_devis) || Number(formData.total) || Number(formData.montant) || Number(demande.prix) || 0;
    const pu = Number(formData.prix_unitaire);
    if (devisTotal > 0 && pu > 0) {
        const calculatedPassages = Math.round(devisTotal / pu);
        if (calculatedPassages >= 1 && calculatedPassages <= 31) {
            return calculatedPassages;
        }
    }

    // 5. Soft fallback checks
    if (freqStr.includes('7')) return 28;
    if (freqStr.includes('6')) return 24;
    if (freqStr.includes('5')) return 20;
    if (freqStr.includes('4')) return 16;
    if (freqStr.includes('3')) return 12;
    if (freqStr.includes('2')) return 8;
    if (freqStr.includes('1')) return 4;

    return 8;
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

    // ── 1. Devis total (source de vérité pour le contrat de base — APRÈS remise abonnement) ──
    // formData.total / formData.montant are saved by QuoteSection with the post-discount total
    const devisTotal = Number(demande.montant_devis) || Number(formData.montant_devis_base) || Number(formData.devis_total_base) || Number(formData.mensuel_base) || Number(formData.montant_devis) || Number(formData.total) || Number(formData.montant) || Number(demande.prix) || 0;

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
 * Retourne le montant de référence du DEVIS (baseline 30j/29j / contrat fixe).
 * Utilisé pour la génération du devis PDF et l'affichage des devis.
 */
export const getDevisBasedMonthlyAmount = (demande: any): number => {
    if (!demande) return 0;
    const formData = demande.formulaire_data || {};
    const baselineDevis = Number(demande.montant_devis) || Number(formData.montant_devis_base) || Number(formData.devis_total_base) || Number(formData.mensuel_base) || Number(formData.montant_devis) || Number(formData.total) || Number(formData.montant);
    if (baselineDevis > 0) return baselineDevis;

    const result = calculateInvoiceFromDevis(demande);
    return result.devisTotal || Number(demande.prix) || 0;
};

/**
 * Retourne le montant de la FACTURE (calculé au prorata des passages du mois).
 * Utilisé pour la facturation, les widgets financiers et l'affichage des factures.
 */
export const getInvoiceMonthlyAmount = (demande: any, monthPassages?: number): number => {
    if (!demande) return 0;
    const formData = demande.formulaire_data || {};
    const validatedInvoice = Number(demande.montant_facture) || Number(formData.montant_facture) || Number(formData.total_ttc) || Number(formData.montant_ttc) || Number(formData.montant_final);
    if (validatedInvoice > 0) return validatedInvoice;

    const result = calculateInvoiceFromDevis(demande, monthPassages);
    return result.totalTTC;
};

export const extractJoursPassage = (raw: any): string[] => {
    const dayNames = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw
            .map(item => typeof item === 'string' ? item.toLowerCase() : String(item?.jour || item).toLowerCase())
            .map(s => s.trim())
            .filter(j => dayNames.includes(j));
    }
    if (typeof raw === 'string') {
        const parts = raw.split(/[+,/;]|\s+et\s+/i);
        return parts
            .map(p => p.trim().toLowerCase())
            .filter(j => dayNames.includes(j));
    }
    return [];
};

/**
 * Calculates the exact real dynamic number of planned passages for a given subscription and month.
 * Automatically accounts for active days, calendar start date (e.g. mid-month start prorata),
 * and manual overrides / child demand cancellations / postponements on the planning calendar.
 */
export const getDynamicMonthPassagesCount = (demande: any, allDemandes: any[] = []): number => {
    if (!demande) return 0;

    // 2. Compute dynamic passages for current month from active days & calendar bounds
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const mPrefix = `${y}-${String(m + 1).padStart(2, '0')}`;

    const firstOfMonth = new Date(y, m, 1, 0, 0, 0, 0);
    const lastOfMonth = new Date(y, m + 1, 0, 23, 59, 59, 999);

    const dayNames = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    const dayMap: Record<string, number> = {
        dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6
    };

    let days: string[] = [];
    const detail = (demande.formulaire_data as any)?.jours_intervention_detail;
    if (Array.isArray(detail) && detail.length > 0) {
        days = detail.map((item: any) => typeof item === 'string' ? item.toLowerCase() : item?.jour?.toLowerCase()).filter((j: string) => dayNames.includes(j));
    }
    if (days.length === 0) {
        const rawJours = (demande.formulaire_data as any)?.jours_intervention || demande.planning?.jours_intervention || [];
        days = extractJoursPassage(rawJours);
    }
    if (days.length === 0) {
        const rawJoursPassage = (demande.formulaire_data as any)?.jours_passage || demande.jours_passage;
        days = extractJoursPassage(rawJoursPassage);
    }
    if (days.length === 0 && Array.isArray(demande.planning?.semaines)) {
        const found = new Set<string>();
        demande.planning.semaines.forEach((w: any) => {
            if (w.jours && typeof w.jours === 'object') {
                Object.keys(w.jours).forEach((k: string) => {
                    if (w.jours[k]?.selected && dayNames.includes(k.toLowerCase())) {
                        found.add(k.toLowerCase());
                    }
                });
            }
        });
        if (found.size > 0) days = Array.from(found);
    }
    if (days.length === 0) {
        const freqStr = (demande.frequency_label || (demande.formulaire_data as any)?.frequence || '').toLowerCase();
        if (freqStr.includes('2')) days = ['lundi', 'jeudi'];
        else if (freqStr.includes('1')) days = ['samedi'];
        else if (freqStr.includes('4')) days = ['lundi', 'mardi', 'mercredi', 'jeudi'];
        else if (freqStr.includes('5')) days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
        else days = ['lundi', 'mercredi', 'vendredi'];
    }

    const selectedDows = days.map(d => dayMap[d.toLowerCase()]).filter(v => v !== undefined);
    if (selectedDows.length === 0) return getContractBaselinePassages(demande);

    let start = firstOfMonth;
    const startStr = (demande.formulaire_data as any)?.date_demarrage || (demande.formulaire_data as any)?.date_debut || demande.planning?.date_debut || demande.date_intervention;
    if (startStr) {
        const parsedStart = new Date(startStr.includes('T') ? startStr : `${startStr.slice(0, 10)}T00:00:00`);
        if (!isNaN(parsedStart.getTime()) && parsedStart > firstOfMonth && parsedStart <= lastOfMonth) {
            start = parsedStart;
        }
    }

    let end = lastOfMonth;
    const isResilie = (demande.statut || '').toLowerCase() === 'resilie';
    if (isResilie) {
        const endStr = (demande.formulaire_data as any)?.date_fin || demande.planning?.date_fin;
        if (endStr) {
            const parsedEnd = new Date(endStr.includes('T') ? endStr : `${endStr.slice(0, 10)}T23:59:59`);
            if (!isNaN(parsedEnd.getTime()) && parsedEnd >= firstOfMonth && parsedEnd < lastOfMonth) {
                end = parsedEnd;
            }
        }
    }

    const passageDatesSet = new Set<string>();
    for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
        if (selectedDows.includes(cur.getDay())) {
            const isoKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
            passageDatesSet.add(isoKey);
        }
    }

    const dateOverrides = (demande.formulaire_data as any)?.date_overrides || {};
    Object.entries(dateOverrides).forEach(([k, ov]: [string, any]) => {
        if (k.startsWith(mPrefix)) {
            const st = (ov?.statut || '').toLowerCase();
            const isExcluded = ov?.excluded || ['annule', 'annulee', 'reporte', 'reportee', 'retirer'].includes(st);
            if (isExcluded) {
                passageDatesSet.delete(k);
            } else if (ov?.heure && !isExcluded) {
                passageDatesSet.add(k);
            }
        }
    });

    const children = allDemandes.filter(c => Number(c.parent_demande) === Number(demande.id));
    children.forEach((cd: any) => {
        if (cd.date_intervention) {
            const dIso = cd.date_intervention.includes('T') ? cd.date_intervention.split('T')[0] : cd.date_intervention.slice(0, 10);
            if (dIso.startsWith(mPrefix)) {
                const st = (cd.statut || '').toLowerCase();
                if (['annule', 'annulee', 'reporte', 'reportee', 'retirer'].includes(st)) {
                    passageDatesSet.delete(dIso);
                }
            }
        }
    });

    return passageDatesSet.size > 0 ? passageDatesSet.size : getContractBaselinePassages(demande);
};
