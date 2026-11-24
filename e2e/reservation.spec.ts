/**
 * Reservation journeys from e2e/scenarios/reservation.feature. Each Gherkin
 * step is a test.step with the same text. The database is used only to seed
 * Given data and to check what was persisted; every booking attempt goes
 * through the browser against the real React app and Express backend.
 */
import type { Locator, Page } from "@playwright/test";

import { flexibleSpaces, tomorrowInZone, zonedSlot } from "./support/dates.ts";
import type { Slot } from "./support/dates.ts";
import { E2E_STUDENT_ID } from "./support/e2e-env.ts";
import { expect, test } from "./support/fixtures.ts";
import type { StoredReservation } from "./support/fixtures.ts";

const OTHER_STUDENT_ID = "student-002";
const CONFLICT_ALERT =
  "This resource is already reserved for the selected time window.";
const NO_BOOKINGS = "You have no active bookings.";

function directory(page: Page): Locator {
  return page.getByRole("region", { name: "Resource directory" });
}

function bookingForm(page: Page): Locator {
  return page.getByRole("region", { name: "Book a resource" });
}

function myBookings(page: Page): Locator {
  return page.getByRole("region", { name: "My Bookings" });
}

/** The booking confirmation ("Booked … Status: …"), wherever it appears. */
function confirmation(page: Page): Locator {
  return page.getByRole("status").filter({ hasText: /^Booked / });
}

async function expectNoBookingsShown(page: Page): Promise<void> {
  const bookings = myBookings(page);
  await expect(bookings.getByText(NO_BOOKINGS)).toBeVisible();
  await expect(
    bookings.getByRole("list", { name: "Your reservations" }),
  ).toHaveCount(0);
}

/** Load the app and confirm which student it is running as. */
async function openCampusHub(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("banner")).toContainText(
    `Current student: ${E2E_STUDENT_ID}`,
  );
}

async function filterByType(page: Page, label: string): Promise<void> {
  const filters = directory(page).getByRole("group", {
    name: "Filter by type",
  });
  await filters.getByRole("button", { name: label, exact: true }).click();
  await expect(
    filters.getByRole("button", { name: label, exact: true, pressed: true }),
  ).toBeVisible();
}

async function selectResource(page: Page, name: string): Promise<void> {
  const card = directory(page).getByRole("article", { name, exact: true });
  await card.getByRole("button", { name: "Select for booking" }).click();
  await expect(
    card.getByRole("button", { name: "Selected", pressed: true }),
  ).toBeVisible();
  await expect(
    bookingForm(page).getByText(name, { exact: true }),
  ).toBeVisible();
}

async function enterTimeWindow(
  page: Page,
  start: Slot,
  end: Slot,
): Promise<void> {
  const form = bookingForm(page);
  await form.getByLabel("Start time").fill(start.input);
  await form.getByLabel("End time").fill(end.input);
  await expect(form.getByLabel("Start time")).toHaveValue(start.input);
  await expect(form.getByLabel("End time")).toHaveValue(end.input);
}

async function submitBooking(page: Page): Promise<void> {
  await bookingForm(page)
    .getByRole("button", { name: "Book resource" })
    .click();
}

test.describe("Feature: Reserve a campus resource", (): void => {
  test("Student reserves an available study room and sees it in My Bookings", async ({
    page,
    db,
  }): Promise<void> => {
    const roomName = "Study Room 101";
    const tomorrow = tomorrowInZone();
    const start = zonedSlot(tomorrow, "10:00");
    const end = zonedSlot(tomorrow, "11:00");
    let roomId = "";

    await test.step(`Given I am using CampusHub as student "${E2E_STUDENT_ID}"`, async (): Promise<void> => {
      await openCampusHub(page);
    });
    await test.step(`And the room "${roomName}" in "Library - First Floor" is available for booking`, async (): Promise<void> => {
      roomId = (await db.seedRoom(roomName, "Library - First Floor")).id;
    });
    await test.step(`And "${roomName}" has no reservations tomorrow`, async (): Promise<void> => {
      expect(await db.listReservations({ resourceId: roomId })).toEqual([]);
    });
    await test.step("And I have no active bookings", async (): Promise<void> => {
      expect(await db.listReservations({ userId: E2E_STUDENT_ID })).toEqual([]);
    });

    await test.step("When I open CampusHub", async (): Promise<void> => {
      // A fresh load, so the page shows the data seeded above.
      await openCampusHub(page);
      await expectNoBookingsShown(page);
    });
    await test.step('And I filter the resource directory by "Room"', async (): Promise<void> => {
      await filterByType(page, "Room");
    });
    await test.step(`And I select "${roomName}" for booking`, async (): Promise<void> => {
      await selectResource(page, roomName);
    });
    await test.step("And I enter a time window from 10:00 to 11:00 tomorrow", async (): Promise<void> => {
      await enterTimeWindow(page, start, end);
    });
    await test.step("And I submit the booking", async (): Promise<void> => {
      await submitBooking(page);
    });

    await test.step(`Then I see a confirmation that "${roomName}" is booked from 10:00 to 11:00 tomorrow with status "Pending"`, async (): Promise<void> => {
      await expect(confirmation(page)).toHaveText(
        new RegExp(
          `^Booked ${roomName} from ${flexibleSpaces(start.display)} to ${flexibleSpaces(end.display)}\\. Status: Pending\\.$`,
        ),
      );
      await expect(bookingForm(page).getByRole("alert")).toHaveCount(0);
    });
    await test.step(`And My Bookings lists "${roomName}" from 10:00 to 11:00 tomorrow with status "Pending"`, async (): Promise<void> => {
      const items = myBookings(page)
        .getByRole("list", { name: "Your reservations" })
        .getByRole("listitem");
      await expect(items).toHaveCount(1);
      const item = items.filter({
        has: page.getByRole("heading", { name: roomName, exact: true }),
      });
      await expect(item.getByText("Pending", { exact: true })).toBeVisible();
      await expect(
        item.getByText(new RegExp(`^${flexibleSpaces(start.display)}$`)),
      ).toBeVisible();
      await expect(
        item.getByText(new RegExp(`^${flexibleSpaces(end.display)}$`)),
      ).toBeVisible();
      await expect(
        item.getByRole("button", {
          name: new RegExp(
            `^Cancel reservation for ${roomName} starting ${flexibleSpaces(start.display)}$`,
          ),
        }),
      ).toBeVisible();

      // Persisted exactly as entered: resource, student, instants, status.
      expect(await db.listReservations()).toEqual([
        {
          id: expect.any(String),
          resourceId: roomId,
          userId: E2E_STUDENT_ID,
          startTime: start.instant.toISOString(),
          endTime: end.instant.toISOString(),
          status: "PENDING",
        },
      ]);
    });
  });

  test("Student is alerted that a study room is already booked for an overlapping time", async ({
    page,
    db,
  }): Promise<void> => {
    const roomName = "Study Room 102";
    const tomorrow = tomorrowInZone();
    const heldStart = zonedSlot(tomorrow, "14:00");
    const heldEnd = zonedSlot(tomorrow, "15:00");
    const start = zonedSlot(tomorrow, "14:30");
    const end = zonedSlot(tomorrow, "15:30");
    let roomId = "";
    let original: StoredReservation | undefined;

    await test.step(`Given I am using CampusHub as student "${E2E_STUDENT_ID}"`, async (): Promise<void> => {
      await openCampusHub(page);
    });
    await test.step(`And the room "${roomName}" in "Library - Second Floor" is available for booking`, async (): Promise<void> => {
      roomId = (await db.seedRoom(roomName, "Library - Second Floor")).id;
    });
    await test.step(`And student "${OTHER_STUDENT_ID}" has a pending reservation for "${roomName}" from 14:00 to 15:00 tomorrow`, async (): Promise<void> => {
      original = await db.seedPendingReservation({
        resourceId: roomId,
        userId: OTHER_STUDENT_ID,
        start: heldStart.instant,
        end: heldEnd.instant,
      });
    });
    await test.step("And I have no active bookings", async (): Promise<void> => {
      expect(await db.listReservations({ userId: E2E_STUDENT_ID })).toEqual([]);
    });

    await test.step("When I open CampusHub", async (): Promise<void> => {
      // A fresh load, so the page shows the data seeded above.
      await openCampusHub(page);
      await expectNoBookingsShown(page);
    });
    await test.step('And I filter the resource directory by "Room"', async (): Promise<void> => {
      await filterByType(page, "Room");
    });
    await test.step(`And I select "${roomName}" for booking`, async (): Promise<void> => {
      await selectResource(page, roomName);
    });
    await test.step("And I enter a time window from 14:30 to 15:30 tomorrow", async (): Promise<void> => {
      await enterTimeWindow(page, start, end);
    });
    await test.step("And I submit the booking", async (): Promise<void> => {
      await submitBooking(page);
    });

    await test.step(`Then I see the alert "${CONFLICT_ALERT}"`, async (): Promise<void> => {
      await expect(bookingForm(page).getByRole("alert")).toHaveText(
        CONFLICT_ALERT,
      );
    });
    await test.step("And I do not see a booking confirmation", async (): Promise<void> => {
      await expect(confirmation(page)).toHaveCount(0);
    });
    await test.step("And My Bookings shows that I have no active bookings", async (): Promise<void> => {
      await expectNoBookingsShown(page);
      // Reloading fetches the list again from the server.
      await page.reload();
      await expectNoBookingsShown(page);
    });
    await test.step(`And "${roomName}" still has only one reservation tomorrow, held by "${OTHER_STUDENT_ID}" from 14:00 to 15:00`, async (): Promise<void> => {
      // The alert appears only after the backend rejected the booking, so
      // the stored data is final here.
      expect(await db.listReservations()).toEqual([original]);
      expect(original).toMatchObject({
        resourceId: roomId,
        userId: OTHER_STUDENT_ID,
        startTime: heldStart.instant.toISOString(),
        endTime: heldEnd.instant.toISOString(),
        status: "PENDING",
      });
    });
  });
});
