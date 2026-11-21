ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client ./client
COPY server ./server
COPY scripts ./scripts
RUN npm run build

FROM ${NODE_IMAGE} AS runtime
LABEL org.opencontainers.image.source="https://github.com/KRodenberg/tls-planscan"
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node --from=build /app/dist/server ./dist/server
COPY --chown=node:node server/node.mjs ./server/node.mjs
COPY --chown=node:node scripts/serve.mjs ./scripts/serve.mjs
USER node
EXPOSE 4173
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/api/status',{signal:AbortSignal.timeout(2000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "scripts/serve.mjs"]
