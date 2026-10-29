# syntax=docker/dockerfile:1
# Production image for a long-running Node server (VPS, container platform). Not for serverless.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so they are build args.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BRAND_NAME=ReelSave
ARG NEXT_PUBLIC_CONTACT_EMAIL
ARG NEXT_PUBLIC_ADSENSE_PUBLISHER_ID
ARG NEXT_PUBLIC_ADSENSE_SLOT_BELOW_TOOL
ARG NEXT_PUBLIC_ADSENSE_SLOT_BETWEEN_SECTIONS
ARG NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE
ARG NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR
ARG NEXT_PUBLIC_ADSENSE_SLOT_ABOVE_FOOTER
ARG NEXT_PUBLIC_CONSENT_MODE=builtin
ARG NEXT_PUBLIC_PLAUSIBLE_DOMAIN
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_BRAND_NAME=$NEXT_PUBLIC_BRAND_NAME \
    NEXT_PUBLIC_CONTACT_EMAIL=$NEXT_PUBLIC_CONTACT_EMAIL \
    NEXT_PUBLIC_ADSENSE_PUBLISHER_ID=$NEXT_PUBLIC_ADSENSE_PUBLISHER_ID \
    NEXT_PUBLIC_ADSENSE_SLOT_BELOW_TOOL=$NEXT_PUBLIC_ADSENSE_SLOT_BELOW_TOOL \
    NEXT_PUBLIC_ADSENSE_SLOT_BETWEEN_SECTIONS=$NEXT_PUBLIC_ADSENSE_SLOT_BETWEEN_SECTIONS \
    NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE=$NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE \
    NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR=$NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR \
    NEXT_PUBLIC_ADSENSE_SLOT_ABOVE_FOOTER=$NEXT_PUBLIC_ADSENSE_SLOT_ABOVE_FOOTER \
    NEXT_PUBLIC_CONSENT_MODE=$NEXT_PUBLIC_CONSENT_MODE \
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN=$NEXT_PUBLIC_PLAUSIBLE_DOMAIN
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/scripts/start-standalone.mjs ./start-standalone.mjs
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health | grep -q '"status":"ok"' || exit 1
CMD ["node", "start-standalone.mjs"]
