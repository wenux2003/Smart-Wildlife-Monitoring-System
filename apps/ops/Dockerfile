FROM node:22-alpine

WORKDIR /workspace
RUN corepack enable

COPY . .
RUN pnpm install --no-frozen-lockfile

EXPOSE 5174
CMD ["pnpm", "--filter", "@wr/ops", "dev"]
