package com.team1.goorm.domain.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
@Table(name = "orders")
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "total_amount")
    private BigDecimal totalAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private OrderStatus status; // READY, DONE, CANCELLED 3가지 타입만 가능

    @Column(name = "order_name")
    private String orderName;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // 양방향 매핑
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<OrderProduct> orderProducts = new ArrayList<>();

    @Column(name = "order_number", unique = true, nullable = false)
    private String orderNumber; // ORD-20260215-1 형식 저장

    /** 주문 완료 처리 */
    public void markAsDone() {
        this.status = OrderStatus.DONE;
    }

    /** 주문 정보 업데이트 (금액, 이름, 실제 주문 번호 등) */
    public void updateOrderDetails(String orderName, BigDecimal totalAmount, String orderNumber, List<OrderProduct> orderProducts) {
        this.orderName = orderName;
        this.totalAmount = totalAmount;
        this.orderNumber = orderNumber;
        orderProducts.forEach(this::addOrderProduct);
    }

    /** 주문 상품 추가 */
    public void addOrderProduct(OrderProduct orderProduct) {
        this.orderProducts.add(orderProduct);
        orderProduct.setOrder(this);
    }
}
