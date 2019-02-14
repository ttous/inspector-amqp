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
  Timer,
  TimeUnit,
} from "inspector-metrics";

export interface RabbitMqMetricReporterOptions extends ScheduledMetricReporterOptions {
  /**
   * Logger instance used to report errors.
   *
   * @type {Logger}
   * @memberof RabbitMqMetricReporterOptions
   */
  log: Logger;

  // TO DO: COMMENT
  connection: string;
  exchangeName: string;
  queueName: string;
}

export class RabbitMqMetricReporter extends ScheduledMetricReporter<RabbitMqMetricReporterOptions, {}> {
  /**
   * Gets the values for the specified monotone counter metric.
   *
   * @static
   * @param {MonotoneCounter} counter
   * @returns {{}}
   * @memberof RabbitMqMetricReporter
   */
  public static getMonotoneCounterValues(counter: MonotoneCounter): {} {
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
   * @memberof RabbitMqMetricReporter
   */
  public static getCounterValues(counter: Counter): {} {
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
   * @memberof RabbitMqMetricReporter
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
   * @memberof RabbitMqMetricReporter
   */
  public static getHistogramValues(histogram: Histogram): {} {
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
   * @memberof RabbitMqMetricReporter
   */
  public static getMeterValues(meter: Meter): {} {
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
   * @memberof RabbitMqMetricReporter
   */
  public static getTimerValues(timer: Timer): {} {
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
   * @memberof RabbitMqMetricReporter
   */
  private static getNumber(value: number): number {
    if (isNaN(value)) {
      return 0;
    }
    return value;
  }

  /**
   * RabbitMQ exchange used to do reporting.
   *
   * @private
   * @type {Amqp.Exchange}
   * @memberof RabbitMqMetricReporter
   */
  private exchange: Amqp.Exchange;

  /**
   * Creates an instance of RabbitMqMetricReporter.
   */
  public constructor(
    {
      connection,
      exchangeName,
      queueName,
      log = console,
      reportInterval = 1000,
      unit = MILLISECOND,
      clock = new StdClock(),
      scheduler = setInterval,
      minReportingTimeout = 1,
      tags = new Map(),
    }: {
      /**
       * RabbitMQ connection URI.
       * @type {string}
       */
      connection: string,
      /**
       * RabbitMQ exchange name.
       * @type {string}
       */
      exchangeName: string,
      /**
       * RabbitMQ queue name.
       * @type {string}
       */
      queueName: string,
      /**
       * The logger instance used to report metrics.
       * @type {Logger}
       */
      log?: Logger,
      /**
       * Reporting interval in the time-unit of {@link #unit}.
       * @type {number}
       */
      reportInterval?: number;
      /**
       * The time-unit of the reporting interval.
       * @type {TimeUnit}
       */
      unit?: TimeUnit;
      /**
       * The clock instance used determine the current time.
       * @type {Clock}
       */
      clock?: Clock;
      /**
       * The scheduler function used to trigger reporting.
       * @type {Scheduler}
       */
      scheduler?: Scheduler;
      /**
       * The timeout in which a metrics gets reported wether it's value has changed or not.
       * @type {number}
       */
      minReportingTimeout?: number;
      /**
       * Common tags for this reporter instance.
       * @type {Map<string, string>}
       */
      tags?: Map<string, string>;
    }) {
    super({
      clock,
      connection,
      exchangeName,
      log,
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
   * @memberof RabbitMqMetricReporter
   */
  public getLog(): Logger {
    return this.options.log;
  }

  /**
   * Sets the logger instance.
   *
   * @param {Logger} log
   * @memberof RabbitMqMetricReporter
   */
  public setLog(log: Logger): void {
    this.options.log = log;
  }

  /**
   * Reports an {@link Event}.
   *
   * @param {Event} event
   * @returns {Promise<TEvent>}
   * @memberof RabbitMqMetricReporter
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
   * @memberof RabbitMqMetricReporter
   */
  public async flushEvents(): Promise<void> {
  }

  /**
   * Send the combinations of index and document to the elasticsearch cluster
   * using the bulk method of the elasticsearch client.
   *
   * @protected
   * @param {MetricRegistry} registry
   * @param {Date} date
   * @param {MetricType} type
   * @param {Array<ReportingResult<any, any[]>>} results
   * @returns {Promise<void>}
   * @memberof RabbitMqMetricReporter
   */
  protected handleResults(
    ctx: OverallReportContext,
    registry: MetricRegistry,
    date: Date,
    type: MetricType,
    results: Array<ReportingResult<any, {}>>): Promise<void> {
    const message = new Amqp.Message(JSON.stringify(results));

    this.exchange.send(message);

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
   * @memberof RabbitMqMetricReporter
   */
  protected reportMetric(metric: Metric, ctx: MetricSetReportContext<Metric>): {} {
    let values = null;
    if (metric instanceof MonotoneCounter) {
      values = RabbitMqMetricReporter.getMonotoneCounterValues(metric);
    } else if (metric instanceof Counter) {
      values = RabbitMqMetricReporter.getCounterValues(metric);
    } else if (metric instanceof Histogram) {
      values = RabbitMqMetricReporter.getHistogramValues(metric);
    } else if (metric instanceof Meter) {
      values = RabbitMqMetricReporter.getMeterValues(metric);
    } else if (metric instanceof Timer) {
      values = RabbitMqMetricReporter.getTimerValues(metric);
    } else {
      values = RabbitMqMetricReporter.getGaugeValue(metric as Gauge<any>);
    }

    const name = metric.getName();
    const group = metric.getGroup();
    const tags = this.buildTags(ctx.registry, metric);
    const timestamp = ctx.date;
    const type = ctx.type;

    return { name, group, tags, timestamp, values, type };
  }

  /**
   * Calls {@link #reportMetric} with the specified arguments.
   *
   * @protected
   * @param {(MonotoneCounter | Counter)} counter
   * @param {(ReportingContext<MonotoneCounter | Counter>)} ctx
   * @returns {{}}
   * @memberof RabbitMqMetricReporter
   */
  protected reportCounter(
    counter: MonotoneCounter | Counter, ctx: MetricSetReportContext<MonotoneCounter | Counter>): {} {
    return this.reportMetric(counter, ctx);
  }

  /**
   * Calls {@link #reportMetric} with the specified arguments.
   *
   * @protected
   * @param {Gauge<any>} gauge
   * @param {ReportingContext<Gauge<any>>} ctx
   * @returns {{}}
   * @memberof RabbitMqMetricReporter
   */
  protected reportGauge(gauge: Gauge<any>, ctx: MetricSetReportContext<Gauge<any>>): {} {
    return this.reportMetric(gauge, ctx);
  }

  /**
   * Calls {@link #reportMetric} with the specified arguments.
   *
   * @protected
   * @param {Histogram} histogram
   * @param {ReportingContext<Histogram>} ctx
   * @returns {{}}
   * @memberof RabbitMqMetricReporter
   */
  protected reportHistogram(histogram: Histogram, ctx: MetricSetReportContext<Histogram>): {} {
    return this.reportMetric(histogram, ctx);
  }

  /**
   * Calls {@link #reportMetric} with the specified arguments.
   *
   * @protected
   * @param {Meter} meter
   * @param {ReportingContext<Meter>} ctx
   * @returns {{}}
   * @memberof RabbitMqMetricReporter
   */
  protected reportMeter(meter: Meter, ctx: MetricSetReportContext<Meter>): {} {
    return this.reportMetric(meter, ctx);
  }

  /**
   * Calls {@link #reportMetric} with the specified arguments.
   *
   * @protected
   * @param {Timer} timer
   * @param {ReportingContext<Timer>} ctx
   * @returns {{}}
   * @memberof RabbitMqMetricReporter
   */
  protected reportTimer(timer: Timer, ctx: MetricSetReportContext<Timer>): {} {
    return this.reportMetric(timer, ctx);
  }
}
