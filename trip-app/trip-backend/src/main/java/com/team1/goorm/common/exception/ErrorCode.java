package com.team1.goorm.common.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum ErrorCode {
    // 공통 에러 (401, 500)
    SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 오류가 발생했습니다."),
    AUTH_REQUIRED(HttpStatus.UNAUTHORIZED, "로그인이 필요한 서비스입니다."),
    // 400
    INVALID_PRODUCT(HttpStatus.BAD_REQUEST, "판매 중지된 상품이 포함되어 있습니다."),
    INVALID_AMOUNT(HttpStatus.BAD_REQUEST, "결제 금액이 일치하지 않습니다."),
    OUT_OF_STOCK(HttpStatus.BAD_REQUEST, "재고가 부족합니다."),
    INVALID_REQUEST(HttpStatus.NOT_FOUND, "처리할 수 없는 요청입니다."),
    INVALID_CATEGORY(HttpStatus.NOT_FOUND, "존재하지 않는 카테고리입니다."),
    // 402
    CARD_DECLINED(HttpStatus.PAYMENT_REQUIRED, "한도 초과 또는 잔액이 부족합니다."),
    // 404
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "사용자 정보를 찾을 수 없습니다."),
    PRODUCT_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 상품입니다."),
    REGION_NOT_FOUND(HttpStatus.NOT_FOUND, "해당 지역에 상품이 없습니다.");


    private final HttpStatus httpStatus;
    private final String message;
}
