import { COLORS } from '../../../styles/Colors';

interface ProductDescriptionProps {
  description: string;
}

export default function ProductDescription({
  description,
}: ProductDescriptionProps) {
  return (
    <div
      className='p-5 my-8 whitespace-pre-line rounded-2xl'
      style={{ backgroundColor: COLORS.DESCRIPTION_BG }}
    >
      <div>{description}</div>
    </div>
  );
}
