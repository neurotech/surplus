import { InvalidArgumentError } from "commander";
import { describe, expect, it } from "vitest";
import { parseFlavor } from "./flavor.js";

describe("parseFlavor", () => {
  it("accepts supported flavors", () => {
    expect(parseFlavor("retail")).toBe("retail");
    expect(parseFlavor("classic")).toBe("classic");
  });

  it("rejects unsupported flavors", () => {
    expect(() => parseFlavor("wrath")).toThrow(InvalidArgumentError);
  });
});
