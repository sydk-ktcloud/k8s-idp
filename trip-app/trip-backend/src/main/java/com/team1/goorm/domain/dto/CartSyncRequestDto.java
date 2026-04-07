package com.team1.goorm.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CartSyncRequestDto {
    private Long userId;
    private Long productId;
    private String productName;
    private int quantity;
    private LocalDate departureDate;
}
