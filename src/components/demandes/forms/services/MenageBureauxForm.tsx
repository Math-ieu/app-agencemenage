import React from 'react';
import { FormBlockProps } from '../ServiceFormBlocks';
import { 
  SurfaceBureauxBlock,
  FrequenceBlock, 
  DurationBlock, 
  PeopleBlock, 
  PlanningBlock
} from '../ServiceFormBlocks';

interface MenageBureauxFormProps extends FormBlockProps {
  minDuree: number;
  estimatedResources?: { duration: number; people: number } | null;
}

export const MenageBureauxForm: React.FC<MenageBureauxFormProps> = (props) => {
  return (
    <>
      <SurfaceBureauxBlock {...props} />
      <FrequenceBlock {...props} />
      <DurationBlock {...props} />
      <PeopleBlock {...props} />
      <PlanningBlock {...props} />
    </>
  );
};
