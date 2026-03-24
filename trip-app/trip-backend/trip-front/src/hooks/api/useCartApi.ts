import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

import { API_BASE_URL, COMMON_HEADERS } from '../../config/api';
import type { CartRequest } from '../../types/api';

// 장바구니 목록 조회
export const useGetCartItems = (enabled = true) => {
  return useQuery({
    queryKey: ['cart', 'items'],
    enabled,
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/v1/carts`, {
        headers: { 'X-User-Id': '1' },
      });
      return response.data;
    },
  });
};

// 장바구니에 상품 추가
export const useAddToCart = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cartData: CartRequest) => {
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/carts`,
        cartData,
        { headers: COMMON_HEADERS },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart', 'items'] });
    },
  });
};

// 장바구니 상품 삭제
export const useDeleteCartItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cartId: number) => {
      const response = await axios.delete(
        `${API_BASE_URL}/api/v1/carts/${cartId}`,
        {
          headers: { 'X-User-Id': '1' },
        },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart', 'items'] });
    },
  });
};
