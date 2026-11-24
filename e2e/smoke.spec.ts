/**
 * Part 1 smoke tests: prove Playwright starts both servers and that the
 * browser reaches the backend through the Vite proxy. No reservation data.
 */
import { expect, test } from "@playwright/test";
import type { APIRequestContext, APIResponse, Page } from "@playwright/test";

test.describe("CampusHub smoke", (): void => {
  test("API health check responds through the Vite proxy", async ({
    request,
  }: {
    request: APIRequestContext;
  }): Promise<void> => {
    const response: APIResponse = await request.get("/api/v1/health");

    await expect(response).toBeOK();
    const body: unknown = await response.json();
    expect(body).toMatchObject({ status: "ok" });
  });

  test("home page renders the CampusHub heading", async ({
    page,
  }: {
    page: Page;
  }): Promise<void> => {
    await page.goto("/");

    await expect(page).toHaveTitle("CampusHub");
    await expect(
      page.getByRole("heading", { level: 1, name: "CampusHub" }),
    ).toBeVisible();
  });
});
