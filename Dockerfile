# syntax=docker/dockerfile:1
# mcp-lint container image. The build stage bundles the CLI into one JavaScript file on the build
# host's platform; the runtime stage only copies that file, so multi-arch builds need no emulation.
# Node.js and npx stay in the image so that you can lint stdio servers started with them.

FROM --platform=$BUILDPLATFORM oven/bun:1.4.2-alpine@sha256:d888c0ae6c86d7866ff10c5aafdd9077b36aee6455b33dd270fb93c0dd5cef6f AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN bun install --frozen-lockfile --ignore-scripts --production
COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN bun scripts/compile.mjs /out/cli.js node

FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
LABEL org.opencontainers.image.title="mcp-lint" \
      org.opencontainers.image.description="Lint and grade Model Context Protocol (MCP) servers." \
      org.opencontainers.image.source="https://github.com/superintelligenceco/mcp-lint" \
      org.opencontainers.image.licenses="Apache-2.0"
ENV NODE_ENV=production
COPY --from=build /out/cli.js /app/cli.js
COPY LICENSE /app/LICENSE
WORKDIR /work
USER node
ENTRYPOINT ["node", "/app/cli.js"]
CMD ["--help"]
