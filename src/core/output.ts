type Cell = string | number | boolean | null | undefined;

function toCell(value: Cell): string {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printTable(headers: string[], rows: Cell[][]): void {
  const widths = headers.map((header, index) => {
    const cells = rows.map((row) => toCell(row[index]));
    return Math.max(header.length, ...cells.map((cell) => cell.length));
  });

  const pad = (value: string, length: number) =>
    value + " ".repeat(Math.max(0, length - value.length));

  const headerLine = headers
    .map((header, index) => pad(header, widths[index]))
    .join("  ");
  const divider = widths.map((width) => "-".repeat(width)).join("  ");

  process.stdout.write(`${headerLine}\n${divider}\n`);
  for (const row of rows) {
    const line = row
      .map((cell, index) => pad(toCell(cell), widths[index]))
      .join("  ");
    process.stdout.write(`${line}\n`);
  }
}

export function printKeyValue(title: string, entries: Record<string, Cell>): void {
  const keys = Object.keys(entries);
  const maxKey = Math.max(...keys.map((key) => key.length), 0);
  process.stdout.write(`${title}\n`);
  for (const key of keys) {
    const value = toCell(entries[key]);
    const paddedKey = key.padEnd(maxKey, " ");
    process.stdout.write(`${paddedKey}  ${value}\n`);
  }
}
