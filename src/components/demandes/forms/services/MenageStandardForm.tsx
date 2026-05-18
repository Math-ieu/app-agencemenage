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

interface MenageStandardFormProps extends FormBlockProps {
  minDuree: number;
  estimatedResources?: { duration: number; people: number } | null;
}

export const MenageStandardForm: React.FC<MenageStandardFormProps> = (props) => {
  return (
    <>
      <HabitationTypeBlock {...props} />
      <FrequenceBlock {...props} />
      <RoomsGridBlock {...props} />
      <DurationBlock {...props} />
      <PeopleBlock {...props} />
      <PlanningBlock {...props} />
      <OptionalServicesBlock {...props} />
    </>
  );
};
