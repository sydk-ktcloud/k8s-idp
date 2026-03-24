import { useMemo, useState } from 'react';

import type { PaymentItem } from '../../../types/payment';

export function usePaymentSelection(bookingItems: PaymentItem[]) {
  const [selectedItems, setSelectedItems] = useState<Record<number, boolean>>(
    {},
  );
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const defaultQuantities = useMemo(
    () =>
      bookingItems.reduce<Record<number, number>>((acc, item) => {
        acc[item.id] = item.quantity;
        return acc;
      }, {}),
    [bookingItems],
  );

  const effectiveSelectedItems = useMemo(
    () =>
      bookingItems.reduce<Record<number, boolean>>((acc, item) => {
        acc[item.id] = selectedItems[item.id] ?? true;
        return acc;
      }, {}),
    [bookingItems, selectedItems],
  );

  const effectiveQuantities = useMemo(
    () =>
      bookingItems.reduce<Record<number, number>>((acc, item) => {
        acc[item.id] = quantities[item.id] ?? defaultQuantities[item.id] ?? 1;
        return acc;
      }, {}),
    [bookingItems, defaultQuantities, quantities],
  );

  const handleItemCheckChange = (itemId: number) => {
    setSelectedItems((prev) => {
      const current = prev[itemId] ?? true;
      return { ...prev, [itemId]: !current };
    });
  };

  const handleQuantityChange = (itemId: number, delta: number) => {
    setQuantities((prev) => {
      const current = prev[itemId] ?? defaultQuantities[itemId] ?? 1;
      const nextValue = Math.max(1, current + delta);
      return { ...prev, [itemId]: nextValue };
    });
  };

  const selectedPaymentItems = useMemo(() => {
    return bookingItems
      .filter((item) => effectiveSelectedItems[item.id])
      .map((item) => ({
        ...item,
        quantity: effectiveQuantities[item.id] ?? item.quantity,
      }));
  }, [bookingItems, effectiveSelectedItems, effectiveQuantities]);

  const selectedTotal = useMemo(() => {
    return bookingItems.reduce((acc, item) => {
      if (!effectiveSelectedItems[item.id]) {
        return acc;
      }
      const quantity = effectiveQuantities[item.id] ?? item.quantity;
      return acc + item.unitPrice * quantity;
    }, 0);
  }, [bookingItems, effectiveSelectedItems, effectiveQuantities]);

  return {
    effectiveSelectedItems,
    effectiveQuantities,
    selectedPaymentItems,
    selectedTotal,
    handleItemCheckChange,
    handleQuantityChange,
  };
}
