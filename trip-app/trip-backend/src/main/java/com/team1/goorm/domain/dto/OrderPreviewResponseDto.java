package com.team1.goorm.domain.dto;

import com.team1.goorm.domain.entity.Order;
import com.team1.goorm.domain.entity.OrderProduct;
import com.team1.goorm.domain.entity.OrderStatus;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class OrderPreviewResponseDto {
    private String orderName;
    private String orderNumber; // ORD-20260215-1 형태
    private OrderStatus status;
    private List<OrderProductDto> orderProducts;
    private BigDecimal totalPrice;


    public static OrderPreviewResponseDto from(Order order) {
        List<OrderProductDto> orderProducts = new ArrayList<>();
        for (OrderProduct orderProduct : order.getOrderProducts()) {
            orderProducts.add(OrderProductDto.from(orderProduct));
        }

        return OrderPreviewResponseDto.builder()
                .orderName(order.getOrderName())
                .orderNumber(order.getOrderNumber())
                .status(order.getStatus())
                .orderProducts(orderProducts)
                .totalPrice(order.getTotalAmount())
                .build();
    }
}
