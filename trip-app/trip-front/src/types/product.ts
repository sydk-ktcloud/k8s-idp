export interface Product {
  product_id: number;
  product_name: string;
  category: string;
  price: number;
  image: string;
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

export interface CartAddRequest {
  product_id: number;
  quantity: number;
  departure_date: string;
}
