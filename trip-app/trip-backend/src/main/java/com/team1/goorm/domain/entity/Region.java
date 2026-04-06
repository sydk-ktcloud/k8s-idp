package com.team1.goorm.domain.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.util.Arrays;

@Getter
@RequiredArgsConstructor
public enum Region {
    SEOUL("11", "서울"),
    BUSAN("26", "부산"),
    DAEGU("27", "대구"),
    INCHEON("28", "인천"),
    GWANGJU("29", "광주"),
    DAEJEON("30", "대전"),
    ULSAN("31", "울산"),
    GYEONGGI("41", "경기"),
    CHUNGBUK("43", "충북"),
    CHUNGNAM("44", "충남"),
    JEONNAM("46", "전남"),
    GYEONGBUK("47", "경북"),
    GYEONGNAM("48", "경남"),
    JEJU("50", "제주"),
    GANGWON("51", "강원"),
    JEONBUK("52", "전북"),
    SEJONG("17", "세종");

    private final String code;
    private final String description;

    // 코드로 Enum을 찾는 편의 메서드
    public static Region getByCode(String code) {
        return Arrays.stream(Region.values())
                .filter(r -> r.code.equals(code))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("일치하는 코드가 없습니다: " + code));
    }
}
