# inspector-rabbitmq

## running rabbitmq locally

```
docker run -d --hostname my-rabbit --name my-rabbit -p 4369:4369 -p 5671:5671 -p 5672:5672 -p 15672:15672 rabbitmq
docker exec my-rabbit rabbitmq-plugins enable rabbitmq_management
```

## using the reporter

```
docker run -d --hostname my-rabbit --name my-rabbit -p 4369:4369 -p 5671:5671 -p 5672:5672 -p 15672:15672 rabbitmq
docker exec my-rabbit rabbitmq-plugins enable rabbitmq_management
```

