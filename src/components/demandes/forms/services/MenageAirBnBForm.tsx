import React from 'react';
import { FormBlockProps } from '../ServiceFormBlocks';
import { 
  HabitationTypeBlock,
  FormulesAirbnbBlock,
  PlanningBlock
} from '../ServiceFormBlocks';

interface MenageAirBnBFormProps extends FormBlockProps {
  minDuree: number;
  estimatedResources?: { duration: number; people: number } | null;
}

export const MenageAirBnBForm: React.FC<MenageAirBnBFormProps> = (props) => {
  return (
    <>
      <HabitationTypeBlock {...props} />
      <FormulesAirbnbBlock {...props} />
      <PlanningBlock {...props} />
    </>
  );
};
