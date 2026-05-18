import React from 'react';
import { FormBlockProps } from '../ServiceFormBlocks';
import { 
  HabitationTypeBlock,
  SurfaceSliderBlock,
  FrequenceBlock,
  DurationBlock, 
  PeopleBlock, 
  PlanningBlock, 
  OptionalServicesBlock 
} from '../ServiceFormBlocks';

interface GrandMenageFormProps extends FormBlockProps {
  minDuree: number;
  estimatedResources?: { duration: number; people: number } | null;
}

export const GrandMenageForm: React.FC<GrandMenageFormProps> = (props) => {
  return (
    <>
      <HabitationTypeBlock {...props} />
      <SurfaceSliderBlock {...props} />
      <FrequenceBlock {...props} />
      <DurationBlock {...props} />
      <PeopleBlock {...props} />
      <PlanningBlock {...props} />
      <OptionalServicesBlock {...props} />
    </>
  );
};
