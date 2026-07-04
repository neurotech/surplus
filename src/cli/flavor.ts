import { InvalidArgumentError } from "commander";
import type { WowFlavor } from "../addons/types.js";

const FLAVORS = new Set<string>(["retail", "classic"]);

export function parseFlavor(value: string): WowFlavor {
  if (FLAVORS.has(value)) {
    return value as WowFlavor;
  }

  throw new InvalidArgumentError(
    `invalid flavor "${value}" (expected "retail" or "classic")`,
  );
}
