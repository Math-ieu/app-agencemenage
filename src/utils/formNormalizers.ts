export const normalizeFrequence = (val?: string) => {
  if (!val) return '';
  const s = String(val).toLowerCase();
  
  if (s.includes('once') || s.includes('ponctuelle') || s.includes('ponctuel') || s.includes('une fois')) return 'une fois';
  if (s.includes('1') && (s.includes('sem') || s.includes('semaine'))) return '1/sem';
  if (s.includes('2') && (s.includes('sem') || s.includes('semaine'))) return '2/sem';
  if (s.includes('3') && (s.includes('sem') || s.includes('semaine'))) return '3/sem';
  if (s.includes('4') && (s.includes('sem') || s.includes('semaine'))) return '4/sem';
  if (s.includes('5') && (s.includes('sem') || s.includes('semaine'))) return '5/sem';
  if (s.includes('6') && (s.includes('sem') || s.includes('semaine'))) return '6/sem';
  if (s.includes('7') && (s.includes('sem') || s.includes('semaine'))) return '7/sem';
  
  if (s.includes('1') && (s.includes('mois') || s.includes('mensuel'))) return '1/mois';
  if (s.includes('2') && (s.includes('mois') || s.includes('mensuel'))) return '2/mois';
  if (s.includes('3') && (s.includes('mois') || s.includes('mensuel'))) return '3/mois';
  if (s.includes('4') && (s.includes('mois') || s.includes('mensuel'))) return '4/mois';
  
  if (s.includes('quotidien') || s.includes('everyday') || s.includes('chaque jour') || s.includes('jour')) return 'quotidien';
  
  if (s.includes('abonnement')) return '1/sem';
  
  if (s.includes('mensuel')) return '1/mois';

  return s === "oneshot" ? "une fois" : val;
};

export const normalizeSexe = (val?: string) => {
  if (!val) return '';
  const s = String(val).toLowerCase();
  if (s.includes('femme')) return 'femme';
  if (s.includes('homme')) return 'homme';
  return val;
};

export const normalizeMobilite = (val?: string) => {
  if (!val) return '';
  const s = String(val).toLowerCase();
  if (s.includes('adulte')) return 'adulte';
  if (s.includes('agée') || s.includes('agee')) return 'agee';
  if (s.includes('autonome')) return 'autonome';
  if (s.includes('aide')) return 'besoin_aide';
  if (s.includes('alité') || s.includes('alite')) return 'alitee';
  return val;
};

export const normalizeStructure = (val?: string) => {
  if (!val) return '';
  const s = String(val).toLowerCase();
  if (s.includes('studio')) return 'Studio';
  if (s.includes('appartement') || s.includes('apartment') || s.includes('residence') || s.includes('résidence')) return 'Appartement';
  if (s.includes('duplex')) return 'Duplex';
  if (s.includes('villa')) return 'Villa';
  if (s.includes('maison') || s.includes('house')) return 'Maison';
  if (s.includes('bureau') || s.includes('office')) return 'Bureau';
  if (s.includes('magasin') || s.includes('boutique') || s.includes('store')) return 'Magasin';
  if (s.includes('restaurant') || s.includes('café') || s.includes('cafe')) return 'Restaurant';
  if (s.includes('clinique') || s.includes('hôpital') || s.includes('hopital')) return 'Clinique';
  if (s.includes('hôtel') || s.includes('riad') || s.includes('hotel')) return 'Hôtel';
  if (s.includes('entrepôt') || s.includes('entrepot') || s.includes('stock')) return 'Entrepôt';
  return String(val);
};

export const normalizePayment = (val?: string) => {
  if (!val) return '';
  const s = String(val).toLowerCase();
  if (s === 'non_paye' || s === 'acompte' || s === 'partiel' || s === 'integral') return s;
  if (s.includes('virement')) return 'virement';
  if (s.includes('chèque') || s.includes('cheque')) return 'cheque';
  if (s.includes('agence')) return 'agence';
  if (s.includes('sur place') || s.includes('sur_place')) return 'sur_place';
  return val;
};

export const normalizeTimePref = (val?: string) => {
  if (!val) return '';
  const s = String(val).toLowerCase();
  if (s.includes('matin') || s.includes('morning')) return 'matin';
  if (s.includes('apres') || s.includes('après') || s.includes('afternoon') || s.includes('midi')) return 'apres_midi';
  return val;
};

export const normalizeQuartier = (val?: string) => {
  if (!val) return '';
  const s = String(val).toLowerCase();
  
  if (s.includes('maârif') || s.includes('maarif')) return 'Maârif';
  if (s.includes('gauthier')) return 'Gauthier';
  if (s.includes('racine')) return 'Racine';
  if (s.includes('palmier')) return 'Palmier';
  if (s.includes('bourgogne')) return 'Bourgogne';
  if (s.includes('ghallef')) return 'Derb Ghallef';
  if (s.includes('hopitaux') || s.includes('hôpitaux')) return 'Hôpitaux';
  if (s.includes('belvedere') || s.includes('belvédère')) return 'Belvédère';
  if (s.includes('roche')) return 'Roches Noires';
  if (s.includes('anfa')) return 'Anfa';
  if (s.includes('diab')) return 'Aïn Diab';
  if (s.includes('californie')) return 'Californie';
  if (s.includes('oasis')) return "L'Oasis";
  if (s.includes('polo')) return 'Polo';
  if (s.includes('cil') || s.includes('hanaa')) return 'CIL (Hay El Hanaa)';
  if (s.includes('maarouf') || s.includes('maârouf')) return 'Sidi Maârouf';
  if (s.includes('cfc') || s.includes('finance')) return 'Casablanca Finance City (CFC)';
  if (s.includes('habou')) return 'Habous (Nouvelle Médina)';
  if (s.includes('ancienne medina') || s.includes('ancienne médina')) return 'Ancienne Médina';
  if (s.includes('mers sultan')) return 'Mers Sultan';
  if (s.includes('derb sultan')) return 'Derb Sultan';
  if (s.includes('mohammadi')) return 'Hay Mohammadi';
  if (s.includes('fida')) return 'Al Fida';
  if (s.includes('chock')) return 'Aïn Chock';
  if (s.includes('hay hassani')) return 'Hay Hassani';
  if (s.includes('sbata')) return 'Sbata';
  if (s.includes('msik') || s.includes("m'sik")) return "Ben M'sik";
  if (s.includes('othman')) return 'Sidi Othmane';
  if (s.includes('moulay rachid')) return 'Moulay Rachid';
  if (s.includes('sebaa') || s.includes('sebaâ')) return 'Aïn Sebaâ';
  if (s.includes('bernoussi')) return 'Sidi Bernoussi';
  if (s.includes('moumen')) return 'Sidi Moumen';
  if (s.includes('lissasfa')) return 'Lissasfa';
  
  if (s.includes('agdal')) return 'Agdal';
  if (s.includes('hassan')) return 'Hassan';
  if (s.includes('hay riad')) return 'Hay Riad';
  if (s.includes('souissi')) return 'Souissi';
  if (s.includes('ocean') || s.includes('océan')) return "L'Océan";
  if (s.includes('oranger')) return 'Les Orangers';
  if (s.includes('ministere') || s.includes('ministère')) return 'Quartier des Ministères';
  if (s.includes('yacoub') || s.includes('mansour')) return 'Yacoub El Mansour';
  if (s.includes('akkari')) return 'Akkari';
  if (s.includes('diour jamaa')) return 'Diour Jamaa';

  if (s.includes('ville verte')) return 'Ville Verte';
  if (s.includes('victoria')) return 'Victoria';
  if (s.includes('cgi')) return 'CGI';
  if (s.includes('golf')) return 'Golf';
  if (s.includes('centre-ville') || s.includes('centre ville')) return 'Centre-ville';
  if (s.includes('industriel')) return 'Quartier Industriel';
  if (s.includes('tamaris')) return 'Tamaris';
  if (s.includes('oued merzeg')) return 'Oued Merzeg';
  if (s.includes('jack beach') || s.includes('jack')) return 'Jack Beach';
  if (s.includes('medina') || s.includes('médina')) return 'Médina';

  return val;
};
