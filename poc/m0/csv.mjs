// A tiny RFC-4180-enough CSV reader/writer.
// Handles: quoted fields, commas inside quotes, doubled quotes ("" -> "),
// and newlines inside quoted fields. Not a full RFC 4180 implementation
// (no configurable delimiter, no BOM handling) — just enough for this
// project's own CSVs.

/**
 * Parse CSV text into an array of row objects keyed by the header row.
 * @param {string} text
 * @returns {Array<Record<string, string>>}
 */
export function parseCsv(text) {
  const rows = parseRows(text);
  if (rows.length === 0) return [];
  const header = rows[0];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Skip a trailing blank line produced by a final newline in the file.
    if (row.length === 1 && row[0] === '') continue;
    const obj = {};
    for (let c = 0; c < header.length; c++) {
      obj[header[c]] = row[c] ?? '';
    }
    out.push(obj);
  }
  return out;
}

// Parse raw CSV text into an array of rows, each an array of field strings.
function parseRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Flush the last field/row if the text didn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function needsQuoting(value) {
  return /[",\r\n]/.test(value);
}

function quoteField(value) {
  const s = String(value ?? '');
  if (!needsQuoting(s)) return s;
  return '"' + s.replace(/"/g, '""') + '"';
}

/**
 * Serialize an array of row objects into CSV text using the given header
 * (column order). Missing fields in a row are written as empty strings.
 * @param {Array<Record<string, unknown>>} rows
 * @param {string[]} header
 * @returns {string}
 */
export function toCsv(rows, header) {
  const lines = [header.map(quoteField).join(',')];
  for (const row of rows) {
    lines.push(header.map((h) => quoteField(row[h])).join(','));
  }
  return lines.join('\n') + '\n';
}
