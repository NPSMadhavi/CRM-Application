FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate --schema=prisma/schema.prisma

COPY . .

EXPOSE 5000

CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.prisma && node prisma/seed.js && node src/server.js"]
