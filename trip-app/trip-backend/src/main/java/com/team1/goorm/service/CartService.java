package com.team1.goorm.service;

import com.team1.goorm.common.exception.BusinessException;
import com.team1.goorm.common.exception.ErrorCode;
import com.team1.goorm.domain.dto.CartRequestDto;
import com.team1.goorm.domain.dto.CartResponseDto;
import com.team1.goorm.domain.entity.Cart;
import com.team1.goorm.domain.entity.Product;
import com.team1.goorm.repository.CartRepository;
import com.team1.goorm.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CartService {
    private final CartRepository cartRepository;
    private final ProductRepository productRepository;

    // 장바구니의 목록을 조회
    @Transactional(readOnly = true)
    public List<CartResponseDto> getCartList(Long userId) {
        return cartRepository.findAllByUserIdWithProduct(userId)
                .stream()
                .map(CartResponseDto::fromEntity)
                .collect(Collectors.toList());
    }

    // 장바구니의 목록을 추가, 요청을 받아 데이터를 정리하여 장바구니에 추가
    @Transactional
    public CartResponseDto addCart(Long userId, CartRequestDto request) {
        if (request.getQuantity() < 1) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new BusinessException(ErrorCode.PRODUCT_NOT_FOUND));

        Optional<Cart> existingCart = cartRepository.findByUserIdAndProduct_ProductId(userId, request.getProductId());

        // 중복처리, 이미 데이터가 있다면 quantity만 더하기
        if (existingCart.isPresent()) {
            Cart cart = existingCart.get();
            Cart updatedCart = Cart.builder()
                    .cartId(cart.getCartId())
                    .userId(userId)
                    .quantity(cart.getQuantity() + request.getQuantity())
                    .departureDate(request.getDepartureDate())
                    .product(product)
                    .build();
            return CartResponseDto.fromEntity(cartRepository.save(updatedCart));
        }

        Cart cart = Cart.builder()
                .userId(userId)
                .quantity(request.getQuantity())
                .departureDate(request.getDepartureDate())
                .product(product)
                .build();
        return CartResponseDto.fromEntity(cartRepository.save(cart));
    }

    // id 기반으로 데이터를 삭제
    @Transactional
    public void deleteCart(Long userId, Long cartId) {
        Cart cart = cartRepository.findById(cartId)
                .orElseThrow(() -> new BusinessException((ErrorCode.INVALID_REQUEST)));

        if (!cart.getUserId().equals(userId)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }

        cartRepository.deleteById(cartId);
    }
}
