# Frontend (TanStack Start) container.
# Build stage: install & compile with the API URL baked in via VITE_API_URL.
FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
# Force Nitro to produce a Node server (default preset targets Cloudflare Workers,
# which cannot run with `node .output/server/index.mjs` inside a plain container).
ENV NITRO_PRESET=node-server
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# Runtime: TanStack Start's node server output.
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]