import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import ProductCard from './ProductCard';
import type { Product } from '../../../../types/product';

const SAMPLE_PRODUCT: Product = {
  product_id: 1,
  product_name: '제주도 3박 4일 여행',
  category: '자연관광',
  price: 890000,
  image: 'https://placehold.co/400x300?text=제주3박4일',
};

describe('ProductCard', () => {
  let mockOnClick: () => void;
  let mockOnAddToCart: (product: Product, quantity: number) => void;
  let mockOnReserve: (product: Product, quantity: number) => void;

  beforeEach(() => {
    mockOnClick = vi.fn();
    mockOnAddToCart = vi.fn();
    mockOnReserve = vi.fn();
  });

  it('상품 이미지가 렌더링된다', () => {
    render(
      <ProductCard
        product={SAMPLE_PRODUCT}
        onClick={mockOnClick}
        onAddToCart={mockOnAddToCart}
        onReserve={mockOnReserve}
      />,
    );
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', SAMPLE_PRODUCT.image);
    expect(img).toHaveAttribute('alt', SAMPLE_PRODUCT.product_name);
  });

  it('상품명이 렌더링된다', () => {
    render(
      <ProductCard
        product={SAMPLE_PRODUCT}
        onClick={mockOnClick}
        onAddToCart={mockOnAddToCart}
        onReserve={mockOnReserve}
      />,
    );
    expect(screen.getByText('제주도 3박 4일 여행')).toBeInTheDocument();
  });

  it('카테고리가 렌더링된다', () => {
    render(
      <ProductCard
        product={SAMPLE_PRODUCT}
        onClick={mockOnClick}
        onAddToCart={mockOnAddToCart}
        onReserve={mockOnReserve}
      />,
    );
    expect(screen.getByText('자연관광')).toBeInTheDocument();
  });

  it('가격이 원화로 렌더링된다', () => {
    render(
      <ProductCard
        product={SAMPLE_PRODUCT}
        onClick={mockOnClick}
        onAddToCart={mockOnAddToCart}
        onReserve={mockOnReserve}
      />,
    );
    expect(screen.getByText('890,000원')).toBeInTheDocument();
  });

  it('장바구니에 담기 버튼이 렌더링된다', () => {
    render(
      <ProductCard
        product={SAMPLE_PRODUCT}
        onClick={mockOnClick}
        onAddToCart={mockOnAddToCart}
        onReserve={mockOnReserve}
      />,
    );
    expect(
      screen.getByRole('button', { name: '장바구니에 추가' }),
    ).toBeInTheDocument();
  });

  it('장바구니에 담기 클릭 시 onAddToCart가 호출된다', async () => {
    const user = userEvent.setup();
    render(
      <ProductCard
        product={SAMPLE_PRODUCT}
        onClick={mockOnClick}
        onAddToCart={mockOnAddToCart}
        onReserve={mockOnReserve}
      />,
    );

    await user.click(screen.getByRole('button', { name: '장바구니에 추가' }));
    expect(mockOnAddToCart).toHaveBeenCalledWith(SAMPLE_PRODUCT, 1);
  });

  it('예약하기 버튼이 렌더링된다', () => {
    render(
      <ProductCard
        product={SAMPLE_PRODUCT}
        onClick={mockOnClick}
        onAddToCart={mockOnAddToCart}
        onReserve={mockOnReserve}
      />,
    );
    expect(
      screen.getByRole('button', { name: '예약하기' }),
    ).toBeInTheDocument();
  });

  it('예약하기 버튼 클릭 시 onReserve가 호출된다', async () => {
    const user = userEvent.setup();
    render(
      <ProductCard
        product={SAMPLE_PRODUCT}
        onClick={mockOnClick}
        onAddToCart={mockOnAddToCart}
        onReserve={mockOnReserve}
      />,
    );

    await user.click(screen.getByRole('button', { name: '예약하기' }));
    expect(mockOnReserve).toHaveBeenCalledWith(SAMPLE_PRODUCT, 1);
  });

  it('수량 변경 후 장바구니 담기 클릭 시 변경된 수량으로 호출된다', async () => {
    const user = userEvent.setup();
    render(
      <ProductCard
        product={SAMPLE_PRODUCT}
        onClick={mockOnClick}
        onAddToCart={mockOnAddToCart}
        onReserve={mockOnReserve}
      />,
    );

    await user.click(screen.getByRole('button', { name: '수량 증가' }));
    await user.click(screen.getByRole('button', { name: '장바구니에 추가' }));
    expect(mockOnAddToCart).toHaveBeenCalledWith(SAMPLE_PRODUCT, 2);
  });

  it('수량 변경 후 예약하기 클릭 시 변경된 수량으로 호출된다', async () => {
    const user = userEvent.setup();
    render(
      <ProductCard
        product={SAMPLE_PRODUCT}
        onClick={mockOnClick}
        onAddToCart={mockOnAddToCart}
        onReserve={mockOnReserve}
      />,
    );

    await user.click(screen.getByRole('button', { name: '수량 증가' }));
    await user.click(screen.getByRole('button', { name: '예약하기' }));
    expect(mockOnReserve).toHaveBeenCalledWith(SAMPLE_PRODUCT, 2);
  });
});
