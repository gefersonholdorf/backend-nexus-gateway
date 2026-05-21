# Estágio 1 - Build da aplicação
FROM node:20-alpine as builder

WORKDIR /app
COPY package*.json ./

RUN npm ci
COPY . .

RUN npm run build

# Estágio 2 - Imagem final para produção
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./

RUN npm ci
COPY --from=builder /app/build ./build

EXPOSE 3336

CMD ["npm", "run", "start"]