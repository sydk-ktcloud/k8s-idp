import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import ReservationButton from './ReservationButton';
import CalendarModal from '../../../components/common/CalendarModal/CalendarModal';
import QuantityControl from '../../../components/common/QuantityControl/QuantityControl';
import { useAddToCart } from '../../../hooks/api/useCartApi';
import { COLORS } from '../../../styles/Colors';
import type { ProductDetail } from '../../../types/api';

interface ProductInfoProps {
  product: ProductDetail;
  product_id: number;
  onClose?: () => void;
}

export default function ProductInfo({
  product,
  product_id,
  onClose,
}: ProductInfoProps) {
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState<{
    product: ProductDetail;
    quantity: number;
    type: 'cart' | 'reserve';
  } | null>(null);

  const addToCartMutation = useAddToCart();

  const handleDateConfirm = (date: string) => {
    if (!pendingItem) return;

    if (pendingItem.type === 'cart') {
      addToCartMutation.mutate(
        {
          product_id: product_id,
          quantity: pendingItem.quantity,
          departure_date: date,
        },
        {
          onSuccess: (data) => {
            console.log('장바구니 추가 성공:', data);
            if (onClose) {
              onClose();
            }
          },
          onError: (error) => {
            console.error('장바구니 추가 실패:', error);
            alert('장바구니 추가에 실패했습니다. 다시 시도해주세요.');
          },
        },
      );
    } else if (pendingItem.type === 'reserve') {
      // 기존 utils의 toPaymentItem 함수가 처리할 수 있는 형식으로 데이터 전달
      navigate('/payment', {
        state: {
          previewItems: [
            {
              product_id: product_id,
              product_name: pendingItem.product.product_name,
              price: pendingItem.product.price,
              quantity: pendingItem.quantity,
              departure_date: date,
              image: pendingItem.product.images?.[0] ?? '',
            },
          ],
        },
      });
    }

    setDateModalOpen(false);
    setPendingItem(null);
  };

  const hasImage = product.images && product.images.length > 0;

  return (
    <div
      className='py-8 border-b-[2px]'
      style={{ borderColor: COLORS.SEARCH_BG }}
    >
      <div id='Top' className='flex justify-between'>
        <div id='TopLeft'>
          <div className='font-semibold text-[20px]'>
            {product.product_name}
          </div>
          <div className='flex items-center gap-3 mt-2'>
            <div
              className='flex px-2 font-medium text-[14px] py-1 rounded-[5px]'
              style={{
                backgroundColor: COLORS.CATEGORY_BG,
                color: COLORS.CATEGORY_TEXT,
              }}
            >
              {product.category}
            </div>
          </div>
        </div>

        <div id='Right' className='flex'>
          {hasImage ? (
            <img
              src={product.images[0]}
              className='rounded-lg w-44'
              alt={product.product_name}
            />
          ) : (
            <div
              className='flex items-center justify-center h-32 rounded-lg w-44'
              style={{ backgroundColor: COLORS.CHECKBOX }}
            ></div>
          )}
        </div>
      </div>

      <div
        id='Bottom'
        className='flex items-center justify-between w-full mt-10'
      >
        <div id='Left' className='flex items-center gap-6'>
          <QuantityControl quantity={quantity} onChange={setQuantity} />

          <div className='flex font-bold text-[25px]'>
            ₩ {product.price.toLocaleString()}
          </div>
        </div>

        <div id='Right' className='flex w-[45%] items-center'>
          <ReservationButton
            product={product}
            quantity={quantity}
            onAddToCart={(product, quantity) => {
              setPendingItem({ product, quantity, type: 'cart' });
              setDateModalOpen(true);
            }}
            onReserve={(product, quantity) => {
              setPendingItem({ product, quantity, type: 'reserve' });
              setDateModalOpen(true);
            }}
          />
        </div>
      </div>

      <CalendarModal
        isOpen={dateModalOpen}
        onConfirm={handleDateConfirm}
        onClose={() => {
          setDateModalOpen(false);
          setPendingItem(null);
        }}
      />
    </div>
  );
}
