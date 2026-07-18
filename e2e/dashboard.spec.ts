import { expect, test } from "@playwright/test";

test("renders the governance overview and management navigation", async ({
  page
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Payment governance" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Traces" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Live payment traces" })
  ).toBeVisible();
  await expect(
    page.getByRole("complementary").getByText("Trace timeline")
  ).toBeVisible();
});

test("keeps the primary dashboard usable at a mobile viewport", async ({
  page
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Payment governance" })
  ).toBeVisible();
  await expect(page.locator(".metric-strip")).toBeVisible();
  await expect(page.locator(".trace-table-wrap")).toBeVisible();
});

test("switches preloaded spend ranges without navigating", async ({ page }) => {
  await page.goto("/");
  const initialUrl = page.url();
  const oneHour = page.getByRole("button", { name: "1H", exact: true });
  const twentyFourHours = page.getByRole("button", {
    name: "24H",
    exact: true
  });

  await expect(twentyFourHours).toHaveAttribute("aria-pressed", "true");
  await expect(oneHour).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("img", { name: /24 hours/i })).toBeVisible();

  await oneHour.click();

  await expect(oneHour).toHaveAttribute("aria-pressed", "true");
  await expect(twentyFourHours).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("img", { name: /1 hour/i })).toBeVisible();
  expect(page.url()).toBe(initialUrl);
});

test("renders policy health from dashboard data", async ({ page }) => {
  await page.goto("/");
  const policyHealth = page.locator(".policy-health");

  await expect(policyHealth).toContainText("Healthy policies");
  await expect(policyHealth).toContainText("40");
  await expect(policyHealth).toContainText("83.3%");
  await expect(policyHealth).toContainText("Policies with warnings");
  await expect(policyHealth).toContainText("6");
  await expect(policyHealth).toContainText("Policies with errors");
  await expect(policyHealth).toContainText("2");
  await expect(
    policyHealth.getByRole("link", { name: /View all policies/i })
  ).toHaveAttribute("href", "/policies");
});

test("renders first-admin onboarding with install instructions", async ({
  page
}) => {
  await page.goto("/onboarding");
  await expect(
    page.getByRole("heading", { name: "Bootstrap Qusto" })
  ).toBeVisible();
  await expect(page.getByText("pnpm add @qusto/sdk")).toBeVisible();
  await expect(page.getByText("npx -y @qusto/mcp")).toBeVisible();
});

test("opens the getting started guide from the sidebar and copies setup code", async ({
  page
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Getting started" }).click();

  await expect(page).toHaveURL(/\/getting-started$/);
  await expect(
    page.getByRole("heading", { name: "Getting started", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Send your first governed request" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create API key" })
  ).toHaveAttribute("href", "/settings");
  await expect(
    page.getByRole("link", { name: "Open policies" })
  ).toHaveAttribute("href", "/policies");
  await expect(
    page.getByRole("link", { name: "View traces" })
  ).toHaveAttribute("href", "/traces");

  await page.getByRole("button", { name: "Copy SDK installation command" }).click();
  await expect(page.getByRole("status")).toHaveText("Copied");
  await expect(
    page.getByRole("link", { name: "Getting started" })
  ).toHaveAttribute("aria-current", "page");

  const viewportHasNoHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
  );
  expect(viewportHasNoHorizontalOverflow).toBe(true);
});
