package com.team1.goorm.domain.dto;


import com.team1.goorm.domain.entity.Cart;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CartResponseDto {
    private Long cartId;
    private Long productId;
    private String productName; // 상품 이름
    private BigDecimal price; // 상품 가격
    private int quantity; // 상품 갯수
    private BigDecimal totalPrice; // 전체 상품 가격
    private String image; // 상품 이미지
    private String category; // 카테고리
    private LocalDate departureDate; // 출발 날짜

    public static CartResponseDto fromEntity(Cart cart) {

        BigDecimal price = cart.getProduct().getPrice();
        int quantity = cart.getQuantity();

        return CartResponseDto.builder()
                .cartId(cart.getCartId())
                .productId(cart.getProduct().getProductId())
                .productName(cart.getProduct().getProductName())
                .price(cart.getProduct().getPrice())
                .quantity(cart.getQuantity())
                .image(cart.getProduct().getImage())
                .category(cart.getProduct().getCategory())
                .totalPrice(price.multiply(BigDecimal.valueOf(quantity)))
                .departureDate(cart.getDepartureDate())
                .build();
    }

}
