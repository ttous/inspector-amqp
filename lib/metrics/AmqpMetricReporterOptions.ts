import "source-map-support/register";

import { Logger, ScheduledMetricReporterOptions } from "inspector-metrics";

import { MetricMessageBuilder } from "./MetricMessageBuilder";

/**
 * Options for {@link AmqpMetricReporter}.
 *
 * @export
 * @interface AmqpMetricReporterOptions
 * @extends {ScheduledMetricReporterOptions}
 */
export interface AmqpMetricReporterOptions extends ScheduledMetricReporterOptions {
  /**
   * Logger instance used to report errors.
   *
   * @type {Logger}
   * @memberof AmqpMetricReporterOptions
   */
  log: Logger;

  /**
   * Used to build the amqp message for a metric.
   * @type {MetricMessageBuilder}
   */
  metricMessageBuilder: MetricMessageBuilder;
}
