import "source-map-support/register";

import { Message } from "amqp-ts";

export interface AmqpReportingResult {
  routingKey: Promise<string | undefined>;
  message: Promise<Message | null>;
}
