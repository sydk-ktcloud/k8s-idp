package com.team1.goorm.controller;

import com.team1.goorm.common.response.ApiResponse;
import com.team1.goorm.domain.dto.ProductDetailDto;
import com.team1.goorm.domain.dto.ProductDto;
import com.team1.goorm.service.ProductService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import lombok.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
public class ProductController {
    private final ProductService productService;

    // 전체 상품 목록 조회
    @GetMapping
    @Operation(summary = "전체 상품 목록 조회")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "상품 없음")
    })
    public ResponseEntity<ApiResponse<List<ProductDto>>> getAllProducts() {
        return ResponseEntity.ok(
                ApiResponse.success("SUCCESS", "전체 상품 정보를 성공적으로 가져왔습니다.", productService.getAllProducts())
        );
    }

    // productId를 통한 상세 정보 조회
    @GetMapping("/{productId}")
    @Operation(summary = "상품 상세 조회")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "상품 없음")
    })
    public ResponseEntity<ApiResponse<ProductDetailDto>> getProductDetail(@PathVariable Long productId) {
        return ResponseEntity.ok(
                ApiResponse.success("SUCCESS", "상품 상세 조회에 성공했습니다", productService.getProductDetail(productId))
        );
    }

    // 카테고리별 조회
    @GetMapping("/category/{category}")
    @Operation(summary = "카테고리별 조회")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "상품 없음")
    })
    public ResponseEntity<ApiResponse<List<ProductDto>>> getProductsByCategory(@PathVariable String category) {
        return ResponseEntity.ok(
                ApiResponse.success("SUCCESS", "카테고리별 상품 조회에 성공했습니다.", productService.getProductsByCategory(category))
        );
    }

    // 지역별 조회
    @GetMapping("/region/{region}")
    @Operation(summary = "지역별 조회")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "상품 없음")
    })
    public ResponseEntity<ApiResponse<List<ProductDto>>> getProductsByRegion(@PathVariable String region) {
        return ResponseEntity.ok(
                ApiResponse.success("SUCESS", "지역별 상품 조회에 성공했습니다.", productService.getProductsByRegion(region))
        );
    }
}
    @GetMapping("/region/{region}")
    @Operation(summary = "지역별 조회")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "상품 없음")
    })
    public ResponseEntity<ApiResponse<List<ProductDto>>> getProductsByRegion(@PathVariable String region) {
        return ResponseEntity.ok(
                ApiResponse.success("SUCESS", "지역별 상품 조회에 성공했습니다.", productService.getProductsByRegion(region))
        );
    }
}
