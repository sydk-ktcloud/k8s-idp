import { useState, type ChangeEvent } from 'react';

import type {
  BookingTerm,
  PaymentFormData,
  TermsAccepted,
} from '../../../types/payment';

export function usePaymentForm() {
  const [formData, setFormData] = useState<PaymentFormData>({
    lastName: '',
    firstName: '',
    phone: '',
    email: '',
  });
  const [termsAccepted, setTermsAccepted] = useState<TermsAccepted>({
    cancellation: false,
    refund: false,
    all: false,
  });

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const nextValue = name === 'phone' ? value.replace(/\D/g, '') : value;
    setFormData((prev) => ({ ...prev, [name]: nextValue }));
  };

  const handleTermsChange = (term: BookingTerm) => {
    setTermsAccepted((prev) => {
      if (term === 'all') {
        const nextValue = !prev.all;
        return {
          cancellation: nextValue,
          refund: nextValue,
          all: nextValue,
        };
      }

      const next = { ...prev, [term]: !prev[term] };
      return { ...next, all: next.cancellation && next.refund };
    });
  };

  return { formData, termsAccepted, handleInputChange, handleTermsChange };
}
