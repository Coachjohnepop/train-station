import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientSiteVideoMime, siteVideoMimeFromName } from "./site-video";

describe("clientSiteVideoMime", () => {
  it("uses the Photos .MOV filename when iPhone leaves type empty", () => {
    assert.equal(clientSiteVideoMime({ name: "IMG_4033.MOV", type: "" }), "video/quicktime");
  });

  it("accepts application-empty iOS mp4", () => {
    assert.equal(clientSiteVideoMime({ name: "intro.mp4", type: "application/octet-stream" }), "video/mp4");
  });

  it("keeps a real video MIME", () => {
    assert.equal(clientSiteVideoMime({ name: "clip.mov", type: "video/quicktime" }), "video/quicktime");
  });
});

describe("siteVideoMimeFromName", () => {
  it("maps mov/m4v/webm", () => {
    assert.equal(siteVideoMimeFromName("a.mov"), "video/quicktime");
    assert.equal(siteVideoMimeFromName("a.m4v"), "video/x-m4v");
    assert.equal(siteVideoMimeFromName("a.webm"), "video/webm");
  });
});
