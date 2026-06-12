FROM node:22-alpine AS dependencies

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

FROM dependencies AS builder

COPY . .

RUN npx prisma generate && npm run build

FROM node:22-alpine AS production

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

RUN npm ci --omit=dev --legacy-peer-deps \
    && npx prisma generate \
    && npm cache clean --force

COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node scripts ./scripts

RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node

EXPOSE 3001

CMD ["sh", "-lc", "npx prisma migrate deploy && npm run seed:admin && npm run start:prod"]
