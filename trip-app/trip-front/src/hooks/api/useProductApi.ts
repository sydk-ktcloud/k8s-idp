import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { API_BASE_URL } from '../../config/api';

// 전체 상품 조회
export const useGetAllProducts = () => {
  return useQuery({
    queryKey: ['products', 'all'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/api/v1/products`);
      return response.data;
    },
  });
};

// 카테고리별 상품 조회
export const useGetProductsByCategory = (category?: string) => {
  return useQuery({
    queryKey: ['products', 'category', category],
    queryFn: async () => {
      const response = await axios.get(
        `${API_BASE_URL}/api/v1/products/category/${category}`,
      );
      return response.data;
    },
    enabled: !!category,
  });
};

// 상품 상세 조회
export const useGetProductDetail = (productId?: number) => {
  return useQuery({
    queryKey: ['products', 'detail', productId],
    queryFn: async () => {
      const response = await axios.get(
        `${API_BASE_URL}/api/v1/products/${productId}`,
      );

      return response.data;
    },
    enabled: !!productId,
  });
};

// 지역별 상품 조회
export const useGetProductsByRegion = (region?: string) => {
  return useQuery({
    queryKey: ['products', 'region', region],
    queryFn: async () => {
      const response = await axios.get(
        `${API_BASE_URL}/api/v1/products/region/${region}`,
      );
      return response.data;
    },
    enabled: !!region,
  });
};
