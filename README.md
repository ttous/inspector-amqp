# inspector-amqp

Typescript [Metrics Reporter](https://github.com/rstiller/inspector-metrics/blob/master/lib/metrics/metric-reporter.ts) for [AMQP](https://www.amqp.org/).

This library is made for [inspector-metrics](https://github.com/rstiller/inspector-metrics) node module and is meant to be used with `typescript` / `nodejs`.  
It uses [amqp-ts](https://github.com/abreits/amqp-ts) as amqp client.

## install

`npm install --save inspector-amqp`

## running rabbitmq locally (using docker)

```
docker run -d --hostname my-rabbit --name my-rabbit -p 4369:4369 -p 5671:5671 -p 5672:5672 -p 15672:15672 rabbitmq
docker exec my-rabbit rabbitmq-plugins enable rabbitmq_management
```

## using the reporter

```
docker run -d --hostname my-rabbit --name my-rabbit -p 4369:4369 -p 5671:5671 -p 5672:5672 -p 15672:15672 rabbitmq
docker exec my-rabbit rabbitmq-plugins enable rabbitmq_management
```

