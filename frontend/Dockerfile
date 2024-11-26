FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --force

RUN npm install @fullcalendar/react @fullcalendar/daygrid --force

COPY . .

CMD ["npm", "start"]
