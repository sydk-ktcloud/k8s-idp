package com.team1.goorm.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentProcessRequestDto {
    private Long userId;
    private String orderId;
    private Long productId;
    private String productName;
    private int quantity;
    private BigDecimal totalAmount;
    private String paymentMethod;
}
