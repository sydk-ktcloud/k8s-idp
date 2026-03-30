import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import Cart from './Cart';
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
];

describe('Cart', () => {
  it('isOpen이 false일 때 렌더링되지 않는다', () => {
    render(<Cart isOpen={false} items={[]} onClose={() => {}} />);
    expect(screen.queryByText('장바구니')).not.toBeInTheDocument();
  });

  it('isOpen이 true일 때 렌더링된다', () => {
    render(<Cart isOpen={true} items={SAMPLE_ITEMS} onClose={() => {}} />);
    expect(screen.getByText('장바구니')).toBeInTheDocument();
  });

  it('장바구니가 비어있을 때 안내 메시지를 표시한다', () => {
    render(<Cart isOpen={true} items={[]} onClose={() => {}} />);
    expect(screen.getByText('장바구니가 비어있습니다')).toBeInTheDocument();
  });

  it('장바구니 아이템을 렌더링한다', () => {
    render(<Cart isOpen={true} items={SAMPLE_ITEMS} onClose={() => {}} />);
    expect(screen.getByText('제주도 패키지')).toBeInTheDocument();
  });

  it('닫기 버튼 클릭 시 onClose가 호출된다', async () => {
    const onClose = vi.fn();
    render(<Cart isOpen={true} items={SAMPLE_ITEMS} onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: /close|닫기|×/i });
    closeButton.click();

    expect(onClose).toHaveBeenCalled();
  });
});
