FROM node:20-alpine AS builder
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci

COPY backend/tsconfig.json ./tsconfig.json
COPY backend/src ./src

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 5000
CMD ["node", "dist/server.js"]
