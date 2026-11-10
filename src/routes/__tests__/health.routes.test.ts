import request from "supertest";

import { createApp } from "../../app.js";

describe("GET /api/v1/health", (): void => {
  it("reports liveness", async (): Promise<void> => {
    const response = await request(createApp()).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      timestamp: expect.any(String),
      uptimeSeconds: expect.any(Number),
    });
  });
});
