package com.team1.goorm.repository;

import com.team1.goorm.domain.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {
    // 주문 번호로 주문 찾기
    Optional<Order> findByOrderNumber(String orderNumber);

    // 특정 유저의 모든 주문 찾기
    List<Order> findAllByUserId(Long userId);
}
