package com.team1.goorm.service;

import com.team1.goorm.common.exception.BusinessException;
import com.team1.goorm.common.exception.ErrorCode;
import com.team1.goorm.domain.dto.OrderPreviewRequestDto;
import com.team1.goorm.domain.dto.OrderPreviewResponseDto;
import com.team1.goorm.domain.dto.PaymentRequestDto;
import com.team1.goorm.domain.dto.PaymentResponseDto;
import com.team1.goorm.domain.entity.*;
import com.team1.goorm.repository.OrderRepository;
import com.team1.goorm.repository.PaymentRepository;
import com.team1.goorm.repository.ProductRepository;
import org.junit.jupiter.api.BeforeEach;
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
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class OrderServiceTests {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private ProductRepository productRepository;

    @InjectMocks
    private OrderService orderService;

    private User mockUser;

    @BeforeEach
    void setUp() {
        mockUser = new User(1L, "김구름", "goorm@goorm1.com");
    }

    @Test
    @DisplayName("주문 미리보기 생성 성공")
    void testCreateOrder() {
        // Given
        Product mockProduct1 = new Product(1L, "임시상품1", new BigDecimal("10000.00"), null, null, null, null, null, 2);
        Product mockProduct2 = new Product(2L, "임시상품2", new BigDecimal("10000.00"), null, null, null, null, null, 2);

        given(productRepository.findById(1L)).willReturn(Optional.of(mockProduct1));
        given(productRepository.findById(2L)).willReturn(Optional.of(mockProduct2));

        OrderPreviewRequestDto.ProductItemDto item1 = new OrderPreviewRequestDto.ProductItemDto(1L, 2, LocalDate.parse("2026-02-18")); // 10000 * 2
        OrderPreviewRequestDto.ProductItemDto item2 = new OrderPreviewRequestDto.ProductItemDto(2L, 1, LocalDate.parse("2026-02-18")); // 10000 * 1
        OrderPreviewRequestDto requestDto = new OrderPreviewRequestDto(List.of(item1, item2));

        Order tempOrder = Order.builder().id(100L).user(mockUser).build();

        // save 호출 시 ID가 할당된 객체 반환 시뮬레이션
        given(orderRepository.save(any(Order.class))).willReturn(tempOrder);

        // When
        OrderPreviewResponseDto result = orderService.createOrder(requestDto, mockUser);

        // Then
        assertThat(result.getOrderName()).contains("외 1건");
        assertThat(result.getOrderNumber()).startsWith("ORD-");
        assertThat(result.getOrderProducts().getFirst().getStartDate()).isEqualTo(LocalDate.of(2026, 2, 18));
        verify(orderRepository, times(1)).save(any(Order.class));
    }

    @Test
    @DisplayName("결제 생성 성공 - 주문 상태가 DONE으로 변경되어야 함")
    void createPayment_success() {
        // Given
        String orderNumber = "ORD-20260216-100";
        BigDecimal amount = new BigDecimal("20000.00");

        // 검증을 통과할 수 있는 상태의 주문 객체
        Order order = spy(Order.builder()
                .orderNumber(orderNumber)
                .totalAmount(amount)
                .user(mockUser)
                .status(OrderStatus.READY)
                .build());

        PaymentRequestDto requestDto = PaymentRequestDto.builder()
                .orderId(orderNumber)
                .totalAmount(amount)
                .paymentMethod("CARD")
                .build();

        given(orderRepository.findByOrderNumber(orderNumber)).willReturn(Optional.of(order));
        given(paymentRepository.save(any(Payment.class))).willAnswer(invocation -> invocation.getArgument(0));

        // When
        PaymentResponseDto result = orderService.createPayment(requestDto, mockUser);

        // Then
        assertThat(result.getStatus()).isEqualTo(OrderStatus.DONE);
        verify(order).markAsDone(); // 상태 변경 메서드 호출 여부 검증
        verify(paymentRepository).save(any(Payment.class));
    }

    @Test
    @DisplayName("결제 실패 - 요청 금액과 주문 금액이 다를 경우 예외 발생")
    void createPayment_fail_invalidAmount() {
        // Given
        String orderNumber = "ORD-ERR";
        Order order = Order.builder()
                .orderNumber(orderNumber)
                .totalAmount(new BigDecimal("10000.00"))
                .user(mockUser)
                .status(OrderStatus.READY)
                .build();

        PaymentRequestDto requestDto = PaymentRequestDto.builder()
                .orderId(orderNumber)
                .totalAmount(new BigDecimal("99999.00")) // 잘못된 금액
                .build();

        given(orderRepository.findByOrderNumber(orderNumber)).willReturn(Optional.of(order));

        // When & Then
        assertThatThrownBy(() -> orderService.createPayment(requestDto, mockUser))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_AMOUNT);
    }
}
