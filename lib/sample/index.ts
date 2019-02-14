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
