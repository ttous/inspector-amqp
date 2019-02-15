# inspector-amqp

Typescript [Metrics Reporter](https://github.com/rstiller/inspector-metrics/blob/master/lib/metrics/reporter/metric-reporter.ts) for [AMQP](https://www.amqp.org/).

This library is made for [inspector-metrics](https://github.com/rstiller/inspector-metrics) node module and is meant to be used with `typescript` / `nodejs`.

It uses [amqp-ts](https://github.com/abreits/amqp-ts) as amqp client.

## install

`npm install --save inspector-amqp`

## basic usage

```typescript
import { Event } from "inspector-metrics";
import { AmqpMetricReporter } from "../metrics";

// instance the Amqp reporter
const reporter: AmqpMetricReporter = new AmqpMetricReporter({
  connection: "amqp://localhost",
  exchangeName: "exchange",
  queueName: "queue",
});

// start reporter
reporter.start().then((r) => {
  const event = new Event<{}>("test")
    .setValue({
      int: 123,
      string: "toto",
    });

  // send event
  r.reportEvent(event);
});
```

## running rabbitmq locally (using docker)

```
docker run -d --hostname my-rabbit --name my-rabbit -p 4369:4369 -p 5671:5671 -p 5672:5672 -p 15672:15672 rabbitmq
docker exec my-rabbit rabbitmq-plugins enable rabbitmq_management
```

### releasing / publish docs

```text
# check functionality
npm i
npm run build

# release
git commit -am "release of a.b.c"
git push
git tag va.b.c
git push --tags

# publish docs
rm -fr docs/
git branch -D gh-pages
git worktree prune
git worktree list
git worktree add -b gh-pages docs origin/gh-pages
npm run publishDocs

# publish package
npm publish
```

## License

[MIT](https://www.opensource.org/licenses/mit-license.php)
