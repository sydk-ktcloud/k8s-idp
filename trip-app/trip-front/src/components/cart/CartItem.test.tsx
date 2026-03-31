import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CartItem from './CartItem';
import type { CartItem as CartItemType } from '../../types/api';

const SAMPLE_ITEM: CartItemType = {
  cart_id: 1,
  product_id: 101,
  product_name: '제주도 3박 4일 여행',
  price: 890000,
  quantity: 2,
  total_price: 1780000,
  image: 'https://placehold.co/400x300?text=제주3박4일',
  category: '자연관광',
  departure_date: '2026-03-01',
};

test('상품 이미지가 렌더링된다', () => {
  render(<CartItem item={SAMPLE_ITEM} onRemove={() => {}} />);
  const img = screen.getByRole('img');
  expect(img).toHaveAttribute('src', SAMPLE_ITEM.image);
  expect(img).toHaveAttribute('alt', SAMPLE_ITEM.product_name);
});

test('상품명이 렌더링된다', () => {
  render(<CartItem item={SAMPLE_ITEM} onRemove={() => {}} />);
  expect(screen.getByText('제주도 3박 4일 여행')).toBeInTheDocument();
});

test('카테고리가 렌더링된다', () => {
  render(<CartItem item={SAMPLE_ITEM} onRemove={() => {}} />);
  expect(screen.getByText('자연관광')).toBeInTheDocument();
});

test('출발일이 렌더링된다', () => {
  render(<CartItem item={SAMPLE_ITEM} onRemove={() => {}} />);
  expect(screen.getByText('2026-03-01')).toBeInTheDocument();
});

test('수량이 렌더링된다', () => {
  render(<CartItem item={SAMPLE_ITEM} onRemove={() => {}} />);
  expect(screen.getByText('2명')).toBeInTheDocument();
});

test('총 가격이 원화 포맷으로 렌더링된다', () => {
  render(<CartItem item={SAMPLE_ITEM} onRemove={() => {}} />);
  expect(screen.getByText('1,780,000원')).toBeInTheDocument();
});

test('삭제 버튼이 렌더링된다', () => {
  render(<CartItem item={SAMPLE_ITEM} onRemove={() => {}} />);
  expect(screen.getByRole('button', { name: '삭제' })).toBeInTheDocument();
});

test('삭제 버튼 클릭 시 onRemove가 cart_id와 함께 호출된다', async () => {
  const handleRemove = vi.fn();
  const user = userEvent.setup();
  render(<CartItem item={SAMPLE_ITEM} onRemove={handleRemove} />);

  await user.click(screen.getByRole('button', { name: '삭제' }));
  expect(handleRemove).toHaveBeenCalledWith(1);
});
