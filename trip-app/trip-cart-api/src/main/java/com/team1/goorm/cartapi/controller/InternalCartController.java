package com.team1.goorm.cartapi.controller;

import com.team1.goorm.cartapi.dto.CartSyncRequestDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/internal/api/v1/cart")
public class InternalCartController {

    @PostMapping("/sync")
    public ResponseEntity<Map<String, Object>> sync(
            @RequestHeader(value = "X-Demo-Failure", required = false) String demoFailure,
            @RequestBody CartSyncRequestDto request
    ) {
        maybeFail(demoFailure);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("service", "trip-cart-api");
        body.put("action", "sync");
        body.put("product_id", request.getProductId());
        body.put("quantity", request.getQuantity());
        return ResponseEntity.ok(body);
    }

    @PostMapping("/reserve")
    public ResponseEntity<Map<String, Object>> reserve(
            @RequestHeader(value = "X-Demo-Failure", required = false) String demoFailure,
            @RequestBody CartSyncRequestDto request
    ) {
        maybeFail(demoFailure);
        log.info(
                "reserve request userId={}, productId={}, productName={}, quantity={}, departureDate={}",
                request.getUserId(),
                request.getProductId(),
                request.getProductName(),
                request.getQuantity(),
                request.getDepartureDate()
        );

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("service", "trip-cart-api");
        body.put("action", "reserve");
        body.put("product_id", request.getProductId());
        body.put("quantity", request.getQuantity());
        return ResponseEntity.ok(body);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", ex.getReason() == null ? "trip-cart-api error" : ex.getReason());
        return ResponseEntity.status(ex.getStatusCode())
                .body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception ex) {
        log.error("trip-cart-api unexpected error", ex);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(body);
    }

    private void maybeFail(String demoFailure) {
        if ("cart_404".equalsIgnoreCase(demoFailure)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "trip-cart-api forced 404");
        }
        if ("cart_500".equalsIgnoreCase(demoFailure)) {
            throw new IllegalStateException("trip-cart-api forced 500");
        }
    }
}
