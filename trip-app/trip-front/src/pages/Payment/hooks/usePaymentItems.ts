import { useMemo } from 'react';

import { useGetCartItems } from '../../../hooks/api/useCartApi';
import {
  extractCartItems,
  extractPreviewItems,
  mapCartItemsToPaymentItems,
  mapPreviewItemsToPaymentItems,
} from '../utils/paymentUtils';

export function usePaymentItems(locationState: unknown) {
  const previewItems = useMemo(
    () => mapPreviewItemsToPaymentItems(extractPreviewItems(locationState)),
    [locationState],
  );
  const isPreviewFlow = previewItems.length > 0;
  const {
    data: cartResponse,
    isLoading: isCartLoading,
    error: cartError,
  } = useGetCartItems(!isPreviewFlow);
  const cartItems = useMemo(
    () => mapCartItemsToPaymentItems(extractCartItems(cartResponse)),
    [cartResponse],
  );
  const bookingItems = isPreviewFlow ? previewItems : cartItems;

  return { bookingItems, isPreviewFlow, isCartLoading, cartError };
}
