package com.team1.goorm.service;

import com.team1.goorm.common.exception.BusinessException;
import com.team1.goorm.common.exception.ErrorCode;
import com.team1.goorm.domain.dto.ProductDetailDto;
import com.team1.goorm.domain.dto.ProductDto;
import com.team1.goorm.repository.ProductRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;

    // 피드백 반영: 환경변수 플래그로 토글 (기본값 0)
    @Value("${trip.demo.delay-ms:0}")
    private long demoDelayMs;

    // 전체 상품 조회
    @Transactional(readOnly = true)
    public List<ProductDto> getAllProducts() {
        applyDemoDelay(); // 지연 적용

        return productRepository.findAll()
                .stream()
                .map(ProductDto::fromEntity)
                .collect(Collectors.toList());
    }

    // 특정 상품 상세 조회
    @Transactional(readOnly = true)
    public ProductDetailDto getProductDetail(Long productId) {
        applyDemoDelay(); // 지연 적용

        return productRepository.findById(productId)
                .map(ProductDetailDto::fromEntity)
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND));
    }

    /**
     * 피드백 반영: 지연 처리를 위한 공통 메서드
     * 하드코딩을 제거하고 설정된 demoDelayMs 값에 따라 작동합니다.
     */
    private void applyDemoDelay() {
        if (demoDelayMs > 0) {
            try {
                log.info("🔥 Demo delay active: {}ms", demoDelayMs);
                Thread.sleep(demoDelayMs);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt(); // 인터럽트 상태 복구
                throw new RuntimeException("Delay interrupted", e);
            }
        }
    }

    // 카테고리별 상품 조회
    @Transactional(readOnly = true)
    public List<ProductDto> getProductsByCategory(String category) {
        if (!productRepository.existsByCategory(category)) {
            throw new BusinessException(ErrorCode.INVALID_CATEGORY);
        }

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
