package com.team1.goorm.service;

import com.team1.goorm.common.exception.BusinessException;
import com.team1.goorm.common.exception.ErrorCode;
import com.team1.goorm.domain.dto.ProductDetailDto;
import com.team1.goorm.domain.dto.ProductDto;
import com.team1.goorm.repository.ProductRepository;


import lombok.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;

    // 전체 상품 조회
    @Transactional(readOnly = true)
    public List<ProductDto> getAllProducts() {
        return productRepository.findAll()
                .stream()
                .map(ProductDto::fromEntity)
                .collect(Collectors.toList());
    }

    // 특정 상품 상세 조회
    @Transactional(readOnly = true)
    public ProductDetailDto getProductDetail(Long productId) {
        return productRepository.findById(productId)
                .map(ProductDetailDto::fromEntity)
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND));
    }

    // 카테고리별 상품 조회
    @Transactional(readOnly = true)
    public List<ProductDto> getProductsByCategory(String category) {
        // 존재하지 않는 카테고리 일 경우
        if (!productRepository.existsByCategory(category)) {
            throw new BusinessException(ErrorCode.INVALID_CATEGORY);
        }
        // 카테고리에 포함된 상품들을 가져옴
        return productRepository.findByCategory(category)
                .stream()
                .map(ProductDto::fromEntity)
                .collect(Collectors.toList());
    }

    // 지역별 상품 조회
    @Transactional(readOnly = true)
    public List<ProductDto> getProductsByRegion(String region) {
        List<ProductDto> products = productRepository.findByAddrContaining(region)
                .stream()
                .map(ProductDto::fromEntity)
                .collect(Collectors.toList());

        if (products.isEmpty()) {
            throw new BusinessException(ErrorCode.REGION_NOT_FOUND);
        }

        return products;
    }

}
