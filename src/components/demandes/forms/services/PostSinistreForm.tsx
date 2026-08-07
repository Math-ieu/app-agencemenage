import React from 'react';
import { FormBlockProps } from '../ServiceFormBlocks';
import { 
  HabitationTypeBlock,
  InterventionNatureBlock,
  SurfacePostSinistreBlock,
  FrequenceBlock,
  PlanningBlock
} from '../ServiceFormBlocks';

interface PostSinistreFormProps extends FormBlockProps {
  minDuree: number;
  estimatedResources?: { duration: number; people: number } | null;
}

export const PostSinistreForm: React.FC<PostSinistreFormProps> = (props) => {
  return (
    <>
      <HabitationTypeBlock {...props} />
      <InterventionNatureBlock {...props} />
      <SurfacePostSinistreBlock {...props} />
      <FrequenceBlock {...props} />
      <PlanningBlock {...props} />
    </>
  );
};
