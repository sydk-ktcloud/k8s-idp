package com.team1.goorm.cartapi.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
public class CartSyncRequestDto {
    private Long userId;
    private Long productId;
    private String productName;
    private int quantity;
    private LocalDate departureDate;
}
