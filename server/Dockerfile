# Self-contained ledger service. No managed platform required.
FROM node:22-alpine

WORKDIR /app

# tsx runs the TypeScript directly, which keeps the image close to the source
# someone is auditing rather than to a bundle they cannot read.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm install --no-save tsx

COPY server ./server

# The guard store must outlive the container: losing it resets every sybil
# guard. Mount a volume here.
VOLUME /app/data
ENV STORE_PATH=/app/data/guard.json
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:8787/health || exit 1

CMD ["npx", "tsx", "server/src/node.ts"]
