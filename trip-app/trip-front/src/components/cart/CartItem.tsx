import { COLORS } from '../../styles/Colors';
import type { CartItem as CartItemType } from '../../types/api';

interface CartItemProps {
  item: CartItemType;
  onRemove: (cartId: number) => void;
}

export default function CartItem({ item, onRemove }: CartItemProps) {
  return (
    <div
      className='flex items-center gap-4 py-4 border-b border-gray-100'
      style={{ borderColor: COLORS.INFO_BOX }}
    >
      {/* 이미지 */}
      <div className='w-20 h-20 overflow-hidden rounded-lg shrink-0'>
        <img
          src={item.image}
          alt={item.product_name}
          className='object-cover w-full h-full'
        />
      </div>

      {/* 정보 */}
      <div className='flex flex-col flex-1 gap-1'>
        <p className='text-sm font-semibold line-clamp-1'>
          {item.product_name}
        </p>
        <p className='text-xs' style={{ color: COLORS.TEXT_SUB }}>
          {item.category}
        </p>
        <p className='text-xs' style={{ color: COLORS.TEXT_SUB }}>
          {item.departure_date}
        </p>
        <div className='flex items-center justify-between mt-1'>
          <span className='text-xs' style={{ color: COLORS.TEXT_SUB }}>
            {item.quantity}명
          </span>
          <span
            className='text-sm font-bold'
            style={{ color: COLORS.BUTTON_MAIN }}
          >
            {item.total_price.toLocaleString()}원
          </span>
        </div>
      </div>

      {/* 삭제 버튼 */}
      <button
        type='button'
        aria-label='삭제'
        onClick={() => onRemove(item.cart_id)}
        className='text-lg leading-none text-gray-400 transition-colors hover:text-red-500'
      >
        ×
      </button>
    </div>
  );
}
