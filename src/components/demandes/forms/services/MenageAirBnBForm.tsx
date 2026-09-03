import React, { useEffect } from 'react';
import { FormBlockProps } from '../ServiceFormBlocks';
import { 
  FormulesAirbnbBlock,
  PlanningBlock
} from '../ServiceFormBlocks';

interface MenageAirBnBFormProps extends FormBlockProps {
  minDuree: number;
  estimatedResources?: { duration: number; people: number } | null;
}

export const MenageAirBnBForm: React.FC<MenageAirBnBFormProps> = (props) => {
  const { formData, setFormData } = props;

  useEffect(() => {
    if (formData.frequence !== 'une fois') {
      setFormData({
        ...formData,
        frequence: 'une fois'
      });
    }
  }, [formData.frequence]);

  return (
    <>
      <FormulesAirbnbBlock {...props} />
      <PlanningBlock {...props} />
    </>
  );
};
