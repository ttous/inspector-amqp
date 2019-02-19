import "source-map-support/register";

import { Exchange, Message, Queue } from "amqp-ts";

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
  Scheduler,
  StdClock,
  Tags,
  Timer,
  TimeUnit,
} from "inspector-metrics";

import { AmqpMetricReporterOptions } from "./AmqpMetricReporterOptions";
import { AmqpReportingResult } from "./AmqpReportingResult";
import { AmqpTopologyBuilder } from "./AmqpTopologyBuilder";
import { ICounterValue } from "./ICounterValue";
import { IGaugeValue } from "./IGaugeValue";
import { IHistogramValue } from "./IHistogramValue";
import { IMeterValue } from "./IMeterValue";
import { ITimerValue } from "./ITimerValue";
import { MetricMessageBuilder } from "./MetricMessageBuilder";
import { RoutingKeyDeterminator } from "./RoutingKeyDeterminator";

export class AmqpMetricReporter extends ScheduledMetricReporter<AmqpMetricReporterOptions, AmqpReportingResult> {
  /**
   * Returns a {@link MetricMessageBuilder} that builds an Amqp.Message for a metric.
   *
   * @static
   * @returns {MetricMessageBuilder}
   * @memberof AmqpMetricReporter
   */
  public static defaultMessageBuilder(withBuckets: boolean): MetricMessageBuilder {
    return (registry: MetricRegistry, metric: Metric, type: MetricType, timestamp: Date, tags: Tags) => {
      let values = null;

      if (metric instanceof MonotoneCounter) {
        values = AmqpMetricReporter.getMonotoneCounterValue(metric);
      } else if (metric instanceof Counter) {
        values = AmqpMetricReporter.getCounterValue(metric);
      } else if (metric instanceof Histogram) {
        values = AmqpMetricReporter.getHistogramValue(metric, withBuckets);
      } else if (metric instanceof Meter) {
        values = AmqpMetricReporter.getMeterValue(metric);
      } else if (metric instanceof Timer) {
        values = AmqpMetricReporter.getTimerValue(metric, withBuckets);
      } else if (MetricRegistry.isGauge<any>(metric)) {
        values = AmqpMetricReporter.getGaugeValue(metric);
      } else {
        return null;
      }

      if (!values) {
        return null;
      }

      const name = metric.getName();
      const group = metric.getGroup();

      return new Message(JSON.stringify({ name, group, timestamp, type, tags, values }));
    };
  }

  /**
   * Returns a {@link RoutingKeyDeterminator} that determines the routing key for a given metric.
   *
   * @static
   * @returns {RoutingKeyDeterminator}
   * @memberof AmqpMetricReporter
   */
  public static defaultRoutingKeyDeterminator(): RoutingKeyDeterminator {
    return (registry: MetricRegistry, metric: Metric, type: MetricType, timestamp: Date, tags: Tags) => undefined;
  }

  /**
   * Gets the values for the specified monotone counter metric.
   *
   * @static
   * @param {MonotoneCounter} counter
   * @returns {ICounterValue}
   * @memberof AmqpMetricReporter
   */
  public static getMonotoneCounterValue(counter: MonotoneCounter): ICounterValue {
    const count = counter.getCount();

    return { count };
  }

  /**
   * Gets the values for the specified counter metric.
   *
   * @static
   * @param {Counter} counter
   * @returns {ICounterValue}
   * @memberof AmqpMetricReporter
   */
  public static getCounterValue(counter: Counter): ICounterValue {
    const count = counter.getCount();

    return { count };
  }

  /**
   * Gets the values for the specified {Gauge} metric.
   *
   * @static
   * @param {Gauge<T>} gauge
   * @returns {IGaugeValue<T>}
   * @memberof AmqpMetricReporter
   */
  public static getGaugeValue<T>(gauge: Gauge<T>): IGaugeValue<T> {
    const value = gauge.getValue();

    return { value };
  }

  /**
   * Gets the values for the specified {Histogram} metric.
   *
   * @static
   * @param {Histogram} histogram
   * @returns {IHistogramValue}
   * @memberof AmqpMetricReporter
   */
  public static getHistogramValue(histogram: Histogram, withBuckets: boolean): IHistogramValue {
    const count = histogram.getCount();

    const snapshot = histogram.getSnapshot();

    return {
      buckets: withBuckets ? histogram.getBuckets() : undefined,
      buckets_counts: histogram.getCounts(),
      count,
      max: AmqpMetricReporter.getNumber(snapshot.getMax()),
      mean: AmqpMetricReporter.getNumber(snapshot.getMean()),
      min: AmqpMetricReporter.getNumber(snapshot.getMin()),
      p50: AmqpMetricReporter.getNumber(snapshot.getMedian()),
      p75: AmqpMetricReporter.getNumber(snapshot.get75thPercentile()),
      p95: AmqpMetricReporter.getNumber(snapshot.get95thPercentile()),
      p98: AmqpMetricReporter.getNumber(snapshot.get98thPercentile()),
      p99: AmqpMetricReporter.getNumber(snapshot.get99thPercentile()),
      p999: AmqpMetricReporter.getNumber(snapshot.get999thPercentile()),
      stddev: AmqpMetricReporter.getNumber(snapshot.getStdDev()),
    };
  }

  /**
   * Gets the values for the specified {Meter} metric.
   *
   * @static
   * @param {Meter} meter
   * @returns {IMeterValue}
   * @memberof AmqpMetricReporter
   */
  public static getMeterValue(meter: Meter): IMeterValue {
    const count = meter.getCount();

    return {
      count,
      m15_rate: AmqpMetricReporter.getNumber(meter.get15MinuteRate()),
      m1_rate: AmqpMetricReporter.getNumber(meter.get1MinuteRate()),
      m5_rate: AmqpMetricReporter.getNumber(meter.get5MinuteRate()),
      mean_rate: AmqpMetricReporter.getNumber(meter.getMeanRate()),
    };
  }

  /**
   * Gets the values for the specified {Timer} metric.
   *
   * @static
   * @param {Timer} timer
   * @returns {ITimerValue}
   * @memberof AmqpMetricReporter
   */
  public static getTimerValue(timer: Timer, withBuckets: boolean): ITimerValue {
    const count = timer.getCount();

    const snapshot = timer.getSnapshot();

    return {
      buckets: withBuckets ? timer.getBuckets() : undefined,
      buckets_counts: timer.getCounts(),
      count,
      m15_rate: AmqpMetricReporter.getNumber(timer.get15MinuteRate()),
      m1_rate: AmqpMetricReporter.getNumber(timer.get1MinuteRate()),
      m5_rate: AmqpMetricReporter.getNumber(timer.get5MinuteRate()),
      max: AmqpMetricReporter.getNumber(snapshot.getMax()),
      mean: AmqpMetricReporter.getNumber(snapshot.getMean()),
      mean_rate: AmqpMetricReporter.getNumber(timer.getMeanRate()),
      min: AmqpMetricReporter.getNumber(snapshot.getMin()),
      p50: AmqpMetricReporter.getNumber(snapshot.getMedian()),
      p75: AmqpMetricReporter.getNumber(snapshot.get75thPercentile()),
      p95: AmqpMetricReporter.getNumber(snapshot.get95thPercentile()),
      p98: AmqpMetricReporter.getNumber(snapshot.get98thPercentile()),
      p99: AmqpMetricReporter.getNumber(snapshot.get99thPercentile()),
      p999: AmqpMetricReporter.getNumber(snapshot.get999thPercentile()),
      stddev: AmqpMetricReporter.getNumber(snapshot.getStdDev()),
    };
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
   * Amqp target used to do reporting.
   *
   * @private
   * @type {Amqp.Queue | Amqp.Exchange}
   * @memberof AmqpMetricReporter
   */
  private target: Queue | Exchange;

  /**
   * Creates an instance of AmqpMetricReporter.
   */
  public constructor(
    {
      amqpTopologyBuilder,
      clock = new StdClock(),
      log = console,
      metricMessageBuilder = AmqpMetricReporter.defaultMessageBuilder(true),
      minReportingTimeout = 1,
      reportInterval = 1000,
      routingKeyDeterminator = AmqpMetricReporter.defaultRoutingKeyDeterminator(),
      scheduler = setInterval,
      tags = new Map(),
      unit = MILLISECOND,
    }: {
      /**
       * Used to build the underlying amqp topology.
       * @type {AmqpTopologyBuilder}
       */
      amqpTopologyBuilder: AmqpTopologyBuilder,
      /**
       * The clock instance used determine the current time.
       * @type {Clock}
       */
      clock?: Clock;
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
       * Reporting interval in the time-unit of {@link #unit}.
       * @type {number}
       */
      reportInterval?: number;
      /**
       * Used to determine the routing key for a given metric.
       * @type {RoutingKeyDeterminator}
       */
      routingKeyDeterminator?: RoutingKeyDeterminator,
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
      log,
      metricMessageBuilder,
      minReportingTimeout,
      reportInterval,
      routingKeyDeterminator,
      scheduler,
      tags,
      unit,
    });

    this.target = amqpTopologyBuilder();
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
  protected async handleResults(ctx: OverallReportContext, registry: MetricRegistry, date: Date, type: MetricType, results: Array<ReportingResult<any, AmqpReportingResult>>): Promise<void> {
    results
      .filter((result) => result.result && result.result.message)
      .forEach((result) => result.result.message.sendTo(this.target, result.result.routingKey));
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
  protected reportMetric(metric: Metric, ctx: MetricSetReportContext<Metric>): AmqpReportingResult {
    const tags = this.buildTags(ctx.registry, metric);
    const message = this.options.metricMessageBuilder(ctx.registry, metric, ctx.type, ctx.date, tags);
    const routingKey = this.options.routingKeyDeterminator(ctx.registry, metric, ctx.type, ctx.date, tags);

    return { message, routingKey };
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
  protected reportCounter(counter: MonotoneCounter | Counter, ctx: MetricSetReportContext<MonotoneCounter | Counter>): AmqpReportingResult {
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
  protected reportGauge(gauge: Gauge<any>, ctx: MetricSetReportContext<Gauge<any>>): AmqpReportingResult {
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
  protected reportHistogram(histogram: Histogram, ctx: MetricSetReportContext<Histogram>): AmqpReportingResult {
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
  protected reportMeter(meter: Meter, ctx: MetricSetReportContext<Meter>): AmqpReportingResult {
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
  protected reportTimer(timer: Timer, ctx: MetricSetReportContext<Timer>): AmqpReportingResult {
    return this.reportMetric(timer, ctx);
  }
}
