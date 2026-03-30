import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import PopularProducts from './PopularProducts';
import type { Product } from '../../../../types/product';

const SAMPLE_PRODUCTS: Product[] = [
  {
    product_id: 1,
    product_name: '제주도 3박 4일 여행',
    category: '자연관광',
    price: 890000,
    image: 'https://placehold.co/400x300?text=제주',
  },
  {
    product_id: 2,
    product_name: '부산 당일치기',
    category: '도시여행',
    price: 230000,
    image: 'https://placehold.co/400x300?text=부산',
  },
  {
    product_id: 3,
    product_name: '강릉 3박 4일 여행',
    category: '도시여행',
    price: 660000,
    image: 'https://placehold.co/400x300?text=강릉',
  },
];

const noop = () => {};

describe('PopularProducts', () => {
  it('슬라이더가 렌더링된다', () => {
    render(
      <PopularProducts
        products={SAMPLE_PRODUCTS}
        onAddToCart={noop}
        onReserve={noop}
      />,
    );
    expect(
      screen.getByRole('region', { name: '인기 상품' }),
    ).toBeInTheDocument();
  });

  it('첫 번째 상품이 표시된다', () => {
    render(
      <PopularProducts
        products={SAMPLE_PRODUCTS}
        onAddToCart={noop}
        onReserve={noop}
      />,
    );
    expect(screen.getByText('제주도 3박 4일 여행')).toBeInTheDocument();
  });

  it('다음 버튼 클릭 시 다음 상품으로 이동한다', async () => {
    const user = userEvent.setup();
    render(
      <PopularProducts
        products={SAMPLE_PRODUCTS}
        onAddToCart={noop}
        onReserve={noop}
      />,
    );

    await user.click(screen.getByRole('button', { name: '다음 슬라이드' }));
    expect(screen.getByText('부산 당일치기')).toBeInTheDocument();
  });

  it('이전 버튼 클릭 시 이전 상품으로 이동한다', async () => {
    const user = userEvent.setup();
    render(
      <PopularProducts
        products={SAMPLE_PRODUCTS}
        onAddToCart={noop}
        onReserve={noop}
      />,
    );

    await user.click(screen.getByRole('button', { name: '다음 슬라이드' }));
    await user.click(screen.getByRole('button', { name: '이전 슬라이드' }));
    expect(screen.getByText('제주도 3박 4일 여행')).toBeInTheDocument();
  });

  it('마지막 슬라이드에서 다음 클릭 시 첫 번째로 돌아간다', async () => {
    const user = userEvent.setup();
    render(
      <PopularProducts
        products={SAMPLE_PRODUCTS}
        onAddToCart={noop}
        onReserve={noop}
      />,
    );

    await user.click(screen.getByRole('button', { name: '다음 슬라이드' }));
    await user.click(screen.getByRole('button', { name: '다음 슬라이드' }));
    await user.click(screen.getByRole('button', { name: '다음 슬라이드' }));
    expect(screen.getByText('제주도 3박 4일 여행')).toBeInTheDocument();
  });

  it('첫 번째 슬라이드에서 이전 클릭 시 마지막으로 돌아간다', async () => {
    const user = userEvent.setup();
    render(
      <PopularProducts
        products={SAMPLE_PRODUCTS}
        onAddToCart={noop}
        onReserve={noop}
      />,
    );

    await user.click(screen.getByRole('button', { name: '이전 슬라이드' }));
    expect(screen.getByText('강릉 3박 4일 여행')).toBeInTheDocument();
  });

  it('현재 슬라이드 인디케이터가 표시된다', () => {
    render(
      <PopularProducts
        products={SAMPLE_PRODUCTS}
        onAddToCart={noop}
        onReserve={noop}
      />,
    );
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('count prop으로 표시 개수가 제한된다', async () => {
    const user = userEvent.setup();
    render(
      <PopularProducts
        products={SAMPLE_PRODUCTS}
        count={2}
        onAddToCart={noop}
        onReserve={noop}
      />,
    );

    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다음 슬라이드' }));
    await user.click(screen.getByRole('button', { name: '다음 슬라이드' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('장바구니에 추가 버튼 클릭 시 onAddToCart가 호출된다', async () => {
    const handleAddToCart = vi.fn();
    const user = userEvent.setup();
    render(
      <PopularProducts
        products={SAMPLE_PRODUCTS}
        onAddToCart={handleAddToCart}
        onReserve={noop}
      />,
    );

    await user.click(screen.getByRole('button', { name: '장바구니에 추가' }));
    expect(handleAddToCart).toHaveBeenCalledWith(SAMPLE_PRODUCTS[0], 1);
  });

  it('예약하기 버튼 클릭 시 onReserve가 호출된다', async () => {
    const handleReserve = vi.fn();
    const user = userEvent.setup();
    render(
      <PopularProducts
        products={SAMPLE_PRODUCTS}
        onAddToCart={noop}
        onReserve={handleReserve}
      />,
    );

    await user.click(screen.getByRole('button', { name: '예약하기' }));
    expect(handleReserve).toHaveBeenCalledWith(SAMPLE_PRODUCTS[0], 1);
  });

  it('슬라이드 이동 후 수량이 1로 초기화된다', async () => {
    const handleAddToCart = vi.fn();
    const user = userEvent.setup();
    render(
      <PopularProducts
        products={SAMPLE_PRODUCTS}
        onAddToCart={handleAddToCart}
        onReserve={noop}
      />,
    );

    await user.click(screen.getByRole('button', { name: '수량 증가' }));
    await user.click(screen.getByRole('button', { name: '다음 슬라이드' }));
    await user.click(screen.getByRole('button', { name: '장바구니에 추가' }));
    expect(handleAddToCart).toHaveBeenCalledWith(SAMPLE_PRODUCTS[1], 1);
  });
});
