export const CIRCUIT_BREAKER_THRESHOLD = 6;

export type CircuitBreaker = {
  consecutiveFailures: number;
  open: boolean;
};

export function createCircuitBreaker(): CircuitBreaker {
  return { consecutiveFailures: 0, open: false };
}

/** Records one attempt's outcome. Returns true the moment the breaker trips open. */
export function recordCircuitAttempt(circuit: CircuitBreaker, succeeded: boolean): boolean {
  if (succeeded) {
    circuit.consecutiveFailures = 0;
    return false;
  }
  circuit.consecutiveFailures++;
  if (circuit.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD && !circuit.open) {
    circuit.open = true;
    return true;
  }
  return false;
}
