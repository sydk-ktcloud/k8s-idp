package com.team1.goorm.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.team1.goorm.common.exception.BusinessException;
import com.team1.goorm.common.exception.ErrorCode;
import com.team1.goorm.domain.dto.CartRequestDto;
import com.team1.goorm.domain.dto.CartResponseDto;
import com.team1.goorm.service.CartService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CartController.class)
class CartControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private CartService cartService; // CartService

    @Autowired
    private ObjectMapper objectMapper; // 객체를 JSON으로 변환

    // 테스트용 CartResponseDto 생성
    private CartResponseDto createCartResponseDto() {
        return CartResponseDto.builder()
                .productName("경복궁")
                .price(BigDecimal.valueOf(30000))
                .quantity(2)
                .totalPrice(BigDecimal.valueOf(60000))
                .image("http://test.com/image.jpg")
                .category("문화시설")
                .departureDate(LocalDate.of(2026, 2, 18))
                .build();
    }

    @Test
    @DisplayName("장바구니 추가 - 성공")
    void addCart_success() throws Exception {

        // 요청 데이터와 응답 생성
        CartRequestDto request = new CartRequestDto(5L, 2, LocalDate.of(2026, 2, 18));
        CartResponseDto response = createCartResponseDto();

        // response 반환
        given(cartService.addCart(any(Long.class), any(CartRequestDto.class))).willReturn(response);

        // 응답 검증
        mockMvc.perform(post("/api/v1/carts")
                        .header("X-User-Id", 1L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))) // 요청 body
                .andDo(print())
                .andExpect(status().isCreated())  // 201 응답 확인
                .andExpect(jsonPath("$.status").value(201)) // status 필드 확인
                .andExpect(jsonPath("$.code").value("CART_ADD_SUCCESS")) // code 필드 확인
                .andExpect(jsonPath("$.data.product_name").value("경복궁")) // 상품명 확인
                .andExpect(jsonPath("$.data.quantity").value(2)); // 수량 확인
    }

    @Test
    @DisplayName("장바구니 추가 실패 - 존재하지 않는 상품")
    void addCart_fail_productNotFound() throws Exception {

        // 존재하지 않는 상품 요청
        CartRequestDto request = new CartRequestDto(999L, 2, LocalDate.of(2026, 2, 18));

        // 예외 처리가 되는지
        given(cartService.addCart(any(Long.class), any(CartRequestDto.class)))
                .willThrow(new BusinessException(ErrorCode.PRODUCT_NOT_FOUND));

        mockMvc.perform(post("/api/v1/carts")
                        .header("X-User-Id", 1L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isNotFound()) // 404 응답 확인
                .andExpect(jsonPath("$.code").value("PRODUCT_NOT_FOUND")); // 에러 코드 확인
    }

    @Test
    @DisplayName("장바구니 목록 조회 - 성공")
    void getCartList_success() throws Exception {

        // response 생성
        CartResponseDto response = createCartResponseDto();

        // 목록이 반환되는지
        given(cartService.getCartList(any(Long.class))).willReturn(List.of(response));

        // 응답 검증
        mockMvc.perform(get("/api/v1/carts")
                        .header("X-User-Id", 1L))
                .andDo(print())
                .andExpect(status().isOk()) // 200 응답 확인
                .andExpect(jsonPath("$.status").value(200)) // status 필드 확인
                .andExpect(jsonPath("$.data[0].product_name").value("경복궁")) // 첫번째 상품명 확인
                .andExpect(jsonPath("$.data[0].quantity").value(2)); // 첫번째 수량 확인
    }

    @Test
    @DisplayName("장바구니 삭제 - 성공")
    void deleteCart_success() throws Exception {

        // delete 요청
        mockMvc.perform(delete("/api/v1/carts/1")
                        .header("X-User-Id", 1L))
                .andDo(print())
                .andExpect(status().isOk()) // 200 응답 확인
                .andExpect(jsonPath("$.code").value("CART_DELETE_SUCCESS")); // 코드 확인
    }

    @Test
    @DisplayName("장바구니 삭제 실패 - 존재하지 않는 장바구니")
    void deleteCart_fail_cartNotFound() throws Exception {

        // 없는 cartId 일때
        doThrow(new BusinessException(ErrorCode.INVALID_REQUEST))
                .when(cartService).deleteCart(any(Long.class), eq(999L));

        // 예외 처리 확인
        mockMvc.perform(delete("/api/v1/carts/999")
                        .header("X-User-Id", 1L))
                .andDo(print())
                .andExpect(status().isNotFound()) // 404 응답 확인
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST")); // 에러 코드 확인
    }
}