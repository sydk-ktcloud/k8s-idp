package com.team1.goorm.paymentapi.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
public class PaymentProcessRequestDto {
    private Long userId;
    private String orderId;
    private Long productId;
    private String productName;
    private int quantity;
    private BigDecimal totalAmount;
    private String paymentMethod;
}
