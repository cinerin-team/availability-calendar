# Build phase
FROM node:18 AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "start"]

# Nginx image
FROM nginx:latest
COPY --from=builder /app/build /usr/share/nginx/html