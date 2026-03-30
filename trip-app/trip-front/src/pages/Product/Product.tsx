import { useEffect, useRef } from 'react';

import ProductDescription from './components/ProductDescription';
import ProductHeader from './components/ProductHeader';
import ProductInfo from './components/ProductInfo';
import ProductMap from './components/ProductMap';
import { useGetProductDetail } from '../../hooks/api/useProductApi';
import { COLORS } from '../../styles/Colors';

interface ProductProps {
  productId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function Product({ productId, isOpen, onClose }: ProductProps) {
  const { data, isLoading, error } = useGetProductDetail(productId || 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // CSS 클래스를 통한 애니메이션 제어
  useEffect(() => {
    if (containerRef.current && overlayRef.current) {
      if (isOpen) {
        // 열기 애니메이션
        containerRef.current.classList.remove('animate-slideOut');
        containerRef.current.classList.add('animate-slideIn');
        overlayRef.current.classList.remove('animate-fadeOut');
        overlayRef.current.classList.add('animate-fadeIn');
      } else {
        // 닫기 애니메이션
        containerRef.current.classList.remove('animate-slideIn');
        containerRef.current.classList.add('animate-slideOut');
        overlayRef.current.classList.remove('animate-fadeIn');
        overlayRef.current.classList.add('animate-fadeOut');
      }
    }
  }, [isOpen]);

  // body 스크롤 제어
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // ESC 키 처리
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // 렌더링 조건: 한 번이라도 열렸다면 DOM에 유지 (CSS로 숨김/보임 처리)
  if (!productId) return null;

  if (isLoading) {
    return (
      <>
        <div
          ref={overlayRef}
          className={`fixed inset-0 bg-black z-40 ${
            isOpen ? '' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onClose}
        />

        <div
          ref={containerRef}
          className={`fixed top-0 right-0 h-full w-[55%] shadow-2xl z-50 flex items-center justify-center transition-transform duration-300 ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{ backgroundColor: COLORS.BG_PRIMARY }}
        >
          <div
            className='text-lg animate-pulse'
            style={{ color: COLORS.TEXT_PRIMARY }}
          >
            로딩 중...
          </div>
        </div>
      </>
    );
  }

  if (error || !data?.data) {
    return (
      <>
        <div
          ref={overlayRef}
          className={`fixed inset-0 bg-black z-40 transition-opacity duration-300 ${
            isOpen ? 'opacity-40' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onClose}
        />

        <div
          ref={containerRef}
          className={`fixed top-0 right-0 h-full w-[55%] shadow-2xl z-50 flex items-center justify-center transition-transform duration-300 ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{ backgroundColor: COLORS.BG_PRIMARY }}
        >
          <div style={{ color: COLORS.REQUIRED }}>
            상품 정보를 불러올 수 없습니다.
          </div>
        </div>
      </>
    );
  }

  const productData = data.data;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        ref={overlayRef}
        className={`fixed inset-0 bg-black backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen
            ? 'bg-opacity-40 opacity-100'
            : 'bg-opacity-0 opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* 메인 사이드 패널 */}
      <div
        ref={containerRef}
        className={`fixed top-0 right-0 h-full w-[55%] shadow-2xl z-50 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ backgroundColor: COLORS.BG_PRIMARY }}
      >
        <div className='flex flex-col h-full'>
          {/* ProductHeader */}
          <div className='flex-shrink-0'>
            <ProductHeader onClose={onClose} />
          </div>

          {/* 스크롤 가능한 영역 */}
          <div className='flex-1 px-10 overflow-y-auto'>
            <ProductInfo
              product={productData}
              product_id={productId}
              onClose={onClose}
            />
            <ProductDescription description={productData.description} />
            <ProductMap addr={productData.addr} />
          </div>
        </div>
      </div>
    </>
  );
}
