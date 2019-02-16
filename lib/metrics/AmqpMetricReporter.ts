import "source-map-support/register";

import * as Amqp from "amqp-ts";

import {
  Clock,
  Counter,
  Event,
  Gauge,
  Histogram,
  Logger,
  Meter,
  Metric,
  MetricRegistry,
  MetricSetReportContext,
  MetricType,
  MILLISECOND,
  MonotoneCounter,
  OverallReportContext,
  ReportingResult,
  ScheduledMetricReporter,
  ScheduledMetricReporterOptions,
  Scheduler,
  StdClock,
  Tags,
  Timer,
  TimeUnit,
} from "inspector-metrics";

/**
 * Interface for building a message for a metric.
 */
export type MetricMessageBuilder = (registry: MetricRegistry, metric: Metric, type: MetricType, date: Date, tags: Tags) => Amqp.Message | null;

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

  // TO DO: COMMENT
  connection: string;
  exchangeName: string;
  queueName: string;

  /**
   * Used to build the amqp message for a metric.
   * @type {MetricMessageBuilder}
   */
  metricMessageBuilder: MetricMessageBuilder;
}

export class AmqpMetricReporter extends ScheduledMetricReporter<AmqpMetricReporterOptions, Amqp.Message> {
  /**
   * Returns a {@link MetricMessageBuilder} that builds an Amqp.Message for a metric.
   *
   * @static
   * @returns {MetricMessageBuilder}
   * @memberof AmqpMetricReporter
   */
  public static defaultMessageBuilder(): MetricMessageBuilder {
    return (registry: MetricRegistry, metric: Metric, type: MetricType, timestamp: Date, tags: Tags) => {
      let values = null;

      if (metric instanceof MonotoneCounter) {
        values = AmqpMetricReporter.getMonotoneCounterValues(metric);
      } else if (metric instanceof Counter) {
        values = AmqpMetricReporter.getCounterValues(metric);
      } else if (metric instanceof Histogram) {
        values = AmqpMetricReporter.getHistogramValues(metric);
      } else if (metric instanceof Meter) {
        values = AmqpMetricReporter.getMeterValues(metric);
      } else if (metric instanceof Timer) {
        values = AmqpMetricReporter.getTimerValues(metric);
      } else {
        values = AmqpMetricReporter.getGaugeValue(metric as Gauge<any>);
      }

      if (values === null) {
        return null;
      }

      const name = metric.getName();
      const group = metric.getGroup();

      return new Amqp.Message(JSON.stringify({ name, group, timestamp, type, tags, values }));
    };
  }

  /**
   * Gets the values for the specified monotone counter metric.
   *
   * @static
   * @param {MonotoneCounter} counter
   * @returns {{}}
   * @memberof AmqpMetricReporter
   */
  public static getMonotoneCounterValues(counter: MonotoneCounter): { count: number } {
    const count = counter.getCount();
    if (!count || isNaN(count)) {
      return null;
    }
    return { count };
  }

  /**
   * Gets the values for the specified counter metric.
   *
   * @static
   * @param {Counter} counter
   * @returns {{}}
   * @memberof AmqpMetricReporter
   */
  public static getCounterValues(counter: Counter): { count: number } {
    const count = counter.getCount();
    if (!count || isNaN(count)) {
      return null;
    }
    return { count };
  }

  /**
   * Gets the values for the specified {Gauge} metric.
   *
   * @static
   * @param {Gauge<any>} gauge
   * @returns {{}}
   * @memberof AmqpMetricReporter
   */
  public static getGaugeValue(gauge: Gauge<any>): {} {
    const value = gauge.getValue();
    if ((!value && value !== 0) || Number.isNaN(value)) {
      return null;
    }
    if (typeof value === "object") {
      return value;
    }
    return { value };
  }

  /**
   * Gets the values for the specified {Histogram} metric.
   *
   * @static
   * @param {Histogram} histogram
   * @returns {{}}
   * @memberof AmqpMetricReporter
   */
  public static getHistogramValues(histogram: Histogram): {/* todo : type */ } {
    const value = histogram.getCount();
    if (!value || isNaN(value)) {
      return null;
    }
    const snapshot = histogram.getSnapshot();
    const values: any = {};

    values[`count`] = value;
    values[`max`] = this.getNumber(snapshot.getMax());
    values[`mean`] = this.getNumber(snapshot.getMean());
    values[`min`] = this.getNumber(snapshot.getMin());
    values[`p50`] = this.getNumber(snapshot.getMedian());
    values[`p75`] = this.getNumber(snapshot.get75thPercentile());
    values[`p95`] = this.getNumber(snapshot.get95thPercentile());
    values[`p98`] = this.getNumber(snapshot.get98thPercentile());
    values[`p99`] = this.getNumber(snapshot.get99thPercentile());
    values[`p999`] = this.getNumber(snapshot.get999thPercentile());
    values[`stddev`] = this.getNumber(snapshot.getStdDev());

    return values;
  }

  /**
   * Gets the values for the specified {Meter} metric.
   *
   * @static
   * @param {Meter} meter
   * @returns {{}}
   * @memberof AmqpMetricReporter
   */
  public static getMeterValues(meter: Meter): {/* todo : type */ } {
    const value = meter.getCount();
    if (!value || isNaN(value)) {
      return null;
    }
    const values: any = {};

    values[`count`] = value;
    values[`m15_rate`] = this.getNumber(meter.get15MinuteRate());
    values[`m1_rate`] = this.getNumber(meter.get1MinuteRate());
    values[`m5_rate`] = this.getNumber(meter.get5MinuteRate());
    values[`mean_rate`] = this.getNumber(meter.getMeanRate());

    return values;
  }

  /**
   * Gets the values for the specified {Timer} metric.
   *
   * @static
   * @param {Timer} timer
   * @returns {{}}
   * @memberof AmqpMetricReporter
   */
  public static getTimerValues(timer: Timer): {/* todo : type */ } {
    const value = timer.getCount();
    if (!value || isNaN(value)) {
      return null;
    }
    const snapshot = timer.getSnapshot();
    const values: any = {};

    values[`count`] = value;
    values[`m15_rate`] = this.getNumber(timer.get15MinuteRate());
    values[`m1_rate`] = this.getNumber(timer.get1MinuteRate());
    values[`m5_rate`] = this.getNumber(timer.get5MinuteRate());
    values[`max`] = this.getNumber(snapshot.getMax());
    values[`mean`] = this.getNumber(snapshot.getMean());
    values[`mean_rate`] = this.getNumber(timer.getMeanRate());
    values[`min`] = this.getNumber(snapshot.getMin());
    values[`p50`] = this.getNumber(snapshot.getMedian());
    values[`p75`] = this.getNumber(snapshot.get75thPercentile());
    values[`p95`] = this.getNumber(snapshot.get95thPercentile());
    values[`p98`] = this.getNumber(snapshot.get98thPercentile());
    values[`p99`] = this.getNumber(snapshot.get99thPercentile());
    values[`p999`] = this.getNumber(snapshot.get999thPercentile());
    values[`stddev`] = this.getNumber(snapshot.getStdDev());

    return values;
  }

  /**
   * Either gets 0 or the specifed value.
   *
   * @private
   * @param {number} value
   * @returns {number}
   * @memberof AmqpMetricReporter
   */
  private static getNumber(value: number): number {
    if (isNaN(value)) {
      return 0;
    }
    return value;
  }

  /**
   * Amqp exchange used to do reporting.
   *
   * @private
   * @type {Amqp.Exchange}
   * @memberof AmqpMetricReporter
   */
  private exchange: Amqp.Exchange;

  /**
   * Creates an instance of AmqpMetricReporter.
   */
  public constructor(
    {
      clock = new StdClock(),
      connection,
      exchangeName,
      log = console,
      metricMessageBuilder = AmqpMetricReporter.defaultMessageBuilder(),
      minReportingTimeout = 1,
      queueName,
      reportInterval = 1000,
      scheduler = setInterval,
      tags = new Map(),
      unit = MILLISECOND,
    }: {
      /**
       * The clock instance used determine the current time.
       * @type {Clock}
       */
      clock?: Clock;
      /**
       * Amqp connection URI.
       * @type {string}
       */
      connection: string,
      /**
       * Amqp exchange name.
       * @type {string}
       */
      exchangeName: string,
      /**
       * The logger instance used to report metrics.
       * @type {Logger}
       */
      log?: Logger,
      /**
       * Used to build the amqp message for a metric.
       * @type {MetricMessageBuilder}
       */
      metricMessageBuilder?: MetricMessageBuilder,
      /**
       * The timeout in which a metrics gets reported wether it's value has changed or not.
       * @type {number}
       */
      minReportingTimeout?: number;
      /**
       * Amqp queue name.
       * @type {string}
       */
      queueName: string,
      /**
       * Reporting interval in the time-unit of {@link #unit}.
       * @type {number}
       */
      reportInterval?: number;
      /**
       * The scheduler function used to trigger reporting.
       * @type {Scheduler}
       */
      scheduler?: Scheduler;
      /**
       * Common tags for this reporter instance.
       * @type {Map<string, string>}
       */
      tags?: Map<string, string>;
      /**
       * The time-unit of the reporting interval.
       * @type {TimeUnit}
       */
      unit?: TimeUnit;
    }) {
    super({
      clock,
      connection,
      exchangeName,
      log,
      metricMessageBuilder,
      minReportingTimeout,
      queueName,
      reportInterval,
      scheduler,
      tags,
      unit,
    });

    const amqpConnection = new Amqp.Connection(connection);
    const queue = amqpConnection.declareQueue(queueName);
    const exchange = amqpConnection.declareExchange(exchangeName);

    queue.bind(exchange);

    this.exchange = exchange;
  }

  /**
   * Gets the logger instance.
   *
   * @returns {Logger}
   * @memberof AmqpMetricReporter
   */
  public getLog(): Logger {
    return this.options.log;
  }

  /**
   * Sets the logger instance.
   *
   * @param {Logger} log
   * @memberof AmqpMetricReporter
   */
  public setLog(log: Logger): void {
    this.options.log = log;
  }

  /**
   * Reports an {@link Event}.
   *
   * @param {Event} event
   * @returns {Promise<TEvent>}
   * @memberof AmqpMetricReporter
   */
  public async reportEvent<TEventData, TEvent extends Event<TEventData>>(event: TEvent): Promise<TEvent> {
    const result = this.reportGauge(event, {
      date: event.getTime(),
      metrics: [],
      overallCtx: null,
      registry: null,
      type: "gauge",
    });

    if (result) {
      await this.handleResults(null, null, event.getTime(), "gauge", [{
        metric: event,
        result,
      }]);
    }

    return event;
  }

  /**
   * Does nothing
   *
   * @returns {Promise<void>}
   * @memberof AmqpMetricReporter
   */
  public async flushEvents(): Promise<void> {
  }

  /**
   * Send the messages in the target amqp exchange.
   *
   * @protected
   * @param {MetricRegistry} registry
   * @param {Date} date
   * @param {MetricType} type
   * @param {Array<ReportingResult<any, any[]>>} results
   * @returns {Promise<void>}
   * @memberof AmqpMetricReporter
   */
  protected handleResults(ctx: OverallReportContext, registry: MetricRegistry, date: Date, type: MetricType, results: Array<ReportingResult<any, Amqp.Message>>): Promise<void> {
    results
        .filter((result) => result.result)
        .forEach((result) => this.exchange.send(result.result));
      if (result.result) {
        this.exchange.send(result.result);
      }
    });

    return Promise.resolve();
  }

  /**
   * Generalized reporting method of all types of metric instances.
   * Builds the index configuration document and the metric document.
   *
   * @protected
   * @param {Metric} metric
   * @param {ReportingContext<Metric>} ctx
   * @returns {{}}
   * @memberof AmqpMetricReporter
   */
  protected reportMetric(metric: Metric, ctx: MetricSetReportContext<Metric>): Amqp.Message {
    return this.options.metricMessageBuilder(ctx.registry, metric, ctx.type, ctx.date, this.buildTags(ctx.registry, metric));
  }

  /**
   * Calls {@link #reportMetric} with the specified arguments.
   *
   * @protected
   * @param {(MonotoneCounter | Counter)} counter
   * @param {(ReportingContext<MonotoneCounter | Counter>)} ctx
   * @returns {{}}
   * @memberof AmqpMetricReporter
   */
  protected reportCounter(counter: MonotoneCounter | Counter, ctx: MetricSetReportContext<MonotoneCounter | Counter>): Amqp.Message {
    return this.reportMetric(counter, ctx);
  }

  /**
   * Calls {@link #reportMetric} with the specified arguments.
   *
   * @protected
   * @param {Gauge<any>} gauge
   * @param {ReportingContext<Gauge<any>>} ctx
   * @returns {{}}
   * @memberof AmqpMetricReporter
   */
  protected reportGauge(gauge: Gauge<any>, ctx: MetricSetReportContext<Gauge<any>>): Amqp.Message {
    return this.reportMetric(gauge, ctx);
  }

  /**
   * Calls {@link #reportMetric} with the specified arguments.
   *
   * @protected
   * @param {Histogram} histogram
   * @param {ReportingContext<Histogram>} ctx
   * @returns {{}}
   * @memberof AmqpMetricReporter
   */
  protected reportHistogram(histogram: Histogram, ctx: MetricSetReportContext<Histogram>): Amqp.Message {
    return this.reportMetric(histogram, ctx);
  }

  /**
   * Calls {@link #reportMetric} with the specified arguments.
   *
   * @protected
   * @param {Meter} meter
   * @param {ReportingContext<Meter>} ctx
   * @returns {{}}
   * @memberof AmqpMetricReporter
   */
  protected reportMeter(meter: Meter, ctx: MetricSetReportContext<Meter>): Amqp.Message {
    return this.reportMetric(meter, ctx);
  }

  /**
   * Calls {@link #reportMetric} with the specified arguments.
   *
   * @protected
   * @param {Timer} timer
   * @param {ReportingContext<Timer>} ctx
   * @returns {{}}
   * @memberof AmqpMetricReporter
   */
  protected reportTimer(timer: Timer, ctx: MetricSetReportContext<Timer>): Amqp.Message {
    return this.reportMetric(timer, ctx);
  }
}
