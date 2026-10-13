# --- build the client
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# --- run the API (also serves the built client)
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package*.json server/
RUN npm --prefix server ci --omit=dev
COPY server/ server/
COPY --from=client /app/client/dist client/dist
EXPOSE 3001
VOLUME /app/server/data
CMD ["node", "server/src/index.js"]
