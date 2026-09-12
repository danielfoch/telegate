FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY relay/server.mjs relay/push.mjs relay/
RUN mkdir /data && chown node:node /data
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8790 DATABASE_PATH=/data/telegate.sqlite
VOLUME /data
EXPOSE 8790
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:8790/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "relay/server.mjs"]
