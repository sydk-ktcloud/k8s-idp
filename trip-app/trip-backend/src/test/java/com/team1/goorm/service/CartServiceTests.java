package com.team1.goorm.service;

import com.team1.goorm.common.exception.BusinessException;
import com.team1.goorm.common.exception.ErrorCode;
import com.team1.goorm.domain.dto.CartRequestDto;
import com.team1.goorm.domain.dto.CartResponseDto;
import com.team1.goorm.domain.entity.Cart;
import com.team1.goorm.domain.entity.Product;
import com.team1.goorm.repository.CartRepository;
import com.team1.goorm.repository.ProductRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CartServiceTest {

    @InjectMocks
    private CartService cartService; // 테스트 대상

    @Mock
    private CartRepository cartRepository; // 장바구니 목업 데이터 사용

    @Mock
    private ProductRepository productRepository; // product 목업 데이터 사용

    // Product 객체 생성
    private Product createProduct() {
        return Product.builder()
                .productId(5L)
                .productName("경복궁")
                .price(BigDecimal.valueOf(30000))
                .image("http://test.com/image.jpg")
                .category("문화시설")
                .build();
    }

    // Cart 객체 생성
    private Cart createCart(Product product) {
        return Cart.builder()
                .cartId(1L)
                .userId(1L)
                .quantity(2)
                .departureDate(LocalDate.of(2026, 2, 18))
                .product(product)
                .build();
    }

    // 테스트 진행
    @Test
    @DisplayName("장바구니 추가 - 성공") // 장바구니에 담기는지 테스트
    void addCart_success() {

        // product 객체 생성
        Product product = createProduct();

        // cart 객체 생성
        Cart cart = createCart(product);

        // 요청을 보냄
        CartRequestDto request = new CartRequestDto(5L, 2, LocalDate.of(2026, 2, 18));

        // findById(5L)을 호출하면 product를 반환
        given(productRepository.findById(5L)).willReturn(Optional.of(product));

        // save()를 호출하면 cart를 반환
        given(cartRepository.save(any(Cart.class))).willReturn(cart);

        // 테스트 메서드 호출
        CartResponseDto response = cartService.addCart(1L, request);


        assertThat(response.getProductName()).isEqualTo("경복궁"); // 상품명 확인
        assertThat(response.getQuantity()).isEqualTo(2); // 수량 확인
        assertThat(response.getTotalPrice()).isEqualTo(BigDecimal.valueOf(60000)); // 연산 확인
    }

    @Test
    @DisplayName("장바구니 추가 실패 - 존재하지 않는 상품")
    void addCart_fail_productNotFound() {

        // 존재하지 않는 ID에 요청
        CartRequestDto request = new CartRequestDto(999L, 2, LocalDate.of(2026, 2, 18));

        // 빈값을 반환하게
        given(productRepository.findById(999L)).willReturn(Optional.empty());

        // 예외 처리가 되는지 확인
        assertThatThrownBy(() -> cartService.addCart(1L, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining(ErrorCode.PRODUCT_NOT_FOUND.getMessage());
    }

    @Test
    @DisplayName("장바구니 추가 실패 - 수량이 0 이하")
    void addCart_fail_invalidQuantity() {

        // 수량을 0으로 요청
        CartRequestDto request = new CartRequestDto(5L, 0, LocalDate.of(2026, 2, 19));

        // 수량이 0이면 예외 처리 되는지 확인
        assertThatThrownBy(() -> cartService.addCart(1L, request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining(ErrorCode.INVALID_REQUEST.getMessage());
    }

    @Test
    @DisplayName("장바구니 목록 조회 - 성공")
    void getCartList_success() {

        Product product = createProduct();
        Cart cart = createCart(product);

        // 장바구니에서 유저정보가 1인 목록을 조회
        given(cartRepository.findAllByUserIdWithProduct(1L)).willReturn(List.of(cart));

        // 실제 데이터 조회
        List<CartResponseDto> result = cartService.getCartList(1L);

        // 결과를 검증
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getProductName()).isEqualTo("경복궁");
        assertThat(result.get(0).getQuantity()).isEqualTo(2);
    }

    @Test
    @DisplayName("장바구니 삭제 - 성공")
    void deleteCart_success() {

        Product product = createProduct();
        Cart cart = createCart(product);

        // 장바구니가 존재하면 true를 반환
        given(cartRepository.findById(1L)).willReturn(Optional.of(cart));

        // 장바구니 삭제
        cartService.deleteCart(1L, 1L);

        // 실제 호출이 되었는지 확인
        verify(cartRepository).deleteById(1L);  // deleteById가 실제로 호출됐는지 확인
    }

    @Test
    @DisplayName("장바구니 삭제 실패 - 존재하지 않는 장바구니")
    void deleteCart_fail_cartNotFound() {

        // 잘못된 Id를 넣으면 false를 반환
        given(cartRepository.findById(999L)).willReturn(Optional.empty());

        // 존재하지 않는 cartId를 삭제하면 예외 처리가 되는지 확인
        assertThatThrownBy(() -> cartService.deleteCart(1L, 999L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining(ErrorCode.INVALID_REQUEST.getMessage());
    }
}