# availability-calendar

docker-compose down --rmi all --volumes --remove-orphans

rm frontend/package-lock.json
rm -rf frontend/node_modules/

rm backend/test.db

npm cache clean --force

docker-compose up --build


npm install @fullcalendar/react @fullcalendar/daygrid --force
