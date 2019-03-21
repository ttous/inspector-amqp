import { Event } from "inspector-metrics";
import { AmqpMetricReporter, AmqpTopologyHelper } from "../metrics";

// Instantiate the AMQP reporter
const reporter: AmqpMetricReporter = new AmqpMetricReporter({
  amqpTopologyBuilder: AmqpTopologyHelper.queue("amqp://localhost", "queue"),
});

// Create the event
const event = new Event<{}>("test").setValue({
  int: 123,
  string: "toto",
});

// Report the event
reporter.reportEvent(event);
