package com.team1.goorm.common.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class ApiResponse<T> {
    private final int status;
    private final String code;
    private final String message;
    private final T data;

    // 성공 응답
    public static <T> ApiResponse<T> success(String code, String message, T data) {
        return ApiResponse.<T>builder()
                .status(200)
                .code(code)
                .message(message)
                .data(data)
                .build();
    }

    // 생성 응답
    public static <T> ApiResponse<T> create(String code, String message, T data) {
        return ApiResponse.<T>builder()
                .status(201)
                .code(code)
                .message(message)
                .data(data)
                .build();
    }
    
    // 실패 응답
    public static <T> ApiResponse<T> error(int status, String code, String message, T data) {
        return ApiResponse.<T>builder()
                .status(status)
                .code(code)
                .message(message)
                .data(data)
                .build();
    }
}
