import type { ChangeEvent } from 'react';

export type BookingTerm = 'cancellation' | 'refund' | 'all';

export interface PaymentItem {
  id: number;
  productId: number;
  image: string;
  title: string;
  departureDate: string;
  unitPrice: number;
  quantity: number;
}

export interface PaymentFormData {
  lastName: string;
  firstName: string;
  phone: string;
  email: string;
}

export interface TermsAccepted {
  cancellation: boolean;
  refund: boolean;
  all: boolean;
}

export type PaymentInputChange = (event: ChangeEvent<HTMLInputElement>) => void;
export type TermsChangeHandler = (term: BookingTerm) => void;
