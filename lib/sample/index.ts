import { Event } from "inspector-metrics";
import { AmqpMetricReporter } from "../metrics";

// instance the Amqp reporter
const reporter: AmqpMetricReporter = new AmqpMetricReporter({
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
