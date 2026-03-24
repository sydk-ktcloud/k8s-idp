import { useState } from 'react';
import { AiOutlineShopping } from 'react-icons/ai';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';

import QuantityControl from '../../../../components/common/QuantityControl/QuantityControl';
import { COLORS } from '../../../../styles/Colors';
import type { Product } from '../../../../types/product';

interface PopularProductsProps {
  products: Product[];
  count?: number;
  onAddToCart: (product: Product, quantity: number) => void;
  onReserve: (product: Product, quantity: number) => void;
}

export default function PopularProducts({
  products,
  count = 5,
  onAddToCart,
  onReserve,
}: PopularProductsProps) {
  const displayProducts = products.slice(0, count);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [cartHovered, setCartHovered] = useState(false);

  const handlePrev = () => {
    setIndex((i) => (i - 1 + displayProducts.length) % displayProducts.length);
    setQuantity(1);
  };

  const handleNext = () => {
    setIndex((i) => (i + 1) % displayProducts.length);
    setQuantity(1);
  };

  const current = displayProducts[index];

  return (
    <section
      aria-label='인기 상품'
      className='relative w-full mb-8 overflow-hidden h-80 rounded-2xl'
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 배경 이미지 */}
      <img
        src={current.image}
        alt={current.product_name}
        className='absolute inset-0 object-cover w-full h-full'
      />

      {/* 하단 그라디언트 오버레이 */}
      <div className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent' />

      {/* 상품 정보 */}
      <div className='absolute bottom-0 left-0 right-0 p-6 text-white'>
        <span className='px-2 py-1 text-xs font-medium rounded-full bg-white/20 backdrop-blur-sm'>
          {current.category}
        </span>
        <h2 className='mt-2 text-xl font-bold line-clamp-1'>
          {current.product_name}
        </h2>
        <div className='flex items-center justify-between mt-1'>
          <p className='text-lg font-semibold'>
            {current.price.toLocaleString()}원
          </p>
          <span className='text-sm text-white/70'>
            {index + 1} / {displayProducts.length}
          </span>
        </div>
      </div>

      {/* 이전 버튼 */}
      <button
        aria-label='이전 슬라이드'
        onClick={handlePrev}
        className='absolute flex items-center justify-center text-white transition-colors -translate-y-1/2 rounded-full cursor-pointer left-4 top-1/2 w-9 h-9 bg-white/30 backdrop-blur-sm hover:bg-white/50'
      >
        <IoChevronBack />
      </button>

      {/* 다음 버튼 */}
      <button
        aria-label='다음 슬라이드'
        onClick={handleNext}
        className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 flex items-center justify-center bg-white/30 backdrop-blur-sm     
    rounded-full text-white hover:bg-white/50 transition-colors cursor-pointer`}
      >
        <IoChevronForward />
      </button>

      {/* 호버 시 우측 액션 패널 */}
      <div
        className={`
                    absolute right-0 top-0 h-full w-72
                    flex flex-col items-end justify-end gap-3 pr-6 pb-6
                    bg-gradient-to-r from-transparent to-black/75
                    transition-transform duration-300
                    ${hovered ? 'translate-x-0' : 'translate-x-full'}
                `}
      >
        <QuantityControl quantity={quantity} onChange={setQuantity} />
        <div className='flex items-center gap-2'>
          <button
            type='button'
            aria-label='장바구니에 추가'
            onClick={() => onAddToCart(current, quantity)}
            className='p-2 transition-colors border rounded-lg'
            style={{
              borderColor: cartHovered ? COLORS.CART : COLORS.INFO_BOX,
              color: cartHovered ? COLORS.BUTTON_MAIN : COLORS.TEXT_SUB,
            }}
            onMouseEnter={() => setCartHovered(true)}
            onMouseLeave={() => setCartHovered(false)}
          >
            <AiOutlineShopping style={{ width: '24px', height: '24px' }} />
          </button>
          <button
            type='button'
            onClick={() => onReserve(current, quantity)}
            className='px-10 py-3 text-sm font-medium text-white transition-colors bg-blue-500 rounded-lg hover:bg-blue-600'
          >
            예약하기
          </button>
        </div>
      </div>
    </section>
  );
}
