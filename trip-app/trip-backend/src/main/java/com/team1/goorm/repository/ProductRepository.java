package com.team1.goorm.repository;

import com.team1.goorm.domain.entity.Product;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    // 카테고리별 조회
    List<Product> findByCategory(String category);

    // 지역별 조회 - addr에 특정 문자열이 포함된 상품을 조회
    List<Product> findByAddrContaining(String region);

    // 카테고리의 존재를 확인
    boolean existsByCategory(String category);
}