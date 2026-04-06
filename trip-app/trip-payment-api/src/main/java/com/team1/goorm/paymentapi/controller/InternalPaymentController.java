package com.team1.goorm.paymentapi.controller;

import com.team1.goorm.paymentapi.dto.PaymentProcessRequestDto;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/internal/api/v1/payments")
public class InternalPaymentController {

    @PostMapping("/process")
    public ResponseEntity<Map<String, Object>> process(
            @RequestHeader(value = "X-Demo-Failure", required = false) String demoFailure,
            @RequestBody PaymentProcessRequestDto request
    ) {
        maybeFail(demoFailure);
        return ResponseEntity.ok(Map.of(
                "service", "trip-payment-api",
                "action", "process",
                "order_id", request.getOrderId(),
                "amount", request.getTotalAmount()
        ));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode())
                .body(Map.of("message", ex.getReason()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("message", ex.getMessage()));
    }

    private void maybeFail(String demoFailure) {
        if ("payment_404".equalsIgnoreCase(demoFailure)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "trip-payment-api forced 404");
        }
        if ("payment_500".equalsIgnoreCase(demoFailure)) {
            throw new IllegalStateException("trip-payment-api forced 500");
        }
    }
}
