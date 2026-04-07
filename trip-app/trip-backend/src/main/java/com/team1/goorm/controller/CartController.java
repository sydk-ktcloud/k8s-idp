package com.team1.goorm.controller;

import com.team1.goorm.common.response.ApiResponse;
import com.team1.goorm.domain.dto.CartRequestDto;
import com.team1.goorm.domain.dto.CartResponseDto;
import com.team1.goorm.service.CartService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/carts")
@RequiredArgsConstructor
public class CartController {
    private final CartService cartService;

    // 장바구니 목록 조회
    @GetMapping
    @Operation(summary = "장바구니 목록 조회")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "장바구니 없음")
    })
    public ResponseEntity<ApiResponse<List<CartResponseDto>>> getCartList(
            @RequestHeader("X-User-Id") Long userId
    ) {
        return ResponseEntity.ok(
                ApiResponse.success("SUCCESS", "장바구니 조회에 성공했습니다.", cartService.getCartList(userId))
        );
    }

    @PostMapping
    @Operation(summary = "장바구니 상품 추가")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "201", description = "성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "처리할 수 없는 요청"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "상품 없음")
    })
    public ResponseEntity<ApiResponse<CartResponseDto>> addCart(
            @RequestHeader("X-User-Id") Long userId,
            @RequestHeader(value = "X-Demo-Failure", required = false) String demoFailure,
            @RequestBody CartRequestDto request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                ApiResponse.create("CART_ADD_SUCCESS", "장바구니에 상품이 추가되었습니다.", cartService.addCart(userId, request, demoFailure))
        );
    }

    @DeleteMapping("/{cartId}")
    @Operation(summary = "장바구니 상품 제거")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "성공"),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "처리할 수 없는 요청")
    })
    public ResponseEntity<ApiResponse<Void>> deleteCart(
            @RequestHeader("X-User-Id") Long userId,
            @PathVariable Long cartId) {
        cartService.deleteCart(userId, cartId);
        return ResponseEntity.ok(
                ApiResponse.success("CART_DELETE_SUCCESS", "장바구니 상품이 삭제되었습니다.", null)
        );
    }


}
