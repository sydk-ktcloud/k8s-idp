import { COLORS } from '../../../styles/Colors';

interface QuantityControlProps {
  quantity: number;
  onChange: (quantity: number) => void;
  min?: number;
}

export default function QuantityControl({
  quantity,
  onChange,
  min = 1,
}: QuantityControlProps) {
  return (
    <div className='flex items-center gap-1'>
      <button
        type='button'
        aria-label='수량 감소'
        className='w-7 h-7 rounded-[50%] border-none flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-default'
        style={{ color: COLORS.QUANTITY_TEXT }}
        onClick={() => onChange(quantity - 1)}
        disabled={quantity <= min}
      >
        -
      </button>
      <span
        className='w-5 text-sm text-center cursor-default'
        data-testid='quantity-value'
      >
        {quantity}
      </span>
      <button
        type='button'
        aria-label='수량 증가'
        className='w-7 h-7 rounded-[50%] border-none flex items-center justify-center cursor-pointer'
        onClick={() => onChange(quantity + 1)}
        style={{ color: COLORS.QUANTITY_TEXT }}
      >
        +
      </button>
    </div>
  );
}
