# syntax=docker/dockerfile:1

# ---------- Base image ----------
FROM node:22-alpine AS base
# libc6-compat helps some native addons behave correctly on Alpine
RUN apk add --no-cache libc6-compat

# ---------- Install deps (incl. dev, needed to build bcrypt's native binding) ----------
FROM base AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Build ----------
FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build
# Strip devDependencies, keeping compiled native addons (bcrypt)
RUN npm prune --omit=dev

# ---------- Production runtime ----------
FROM base AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

RUN addgroup -S nodejs && adduser -S nestjs -G nodejs
USER nestjs

EXPOSE 3000

CMD ["node", "dist/src/main"]