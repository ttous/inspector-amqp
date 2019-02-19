import "source-map-support/register";

import { Exchange, Queue } from "amqp-ts";

/**
 * Interface for building the underlying amqp topology.
 */
export type AmqpTopologyBuilder = () => Queue | Exchange;
