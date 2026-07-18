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
