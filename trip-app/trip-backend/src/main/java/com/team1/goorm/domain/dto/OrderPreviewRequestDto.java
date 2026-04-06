package com.team1.goorm.domain.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class OrderPreviewRequestDto {

    private List<ProductItemDto> products;

    @Getter
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    @AllArgsConstructor
    @Builder
    public static class ProductItemDto {
        @NotNull
        private Long productId;
        @NotNull
        private int quantity;
        @NotNull
        private LocalDate departureDate;
    }
}