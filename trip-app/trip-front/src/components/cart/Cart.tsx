import { useNavigate } from 'react-router-dom';

import CartItems from './CartItem';
import { useGetCartItems, useDeleteCartItem } from '../../hooks/api/useCartApi';
import { COLORS } from '../../styles/Colors';
import type { CartItem } from '../../types/product';

interface CartProps {
  items: CartItem[];
  isOpen: boolean;
  onClose: () => void;
}

export default function Cart({ isOpen, onClose }: CartProps) {
  const navigate = useNavigate();
  const { data, isLoading } = useGetCartItems();
  const { mutate: deleteItem } = useDeleteCartItem();

  const items = data?.data ?? [];
  const totalPrice = items.reduce(
    (sum: number, item: CartItem) => sum + item.total_price,
    0,
  );
  const totalItems = items.reduce(
    (sum: number, item: CartItem) => sum + item.quantity,
    0,
  );

  return (
    <>
      {isOpen && (
        <div
          className='fixed inset-0 z-40 bg-black/30'
          onClick={onClose}
          data-testid='cart-overlay'
        />
      )}
      <div
        data-testid='cart-panel'
        className={`fixed right-0 top-0 h-full w-96 shadow-xl z-50 flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ backgroundColor: COLORS.BG_PRIMARY }}
      >
        {/* 헤더 */}
        <div
          className='flex items-center justify-between p-4 border-b'
          style={{ borderColor: COLORS.INFO_BOX }}
        >
          <h2 className='text-lg font-bold'>장바구니</h2>
          <button
            type='button'
            aria-label='장바구니 닫기'
            onClick={onClose}
            className='text-2xl leading-none'
            style={{ color: COLORS.TEXT_SUB }}
          >
            &times;
          </button>
        </div>

        {/* 바디 */}
        <div className='flex-1 px-4 overflow-y-auto'>
          {isLoading ? (
            <p className='mt-10 text-center' style={{ color: COLORS.TEXT_SUB }}>
              불러오는 중...
            </p>
          ) : items.length === 0 ? (
            <p className='mt-10 text-center' style={{ color: COLORS.TEXT_SUB }}>
              장바구니가 비어있습니다
            </p>
          ) : (
            items.map((item: CartItem) => (
              <CartItems
                key={item.cart_id}
                item={item}
                onRemove={(cartId: number) => deleteItem(cartId)}
              />
            ))
          )}
        </div>

        {/* 푸터 */}
        <div className='p-4 border-t' style={{ borderColor: COLORS.INFO_BOX }}>
          <div className='flex items-center justify-between mb-3'>
            <span className='text-sm' style={{ color: COLORS.TEXT_SUB }}>
              {totalItems}건의 여행 상품
            </span>
            <span
              className='text-lg font-bold'
              style={{ color: COLORS.BUTTON_MAIN }}
            >
              {totalPrice.toLocaleString()}원
            </span>
          </div>
          <button
            type='button'
            aria-label='결제하기'
            onClick={() => {
              onClose();
              navigate('/payment');
            }}
            className='w-full py-3 font-medium text-white transition-colors bg-blue-500 rounded-lg hover:bg-blue-600'
          >
            결제하기
          </button>
        </div>
      </div>
    </>
  );
}
