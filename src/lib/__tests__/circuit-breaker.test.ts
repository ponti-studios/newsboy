import { describe, expect, it } from "vitest";

import {
  CIRCUIT_BREAKER_THRESHOLD,
  createCircuitBreaker,
  recordCircuitAttempt,
} from "../generation/circuit-breaker";

describe("circuit breaker", () => {
  it("starts closed with no failures", () => {
    expect(createCircuitBreaker()).toEqual({ consecutiveFailures: 0, open: false });
  });

  it("opens at the failure threshold and only trips once", () => {
    const circuit = createCircuitBreaker();

    for (let attempt = 1; attempt < CIRCUIT_BREAKER_THRESHOLD; attempt++) {
      expect(recordCircuitAttempt(circuit, false)).toBe(false);
    }
    expect(recordCircuitAttempt(circuit, false)).toBe(true);
    expect(recordCircuitAttempt(circuit, false)).toBe(false);
    expect(circuit).toEqual({ consecutiveFailures: CIRCUIT_BREAKER_THRESHOLD + 1, open: true });
  });

  it("resets consecutive failures after a successful attempt", () => {
    const circuit = createCircuitBreaker();

    recordCircuitAttempt(circuit, false);
    recordCircuitAttempt(circuit, false);
    recordCircuitAttempt(circuit, true);

    expect(circuit).toEqual({ consecutiveFailures: 0, open: false });
  });
});
