package com.team1.goorm.domain.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
@Table(name = "payments")
public class Payment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "payment_id", nullable = false)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id")
    private Order order;

    @Column(name = "payment_key", updatable = false, nullable = false)
    private String paymentKey;

    @Column(name = "method")
    private String method;

    @Column(name = "amount",  nullable = false)
    private BigDecimal amount;

    @Column(name = "approved_at")
    private LocalDateTime approvedAt;
}
