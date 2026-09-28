// Item (a) — parse the public-apis/public-apis README's category tables.
//
// The README has two table shapes: a 3-column "Best sellers" promo table
// (API | Description | Call this API) near the top, and the real listing,
// dozens of 5-column tables under `### <Category>` headings (API |
// Description | Auth | HTTPS | CORS), each preceded by its own header row
// and markdown separator row. Only the 5-column category tables carry
// auth/https/cors, so only those are parsed; the promo table is skipped.
//
// A row looks like:
//   | [Name](https://example.com) | Some description | No | Yes | Yes |
// with an optional leading/trailing `|` and auth sometimes wrapped in
// backticks (`` `apiKey` ``) instead of being a plain word.

const ROW_RE = /^\|?\s*\[([^\]]*)\]\(([^)]*)\)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|?\s*$/;

/**
 * Parse every 5-column category-table row in the README text.
 * @param {string} text
 * @returns {Array<{name: string, description: string, auth: string, https: string, cors: string, link: string, category: string}>}
 */
export function parseEntries(text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  let category = null;
  let inCategoryTable = false;

  for (const line of lines) {
    const headingMatch = /^###\s+(.+)$/.exec(line);
    if (headingMatch) {
      category = headingMatch[1].trim();
      inCategoryTable = false;
      continue;
    }

    // The header row of a category table: "API | Description | Auth | HTTPS | CORS"
    // (with or without a leading pipe/space).
    if (/^\|?\s*API\s*\|\s*Description\s*\|\s*Auth\s*\|\s*HTTPS\s*\|\s*CORS\s*\|?\s*$/.test(line)) {
      inCategoryTable = true;
      continue;
    }
    // The separator row right after the header: |:---|:---|:---|:---|:---|
    if (inCategoryTable && /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line)) {
      continue;
    }
    if (!inCategoryTable) continue;
    if (!line.trim().startsWith('|') && !line.trim().startsWith('[')) {
      // Blank line or prose ends the table (category tables are contiguous).
      if (line.trim() === '') continue;
      inCategoryTable = false;
      continue;
    }

    const m = ROW_RE.exec(line);
    if (!m) continue;
    const [, name, link, description, auth, https, cors] = m;
    entries.push({
      name: name.trim(),
      link: link.trim(),
      description: description.trim(),
      auth: auth.trim().replace(/`/g, ''),
      https: https.trim(),
      cors: cors.trim(),
      category,
    });
  }

  return entries;
}
