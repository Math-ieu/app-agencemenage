import React from 'react';
import { FormBlockProps } from '../ServiceFormBlocks';
import { 
  HabitationTypeBlock,
  SurfacePostSinistreBlock,
  PlanningBlock
} from '../ServiceFormBlocks';

interface FinChantierFormProps extends FormBlockProps {
  minDuree: number;
  estimatedResources?: { duration: number; people: number } | null;
}

export const FinChantierForm: React.FC<FinChantierFormProps> = (props) => {
  return (
    <>
      <HabitationTypeBlock {...props} />
      <SurfacePostSinistreBlock {...props} />
      <PlanningBlock {...props} />
    </>
  );
};
