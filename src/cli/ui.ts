import { createSpinner } from "nanospinner";
import pc from "picocolors";

export { pc };

export function spinner(text: string) {
  return createSpinner(text);
}

export function success(msg: string): void {
  console.log(`${pc.green("✓")} ${msg}`);
}

export function error(msg: string): void {
  console.error(`${pc.red("✗")} ${msg}`);
}

export function warn(msg: string): void {
  console.log(`${pc.yellow("!")} ${msg}`);
}

export function info(msg: string): void {
  console.log(`${pc.blue("ℹ")} ${msg}`);
}

export function heading(msg: string): void {
  console.log(`\n${pc.bold(pc.underline(msg))}\n`);
}

export function table(rows: string[][]): void {
  if (rows.length === 0) return;
  const firstRow = rows[0];
  if (!firstRow) return;
  const colWidths = firstRow.map((_, i) =>
    Math.max(...rows.map((r) => (r[i] ?? "").length)),
  );
  for (const row of rows) {
    const line = row
      .map((cell, i) => cell.padEnd(colWidths[i] ?? 0))
      .join("  ");
    console.log(line);
  }
}
