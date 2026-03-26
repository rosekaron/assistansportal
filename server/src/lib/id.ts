import { randomBytes } from "crypto";

export function newId(prefix = ""): string {
  return prefix + randomBytes(4).toString("hex");
}
