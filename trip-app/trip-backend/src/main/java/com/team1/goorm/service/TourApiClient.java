package com.team1.goorm.service;

import com.team1.goorm.domain.dto.TourApiListResponseDto;
import com.team1.goorm.domain.entity.Region;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Collections;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class TourApiClient {
    @Value("${external.api.tour.base-url:}")
    private String baseUrl;

    @Value("${external.api.tour.service-key:}")
    private String serviceKey;

    private final RestTemplate restTemplate;

    public List<TourApiListResponseDto.Item> fetchTourDataByRegion(Region region) {
        URI uri = UriComponentsBuilder.fromHttpUrl(baseUrl + "/areaBasedList2")
                .queryParam("serviceKey", serviceKey)
                .queryParam("numOfRows", 50)
                .queryParam("pageNo", 1)
                .queryParam("MobileOS", "WEB")
                .queryParam("MobileApp", "GoormTrip")
                .queryParam("_type", "json")
                .queryParam("lDongRegnCd", region.getCode())
                .queryParam("contentTypeId", 12)
                .queryParam("arrange", "Q")
                .build(true).toUri();

        log.info("Request URI: {}", uri);

        try {
            TourApiListResponseDto response = restTemplate.getForObject(uri, TourApiListResponseDto.class);

            if (response != null && response.getResponse().getBody().getItems() != null) {
                return response.getResponse().getBody().getItems().getItem();
            }
        } catch (Exception e) {
            log.error("API 호출 중 오류 발생: {}", e.getMessage());
        }

        return Collections.emptyList();
    }
}
