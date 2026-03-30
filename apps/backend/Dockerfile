FROM node:22-alpine

RUN apk add --no-cache wget openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

EXPOSE 3001

CMD ["sh", "-lc", "npm run start:dev"]