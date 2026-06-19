import React from 'react';
import { MenageStandardForm } from './services/MenageStandardForm';
import { GrandMenageForm } from './services/GrandMenageForm';
import { MenageBureauxForm } from './services/MenageBureauxForm';
import { MenageAirBnBForm } from './services/MenageAirBnBForm';
import { PostSinistreForm } from './services/PostSinistreForm';
import { PostDemenagementForm } from './services/PostDemenagementForm';
import { FinChantierForm } from './services/FinChantierForm';
import { PlacementForm } from './services/PlacementForm';
import { AutreServiceForm } from './services/AutreServiceForm';

interface DynamicServiceFormProps {
  serviceKey: string;
  formData: any;
  setFormData: (data: any) => void;
  minDuree: number;
  estimatedResources?: { duration: number; people: number } | null;
  activeSegment?: 'particulier' | 'entreprise' | null;
}

export const DynamicServiceForm: React.FC<DynamicServiceFormProps> = (props) => {
  const sk = (props.serviceKey || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  
  if (sk.includes('menage standard')) return <MenageStandardForm {...props} />;
  if (sk.includes('grand') || sk.includes('approfondi')) return <GrandMenageForm {...props} />;
  if (sk.includes('bureaux')) return <MenageBureauxForm {...props} />;
  if (sk.includes('airbnb') || sk.includes('air bnb')) return <MenageAirBnBForm {...props} />;
  if (sk.includes('sinistre')) return <PostSinistreForm {...props} />;
  if (sk.includes('demenagement')) return <PostDemenagementForm {...props} />;
  if (sk.includes('chantier')) return <FinChantierForm {...props} />;
  if (sk.includes('placement') || sk.includes('gestion')) return <PlacementForm {...props} />;
  if (sk.includes('autre service')) return <AutreServiceForm {...props} />;

  // Par défaut, si rien ne correspond mais que c'est un service de nettoyage
  return null;
};

