import React from 'react';
import { FormBlockProps } from '../ServiceFormBlocks';
import { 
  FormulesAirbnbBlock,
  FrequenceBlock,
  PlanningBlock
} from '../ServiceFormBlocks';

interface MenageAirBnBFormProps extends FormBlockProps {
  minDuree: number;
  estimatedResources?: { duration: number; people: number } | null;
}

export const MenageAirBnBForm: React.FC<MenageAirBnBFormProps> = (props) => {
  return (
    <>
      <FormulesAirbnbBlock {...props} />
      <FrequenceBlock {...props} />
      <PlanningBlock {...props} />
    </>
  );
};
