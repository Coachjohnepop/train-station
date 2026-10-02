import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { staffAdminRedirect, staffLoginDestination } from "./staff-access";

describe("staffAdminRedirect", () => {
  it("lets coaches open Station pulse", () => {
    assert.equal(staffAdminRedirect("/admin/analytics", "INSTRUCTOR"), null);
  });

  it("lets platform admins open Station pulse", () => {
    assert.equal(staffAdminRedirect("/admin/analytics", "PLATFORM_ADMIN"), null);
  });

  it("lets coaches and platform admins open Daily activity", () => {
    assert.equal(staffAdminRedirect("/admin/activity", "INSTRUCTOR"), null);
    assert.equal(staffAdminRedirect("/admin/activity", "PLATFORM_ADMIN"), null);
  });

  it("still blocks coaches from billing", () => {
    assert.equal(staffAdminRedirect("/admin/billing", "INSTRUCTOR"), "/admin/day");
  });
});

describe("staffLoginDestination", () => {
  it("lets operators open member, coach, or admin from the login menu", () => {
    assert.equal(staffLoginDestination("ADMIN", "/member/today"), "/member/today");
    assert.equal(staffLoginDestination("ADMIN", "/admin/today"), "/admin/today");
    assert.equal(staffLoginDestination("ADMIN", "/admin/platform"), "/admin/platform");
    assert.equal(staffLoginDestination("INSTRUCTOR", "/admin/today"), "/admin/today");
  });

  it("falls back to the coach desk when no destination is picked", () => {
    assert.equal(staffLoginDestination("ADMIN"), "/admin/day");
    assert.equal(staffLoginDestination("INSTRUCTOR", "//evil.example"), "/admin/day");
  });
});
