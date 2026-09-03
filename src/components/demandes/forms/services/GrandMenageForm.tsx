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
  const effectiveMinDuree = Math.max(5, props.minDuree || 5);

  React.useEffect(() => {
    if (props.formData?.duree !== undefined && props.formData.duree < effectiveMinDuree) {
      props.setFormData({ ...props.formData, duree: effectiveMinDuree });
    }
  }, [props.formData?.duree, effectiveMinDuree]);

  return (
    <>
      <HabitationTypeBlock {...props} />
      <SurfaceSliderBlock {...props} />
      <FrequenceBlock {...props} />
      <DurationBlock {...props} minDuree={effectiveMinDuree} />
      <PeopleBlock {...props} />
      <PlanningBlock {...props} />
      <OptionalServicesBlock {...props} />
    </>
  );
};
