# syntax=docker/dockerfile:1.7
FROM node:lts-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/reconlite.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
# COOP/COEP intentionally omitted: Phase 1 uses single-threaded DuckDB-WASM
# (MVP + EH bundles, no pthreadWorker). Add same-origin/require-corp headers
# only when enabling the threaded (coi) bundle.
