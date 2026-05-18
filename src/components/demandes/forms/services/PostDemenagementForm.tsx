import React from 'react';
import { FormBlockProps } from '../ServiceFormBlocks';
import { 
  HabitationTypeBlock,
  SurfaceSliderBlock,
  EtatLogementBlock,
  OptionalServicesBlock,
  PlanningBlock
} from '../ServiceFormBlocks';

interface PostDemenagementFormProps extends FormBlockProps {
  minDuree: number;
  estimatedResources?: { duration: number; people: number } | null;
}

export const PostDemenagementForm: React.FC<PostDemenagementFormProps> = (props) => {
  return (
    <>
      <HabitationTypeBlock {...props} />
      <SurfaceSliderBlock {...props} />
      <EtatLogementBlock {...props} />
      <OptionalServicesBlock {...props} />
      <PlanningBlock {...props} />
    </>
  );
};
