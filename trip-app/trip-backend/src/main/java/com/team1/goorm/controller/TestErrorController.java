package com.team1.goorm.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TestErrorController {

    @GetMapping("/error-test")
    public String errorTest(@RequestParam(required = false) String test) {

        // test=true일 때만 500 발생
        if ("true".equals(test)) {
            throw new RuntimeException("테스트용 강제 에러");
        }

        return "OK";
    }
}