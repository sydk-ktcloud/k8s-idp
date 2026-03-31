-- psql 창에서 입력
INSERT INTO users (user_id, name, email) 
VALUES (1, 'BAEK BYUNG', 'rawstock@naver.com');
INSERT INTO product (product_id, product_name, category, price, description, image, image_2, addr, nights) 
VALUES 
(1, '제주도 3박 4일 여행', '자연관광', 890000, '제주도 푸른 바다 여행', '/assets/images/jeju.png', 'https://placehold.co/400x300?text=Jeju2', '제주', 3),
(2, '부산 당일치기', '도시여행', 230000, '부산 해운대 투어', '/assets/images/busan.png', 'https://placehold.co/400x300?text=Busan2', '부산', 0),
(3, '광주 2박 3일 여행', '도시여행', 460000, '광주 문화 예술 여행', '/assets/images/Gwangju.png', 'https://placehold.co/400x300?text=Gwangju2', '광주', 2),
(4, '동해 바다 기차여행', '자연관광', 570000, '강원도 동해 바다 열차', '/assets/images/train.png', 'https://placehold.co/400x300?text=EastSea2', '강원', 1),
(5, '서울 고궁 투어', '문화예술', 330000, '경복궁과 창덕궁 탐방', '/assets/images/gogung.png', 'https://placehold.co/400x300?text=Seoul2', '서울', 0),
(6, '강릉 3박 4일 여행', '도시여행', 660000, '강릉 커피 거리와 바다', '/assets/images/gangrung.png', 'https://placehold.co/400x300?text=Gangneung2', '강릉', 3),
(7, '경복궁 역사 탐방', '역사탐방', 150000, '서울의 역사 깊은 궁궐', '/assets/images/kyungbokgung.png', 'https://placehold.co/400x300?text=Gyeongbokgung2', '서울', 0),
(8, '전주 한옥마을 역사 투어', '역사탐방', 210000, '전주 한옥의 멋과 맛', '/assets/images/hanock.png', 'https://placehold.co/400x300?text=Jeonju2', '전주', 1),
(9, '부산 해산물 미식 투어', '음식여행', 180000, '자갈치 시장 해산물 체험', '/assets/images/seafood.png', 'https://placehold.co/400x300?text=Seafood2', '부산', 0),
(10, '전주 비빔밥 음식 여행', '음식여행', 120000, '전주 전통 비빔밥 투어', '/assets/images/hanock.png', 'https://placehold.co/400x300?text=Bibimbap2', '전주', 0);