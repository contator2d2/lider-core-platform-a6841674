# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app/api
COPY api/package.json api/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---------- build ----------
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app/api
COPY --from=deps /app/api/node_modules ./node_modules
COPY prisma /app/prisma
COPY api/ ./
RUN npx prisma generate --schema=../prisma/schema.prisma
RUN npm run build

# ---------- runtime ----------
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app/api
ENV NODE_ENV=production
COPY --from=build /app/api/node_modules ./node_modules
COPY --from=build /app/api/dist ./dist
COPY --from=build /app/api/package.json ./package.json
COPY prisma /app/prisma
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy --schema=../prisma/schema.prisma && node dist/index.js"]