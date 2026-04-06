package com.team1.goorm.domain.dto;

import com.team1.goorm.domain.entity.Product;
import lombok.*;

import java.math.BigDecimal;
import java.util.List;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductDetailDto {
    private String productName; // 상품 이름
    private BigDecimal price; // 상품 가격
//    private String image; // 상품 이미지
//    private String image2; // 상품 이미지 2
    private List<String> images;
    private String addr; // 상품 주소
    private String description; // 상품 설명
    private String category; // 상품 카테고리
    private int nights; // 숙박일

    // 엔티티를 DTO로 변환
    public static ProductDetailDto fromEntity(Product product) {
        return ProductDetailDto.builder()
                .productName(product.getProductName())
                .price(product.getPrice())
//                .image(product.getImage())
//                .image2(product.getImage2())
                .images(List.of(product.getImage(), product.getImage2()))
                .addr(product.getAddr())
                .description(product.getDescription())
                .category(product.getCategory())
                .nights(product.getNights())
                .build();
    }
}