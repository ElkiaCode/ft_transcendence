FROM node:22-alpine

RUN apk add --no-cache wget openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate && npm run build


EXPOSE 3001

CMD ["sh", "-lc", "npx prisma generate && npx prisma migrate deploy && npm run seed:admin && npm run start:dev"]
