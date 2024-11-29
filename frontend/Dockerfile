FROM node:18 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:latest

RUN apt-get update && apt-get install -y curl && apt-get clean

COPY --from=builder /app/build /usr/share/nginx/html