# Dockerfile opcional. Northflank puede desplegar sin esto usando "Buildpack"
# (detecta Node.js automáticamente por package.json), pero si prefieres o
# necesitas más control, puedes usar este Dockerfile en su lugar.

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
