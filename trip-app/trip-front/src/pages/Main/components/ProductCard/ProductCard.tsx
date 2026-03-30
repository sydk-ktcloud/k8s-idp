import { useState } from 'react';
import { AiOutlineShopping } from 'react-icons/ai';

import QuantityControl from '../../../../components/common/QuantityControl/QuantityControl';
import { COLORS } from '../../../../styles/Colors';
import type { Product } from '../../../../types/product';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, quantity: number) => void;
  onReserve: (product: Product, quantity: number) => void;
  onClick: () => void;
}

export default function ProductCard({
  product,
  onAddToCart,
  onReserve,
  onClick,
}: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [hovered, setHovered] = useState(false);

  const handleCardClick = (e: React.MouseEvent) => {
    // 버튼 클릭은 상세 페이지 이동을 막고, 카드 영역만 이동하도록
    if ((e.target as HTMLElement).tagName === 'BUTTON') {
      return;
    }
    onClick();
  };

  return (
    <div
      className='flex flex-col overflow-hidden transition-shadow border border-gray-200 rounded-lg shadow-sm hover:shadow-md'
      style={{ backgroundColor: COLORS.BG_PRIMARY }}
    >
      {/* 상단: 이미지(좌) + 상품정보(우) */}
      <div className='flex flex-1 cursor-pointer' onClick={handleCardClick}>
        <div
          className='m-5 overflow-hidden rounded-lg w-36 h-36 shrink-0'
          style={{ backgroundColor: COLORS.DESCRIPTION_BG }}
        >
          <img
            src={product.image}
            alt={product.product_name}
            className='object-cover w-full h-full'
          />
        </div>
        <div className='flex flex-col justify-between flex-1 py-5 pr-5'>
          <div>
            <h3 className='text-base font-semibold line-clamp-1'>
              {product.product_name}
            </h3>
            <span className='text-sm' style={{ color: COLORS.TEXT_SUB }}>
              {product.category}
            </span>
          </div>
          <div className='flex items-center justify-between'>
            <span
              className='text-xl font-bold whitespace-nowrap'
              style={{ color: COLORS.BUTTON_MAIN }}
            >
              {product.price.toLocaleString()}원
            </span>
            <QuantityControl quantity={quantity} onChange={setQuantity} />
          </div>
        </div>
      </div>
      {/* 하단: 장바구니 + 예약하기 */}
      <div className='flex items-center gap-3 px-5 pt-3 pb-5 border-t border-gray-100'>
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
          <AiOutlineShopping style={{ width: '24px', height: '24px' }} />
        </button>
        <button
          type='button'
          onClick={() => onReserve(product, quantity)}
          className='flex-1 py-3 text-sm font-medium text-white transition-colors bg-blue-500 rounded-lg hover:bg-blue-600'
        >
          예약하기
        </button>
      </div>
    </div>
  );
}
