# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json eslint.config.mjs .prettierrc.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN mkdir -p apps/web/.next/standalone/apps/web/.next && \
    cp -R apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && groupadd --system qusto && useradd --system --gid qusto --home-dir /app qusto
WORKDIR /app
COPY --from=build --chown=qusto:qusto /app /app
USER qusto

FROM runtime AS web
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
EXPOSE 3000
CMD ["node", "apps/web/.next/standalone/apps/web/server.js"]

FROM runtime AS worker
CMD ["node", "apps/worker/dist/main.js"]

FROM runtime AS migrate
CMD ["node", "packages/database/dist/cli.js"]
