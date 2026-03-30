import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import CartFloatingButton from './CartFloatingButton';
import type { CartItem } from '../../types/api';

const SAMPLE_ITEMS: CartItem[] = [
  {
    cart_id: 1,
    product_id: 101,
    product_name: '제주도 패키지',
    price: 200000,
    quantity: 2,
    total_price: 400000,
    image: 'https://example.com/image1.jpg',
    category: '국내여행',
    departure_date: '2026-03-01',
  },
  {
    cart_id: 2,
    product_id: 102,
    product_name: '부산 패키지',
    price: 150000,
    quantity: 1,
    total_price: 150000,
    image: 'https://example.com/image2.jpg',
    category: '국내여행',
    departure_date: '2026-03-05',
  },
];

describe('CartFloatingButton', () => {
  it('장바구니가 비어있을 때 렌더링되지 않는다', () => {
    const { container } = render(
      <CartFloatingButton items={[]} onClick={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('장바구니에 아이템이 있을 때 렌더링된다', () => {
    render(<CartFloatingButton items={SAMPLE_ITEMS} onClick={() => {}} />);
    expect(screen.getByText('3')).toBeInTheDocument(); // 2 + 1 = 3개
  });

  it('총 수량을 표시한다', () => {
    render(<CartFloatingButton items={SAMPLE_ITEMS} onClick={() => {}} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('클릭 시 onClick이 호출된다', async () => {
    const handleClick = vi.fn();
    render(<CartFloatingButton items={SAMPLE_ITEMS} onClick={handleClick} />);

    const button = screen.getByRole('button');
    button.click();

    expect(handleClick).toHaveBeenCalled();
  });
});
