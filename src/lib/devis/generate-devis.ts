import { Demande } from '../../types';
import logoUrl from '../../assets/LOGO-AGENCE-MENAGE.png';
import signatureUrl from '../../assets/signature.png';
import { genererDevisAirbnb, type DevisAirbnbData } from './devis-airbnb';
import { genererDevisAuxiliaire, type DevisAuxiliaireData } from './devis-auxiliaredevis';
import { genererDevisGestion360, type DevisGestion360Data } from './devis-gestion360';
import { genererDevisMenageBureaux, type DevisMenageBureauxData } from './devis-menagebureux';
import { genererDevisPlacementFlexible, type DevisPlacementFlexibleData } from './devis-placement_flexible';
import { genererDevisPostSinistre, type DevisPostSinistreData } from './devis-post_sinistre';
import { genererDevis as genererDevisFinChantier, type DevisData as DevisFinChantierData } from './devis-nettoyagefinchantier';
import { genererDevisAutreService } from './devis-autreservice';

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatLongDate = (value?: string): string => {
  if (!value) return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const buildDevisNumber = (demande: Demande): string => {
  const year = new Date().getFullYear();
  return `DEV-${year}-${String(demande.id).padStart(4, '0')}`;
};

const getClientPhone = (demande: Demande, form: Record<string, any>): string => {
  return (
    demande.client_phone ||
    demande.client_whatsapp ||
    form.whatsapp_phone ||
    form.telephone ||
    form.phone ||
    '—'
  );
};

const getClientAddress = (demande: Demande, form: Record<string, any>): string => {
  return (
    demande.client_address ||
    form.adresse ||
    form.address ||
    demande.client_city ||
    'Casablanca'
  );
};

const getClientName = (demande: Demande, form: Record<string, any>): string => {
  return (demande.client_name || form.nom || form.client_name || 'Client');
};

const getEntrepriseName = (demande: Demande, form: Record<string, any>): string => {
  return (
    demande.client_detail?.entity_name ||
    form.entityName ||
    form.entity_name ||
    form.raison_sociale ||
    form.raisonSociale ||
    form.entreprise ||
    (demande.client_detail?.segment === 'entreprise' ? demande.client_detail?.display_name : '') ||
    demande.client_name ||
    'Entreprise'
  );
};

const getInterlocuteur = (demande: Demande, form: Record<string, any>): string => {
  return (
    form.interlocuteur ||
    form.contact_name ||
    form.contact_person ||
    form.contactPerson ||
    (demande.client_detail ? `${demande.client_detail.first_name || ''} ${demande.client_detail.last_name || ''}`.trim() : '') ||
    (demande.segment !== 'entreprise' ? demande.client_name : '—')
  );
};

const parseMoney = (value: unknown): number => {
  if (typeof value === 'string') {
    return toNumber(value.replace(/[^-0-9.,]/g, '').replace(',', '.'));
  }
  return toNumber(value);
};

const getTotalPrice = (demande: Demande, form?: Record<string, any>): number => {
  const direct = parseMoney(demande.prix);
  if (direct > 0) return direct;
  if (!form) return direct;
  const fallback =
    parseMoney(form.total) ||
    parseMoney(form.total_ht) ||
    parseMoney(form.total_ttc) ||
    parseMoney(form.prix_total) ||
    parseMoney(form.montant_total) ||
    parseMoney(form.montant) ||
    parseMoney(form.prix) ||
    parseMoney(form.budget) ||
    parseMoney(form.tarif);
  return fallback || direct;
};

const getLogoBase64 = async (): Promise<string | undefined> => {
  try {
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return base64;
  } catch {
    return undefined;
  }
};

const getSignatureBase64 = async (): Promise<string | undefined> => {
  try {
    const response = await fetch(signatureUrl);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return base64;
  } catch {
    return undefined;
  }
};

const getAdvanceFields = (form: Record<string, any>) => {
  return {
    avanceActive: Boolean(form.avance_active),
    avanceType: form.avance_type,
    avancePourcentage: form.avance_pourcentage !== undefined ? Number(form.avance_pourcentage) : undefined,
    avanceFixe: form.avance_fixe !== undefined ? Number(form.avance_fixe) : undefined,
    avancePaiement: form.avance_paiement !== undefined ? Number(form.avance_paiement) : undefined,
  };
};

const buildAirbnbData = (demande: Demande): DevisAirbnbData => {
  const form = demande.formulaire_data || {};
  const total = getTotalPrice(demande, form);
  const objet = `${demande.service} — ${form.type_habitation || form.structure_type || form.structure || 'Logement'}`;

  // Build detailed prestation lines from calculator data
  const lignes: Array<{ designation: string; montant: number }> = [];
  if (Array.isArray(form.prestations) && form.prestations.length) {
    form.prestations.forEach((p: any) => {
      lignes.push({ designation: p.desc || p.designation || p.label || 'Prestation', montant: parseMoney(p.montant || p.prix || 0) });
    });
  } else {
    // Try to build from calculator fields
    const formule = form.formule || 'A';
    const palierLabel = form.palier_label || form.type_habitation || form.structure || 'Logement';
    const prixPassage = parseMoney(form.prix_passage || form.prix_base || total);
    lignes.push({
      designation: form.description_tarif || `Ménage Airbnb — Formule ${formule} — ${palierLabel}`,
      montant: prixPassage,
    });
    const consommables = parseMoney(form.consommables || form.reassort || 0);
    if (consommables > 0) {
      lignes.push({ designation: 'Réassort consommables (savon, papier, etc.)', montant: consommables });
    }
  }
  const totalHT = lignes.reduce((s, l) => s + l.montant, 0) || total;

  return {
    numero: buildDevisNumber(demande),
    date: formatLongDate(demande.created_at || demande.date_intervention),
    client: {
      nom: getClientName(demande, form),
      telephone: getClientPhone(demande, form),
      whatsapp: form.whatsapp_phone || demande.client_whatsapp || getClientPhone(demande, form),
      email: form.email || form.mail || '—',
      adresse: getClientAddress(demande, form),
    },
    objet,
    lignes,
    totalHT,
    note: form.note_devis,
    ...getAdvanceFields(form),
  };
};

const buildAutreServiceData = (demande: Demande) => {
  const form = demande.formulaire_data || {};
  const total = getTotalPrice(demande, form);
  const customServiceType = form.custom_service_type || demande.service || 'Service personnalisé';
  const objet = `${customServiceType} — ${form.property_subtype || form.property_category || 'Sur mesure'}`;

  const lignes: Array<{ designation: string; montant: number }> = [];
  
  lignes.push({
    designation: customServiceType,
    montant: parseMoney(form.amount_ht || total)
  });

  if (Array.isArray(form.options)) {
    form.options.forEach((opt: any) => {
      if (opt.enabled) {
        lignes.push({
          designation: opt.label,
          montant: parseMoney(opt.price || 0)
        });
      }
    });
  }

  const totalHT = lignes.reduce((s, l) => s + l.montant, 0) || total;
  const vatRate = form.vat_rate !== undefined ? Number(form.vat_rate) : 20;
  const tvaAmount = totalHT * (vatRate / 100);
  const totalTTC = totalHT + tvaAmount;

  let avancePaiement = 0;
  if (form.advance_required) {
    if (form.advance_mode === 'percent') {
      avancePaiement = Math.round((totalTTC * (Number(form.advance_percent) || 0)) / 100);
    } else {
      avancePaiement = Number(form.advance_amount) || 0;
    }
  }

  return {
    numero: buildDevisNumber(demande),
    date: formatLongDate(demande.created_at || demande.date_intervention),
    client: {
      nom: getClientName(demande, form),
      telephone: getClientPhone(demande, form),
      whatsapp: form.whatsapp_phone || demande.client_whatsapp || getClientPhone(demande, form),
      email: form.email || form.mail || '—',
      adresse: getClientAddress(demande, form),
    },
    objet,
    lignes,
    totalHT,
    vatRate,
    totalTTC,
    description: form.description || '',
    avanceRequired: Boolean(form.advance_required),
    avanceMode: form.advance_mode,
    avancePercent: form.advance_percent !== undefined ? Number(form.advance_percent) : 30,
    avanceAmount: form.avance_amount !== undefined ? Number(form.avance_amount) : 0,
    avancePaiement,
    surface: form.surface !== undefined ? Number(form.surface) : undefined,
    duree: form.duree !== undefined ? Number(form.duree) : undefined,
    durationUnit: form.duration_unit,
    staffCount: form.nb_intervenants || form.staff_count,
    frequence: form.frequence,
    datePrestation: form.date,
    heurePrestation: form.heure
  };
};

const buildAuxiliaireData = (demande: Demande): DevisAuxiliaireData => {
  const form = demande.formulaire_data || {};
  const total = getTotalPrice(demande, form);
  return {
    numDevis: buildDevisNumber(demande),
    date: formatLongDate(demande.created_at || demande.date_intervention),
    validite: 'Valable 30 jours',
    objet: form.objet || `${demande.service} — Mission ${form.duree || ''}`.trim(),
    client: {
      beneficiaire: form.beneficiaire || form.nom_beneficiaire || getClientName(demande, form),
      donneurOrdre: form.donneur_ordre || form.donneurOrdre || getClientName(demande, form),
      telephone: getClientPhone(demande, form),
      adresse: getClientAddress(demande, form),
    },
    prestations: Array.isArray(form.prestations) && form.prestations.length
      ? form.prestations.map((p: any) => ({ desc: p.desc || p.designation || p.label || 'Prestation', montant: p.montant || p.prix || 0 }))
      : [{ desc: `Prestation ${demande.service}`, montant: total }],
    totalHT: total,
    message: form.message_devis,
    ...getAdvanceFields(form),
  };
};

const buildFinChantierData = (demande: Demande): DevisFinChantierData => {
  const form = demande.formulaire_data || {};
  const total = getTotalPrice(demande, form);
  const surface = toNumber(form.surface || form.superficie || form.m2 || form.surfaceArea || 0);
  const grattageRate = toNumber(form.grattage || form.grattage_rate || 15);
  const grattageLabel = grattageRate <= 12 ? 'Sans grattage' : grattageRate <= 15 ? 'Grattage léger' : 'Grattage profond';
  const isEntreprise = demande.segment === 'entreprise' || form.segment === 'entreprise';

  // Build detailed prestation lines
  const prestations: Array<{ designation: string; montant: number | string }> = [];
  if (Array.isArray(form.prestations) && form.prestations.length) {
    form.prestations.forEach((p: any) => {
      const m = typeof p.montant === 'string' && isNaN(Number(p.montant)) ? p.montant : parseMoney(p.montant || p.prix || 0);
      prestations.push({ designation: p.desc || p.designation || p.label || 'Prestation', montant: m });
    });
  } else {
    // Base nettoyage
    const baseRaw = surface * grattageRate;
    const baseCost = Math.max(baseRaw, 1500);
    const prixBase = parseMoney(form.prix_base || baseCost || total);
    prestations.push({
      designation: form.description_tarif || `Nettoyage fin de chantier — ${surface} m² — ${grattageLabel} (${grattageRate} DH/m²)`,
      montant: prixBase,
    });

    // Vitres
    const surfVitres = toNumber(form.surface_vitres || 0);
    const prixVitres = toNumber(form.prix_vitres || 0);
    if (prixVitres > 0) {
      prestations.push({
        designation: surfVitres > 0 ? `Nettoyage vitres profond — ${surfVitres} m² × 25 DH/m²` : 'Nettoyage vitres léger',
        montant: prixVitres,
      });
    }

    // Déchets
    const poidsDechets = toNumber(form.poids_dechets || 0);
    const prixDechets = toNumber(form.prix_dechets || 0);
    if (prixDechets > 0) {
      prestations.push({
        designation: `Évacuation déchets de chantier${poidsDechets > 0 ? ` (${poidsDechets} kg)` : ''}`,
        montant: prixDechets,
      });
    }

    // Marbre
    const surfMarbre = toNumber(form.surface_marbre || 0);
    const prixMarbre = toNumber(form.prix_marbre || 0);
    if (prixMarbre > 0) {
      prestations.push({
        designation: `Cristallisation marbre — ${surfMarbre} m² × 25 DH/m²`,
        montant: prixMarbre,
      });
    }
  }

  return {
    numDevis: buildDevisNumber(demande),
    date: formatLongDate(demande.created_at || demande.date_intervention),
    client: {
      nom: isEntreprise ? getEntrepriseName(demande, form) : getClientName(demande, form),
      telephone: getClientPhone(demande, form),
      whatsapp: form.whatsapp_phone || demande.client_whatsapp || getClientPhone(demande, form),
      email: form.email || form.mail || '—',
      adresse: getClientAddress(demande, form),
      segment: demande.segment || form.segment,
    },
    prestations,
    surface: surface || 0,
    details: {
      terrasseIncluse: Boolean(form.terrasse_incluse),
      grattageVitres: { surface: toNumber(form.surface_vitres || 0), prix: toNumber(form.prix_vitres || 0) },
      evacuationDechets: { poids: toNumber(form.poids_dechets || 0), prix: toNumber(form.prix_dechets || 0) },
      cristallisationMarbre: { surface: toNumber(form.surface_marbre || 0), prix: toNumber(form.prix_marbre || 0) },
    },
    ...getAdvanceFields(form),
  };
};

const buildPostSinistreData = (demande: Demande): DevisPostSinistreData => {
  const form = demande.formulaire_data || {};
  const total = getTotalPrice(demande, form);
  const surface = toNumber(form.surface || form.superficie || 0);
  const typeSinistre = form.type_sinistre || form.interventionNature || form.type || 'Dégât des eaux';
  const niveau = form.niveau || form.gravite || 'moyen';
  const coeffUrgence = toNumber(form.coefficient_majoration || form.urgence || 1);
  const prixBase = toNumber(form.prix_base || total);
  const isEntreprise = demande.segment === 'entreprise' || form.segment === 'entreprise';

  // Build detailed prestation lines
  const prestations: Array<{ designation: string; montant: number; isMajoration?: boolean }> = [];
  if (Array.isArray(form.prestations) && form.prestations.length) {
    form.prestations.forEach((p: any) => {
      prestations.push({ designation: p.desc || p.designation || 'Prestation', montant: parseMoney(p.montant || p.prix || 0), isMajoration: p.isMajoration });
    });
  } else {
    // Base
    prestations.push({
      designation: form.description_tarif || `Nettoyage post-sinistre — ${typeSinistre} niveau ${niveau} — ${surface} m²`,
      montant: prixBase,
    });
    // Majoration urgence
    const majorationMontant = toNumber(form.majoration_montant || 0);
    if (majorationMontant > 0 || coeffUrgence > 1) {
      const maj = majorationMontant || Math.round(prixBase * (coeffUrgence - 1));
      prestations.push({
        designation: `Majoration intervention urgente (x${coeffUrgence})`,
        montant: maj,
        isMajoration: true,
      });
    }
    // Options
    const desodorisation = toNumber(form.desodorisation || 0);
    if (desodorisation > 0) {
      prestations.push({ designation: 'Désodorisation et désinfection complète', montant: desodorisation });
    }
    const evacuation = toNumber(form.evacuation || form.evacuation_mobilier || 0);
    if (evacuation > 0) {
      prestations.push({ designation: 'Évacuation mobilier endommagé', montant: evacuation });
    }
    const rapportPhoto = toNumber(form.rapport_photo || 0);
    if (rapportPhoto > 0) {
      prestations.push({ designation: 'Rapport photographique PDF (avant / après par zone)', montant: rapportPhoto });
    }
  }

  return {
    numDevis: buildDevisNumber(demande),
    date: formatLongDate(demande.created_at || demande.date_intervention),
    client: {
      nom: isEntreprise ? getEntrepriseName(demande, form) : getClientName(demande, form),
      telephone: getClientPhone(demande, form),
      whatsapp: form.whatsapp_phone || demande.client_whatsapp || getClientPhone(demande, form),
      email: form.email || form.mail || '—',
      adresse: getClientAddress(demande, form),
      segment: demande.segment || form.segment,
    },
    prestations,
    details: {
      typeSinistre,
      niveau,
      surface,
      prixBase,
      coefficientMajoration: coeffUrgence,
      majorationMontant: toNumber(form.majoration_montant || 0),
      desodorisation: toNumber(form.desodorisation || 0),
      rapportPhoto: toNumber(form.rapport_photo || 0),
    },
    ...getAdvanceFields(form),
  };
};

const buildMenageBureauxData = (demande: Demande): DevisMenageBureauxData => {
  const form = demande.formulaire_data || {};
  const total = getTotalPrice(demande, form);
  const heures = toNumber(form.nb_heures || form.heures || 3);
  const nbIntervenantes = toNumber(form.nb_intervenantes || form.nb_intervenants || 1);
  const nbPassages = toNumber(form.nb_passages_mois || form.nb_passages || 4);
  const prixBase = toNumber(form.prix_base || form.prixBase || total);
  const prixProduits = toNumber(form.prix_produits || form.prixProduits || 0);

  const baseDesignation = form.description_tarif ||
    `Ménage bureaux — ${heures}h × ${nbIntervenantes} intervenante × ${nbPassages} passages/mois`;

  const prestations: Array<{ designation: string; montant: number | string }> = [];

  if (Array.isArray(form.prestations) && form.prestations.length > 0) {
    form.prestations.forEach((p: any) => {
      prestations.push({
        designation: p.desc || p.designation || p.label || 'Prestation',
        montant: parseMoney(p.montant || p.prix || 0)
      });
    });
  } else {
    prestations.push({ designation: baseDesignation, montant: prixBase });
    if (prixProduits > 0) {
      prestations.push({
        designation: "Produits ménagers professionnels fournis par l'agence",
        montant: prixProduits,
      });
    }
  }

  return {
    numDevis: buildDevisNumber(demande),
    date: formatLongDate(demande.created_at || demande.date_intervention),
    client: {
      raisonSociale: getEntrepriseName(demande, form),
      interlocuteur: getInterlocuteur(demande, form),
      telephone: getClientPhone(demande, form),
      whatsapp: form.whatsapp_phone || demande.client_whatsapp || getClientPhone(demande, form),
      email: form.email || form.mail || '—',
      adresse: getClientAddress(demande, form),
    },
    prestations,
    details: {
      dureeParSession: heures || 0,
      nbIntervenantes: nbIntervenantes || 1,
      nbPassagesParMois: nbPassages || 4,
      reductionAbonnement: toNumber(form.reduction_abonnement || 0),
      prixBase,
      prixProduits,
    },
    ...getAdvanceFields(form),
  };
};

const buildPlacementFlexibleData = (demande: Demande): DevisPlacementFlexibleData => {
  const form = demande.formulaire_data || {};
  const total = getTotalPrice(demande, form);
  const nbIntervenantes = toNumber(form.nb_intervenantes || form.nb_intervenants || 1);
  const heuresParJour = toNumber(form.heures_par_jour || form.nb_heures || 4);
  const joursParSemaine = toNumber(form.jours_par_semaine || 5);
  const heuresParMois = toNumber(form.heures_par_mois || heuresParJour * joursParSemaine * 4);
  const prixBase = toNumber(form.prix_base || form.prixBase || total);
  const reduction = toNumber(form.reduction || form.reduction_montant || 0);
  const reductionPourcentage = toNumber(form.reduction_pourcentage || form.reductionPourcentage || 0) ||
    (prixBase > 0 && reduction > 0 ? Math.round((reduction / prixBase) * 100) : 0);
  const tenueTravail = toNumber(form.tenue_travail || form.tenueTravail || 0);
  const baseDesignation = form.description_tarif ||
    `Mise à disposition — ${nbIntervenantes} intervenante — ${heuresParJour}h/j × ${joursParSemaine}j/sem (${heuresParMois}h/mois)`;
  const prestations: Array<{ designation: string; montant: number | string; isReduction?: boolean }> = [
    { designation: baseDesignation, montant: prixBase },
  ];
  if (form.frequency === 'subscription') {
    const freqDiscountMontant = Math.round(prixBase * 0.10);
    prestations.push({
      designation: 'Remise abonnement (–10%)',
      montant: -freqDiscountMontant,
      isReduction: true,
    });
    const engDiscount = form.engagement_mois === 12 ? 0.10 : form.engagement_mois === 6 ? 0.05 : 0;
    if (engDiscount > 0) {
      const engDiscountMontant = Math.round(prixBase * engDiscount);
      prestations.push({
        designation: `Réduction engagement ${form.engagement_mois} mois (–${Math.round(engDiscount * 100)}%)`,
        montant: -engDiscountMontant,
        isReduction: true,
      });
    }
  } else {
    if (reduction > 0) {
      prestations.push({
        designation: `Réduction engagement ${toNumber(form.engagement_mois || 0) || ''} mois (${reductionPourcentage ? `–${reductionPourcentage}%` : 'réduction'})`.trim(),
        montant: -Math.abs(reduction),
        isReduction: true,
      });
    }
  }
  if (tenueTravail > 0) {
    prestations.push({
      designation: 'Tenue de travail fournie (coût unique — 1er mois)',
      montant: tenueTravail,
    });
  }
  return {
    numDevis: buildDevisNumber(demande),
    date: formatLongDate(demande.created_at || demande.date_intervention),
    client: {
      raisonSociale: getEntrepriseName(demande, form),
      interlocuteur: getInterlocuteur(demande, form),
      telephone: getClientPhone(demande, form),
      whatsapp: form.whatsapp_phone || demande.client_whatsapp || getClientPhone(demande, form),
      email: form.email || form.mail || '—',
      adresse: getClientAddress(demande, form),
    },
    prestations,
    details: {
      nbIntervenantes,
      heuresParJour,
      joursParSemaine,
      heuresParMois,
      prixBase,
      reduction,
      reductionPourcentage,
      engagementMois: toNumber(form.engagement_mois || 0),
      tenueTravail,
      prixApresReduction: Math.max(0, prixBase - reduction),
    },
    ...getAdvanceFields(form),
  };
};

const buildGestion360Data = (demande: Demande): DevisGestion360Data => {
  const form = demande.formulaire_data || {};
  const total = getTotalPrice(demande, form);
  const nbIntervenantes = toNumber(form.nb_intervenantes || form.nb_intervenants || 2);
  const heuresParJour = toNumber(form.heures_par_jour || 4);
  const joursParSemaine = toNumber(form.jours_par_semaine || 5);
  const heuresParMois = toNumber(form.heures_par_mois || heuresParJour * joursParSemaine * 4);
  const prixBase = toNumber(form.prix_base || form.prixBase || total);
  const reduction = toNumber(form.reduction || form.reduction_montant || 0);
  const prestations: Array<{ designation: string; montant: number | string; isReduction?: boolean }> = [
    {
      designation: form.description_tarif ||
        `Gestion 360° — ${nbIntervenantes} intervenante(s) — ${heuresParJour}h/j × ${joursParSemaine}j/sem (${heuresParMois}h/mois)`,
      montant: prixBase,
    },
  ];
  if (form.frequency === 'subscription') {
    const freqDiscountMontant = Math.round(prixBase * 0.10);
    prestations.push({
      designation: 'Remise abonnement (–10%)',
      montant: -freqDiscountMontant,
      isReduction: true,
    });
    const engDiscount = form.engagement_mois === 12 ? 0.10 : form.engagement_mois === 6 ? 0.05 : 0;
    if (engDiscount > 0) {
      const engDiscountMontant = Math.round(prixBase * engDiscount);
      prestations.push({
        designation: `Réduction engagement ${form.engagement_mois} mois (–${Math.round(engDiscount * 100)}%)`,
        montant: -engDiscountMontant,
        isReduction: true,
      });
    }
  } else {
    if (reduction > 0) {
      prestations.push({
        designation: `Réduction engagement ${toNumber(form.engagement_mois || 0) || ''} mois (${prixBase > 0 && reduction > 0 ? `–${Math.round((reduction / prixBase) * 100)}%` : 'réduction'})`.trim(),
        montant: -Math.abs(reduction),
        isReduction: true,
      });
    }
  }
  prestations.push(
    { designation: `Tenues de travail incluses (${nbIntervenantes} personne${nbIntervenantes > 1 ? 's' : ''})`, montant: 'Inclus' },
    { designation: 'Supervision qualité incluse (≥3 personnes)', montant: 'Inclus' }
  );
  return {
    numDevis: buildDevisNumber(demande),
    date: formatLongDate(demande.created_at || demande.date_intervention),
    client: {
      raisonSociale: getEntrepriseName(demande, form),
      interlocuteur: getInterlocuteur(demande, form),
      telephone: getClientPhone(demande, form),
      whatsapp: form.whatsapp_phone || demande.client_whatsapp || getClientPhone(demande, form),
      email: form.email || form.mail || '—',
      adresse: getClientAddress(demande, form),
    },
    prestations,
    details: {
      nbIntervenantes,
      heuresParJour,
      joursParSemaine,
      heuresParMois,
      prixBase,
      reduction,
      engagementMois: toNumber(form.engagement_mois || 0),
    },
    ...getAdvanceFields(form),
  };
};

const getServiceKey = (service: string): string => service.toLowerCase().trim();

export const generateDevisPdf = async (demande: Demande): Promise<{ blob: Blob; name: string }> => {
  const serviceKey = getServiceKey(demande.service || '');
  const logoBase64 = await getLogoBase64();
  const signatureBase64 = await getSignatureBase64();
  const name = `${buildDevisNumber(demande)}.pdf`;

  let blob: Blob;

  if (demande.formulaire_data?.is_autre_service === true || serviceKey.includes('autre service') || serviceKey.includes('autre_service')) {
    const data = buildAutreServiceData(demande);
    blob = await genererDevisAutreService(data, logoBase64, signatureBase64);
  } else if (serviceKey.includes('air bnb') || serviceKey.includes('airbnb')) {
    const data = buildAirbnbData(demande);
    blob = await genererDevisAirbnb(data, logoBase64, signatureBase64);
  } else if (serviceKey.includes('auxiliaire')) {
    const data = buildAuxiliaireData(demande);
    blob = await genererDevisAuxiliaire(data, logoBase64, signatureBase64);
  } else if (serviceKey.includes('post-sinistre') || serviceKey.includes('post sinistre')) {
    const data = buildPostSinistreData(demande);
    blob = await genererDevisPostSinistre(data, logoBase64, signatureBase64);
  } else if (serviceKey.includes('fin de chantier') || serviceKey.includes('fin chantier')) {
    const data = buildFinChantierData(demande);
    blob = await genererDevisFinChantier(data, logoBase64, signatureBase64);
  } else if (serviceKey.includes('bureaux')) {
    const data = buildMenageBureauxData(demande);
    blob = await genererDevisMenageBureaux(data, logoBase64, signatureBase64);
  } else if (serviceKey.includes('gestion 360') || serviceKey.includes('gestion360')) {
    const data = buildGestion360Data(demande);
    blob = await genererDevisGestion360(data, logoBase64, signatureBase64);
  } else if (serviceKey.includes('placement') || serviceKey.includes('gestion')) {
    const serviceType = demande.formulaire_data?.service_type;
    if (serviceType === 'premium' || serviceType === 'gestion360') {
      const data = buildGestion360Data(demande);
      blob = await genererDevisGestion360(data, logoBase64, signatureBase64);
    } else {
      const data = buildPlacementFlexibleData(demande);
      blob = await genererDevisPlacementFlexible(data, logoBase64, signatureBase64);
    }
  } else {
    const data = buildAirbnbData(demande);
    blob = await genererDevisAirbnb(data, logoBase64, signatureBase64);
  }

  if (!blob.type) {
    blob = new Blob([blob], { type: 'application/pdf' });
  }

  return { blob, name };
};
