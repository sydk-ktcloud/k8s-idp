# Multi-stage Dockerfile for Backstage backend
# Run from repo root:
#   docker buildx build --platform linux/amd64 \
#     -t <registry>/backstage-backend:latest \
#     --push \
#     -f packages/backend/Dockerfile .

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:24-trixie-slim AS build

ENV PYTHON=/usr/bin/python3

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends python3 g++ build-essential && \
    rm -rf /var/lib/apt/lists/*

USER node
WORKDIR /app

# Copy entire workspace upfront (plugins/* included)
COPY --chown=node:node . .

RUN --mount=type=cache,target=/home/node/.cache/yarn,sharing=locked,uid=1000,gid=1000 \
    yarn install --immutable

RUN yarn build:backend

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:24-trixie-slim

ENV PYTHON=/usr/bin/python3
ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-node-snapshot"

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && \
    apt-get install -y --no-install-recommends python3 g++ build-essential libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

USER node
WORKDIR /app

COPY --chown=node:node .yarn ./.yarn
COPY --chown=node:node .yarnrc.yml backstage.json yarn.lock package.json ./

# skeleton.tar.gz contains workspace package.json files for production install
COPY --from=build --chown=node:node /app/packages/backend/dist/skeleton.tar.gz ./
RUN tar xzf skeleton.tar.gz && rm skeleton.tar.gz

RUN --mount=type=cache,target=/home/node/.cache/yarn,sharing=locked,uid=1000,gid=1000 \
    yarn workspaces focus --all --production && rm -rf "$(yarn cache clean)"

COPY --chown=node:node examples ./examples
COPY --chown=node:node app-config*.yaml ./

COPY --from=build --chown=node:node /app/packages/backend/dist/bundle.tar.gz ./
RUN tar xzf bundle.tar.gz && rm bundle.tar.gz

CMD ["node", "packages/backend", "--config", "app-config.yaml", "--config", "app-config.production.yaml"]
