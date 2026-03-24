package com.team1.goorm.service;

import com.team1.goorm.domain.dto.TourApiListResponseDto;
import com.team1.goorm.domain.entity.Region;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

@SpringBootTest
public class TourApiClientTest {
    @Autowired
    private TourApiClient tourApiClient;

    @Test
    void API_데이터_확인_테스트() {
        // Given: 서울 지역 선택
        Region region = Region.SEOUL;

        // When: API 호출
        List<TourApiListResponseDto.Item> items = tourApiClient.fetchTourDataByRegion(region);

        // Then: 데이터 출력 및 검증
        if (items.isEmpty()) {
            System.out.println("검색 결과가 없습니다.");
        } else {
            items.forEach(item -> {
                System.out.println("================");
                System.out.println("제목: " + item.getTitle());
                System.out.println("이미지: " + item.getFirstimage());
                System.out.println("콘텐츠ID: " + item.getContentid());
                System.out.println("주소:" + item.getAddr1());
            });
        }
    }
}
