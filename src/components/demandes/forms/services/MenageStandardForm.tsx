import React from 'react';
import { FormBlockProps } from '../ServiceFormBlocks';
import { 
  HabitationTypeBlock, 
  FrequenceBlock, 
  RoomsGridBlock, 
  DurationBlock, 
  PeopleBlock, 
  PlanningBlock, 
  OptionalServicesBlock 
} from '../ServiceFormBlocks';

// Contrôle de visibilité de la section descriptive des pièces (Cuisine, Chambres, etc.)
// Mettre à true pour réactiver l'affichage dans l'application
const SHOW_ROOMS_SECTION = false;

interface MenageStandardFormProps extends FormBlockProps {
  minDuree: number;
  estimatedResources?: { duration: number; people: number } | null;
}

export const MenageStandardForm: React.FC<MenageStandardFormProps> = (props) => {
  return (
    <>
      <HabitationTypeBlock {...props} />
      <FrequenceBlock {...props} />
      {SHOW_ROOMS_SECTION && <RoomsGridBlock {...props} />}
      <DurationBlock {...props} />
      <PeopleBlock {...props} />
      <PlanningBlock {...props} />
      <OptionalServicesBlock {...props} />
    </>
  );
};
