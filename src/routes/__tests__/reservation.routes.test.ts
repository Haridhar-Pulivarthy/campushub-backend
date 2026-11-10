import type { Express } from "express";
import { Types } from "mongoose";
import request from "supertest";

import type { Resource } from "../../../shared/api.js";
import { createApp } from "../../app.js";
import { ReservationModel } from "../../models/Reservation.model.js";
import type { IReservation } from "../../models/Reservation.model.js";
import { ResourceModel } from "../../models/Resource.model.js";

const RESERVATIONS_PATH = "/api/v1/reservations";
const RESOURCES_PATH = "/api/v1/resources";

const UNKNOWN_OBJECT_ID = "507f1f77bcf86cd799439011";
const USER_ID = "student-001";
const SLOT_START = "2030-01-15T10:00:00.000Z";
const SLOT_END = "2030-01-15T11:00:00.000Z";

async function seedResource(
  overrides: Partial<Omit<Resource, "id">> = {},
): Promise<string> {
  const resource = await ResourceModel.create({
    name: "Study Room 101",
    type: "ROOM",
    location: "Library",
    isAvailable: true,
    ...overrides,
  });
  return resource._id.toString();
}

async function seedReservation(
  resourceId: string,
  overrides: Partial<Pick<IReservation, "userId" | "status">> = {},
): Promise<string> {
  const reservation = await ReservationModel.create({
    resourceId: new Types.ObjectId(resourceId),
    userId: USER_ID,
    startTime: new Date(SLOT_START),
    endTime: new Date(SLOT_END),
    status: "PENDING",
    ...overrides,
  });
  return reservation._id.toString();
}

describe("reservation routes", (): void => {
  const app: Express = createApp();

  describe("POST /api/v1/reservations", (): void => {
    let resourceId: string;

    beforeEach(async (): Promise<void> => {
      resourceId = await seedResource();
    });

    it("returns 201 and persists the reservation", async (): Promise<void> => {
      const response = await request(app).post(RESERVATIONS_PATH).send({
        resourceId,
        userId: USER_ID,
        startTime: SLOT_START,
        endTime: SLOT_END,
      });

      const persisted = await ReservationModel.findOne().orFail().exec();
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: persisted._id.toString(),
        resourceId,
        userId: USER_ID,
        startTime: SLOT_START,
        endTime: SLOT_END,
        status: "PENDING",
      });
      expect(persisted.resourceId.toString()).toBe(resourceId);
      expect(persisted.userId).toBe(USER_ID);
      expect(persisted.startTime.toISOString()).toBe(SLOT_START);
      expect(persisted.endTime.toISOString()).toBe(SLOT_END);
      expect(persisted.status).toBe("PENDING");
    });

    it("returns 409 for a sequential overlapping booking", async (): Promise<void> => {
      const first = await request(app).post(RESERVATIONS_PATH).send({
        resourceId,
        userId: USER_ID,
        startTime: SLOT_START,
        endTime: SLOT_END,
      });

      const second = await request(app).post(RESERVATIONS_PATH).send({
        resourceId,
        userId: "student-002",
        startTime: "2030-01-15T10:30:00.000Z",
        endTime: "2030-01-15T11:30:00.000Z",
      });

      expect(first.status).toBe(201);
      expect(second.status).toBe(409);
      expect(second.body).toEqual({
        code: "RESERVATION_CONFLICT",
        message: `Resource ${resourceId} is already reserved for the requested time`,
      });
      await expect(ReservationModel.countDocuments()).resolves.toBe(1);
    });

    it("returns 400 for a malformed date without persisting", async (): Promise<void> => {
      const response = await request(app).post(RESERVATIONS_PATH).send({
        resourceId,
        userId: USER_ID,
        startTime: "not-a-date",
        endTime: SLOT_END,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        code: "INVALID_RESERVATION",
        message: "startTime must be a valid ISO-8601 date-time",
      });
      await expect(ReservationModel.countDocuments()).resolves.toBe(0);
    });

    it.each(["resourceId", "userId", "startTime", "endTime"])(
      "returns 400 without persisting when %s is missing",
      async (field: string): Promise<void> => {
        const body: Record<string, unknown> = {
          resourceId,
          userId: USER_ID,
          startTime: SLOT_START,
          endTime: SLOT_END,
        };
        delete body[field];

        const response = await request(app).post(RESERVATIONS_PATH).send(body);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          code: "INVALID_BODY",
          message:
            "resourceId, userId, startTime, and endTime are required strings",
        });
        await expect(ReservationModel.countDocuments()).resolves.toBe(0);
      },
    );

    it("returns 400 when the request has no body", async (): Promise<void> => {
      const response = await request(app).post(RESERVATIONS_PATH);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        code: "INVALID_BODY",
        message: "Request body must be a JSON object",
      });
    });

    it.each<[string, Record<string, unknown>, string]>([
      ["a blank resourceId", { resourceId: " " }, "resourceId is required"],
      [
        "a malformed resourceId",
        { resourceId: "not-an-object-id" },
        "resourceId must be a valid ObjectId",
      ],
      ["a blank userId", { userId: " " }, "userId is required"],
      [
        "a malformed endTime",
        { endTime: "not-a-date" },
        "endTime must be a valid ISO-8601 date-time",
      ],
      [
        "an unknown status",
        { status: "DONE" },
        "status must be PENDING, CONFIRMED, or CANCELLED",
      ],
      [
        "a non-string status",
        { status: 1 },
        "status must be PENDING, CONFIRMED, or CANCELLED",
      ],
    ])(
      "returns 400 without persisting for %s",
      async (
        _label: string,
        overrides: Record<string, unknown>,
        message: string,
      ): Promise<void> => {
        const response = await request(app)
          .post(RESERVATIONS_PATH)
          .send({
            resourceId,
            userId: USER_ID,
            startTime: SLOT_START,
            endTime: SLOT_END,
            ...overrides,
          });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ code: "INVALID_RESERVATION", message });
        await expect(ReservationModel.countDocuments()).resolves.toBe(0);
      },
    );

    it("returns 400 for an unavailable resource", async (): Promise<void> => {
      const unavailableId = await seedResource({ isAvailable: false });

      const response = await request(app).post(RESERVATIONS_PATH).send({
        resourceId: unavailableId,
        userId: USER_ID,
        startTime: SLOT_START,
        endTime: SLOT_END,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        code: "INVALID_RESERVATION",
        message: `Resource ${unavailableId} is not available`,
      });
      await expect(ReservationModel.countDocuments()).resolves.toBe(0);
    });

    it("persists an explicitly requested status", async (): Promise<void> => {
      const response = await request(app).post(RESERVATIONS_PATH).send({
        resourceId,
        userId: USER_ID,
        startTime: SLOT_START,
        endTime: SLOT_END,
        status: "CONFIRMED",
      });

      const persisted = await ReservationModel.findOne().orFail().exec();
      expect(response.status).toBe(201);
      expect(persisted.status).toBe("CONFIRMED");
    });
  });

  describe("PATCH /api/v1/reservations/:id/cancel", (): void => {
    it("returns 200 and persists CANCELLED", async (): Promise<void> => {
      const resourceId = await seedResource();
      const id = await seedReservation(resourceId);

      const response = await request(app).patch(
        `${RESERVATIONS_PATH}/${id}/cancel`,
      );

      const persisted = await ReservationModel.findById(id).orFail().exec();
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ id, status: "CANCELLED" });
      expect(persisted.status).toBe("CANCELLED");
    });

    it("returns 200 when already cancelled", async (): Promise<void> => {
      const resourceId = await seedResource();
      const id = await seedReservation(resourceId, { status: "CANCELLED" });

      const response = await request(app).patch(
        `${RESERVATIONS_PATH}/${id}/cancel`,
      );

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ id, status: "CANCELLED" });
    });

    it("returns 404 for an unknown reservation", async (): Promise<void> => {
      const response = await request(app).patch(
        `${RESERVATIONS_PATH}/${UNKNOWN_OBJECT_ID}/cancel`,
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        code: "RESERVATION_NOT_FOUND",
        message: `Reservation ${UNKNOWN_OBJECT_ID} not found`,
      });
    });

    it.each([
      ["a malformed id", "not-an-object-id", "id must be a valid ObjectId"],
      ["a blank id", "%20", "id is required"],
    ])(
      "returns 400 for %s",
      async (_label: string, id: string, message: string): Promise<void> => {
        const response = await request(app).patch(
          `${RESERVATIONS_PATH}/${id}/cancel`,
        );

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          code: "INVALID_RESERVATION_ID",
          message,
        });
      },
    );
  });

  describe("GET /api/v1/reservations/user/:userId", (): void => {
    it("returns only the user's active reservations", async (): Promise<void> => {
      const resourceId = await seedResource();
      const activeId = await seedReservation(resourceId);
      await seedReservation(resourceId, { status: "CANCELLED" });
      await seedReservation(resourceId, { userId: "student-002" });

      const response = await request(app).get(
        `${RESERVATIONS_PATH}/user/${USER_ID}`,
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: activeId,
          resourceId,
          userId: USER_ID,
          startTime: SLOT_START,
          endTime: SLOT_END,
          status: "PENDING",
        },
      ]);
    });

    it("returns 400 for a blank user id", async (): Promise<void> => {
      const response = await request(app).get(`${RESERVATIONS_PATH}/user/%20`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        code: "INVALID_USER_ID",
        message: "userId is required",
      });
    });
  });

  describe("GET /api/v1/resources", (): void => {
    it("applies type and isAvailable together", async (): Promise<void> => {
      const matchId = await seedResource({ name: "Match" });
      await seedResource({ name: "Wrong type", type: "LAB" });
      await seedResource({ name: "Unavailable", isAvailable: false });

      const response = await request(app)
        .get(RESOURCES_PATH)
        .query({ type: "ROOM", isAvailable: "true" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: matchId,
          name: "Match",
          type: "ROOM",
          location: "Library",
          isAvailable: true,
        },
      ]);
    });

    it("returns every resource without filters", async (): Promise<void> => {
      await seedResource({ name: "Available" });
      await seedResource({ name: "Unavailable", isAvailable: false });

      const response = await request(app).get(RESOURCES_PATH);

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
    });

    it("filters on isAvailable=false", async (): Promise<void> => {
      await seedResource({ name: "Available" });
      await seedResource({ name: "Unavailable", isAvailable: false });

      const response = await request(app)
        .get(RESOURCES_PATH)
        .query({ isAvailable: "false" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        expect.objectContaining({ name: "Unavailable", isAvailable: false }),
      ]);
    });

    it.each([
      [
        "an unknown type",
        "type=DESK",
        "INVALID_TYPE",
        "type must be one of ROOM, EQUIPMENT, LAB",
      ],
      [
        "a repeated type",
        "type=ROOM&type=LAB",
        "INVALID_TYPE",
        "type must be one of ROOM, EQUIPMENT, LAB",
      ],
      [
        "an invalid isAvailable",
        "isAvailable=maybe",
        "INVALID_IS_AVAILABLE",
        "isAvailable must be true or false",
      ],
      [
        "a repeated isAvailable",
        "isAvailable=true&isAvailable=false",
        "INVALID_IS_AVAILABLE",
        "isAvailable must be true or false",
      ],
    ])(
      "returns 400 for %s",
      async (
        _label: string,
        query: string,
        code: string,
        message: string,
      ): Promise<void> => {
        const response = await request(app).get(`${RESOURCES_PATH}?${query}`);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ code, message });
      },
    );
  });
});
