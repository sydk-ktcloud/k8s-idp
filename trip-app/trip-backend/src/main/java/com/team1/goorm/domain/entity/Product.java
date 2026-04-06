package com.team1.goorm.domain.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
@Table(name = "Product") // 상품 정보
public class Product {
    @Id
    @Column(name = "product_id") // 상품 id
    private long productId;

    @Column(name= "product_name") // 상품 이름
    private String productName;

    @Column(name = "price") // 상품 가격
    private BigDecimal price;

    @Column(name = "addr") // 상품 주소
    private String addr;

    @Column(name = "image") // 상품 이미지
    private String image;

    @Column(name = "image_2") // 상품 이미지 2
    private String image2;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "category") // 상품 카테고리
    private String category;

    @Column(name = "nights") // 숙박일수
    private int nights;
}
