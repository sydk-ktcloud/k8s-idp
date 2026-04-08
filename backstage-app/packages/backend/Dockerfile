# Backstage backend Dockerfile — uses pre-built dist from local build
# Before building this image, run: yarn build:backend
#
#   docker buildx build --platform linux/amd64 \
#     -t <registry>/backstage-backend:latest \
#     --push \
#     -f packages/backend/Dockerfile .

FROM node:24-trixie-slim

ENV NODE_ENV=production
ENV NODE_OPTIONS="--no-node-snapshot"

USER node
WORKDIR /app

COPY --chown=node:node .yarn ./.yarn
COPY --chown=node:node .yarnrc.yml backstage.json yarn.lock package.json ./

# skeleton.tar.gz contains workspace package.json files for production install
COPY --chown=node:node packages/backend/dist/skeleton.tar.gz ./
RUN tar xzf skeleton.tar.gz && rm skeleton.tar.gz

RUN yarn workspaces focus --all --production

COPY --chown=node:node examples ./examples
COPY --chown=node:node templates ./templates
COPY --chown=node:node app-config*.yaml ./

# Extract bundle.tar.gz which contains built backend + app dist files
COPY --chown=node:node packages/backend/dist/bundle.tar.gz ./
RUN tar xzf bundle.tar.gz && rm bundle.tar.gz

CMD ["node", "packages/backend", "--config", "app-config.yaml", "--config", "app-config.production.yaml"]
