import type { CreateReservationRequest } from "../../../shared/api.js";
import { ReservationModel } from "../../models/Reservation.model.js";
import type { IReservation } from "../../models/Reservation.model.js";
import { ResourceModel } from "../../models/Resource.model.js";
import { ConflictError, ValidationError } from "../errors.js";
import type { DomainError, ErrorCode } from "../errors.js";
import { cancelReservation, createReservation } from "../reservation.service.js";

const USER_ID = "student-001";
const OTHER_USER_ID = "student-002";

const SLOT_START = "2030-01-15T10:00:00.000Z";
const SLOT_END = "2030-01-15T11:00:00.000Z";
const ONE_MS_BEFORE_SLOT_END = "2030-01-15T10:59:59.999Z";
const ONE_MS_AFTER_SLOT_START = "2030-01-15T10:00:00.001Z";
const AFTER_SLOT_END = "2030-01-15T12:00:00.000Z";
const BEFORE_SLOT_START = "2030-01-15T09:00:00.000Z";

const NONEXISTENT_RESOURCE_ID = "507f1f77bcf86cd799439011";

type DomainErrorClass = new (code: ErrorCode, message: string) => DomainError;

/** Resource model fixture: the resource service has no creation method. */
async function seedResource(): Promise<string> {
  const resource = await ResourceModel.create({
    name: "Study Room 101",
    type: "ROOM",
    location: "Library",
    isAvailable: true,
  });
  return resource._id.toString();
}

function findPersisted(id: string): Promise<IReservation> {
  return ReservationModel.findById(id).orFail().lean<IReservation>().exec();
}

async function expectDomainError(
  action: Promise<unknown>,
  errorClass: DomainErrorClass,
  code: ErrorCode,
): Promise<void> {
  const outcome: unknown = await action.then(
    (): string => "resolved",
    (reason: unknown): unknown => reason,
  );
  expect(outcome).toBeInstanceOf(errorClass);
  expect(outcome).toMatchObject({ code });
}

describe("reservation service", (): void => {
  let resourceId: string;

  function slot(
    overrides: Partial<CreateReservationRequest> = {},
  ): CreateReservationRequest {
    return {
      resourceId,
      userId: USER_ID,
      startTime: SLOT_START,
      endTime: SLOT_END,
      ...overrides,
    };
  }

  beforeEach(async (): Promise<void> => {
    resourceId = await seedResource();
  });

  describe("creating a reservation", (): void => {
    it("persists the resource, user, times, and PENDING status", async (): Promise<void> => {
      const created = await createReservation(slot());

      const persisted = await findPersisted(created.id);
      expect(persisted.resourceId.toString()).toBe(resourceId);
      expect(persisted.userId).toBe(USER_ID);
      expect(persisted.startTime.toISOString()).toBe(SLOT_START);
      expect(persisted.endTime.toISOString()).toBe(SLOT_END);
      expect(persisted.status).toBe("PENDING");
    });
  });

  describe("cancelling a reservation", (): void => {
    it("persists CANCELLED status", async (): Promise<void> => {
      const created = await createReservation(slot());

      await cancelReservation(created.id);

      const persisted = await findPersisted(created.id);
      expect(persisted.status).toBe("CANCELLED");
    });

    it("frees the slot for a new booking", async (): Promise<void> => {
      const created = await createReservation(slot());
      await cancelReservation(created.id);

      const rebooked = await createReservation(
        slot({ userId: OTHER_USER_ID }),
      );

      const persisted = await findPersisted(rebooked.id);
      expect(persisted.userId).toBe(OTHER_USER_ID);
      expect(persisted.status).toBe("PENDING");
      await expect(ReservationModel.countDocuments()).resolves.toBe(2);
    });
  });

  describe("overlap boundary", (): void => {
    beforeEach(async (): Promise<void> => {
      await createReservation(slot());
    });

    it("rejects an exact duplicate", async (): Promise<void> => {
      await expectDomainError(
        createReservation(slot({ userId: OTHER_USER_ID })),
        ConflictError,
        "RESERVATION_CONFLICT",
      );
      await expect(ReservationModel.countDocuments()).resolves.toBe(1);
    });

    it("rejects a booking overlapping the end by 1 ms", async (): Promise<void> => {
      await expectDomainError(
        createReservation(
          slot({
            startTime: ONE_MS_BEFORE_SLOT_END,
            endTime: AFTER_SLOT_END,
          }),
        ),
        ConflictError,
        "RESERVATION_CONFLICT",
      );
      await expect(ReservationModel.countDocuments()).resolves.toBe(1);
    });

    it("rejects a booking overlapping the start by 1 ms", async (): Promise<void> => {
      await expectDomainError(
        createReservation(
          slot({
            startTime: BEFORE_SLOT_START,
            endTime: ONE_MS_AFTER_SLOT_START,
          }),
        ),
        ConflictError,
        "RESERVATION_CONFLICT",
      );
      await expect(ReservationModel.countDocuments()).resolves.toBe(1);
    });

    it("accepts a booking starting exactly when the previous one ends", async (): Promise<void> => {
      const adjacent = await createReservation(
        slot({ startTime: SLOT_END, endTime: AFTER_SLOT_END }),
      );

      const persisted = await findPersisted(adjacent.id);
      expect(persisted.startTime.toISOString()).toBe(SLOT_END);
      await expect(ReservationModel.countDocuments()).resolves.toBe(2);
    });
  });

  describe("invalid requests", (): void => {
    it("rejects an end time before the start time", async (): Promise<void> => {
      await expectDomainError(
        createReservation(
          slot({ startTime: SLOT_END, endTime: SLOT_START }),
        ),
        ValidationError,
        "INVALID_RESERVATION",
      );
      await expect(ReservationModel.countDocuments()).resolves.toBe(0);
    });

    it("rejects a zero-length reservation", async (): Promise<void> => {
      await expectDomainError(
        createReservation(
          slot({ startTime: SLOT_START, endTime: SLOT_START }),
        ),
        ValidationError,
        "INVALID_RESERVATION",
      );
      await expect(ReservationModel.countDocuments()).resolves.toBe(0);
    });

    it("rejects a valid ObjectId for a nonexistent resource", async (): Promise<void> => {
      await expectDomainError(
        createReservation(slot({ resourceId: NONEXISTENT_RESOURCE_ID })),
        ValidationError,
        "INVALID_RESERVATION",
      );
      await expect(ReservationModel.countDocuments()).resolves.toBe(0);
    });
  });
});
