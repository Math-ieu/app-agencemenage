import React from 'react';
import { FormBlockProps } from '../ServiceFormBlocks';
import { 
  ServiceTypePlacementBlock,
  StructureTypePlacementBlock,
  FrequenceBlock,
  PeopleBlock
} from '../ServiceFormBlocks';

interface PlacementFormProps extends FormBlockProps {
  minDuree: number;
  estimatedResources?: { duration: number; people: number } | null;
}

export const PlacementForm: React.FC<PlacementFormProps> = (props) => {
  return (
    <>
      <ServiceTypePlacementBlock {...props} />
      <StructureTypePlacementBlock {...props} />
      <FrequenceBlock {...props} />
      <PeopleBlock {...props} />
    </>
  );
};
