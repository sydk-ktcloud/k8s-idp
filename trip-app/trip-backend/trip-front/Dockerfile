# 1단계: 빌드 스테이지
FROM node:18-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 2단계: 실행 스테이지 (Nginx)
FROM nginx:stable-alpine
# 빌드된 결과물을 Nginx 정적 폴더로 복사
COPY --from=build-stage /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]