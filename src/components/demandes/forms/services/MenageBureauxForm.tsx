import React from 'react';
import { FormBlockProps } from '../ServiceFormBlocks';
import { 
  SurfaceBureauxBlock,
  ServiceBureauxBlock,
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
      <ServiceBureauxBlock {...props} />
      <FrequenceBlock {...props} />
      <DurationBlock {...props} />
      <PeopleBlock {...props} />
      <PlanningBlock {...props} />
    </>
  );
};
