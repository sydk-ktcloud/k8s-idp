package com.team1.goorm.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// Swagger 설정용 클래스
@Configuration
public class ApiDocumentConfig {
    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(
                        new Info()
                                .title("Goorm Trip API")
                                .version("1.0")
                                .description("Goorm Trip 프로젝트의 API 문서입니다."));
    }
}
