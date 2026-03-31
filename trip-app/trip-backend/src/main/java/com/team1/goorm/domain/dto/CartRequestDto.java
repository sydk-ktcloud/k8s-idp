package com.team1.goorm.domain.dto;

import lombok.*;
import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CartRequestDto {
    private Long productId; // 상품 Id
    private int quantity; // 수량
    private LocalDate departureDate; // 출발 날짜
}
