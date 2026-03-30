package com.team1.goorm.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate() {
        // 타임아웃을 설정하여 외부 서버가 응답이 없을 경우 무한정 대기하는 것을 방지
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5000); // 연결 5초
        requestFactory.setReadTimeout(5000); // 데이터 읽기 5초

        return new RestTemplate(requestFactory);
    }
}
