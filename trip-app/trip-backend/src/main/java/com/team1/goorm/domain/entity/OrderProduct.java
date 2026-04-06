package com.team1.goorm.domain.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "order_products")
public class OrderProduct {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "order_product_id")
    private Long id;

    @ManyToOne
    @JoinColumn(name = "order_id")
    private Order order;

    @ManyToOne
    @JoinColumn(name = "product_id")
    private Product product;

    // 사용자가 담은 상품 수
    @Column(name = "quantity")
    private int quantity;

    // 상품의 가격(총 가격 X)
    @Column(name = "price")
    private BigDecimal price;

    // 출발 날짜
    @Column(name = "departure_date")
    private LocalDate departureDate;

    /** 주문 연결 메서드 */
    public void setOrder(Order order) {
        this.order = order;
    }

    public OrderProduct(Product product, int quantity, BigDecimal price, LocalDate departureDate) {
        this.product = product;
        this.quantity = quantity;
        this.price = price;
        this.departureDate = departureDate;
    }
}