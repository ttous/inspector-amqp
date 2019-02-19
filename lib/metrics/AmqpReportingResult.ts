import "source-map-support/register";

import { Message } from "amqp-ts";

export interface AmqpReportingResult {
  routingKey: string | undefined;
  message: Message | null;
}
