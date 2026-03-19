FROM node:20-bullseye

WORKDIR /app

RUN apt-get update && apt-get install -y curl && \
    curl -LO "https://dl.k8s.io/release/v1.32.0/bin/linux/amd64/kubectl" && \
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && \
    rm kubectl && \
    apt-get clean

COPY package*.json ./
RUN npm install

COPY . .

ENV NODE_ENV=production

CMD ["node", "bot.js"]