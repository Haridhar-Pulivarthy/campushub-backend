/**
 * Health service — business logic for the health-check feature.
 *
 * This layer owns domain results and (when applicable) Model access. The
 * health check has no persistence yet, so it returns a plain domain object
 * describing process liveness.
 */

export interface HealthStatus {
  readonly status: "ok";
  readonly timestamp: string;
  readonly uptimeSeconds: number;
}

export function getHealthStatus(): HealthStatus {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
  };
}
