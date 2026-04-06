import { useState } from 'react';

import type { Product } from '../../../../types/product';
import ProductDetail from '../../../Product/Product';
import type { FilterCategory } from '../FilterTabs/FilterTabs';
import ProductCard from '../ProductCard/ProductCard';

interface ProductListProps {
  products: Product[];
  category: FilterCategory;
  search: string;
  onAddToCart: (product: Product, quantity: number) => void;
  onReserve: (product: Product, quantity: number) => void;
}

export default function ProductList({
  products,
  category,
  search,
  onAddToCart,
  onReserve,
}: ProductListProps) {
  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null,
  );
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const filtered = products
    .filter((p) => category === '전체' || p.category === category)
    .filter((p) => p.product_name.includes(search));

  if (filtered.length === 0) {
    return <p>상품이 없습니다.</p>;
  }

  const handleProductClick = (productId: number) => {
    setSelectedProductId(productId);
    setIsPanelOpen(true);
  };

  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setTimeout(() => {
      setSelectedProductId(null);
    }, 300);
  };

  return (
    <div className='grid grid-cols-3 gap-6'>
      {filtered.map((product) => (
        <ProductCard
          key={product.product_id}
          product={product}
          onAddToCart={onAddToCart}
          onReserve={onReserve}
          onClick={() => handleProductClick(product.product_id)}
        />
      ))}

      {/* 사이드 패널로 Product 컴포넌트 사용 */}
      <ProductDetail
        productId={selectedProductId}
        isOpen={isPanelOpen}
        onClose={handleClosePanel}
      />
    </div>
  );
}
