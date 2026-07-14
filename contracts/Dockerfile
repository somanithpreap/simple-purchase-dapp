FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run compile

EXPOSE 8545

CMD ["npx", "hardhat", "node", "--hostname", "0.0.0.0"]
