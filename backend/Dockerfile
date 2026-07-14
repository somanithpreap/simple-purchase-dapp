FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
