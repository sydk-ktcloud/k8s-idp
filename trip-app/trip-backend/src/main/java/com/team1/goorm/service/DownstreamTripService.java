package com.team1.goorm.service;

import com.team1.goorm.common.exception.DownstreamServiceException;
import com.team1.goorm.domain.dto.CartRequestDto;
import com.team1.goorm.domain.dto.CartSyncRequestDto;
import com.team1.goorm.domain.dto.PaymentProcessRequestDto;
import com.team1.goorm.domain.dto.PaymentRequestDto;
import com.team1.goorm.domain.entity.Order;
import com.team1.goorm.domain.entity.OrderProduct;
import com.team1.goorm.domain.entity.Product;
import com.team1.goorm.domain.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

@Service
@RequiredArgsConstructor
public class DownstreamTripService {
    private final RestTemplate restTemplate;

    @Value("${trip.chain.enabled:false}")
    private boolean chainEnabled;

    @Value("${trip.cart-api.base-url}")
    private String cartApiBaseUrl;

    @Value("${trip.payment-api.base-url}")
    private String paymentApiBaseUrl;

    public void syncCart(Long userId, CartRequestDto request, Product product, String demoFailure) {
        if (!chainEnabled) {
            return;
        }

        CartSyncRequestDto payload = CartSyncRequestDto.builder()
                .userId(userId)
                .productId(product.getProductId())
                .productName(product.getProductName())
                .quantity(request.getQuantity())
                .departureDate(request.getDepartureDate())
                .build();

        post(cartApiBaseUrl + "/internal/api/v1/cart/sync", payload, demoFailure);
    }

    public void reserveOrder(Order order, User user, String demoFailure) {
        if (!chainEnabled || order.getOrderProducts().isEmpty()) {
            return;
        }

        OrderProduct firstProduct = order.getOrderProducts().getFirst();
        CartSyncRequestDto payload = CartSyncRequestDto.builder()
                .userId(user.getId())
                .productId(firstProduct.getProduct().getProductId())
                .productName(firstProduct.getProduct().getProductName())
                .quantity(firstProduct.getQuantity())
                .departureDate(firstProduct.getDepartureDate())
                .build();

        post(cartApiBaseUrl + "/internal/api/v1/cart/reserve", payload, demoFailure);
    }

    public void processPayment(Order order, PaymentRequestDto requestDto, User user, String demoFailure) {
        if (!chainEnabled || order.getOrderProducts().isEmpty()) {
            return;
        }

        OrderProduct firstProduct = order.getOrderProducts().getFirst();
        PaymentProcessRequestDto payload = PaymentProcessRequestDto.builder()
                .userId(user.getId())
                .orderId(order.getOrderNumber())
                .productId(firstProduct.getProduct().getProductId())
                .productName(firstProduct.getProduct().getProductName())
                .quantity(firstProduct.getQuantity())
                .totalAmount(requestDto.getTotalAmount())
                .paymentMethod(requestDto.getPaymentMethod())
                .build();

        post(paymentApiBaseUrl + "/internal/api/v1/payments/process", payload, demoFailure);
    }

    private void post(String url, Object payload, String demoFailure) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (demoFailure != null && !demoFailure.isBlank()) {
            headers.set("X-Demo-Failure", demoFailure);
        }

        try {
            restTemplate.postForEntity(url, new HttpEntity<>(payload, headers), Void.class);
        } catch (HttpStatusCodeException ex) {
            throw new DownstreamServiceException(ex.getStatusCode(), ex.getResponseBodyAsString());
        } catch (ResourceAccessException ex) {
            throw new DownstreamServiceException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, ex.getMessage());
        }
    }
}
