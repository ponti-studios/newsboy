import pino from "pino";
import pinoPretty from "pino-pretty";

/**
 * Shared pino logger factory.
 *
 * Output selection, in priority order:
 *   1. NODE_ENV === "test" or VITEST set → silent (test suites never log)
 *   2. LOG_PRETTY=1                       → pretty, even when piped
 *   3. stdout is a TTY                    → pretty, colorized, single-line
 *   4. NODE_ENV === "development"         → pretty
 *   5. otherwise                          → lean NDJSON for CI / logs ingest
 *
 * The pretty stream runs in-process (not via pino's worker transport) because
 * the event-prefixing message formatter is a function and cannot be cloned
 * into a worker thread. Scripts are short-lived, so this costs nothing.
 *
 * JSON lines are kept deliberately lean:
 *   - no `pid` / `hostname` (meaningless in single-process scripts; add them
 *     back via pino's `base` option if a deployment needs to correlate them)
 *   - ISO-8601 `time` instead of epoch milliseconds
 *   - `level` stays numeric (10..60) for machine filtering; the pretty
 *     stream renders it as a label.
 *
 * Event taxonomy (convention — keep it, it makes logs greppable):
 *   Every structured log line carries `event` = a scoped, dot-separated
 *   snake_case name that reads like a sentence:
 *
 *     generate.run.started      generate.game.completed
 *     generate.puzzle.created   generate.attempt.failed
 *     generate.api.error        ingest.run.completed
 *     health.game.completed     generate.circuit.opened
 *
 *   First segment is the subsystem, last segment is a past-tense verb
 *   (started / completed / planned / created / skipped / failed / opened).
 *   Do not use [BRACKETED_UPPER_SNAKE] event names, and keep every field
 *   camelCase (puzzleId, not puzzle_id) so JSON consumers can rely on one
 *   casing. Enrich with scalar context (durationMs, attempt, counts) rather
 *   than spreading nested objects.
 *
 * See scripts/game-generate.ts for a full lifecycle example.
 */

function isTestRun(): boolean {
  return process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
}

function shouldPretty(): boolean {
  if (process.env.LOG_PRETTY === "0") return false;
  if (process.env.LOG_PRETTY === "1") return true;
  if (process.env.NODE_ENV === "development") return true;
  return Boolean(process.stdout.isTTY);
}

function pinoOptions(): pino.LoggerOptions {
  if (isTestRun()) return { level: "silent" };
  return {
    level: process.env.LOG_LEVEL ?? "info",
    // NDJSON only: lean lines, no pid/hostname, ISO-8601 timestamps.
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime,
  };
}

function prettyStream(): pinoPretty.PrettyStream {
  return pinoPretty({
    colorize: true,
    singleLine: true,
    translateTime: "SYS:HH:MM:ss.l",
    ignore: "pid,hostname",
    messageFormat: (log: pino.LogDescriptor, messageKey: string) => {
      const event = typeof log.event === "string" ? `${log.event} — ` : "";
      return `${event}${String(log[messageKey])}`;
    },
  });
}

export function createLogger(context?: Record<string, unknown>): pino.Logger {
  const base =
    shouldPretty() && !isTestRun() ? pino(pinoOptions(), prettyStream()) : pino(pinoOptions());
  return context ? base.child(context) : base;
}
