/**
 * Minimal CSV parser: handles quoted fields, commas inside quotes,
 * escaped quotes (""), and CRLF/LF line endings.
 * Returns rows as arrays of strings (first row = headers).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += c;
        i++;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
        i++;
      } else if (c === ",") {
        row.push(field);
        field = "";
        i++;
      } else if (c === "\r") {
        i++;
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i++;
      } else {
        field += c;
        i++;
      }
    }
  }
  // trailing field/row
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // drop fully-empty rows
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

export function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map(normHeader);
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}

/** Escape a value for CSV output. */
export function csvEscape(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Parse an XLSX/XLS file buffer into rows (first sheet only). */
export async function parseSpreadsheet(buf: ArrayBuffer): Promise<string[][]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as unknown[][];
  return rows
    .map((r) => r.map((c) => String(c ?? "")))
    .filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Read an uploaded file (CSV or XLSX/XLS) into rows. */
export async function readUploadRows(file: File): Promise<string[][]> {
  if (/\.xlsx?$/i.test(file.name)) {
    return parseSpreadsheet(await file.arrayBuffer());
  }
  return parseCsv(await file.text());
}

/**
 * Validate + normalize a site URL. Accepts full URLs (https://example.com)
 * or bare domains (example.com → https://example.com).
 * Returns the normalized URL, or null if invalid.
 */
export function normalizeUrl(raw: string): string | null {
  const t = (raw ?? "").trim();
  if (!t) return null;
  // Reject obvious non-URLs (spaces, no dot, etc.)
  if (/\s/.test(t)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    if (!/^(http|https):$/.test(u.protocol)) return null;
    if (!u.hostname.includes(".")) return null;
    if (/[^a-z0-9.:_-]/i.test(u.hostname)) return null;
    return u.href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const r of rows) lines.push(r.map(csvEscape).join(","));
  return lines.join("\r\n");
}
