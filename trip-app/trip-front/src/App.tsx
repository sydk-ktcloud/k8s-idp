import { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';

import Cart from './components/cart/Cart';
import CartFloatingButton from './components/cart/CartFloatingButton';
import ScrollToTop from './components/common/ScrollToTop';
import useKakaoLoader from './hooks/useKakaoLoader';
import Main from './pages/Main/Main';
import Payment from './pages/Payment/Payment';
import Product from './pages/Product/Product';
import { COLORS } from './styles/Colors';

export default function App() {
  useKakaoLoader();
  const location = useLocation();
  const [cartOpen, setCartOpen] = useState(false);
  const shouldShowCart = !location.pathname.startsWith('/payment');

  return (
    <div
      style={{
        backgroundColor: COLORS.BG_PRIMARY,
        color: COLORS.TEXT_PRIMARY,
      }}
    >
      <ScrollToTop />
      <Routes>
        <Route path='/' element={<Main />} />
        <Route
          path='/product/:productId'
          element={
            <Product
              productId={null}
              isOpen={false}
              onClose={function (): void {
                throw new Error('Function not implemented.');
              }}
            />
          }
        />
        <Route path='/payment' element={<Payment />} />
      </Routes>
      {shouldShowCart ? (
        <>
          <Cart
            isOpen={cartOpen}
            onClose={() => setCartOpen(false)}
            items={[]}
          />
          <CartFloatingButton
            onClick={() => setCartOpen((prev) => !prev)}
            items={[]}
          />
        </>
      ) : null}
    </div>
  );
}
