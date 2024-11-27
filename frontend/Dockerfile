FROM node:18

WORKDIR /app

# Másold a package.json és package-lock.json fájlokat
COPY package*.json ./

# Függőségek telepítése
RUN npm install

# Másold a teljes frontend mappát
COPY . .

# A fejlesztői szerver indítása
CMD ["npm", "start"]