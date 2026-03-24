package com.team1.goorm.controller;

import static org.mockito.BDDMockito.given;
import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.team1.goorm.domain.dto.OrderPreviewRequestDto;
import com.team1.goorm.domain.dto.OrderPreviewResponseDto;
import com.team1.goorm.domain.dto.PaymentRequestDto;
import com.team1.goorm.domain.dto.PaymentResponseDto;
import com.team1.goorm.domain.entity.OrderStatus;
import com.team1.goorm.domain.entity.User;
import com.team1.goorm.repository.UserRepository;
import com.team1.goorm.service.OrderService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@ExtendWith(SpringExtension.class)
@WebMvcTest(OrderController.class)
public class OrderControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OrderService orderService;

    @MockBean
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("주문 미리보기 생성 성공 테스트")
    public void testCreateOrderPreview() throws Exception {
        // Given
        Long userId = 1L;
        OrderPreviewRequestDto.ProductItemDto item1 = OrderPreviewRequestDto.ProductItemDto.builder()
                .productId(1L)
                .quantity(1)
                .departureDate(LocalDate.parse("2026-02-18"))
                .build();

        OrderPreviewRequestDto.ProductItemDto item2 = OrderPreviewRequestDto.ProductItemDto.builder()
                .productId(5L)
                .quantity(2)
                .departureDate(LocalDate.parse("2026-02-18"))
                .build();

        OrderPreviewRequestDto requestDto = OrderPreviewRequestDto.builder()
                .products(List.of(item1, item2))
                .build();
        
        OrderPreviewResponseDto responseDto = OrderPreviewResponseDto.builder()
                .orderNumber("ORD-20260218-1")
                .orderName("임시 상품 1 외 1건")
                .status(OrderStatus.READY)
                .build();

        User u = new User(1L, "김구름", "goorm1@goorm.com");
        Optional<User> userOptional = Optional.of(u);

        given(userRepository.findById(userId)).willReturn(userOptional);
        given(orderService.createOrder(any(OrderPreviewRequestDto.class), any(User.class))).willReturn(responseDto);

        // When, Then
        mockMvc.perform(post("/api/v1/orders/preview")
                    .header("X-User-Id", userId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(requestDto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.order_number").value("ORD-20260218-1"))
                .andDo(print());
    }

    @Test
    @DisplayName("결제 승인 성공 테스트")
    public void testCreatePayment() throws Exception {
        // 1. Given (준비)
        Long userId = 1L;

        OrderPreviewRequestDto.ProductItemDto item1 = OrderPreviewRequestDto.ProductItemDto.builder()
                .productId(1L)
                .quantity(1)
                .build();

        OrderPreviewRequestDto.ProductItemDto item2 = OrderPreviewRequestDto.ProductItemDto.builder()
                .productId(5L)
                .quantity(2)
                .build();

        // Request DTO
        PaymentRequestDto requestDto = PaymentRequestDto.builder()
                .orderId("ORD-20260215-1")
                .paymentMethod("CARD")
                .totalAmount(new BigDecimal("30000.00"))
                .build();

        // 서비스가 리턴할 Response DTO
        PaymentResponseDto responseDto = PaymentResponseDto.builder()
                .orderNumber("ORD-20260216-1")
                .paymentKey("PAY-METHOD-CARD-XYZ123") // 서비스에서 생성될 포맷 상상
                .status(OrderStatus.DONE) // order.markAsDone() 반영 결과
                .requestedAt(LocalDateTime.now())
                .approvedAt(LocalDateTime.now().plusSeconds(10))
                .build();

        User mockUser = new User(userId, "김구름", "goorm@test.com");

        given(userRepository.findById(userId)).willReturn(Optional.of(mockUser));
        given(orderService.createPayment(any(PaymentRequestDto.class), any(User.class)))
                .willReturn(responseDto);

        // When & Then
        mockMvc.perform(post("/api/v1/orders/payment") // 실제 컨트롤러에 매핑된 URL 확인 필수
                        .header("X-User-Id", userId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("PAYMENT_SUCCESS"))
                .andExpect(jsonPath("$.data.order_number").value("ORD-20260216-1"))
                .andExpect(jsonPath("$.data.status").value("DONE")) // 상태 변경 확인
                .andDo(print());
    }
}
