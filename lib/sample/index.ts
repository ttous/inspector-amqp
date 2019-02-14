import { Event } from "inspector-metrics";
import { RabbitMqMetricReporter } from "../metrics";

// instance the rabbitmq reporter
const reporter: RabbitMqMetricReporter = new RabbitMqMetricReporter({
  connection: "amqp://localhost",
  exchangeName: "exchange",
  queueName: "queue",
});

function createEvent<T>(name: string, data: T): Event<T> {
  return new Event<T>(name);
}

reporter.start().then((r) => {
  const event = createEvent("test", {
    int: 123,
    string: "toto",
  });

  r.reportEvent(event);
});
