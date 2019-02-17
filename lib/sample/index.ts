import { Event } from "inspector-metrics";
import { AmqpMetricReporter, AmqpTopologyHelper } from "../metrics";

// instance the Amqp reporter
const reporter: AmqpMetricReporter = new AmqpMetricReporter({
  amqpTopologyBuilder: AmqpTopologyHelper.queue("amqp://localhost", "queue"),
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
