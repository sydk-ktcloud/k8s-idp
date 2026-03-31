package com.team1.goorm.repository;

import com.team1.goorm.domain.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
}
