import { expect, test } from "@playwright/test";
import { CONTACT_ENDPOINT } from "../src/config";

// The relay is mocked: a real message must never leave a test run.

test("an incomplete message is refused before it is sent", async ({ page }) => {
  let sent = false;
  await page.route(CONTACT_ENDPOINT, (route) => {
    sent = true;
    return route.abort();
  });
  await page.goto("/#contact");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toHaveText("Please fill in your name, a valid email address and a message.");
  expect(sent).toBe(false);
});

test("a complete message is relayed and acknowledged", async ({ page }) => {
  let body: unknown;
  await page.route(CONTACT_ENDPOINT, async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  await page.goto("/#contact");
  await page.getByLabel("Name", { exact: true }).fill("Test Person");
  await page.getByLabel("Email", { exact: true }).fill("test@example.com");
  await page.getByLabel("Message", { exact: true }).fill("Hello from the test suite.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toHaveText("Thank you, your message is on its way. I will reply to you by email.");
  await expect(page.getByLabel("Message", { exact: true })).toBeHidden();
  expect(body).toEqual({ name: "Test Person", email: "test@example.com", message: "Hello from the test suite.", website: "" });
});

test("a failed relay offers the email address instead", async ({ page }) => {
  await page.route(CONTACT_ENDPOINT, (route) => route.fulfill({ status: 500, body: "" }));
  await page.goto("/#contact");
  await page.getByLabel("Name", { exact: true }).fill("Test Person");
  await page.getByLabel("Email", { exact: true }).fill("test@example.com");
  await page.getByLabel("Message", { exact: true }).fill("Hello.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText("Please email leonard@saharasoftware.co.nz instead.");
  await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
});
