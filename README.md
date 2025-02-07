# availability-calendar

docker-compose down --rmi all --volumes --remove-orphans

rm frontend/package-lock.json
rm -rf frontend/node_modules/

rm backend/test.db

npm cache clean --force

docker-compose up --build


npm install @fullcalendar/react @fullcalendar/daygrid --force

docker system prune -a --volumes
docker builder prune -a


--------------------------------------
docker-compose down
docker-compose build --no-cache
docker-compose up -d

teljes tisztítás:

docker ps

docker stop $(docker ps -q)
docker rm $(docker ps -aq)

docker-compose down --rmi all --volumes --remove-orphans
docker system prune -f

docker system prune -a --volumes -f
