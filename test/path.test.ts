import { describe, expect, it } from "vitest";
import { displayPath, resolvePath } from "../src/tools/path.js";

describe("resolvePath", () => {
  it("相対パスは cwd 基準の絶対パスにする", () => {
    expect(resolvePath("/work/project", "src/a.ts")).toBe(
      "/work/project/src/a.ts",
    );
    expect(resolvePath("/work/project", "./src/../a.ts")).toBe(
      "/work/project/a.ts",
    );
  });

  it("絶対パスはそのまま正規化する", () => {
    expect(resolvePath("/work/project", "/other/../x")).toBe("/x");
  });
});

describe("displayPath", () => {
  it("cwd の中なら相対パスにする", () => {
    expect(displayPath("/work/project", "/work/project/src/a.ts")).toBe(
      "src/a.ts",
    );
  });

  it("cwd の外なら絶対パスにする", () => {
    expect(displayPath("/work/project", "/other/a.ts")).toBe("/other/a.ts");
    expect(displayPath("/work/project", "/work/project2/a.ts")).toBe(
      "/work/project2/a.ts",
    );
  });

  it("cwd 自身は . にする", () => {
    expect(displayPath("/work/project", "/work/project")).toBe(".");
  });
});
