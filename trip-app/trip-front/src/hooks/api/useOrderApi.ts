import { useMutation } from '@tanstack/react-query';
import axios from 'axios';

import { API_BASE_URL, COMMON_HEADERS } from '../../config/api';
import type { OrderRequest } from '../../types/api';

export const useCreateOrderPreview = () => {
  return useMutation({
    mutationFn: async (orderData: OrderRequest) => {
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/orders/preview`,
        orderData,
        { headers: COMMON_HEADERS },
      );
      return response.data;
    },
  });
};
