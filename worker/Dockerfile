FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    MONTAGE_TEMP_DIR=/var/lib/rudyo-montage
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates dumb-init ffmpeg \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /var/lib/rudyo-montage \
  && chown node:node /var/lib/rudyo-montage \
  && chmod 700 /var/lib/rudyo-montage
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/index.js"]
