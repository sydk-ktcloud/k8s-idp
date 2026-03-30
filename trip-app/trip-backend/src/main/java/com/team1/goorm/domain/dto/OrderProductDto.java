package com.team1.goorm.domain.dto;

import com.team1.goorm.domain.entity.Cart;
import com.team1.goorm.domain.entity.OrderProduct;
import com.team1.goorm.domain.entity.Product;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class OrderProductDto {
    private String productName;
    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal price;
    private int quantity;

    public static OrderProductDto from(OrderProduct orderProduct) {
        Product product = orderProduct.getProduct();

        return OrderProductDto.builder()
                .productName(product.getProductName())
                .startDate(orderProduct.getDepartureDate())
                .endDate(orderProduct.getDepartureDate().plusDays(product.getNights()))
                .price(product.getPrice())
                .quantity(orderProduct.getQuantity())
                .build();
    }
}
