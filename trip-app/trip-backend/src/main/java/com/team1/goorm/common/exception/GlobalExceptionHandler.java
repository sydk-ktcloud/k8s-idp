package com.team1.goorm.common.exception;

import com.team1.goorm.common.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 비즈니스 로직 중 발생하는 커스텀 예외 처리
     */
    @ExceptionHandler(BusinessException.class)
    protected ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException e) {
        log.error("BusinessException: {}", e.getErrorCode().getMessage());
        ErrorCode errorCode = e.getErrorCode();

        return ResponseEntity.status(errorCode.getHttpStatus())
                .body(ApiResponse.error(
                        errorCode.getHttpStatus().value(),
                        errorCode.name(),
                        errorCode.getMessage(),
                        null
                ));
    }
    // GlobalExceptionHandler.java에 추가 제안
    @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
    protected ResponseEntity<ApiResponse<Void>> handle404(Exception e) {
    // 404는 Stack Trace 없이 한 줄만 로그를 남겨 Loki 부하를 줄입니다.
        log.error("404 Not Found: {}", e.getMessage()); 
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ApiResponse.error(404, "NOT_FOUND", "페이지를 찾을 수 없습니다.", null));
    }

    @ExceptionHandler(DownstreamServiceException.class)
    protected ResponseEntity<ApiResponse<Void>> handleDownstreamServiceException(DownstreamServiceException e) {
        HttpStatusCode statusCode = e.getStatusCode();
        log.error("DownstreamServiceException [{}]: {}", statusCode.value(), e.getMessage());
        return ResponseEntity.status(statusCode)
                .body(ApiResponse.error(
                        statusCode.value(),
                        "DOWNSTREAM_ERROR",
                        e.getMessage(),
                        null
                ));
    }
    /**
     * 그 외 예상치 못한 모든 예외 처리 (500 에러)
     */
    @ExceptionHandler(Exception.class)
    protected ResponseEntity<ApiResponse<Void>> handleException(Exception e, HttpServletRequest request) {

        String uri = request.getRequestURI();

        // 🔥 actuator 요청은 예외 처리에서 제외
        if (uri.startsWith("/actuator")) {
            throw new RuntimeException(e);
        }

        log.error("Unexpected Exception: ", e);

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(
                        HttpStatus.INTERNAL_SERVER_ERROR.value(),
                        "SERVER_ERROR",
                        "서버 내부 오류가 발생했습니다.",
                        null
                ));
    }

}
