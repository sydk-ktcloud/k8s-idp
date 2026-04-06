package com.team1.goorm.domain.dto;

import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class PaymentRequestDto {
    private String orderId;
    private BigDecimal totalAmount;
    private String paymentMethod;
}
