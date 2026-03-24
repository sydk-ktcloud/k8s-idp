// 기본 API 응답 구조
export interface ApiResponse<T = unknown> {
  status: number;
  code: string;
  message: string;
  data: T;
}

export interface ProductDetail {
  product_id: number;
  product_name: string;
  price: number;
  images: string[];
  addr: string;
  description: string;
  category: string;
  nights: number;
}

// 주문 타입
export interface OrderRequest {
  products: Array<{
    product_id: number;
    quantity: number;
    departure_date: string;
  }>;
}

// 결제 타입
export interface PaymentRequest {
  order_id: string;
  total_amount: number;
  payment_method: string;
}

// 장바구니 타입
export interface CartRequest {
  product_id: number;
  quantity: number;
  departure_date: string;
}

export interface CartItem {
  cart_id: number;
  product_id: number;
  product_name: string;
  price: number;
  quantity: number;
  total_price: number;
  image: string;
  category: string;
  departure_date: string;
}
