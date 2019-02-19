import "source-map-support/register";

import { AmqpTopologyBuilder } from "./AmqpTopologyBuilder";

import { Connection } from "amqp-ts";

/**
 * Helper class for creating {@link AmqpTopologyBuilder}.
 *
 * @export
 */
export class AmqpTopologyHelper {
  /**
   * Returns a {@link AmqpTopologyBuilder} that builds an amqp topology with a single queue.
   * The queue is returned as the target.
   *
   * @static
   * @returns {AmqpTopologyBuilder}
   * @memberof AmqpTopologyHelper
   */
  public static queue(connection: string, queue: string): AmqpTopologyBuilder {
    return () => {
      const amqpConnection = new Connection(connection);
      const amqpQueue = amqpConnection.declareQueue(queue);

      return amqpQueue;
    };
  }

  /**
   * Returns a {@link AmqpTopologyBuilder} that builds an amqp topology with a single queue and a single exchange bound together.
   * The exchange is returned as the target.
   *
   * @static
   * @returns {AmqpTopologyBuilder}
   * @memberof AmqpTopologyHelper
   */
  public static exchange(connection: string, queue: string, exchange: string): AmqpTopologyBuilder {
    return () => {
      const amqpConnection = new Connection(connection);
      const amqpQueue = amqpConnection.declareQueue(queue);
      const amqpExchange = amqpConnection.declareExchange(exchange);

      amqpQueue.bind(amqpExchange);

      return amqpExchange;
    };
  }
}
