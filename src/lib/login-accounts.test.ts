import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  groupLoginAccounts,
  historyMemberAccounts,
  isSafeAppPath,
  loginAccountHref,
  loginAccountLabel,
  operatorLoginAccounts,
  signedInAccountHref,
} from "./login-accounts";

describe("login accounts", () => {
  it("lists John and Jeremy as member, coach, and admin", () => {
    const accounts = operatorLoginAccounts();
    const labels = accounts.map(loginAccountLabel);
    assert.ok(labels.includes("John · Member"));
    assert.ok(labels.includes("John · Coach"));
    assert.ok(labels.includes("John · Admin"));
    assert.ok(labels.includes("Jeremy · Coach"));
    assert.equal(accounts.length, 6);

    const johnCoach = accounts.find((a) => a.id === "john@thetrainstation.co-coach");
    assert.equal(johnCoach?.redirect, "/admin/today");
    const jeremyAdmin = accounts.find((a) => a.id === "jeremy@thetrainstation.co-admin");
    assert.equal(jeremyAdmin?.redirect, "/admin/platform");
  });

  it("groups accounts under Member, Coach, Admin", () => {
    const groups = groupLoginAccounts(operatorLoginAccounts());
    assert.deepEqual(
      groups.map((g) => g.label),
      ["Member", "Coach", "Admin"],
    );
    assert.equal(groups[0].options.length, 2);
  });

  it("builds login URLs with email, workspace redirect, and switch", () => {
    const johnMember = operatorLoginAccounts()[0];
    assert.equal(
      loginAccountHref(johnMember),
      "/login?email=john%40thetrainstation.co&redirect=%2Fmember%2Ftoday",
    );
    assert.ok(loginAccountHref(johnMember, { switchAccount: true }).includes("switch=1"));
  });

  it("adds remembered member emails without duplicating operators", () => {
    const extra = historyMemberAccounts([
      "john@thetrainstation.co",
      "kaite@thetrainstation.co",
      "KAITE@thetrainstation.co",
    ]);
    assert.equal(extra.length, 1);
    assert.equal(extra[0].email, "kaite@thetrainstation.co");
    assert.equal(extra[0].workspace, "member");
  });

  it("pivots a signed-in operator without re-login, other emails go to switch", () => {
    const coach = operatorLoginAccounts().find((a) => a.workspace === "coach")!;
    assert.equal(signedInAccountHref(coach, "john@thetrainstation.co"), "/admin/today");
    assert.ok(
      signedInAccountHref(coach, "jeremy@thetrainstation.co").includes("switch=1"),
    );
  });

  it("rejects open redirects", () => {
    assert.equal(isSafeAppPath("/member/today"), true);
    assert.equal(isSafeAppPath("//evil.example"), false);
    assert.equal(isSafeAppPath("https://evil.example"), false);
  });
});
