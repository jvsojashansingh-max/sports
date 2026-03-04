FROM node:22-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @sports/api exec prisma generate
RUN pnpm --filter @sports/api build
RUN pnpm --filter @sports/worker build

ENV NODE_ENV=production

EXPOSE 4000

CMD ["pnpm", "--filter", "@sports/api", "start"]
