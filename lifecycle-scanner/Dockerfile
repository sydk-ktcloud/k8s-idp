FROM node:20-bullseye-slim

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY scan.js ./

ENV NODE_ENV=production

CMD ["node", "scan.js"]
