package com.team1.goorm.domain.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
@Table(name = "cart") // 장바구니 테이블
public class Cart {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) // 번호 자동 증가
    @Column(name = "cart_id") // 장바구니 id
    private Long cartId;

    @Column(name = "quantity") // 상품 수량
    private int quantity;

    @Column(name = "user_id") // 유저 id
//    private long userId;
    private Long userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id") // FK
    private Product product;

    @Column(name = "departure_date")
    private LocalDate departureDate; // 출발 날짜
}
