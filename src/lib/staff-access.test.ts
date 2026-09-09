import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { staffAdminRedirect } from "./staff-access";

describe("staffAdminRedirect", () => {
  it("lets coaches open Station pulse", () => {
    assert.equal(staffAdminRedirect("/admin/analytics", "INSTRUCTOR"), null);
  });

  it("lets platform admins open Station pulse", () => {
    assert.equal(staffAdminRedirect("/admin/analytics", "PLATFORM_ADMIN"), null);
  });

  it("still blocks coaches from billing", () => {
    assert.equal(staffAdminRedirect("/admin/billing", "INSTRUCTOR"), "/admin/day");
  });
});
