import { render, screen } from '@testing-library/react';

import ProductList from './ProductList';
import type { Product } from '../../../../types/product';

const SAMPLE_PRODUCTS: Product[] = [
  {
    product_id: 1,
    product_name: '제주도 3박 4일 여행',
    category: '자연관광',
    price: 890000,
    image: 'https://placehold.co/400x300?text=제주3박4일',
  },
  {
    product_id: 2,
    product_name: '부산 당일치기',
    category: '도시여행',
    price: 230000,
    image: 'https://placehold.co/400x300?text=부산당일',
  },
  {
    product_id: 3,
    product_name: '광주 2박 3일 여행',
    category: '도시여행',
    price: 460000,
    image: 'https://placehold.co/400x300?text=광주2박3일',
  },
];

test('상품 목록이 렌더링된다', () => {
  render(
    <ProductList
      products={SAMPLE_PRODUCTS}
      category='전체'
      search=''
      onAddToCart={() => {}}
      onReserve={() => {}}
    />,
  );
  expect(screen.getByText('제주도 3박 4일 여행')).toBeInTheDocument();
  expect(screen.getByText('부산 당일치기')).toBeInTheDocument();
  expect(screen.getByText('광주 2박 3일 여행')).toBeInTheDocument();
});

test('상품이 없을 때 빈 상태 메시지를 보여준다', () => {
  render(
    <ProductList
      products={[]}
      category='전체'
      search=''
      onAddToCart={() => {}}
      onReserve={() => {}}
    />,
  );
  expect(screen.getByText('상품이 없습니다.')).toBeInTheDocument();
});

test('카테고리 필터가 적용된다', () => {
  render(
    <ProductList
      products={SAMPLE_PRODUCTS}
      category='자연관광'
      search=''
      onAddToCart={() => {}}
      onReserve={() => {}}
    />,
  );
  expect(screen.getByText('제주도 3박 4일 여행')).toBeInTheDocument();
  expect(screen.queryByText('부산 당일치기')).not.toBeInTheDocument();
  expect(screen.queryByText('광주 2박 3일 여행')).not.toBeInTheDocument();
});

test('검색어 필터가 적용된다', () => {
  render(
    <ProductList
      products={SAMPLE_PRODUCTS}
      category='전체'
      search='여행'
      onAddToCart={() => {}}
      onReserve={() => {}}
    />,
  );
  expect(screen.getByText('제주도 3박 4일 여행')).toBeInTheDocument();
  expect(screen.queryByText('부산 당일치기')).not.toBeInTheDocument();
});

test('카테고리와 검색어가 동시에 적용된다', () => {
  render(
    <ProductList
      products={SAMPLE_PRODUCTS}
      category='도시여행'
      search='광주'
      onAddToCart={() => {}}
      onReserve={() => {}}
    />,
  );
  expect(screen.getByText('광주 2박 3일 여행')).toBeInTheDocument();
  expect(screen.queryByText('부산 당일치기')).not.toBeInTheDocument();
});
