#!/bin/bash
docker kill $(docker ps -a -q)
docker rm $(docker ps -a -q)
docker run --rm -p 0.0.0.0:33306:3306 --name serverdb -v $PWD/mysql/logs:/logs -v $PWD/mysql/data:/var/lib/mysql -e MYSQL_ROOT_PASSWORD=123456 -d mysql:5.7
docker run --rm -p 127.0.0.1:16379:6379 --name serverredis -d redis:4
docker run --rm -p 27017:27017 --name servermongo -v $PWD/mongodb:/data/db -d mongo:4
docker run --rm --hostname imcc-rabbit --name serverrabbit -e RABBITMQ_DEFAULT_USER=serverrabbit -e RABBITMQ_DEFAULT_PASS=123456 -p 5672:5672 -p 15672:15672 -p 25672:25672 -d rabbitmq:3.7-management
