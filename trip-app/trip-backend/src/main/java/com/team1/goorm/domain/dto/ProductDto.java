package com.team1.goorm.domain.dto;

import com.team1.goorm.domain.entity.Product;
import lombok.*;

import java.math.BigDecimal;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductDto {
    private long productId;
    private String productName;
    private String category;
    private BigDecimal price;
    private String image;

    // 엔티티를 DTO로 변환
    public static ProductDto fromEntity(Product product) {
        return ProductDto.builder()
                .productId(product.getProductId())
                .productName(product.getProductName())
                .category(product.getCategory())
                .price(product.getPrice())
                .image(product.getImage())
                .build();
    }
}