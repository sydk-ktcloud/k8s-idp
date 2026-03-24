import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

import { API_BASE_URL, COMMON_HEADERS } from '../../config/api';
import type { PaymentRequest } from '../../types/api';

export const useProcessPayment = () => {
  return useMutation({
    mutationFn: async (paymentData: PaymentRequest) => {
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/orders/payment`,
        paymentData,
        { headers: COMMON_HEADERS },
      );
      return response.data;
    },
  });
};
