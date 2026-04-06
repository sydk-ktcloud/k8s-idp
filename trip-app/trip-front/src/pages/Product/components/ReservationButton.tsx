import { useState } from 'react';
import { AiOutlineShopping } from 'react-icons/ai';

import { COLORS } from '../../../styles/Colors';
import type { ProductDetail } from '../../../types/api';

interface ReservationButtonProps {
  product: ProductDetail;
  quantity: number;
  onAddToCart: (product: ProductDetail, quantity: number) => void;
  onReserve: (product: ProductDetail, quantity: number) => void;
}

export default function ReservationButton({
  product,
  quantity,
  onAddToCart,
  onReserve,
}: ReservationButtonProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className='flex w-full gap-5'>
      <button
        type='button'
        aria-label='장바구니에 추가'
        onClick={() => onAddToCart(product, quantity)}
        className='p-2 transition-colors border rounded-lg'
        style={{
          borderColor: hovered ? COLORS.CART : COLORS.INFO_BOX,
          color: hovered ? COLORS.BUTTON_MAIN : COLORS.TEXT_SUB,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <AiOutlineShopping size={22} />
      </button>
      <button
        type='button'
        onClick={() => onReserve(product, quantity)}
        className='flex-1 py-3 text-sm font-medium text-white transition-colors rounded-lg'
        style={{ backgroundColor: COLORS.BUTTON_MAIN }}
      >
        예약하기
      </button>
    </div>
  );
}
