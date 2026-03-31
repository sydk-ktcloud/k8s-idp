package com.team1.goorm.repository;

import com.team1.goorm.domain.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
}
