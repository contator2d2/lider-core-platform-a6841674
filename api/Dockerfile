# ---------- deps ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY api/package.json api/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# ---------- build ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ../prisma
COPY api/ ./
RUN npx prisma generate --schema=../prisma/schema.prisma
RUN npm run build

# ---------- runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY prisma ../prisma
EXPOSE 4000
CMD sh -c "npx prisma migrate deploy --schema=../prisma/schema.prisma && node dist/index.js"