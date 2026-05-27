# syntax=docker/dockerfile:1.7

FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm fetch --frozen-lockfile
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig*.json ./
COPY src ./src
COPY tests ./tests
RUN pnpm build

FROM deps AS test
COPY tsconfig*.json ./
COPY src ./src
COPY tests ./tests
CMD ["pnpm", "test"]

FROM node:20-slim AS runtime
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm fetch --frozen-lockfile --prod
RUN pnpm install --frozen-lockfile --prod --offline

COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["pnpm", "start"]
