package com.team1.goorm.domain.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum OrderStatus {
    READY("1", "Ready to pay"),
    DONE("2", "Payed"),
    CANCELLED("3", "Cancelled");

    private final String code;
    private final String description;
}
