import { AiOutlineShopping } from 'react-icons/ai';

import { useGetCartItems } from '../../hooks/api/useCartApi';
import type { CartItem } from '../../types/product';

interface CartFloatingButtonProps {
  items: CartItem[];
  onClick: () => void;
}

export default function CartFloatingButton({
  onClick,
}: CartFloatingButtonProps) {
  const { data } = useGetCartItems();
  const items = data?.data ?? [];
  const totalItems = items.reduce(
    (sum: number, item: CartItem) => sum + item.quantity,
    0,
  );

  return (
    <div className='fixed z-30 bottom-6 right-6'>
      <button
        type='button'
        aria-label='장바구니 열기'
        onClick={onClick}
        className='relative flex items-center justify-center text-white transition-colors bg-blue-500 rounded-full shadow-lg w-14 h-14 hover:bg-blue-600'
      >
        {/* 장바구니 아이콘 */}
        <AiOutlineShopping style={{ width: '24px', height: '24px' }} />

        {/* 수량 뱃지 */}
        {totalItems > 0 && (
          <span
            data-testid='cart-badge'
            className='absolute flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full -top-1 -right-1'
          >
            {totalItems}
          </span>
        )}
      </button>
    </div>
  );
}
