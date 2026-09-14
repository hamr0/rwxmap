// A minimal, self-contained YAML subset parser for OpenAPI 3 documents.
// Vanilla Node, zero deps. Not a full YAML 1.1/1.2 implementation: it
// supports what OpenAPI YAML files actually use — block mappings, block
// sequences, plain/quoted scalars, literal (|) and folded (>) block
// scalars with chomping indicators, single-line flow sequences/mappings,
// anchors (&x) and aliases (*x), and comments. Multi-document files use
// only the first document.

function stripComment(line) {
  // Remove a trailing " # comment" that is not inside a quoted string.
  let inSingle = false, inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inSingle) { if (c === "'") inSingle = false; continue; }
    if (inDouble) { if (c === '"' && line[i - 1] !== '\\') inDouble = false; continue; }
    if (c === "'") { inSingle = true; continue; }
    if (c === '"') { inDouble = true; continue; }
    if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i).replace(/\s+$/, '');
    }
  }
  return line;
}

function indentOf(line) {
  let n = 0;
  while (n < line.length && line[n] === ' ') n++;
  return n;
}

function stripQuotes(s) {
  const t = s.trim();
  if (t.length >= 2) {
    if (t[0] === '"' && t[t.length - 1] === '"') {
      try { return JSON.parse(t); } catch { /* fall through */ }
      return t.slice(1, -1).replace(/\\"/g, '"');
    }
    if (t[0] === "'" && t[t.length - 1] === "'") {
      return t.slice(1, -1).replace(/''/g, "'");
    }
  }
  return t;
}

function isNullScalar(s) {
  return s === '' || s === '~' || s === 'null' || s === 'Null' || s === 'NULL';
}

function coerceScalar(raw) {
  const s = raw.trim();
  if (isNullScalar(s)) return null;
  if (s[0] === '"' || s[0] === "'") return stripQuotes(s);
  if (s === 'true' || s === 'True' || s === 'TRUE') return true;
  if (s === 'false' || s === 'False' || s === 'FALSE') return false;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d*\.\d+$/.test(s)) return parseFloat(s);
  return stripQuotes(s);
}

// --- flow style (single logical "line" after joining continuation lines) ---
function parseFlow(text, pos) {
  while (text[pos] === ' ') pos++;
  const c = text[pos];
  if (c === '[') return parseFlowSeq(text, pos);
  if (c === '{') return parseFlowMap(text, pos);
  if (c === '"' || c === "'") return parseFlowScalarQuoted(text, pos);
  return parseFlowScalarPlain(text, pos);
}

function parseFlowScalarQuoted(text, pos) {
  const q = text[pos];
  let i = pos + 1;
  let out = '';
  while (i < text.length) {
    if (q === '"' && text[i] === '\\') { out += text[i + 1]; i += 2; continue; }
    if (text[i] === q) {
      if (q === "'" && text[i + 1] === "'") { out += "'"; i += 2; continue; }
      i++;
      break;
    }
    out += text[i];
    i++;
  }
  return [out, i];
}

function parseFlowScalarPlain(text, pos) {
  let i = pos;
  while (i < text.length) {
    const c = text[i];
    if (c === ',' || c === ']' || c === '}') break;
    // A colon only terminates a plain scalar in flow context when it is a
    // flow-mapping key separator (followed by space/EOF/,]}); a colon
    // embedded in the scalar itself (e.g. an OAuth2 scope string like
    // "resource:read") is not a separator.
    if (c === ':' && (i + 1 >= text.length || /[\s,\]}]/.test(text[i + 1]))) break;
    i++;
  }
  return [coerceScalar(text.slice(pos, i).trimEnd()), i];
}

function parseFlowSeq(text, pos) {
  let i = pos + 1;
  const arr = [];
  while (true) {
    while (text[i] === ' ') i++;
    if (text[i] === ']') { i++; break; }
    if (text[i] === undefined) break;
    const before = i;
    let val;
    [val, i] = parseFlowEntry(text, i);
    arr.push(val);
    while (text[i] === ' ') i++;
    if (text[i] === ',') { i++; continue; }
    if (i === before) { i++; } // safety: never stall
  }
  return [arr, i];
}

function parseFlowEntry(text, pos) {
  // Could be "key: value" inside a flow seq (rare) or a plain value.
  const [v, next] = parseFlow(text, pos);
  return [v, next];
}

function parseFlowMap(text, pos) {
  let i = pos + 1;
  const obj = {};
  while (true) {
    while (text[i] === ' ') i++;
    if (text[i] === '}') { i++; break; }
    if (text[i] === undefined) break;
    const before = i;
    let key;
    [key, i] = parseFlow(text, i);
    while (text[i] === ' ') i++;
    let val = null;
    if (text[i] === ':') {
      i++;
      while (text[i] === ' ') i++;
      [val, i] = parseFlow(text, i);
    }
    obj[String(key)] = val;
    while (text[i] === ' ') i++;
    if (text[i] === ',') { i++; continue; }
    if (i === before) { i++; } // safety: never stall
  }
  return [obj, i];
}

function parseFlowTop(rawRest) {
  const [val] = parseFlow(rawRest, 0);
  return val;
}

// --- block style ---

export function parseYaml(text) {
  const raw = text.replace(/\r\n/g, '\n');
  let body = raw;
  // Only take the first document if the file has multiple.
  const docSep = body.indexOf('\n---');
  const rawLines = body.split('\n');

  const lines = [];
  for (const l of rawLines) {
    if (/^---(\s|$)/.test(l)) { if (lines.length > 0) break; else continue; }
    if (/^\.\.\.(\s|$)/.test(l)) break;
    lines.push(l);
  }

  const anchors = Object.create(null);
  const state = { lines, anchors };

  // Skip leading blank/comment lines.
  let i = 0;
  while (i < lines.length && isBlankOrComment(lines[i])) i++;
  if (i >= lines.length) return null;
  const rootIndent = indentOf(lines[i]);
  const [val] = parseNode(state, i, rootIndent);
  return val;
}

function isBlankOrComment(line) {
  const s = stripComment(line).trim();
  return s === '';
}

function nextContentLine(state, i) {
  while (i < state.lines.length && isBlankOrComment(state.lines[i])) i++;
  return i;
}

// Parses a node (mapping, sequence, or scalar) starting at line i, whose
// own indent is expected to be === indent. Returns [value, nextLineIndex].
function parseNode(state, i, indent) {
  i = nextContentLine(state, i);
  if (i >= state.lines.length) return [null, i];
  const line = stripComment(state.lines[i]);
  const ind = indentOf(line);
  if (ind !== indent) return [null, i];
  const trimmed = line.slice(ind);
  if (trimmed === '-' || trimmed.startsWith('- ') || trimmed.startsWith('-\t')) {
    return parseSequence(state, i, indent);
  }
  return parseMapping(state, i, indent);
}

function splitAnchorTag(rest) {
  // Handle leading "&anchor " and/or "!!tag " prefixes on a value.
  let anchor = null;
  let r = rest;
  let m = r.match(/^&(\S+)\s*/);
  if (m) { anchor = m[1]; r = r.slice(m[0].length); }
  m = r.match(/^!\S*\s*/);
  if (m) { r = r.slice(m[0].length); }
  m = r.match(/^&(\S+)\s*/);
  if (m && !anchor) { anchor = m[1]; r = r.slice(m[0].length); }
  return { anchor, rest: r };
}

function parseSequence(state, i, indent) {
  const arr = [];
  while (true) {
    i = nextContentLine(state, i);
    if (i >= state.lines.length) break;
    const line = stripComment(state.lines[i]);
    const ind = indentOf(line);
    if (ind !== indent) break;
    const trimmed = line.slice(ind);
    if (!(trimmed === '-' || trimmed.startsWith('- ') || trimmed.startsWith('-\t'))) break;
    let rest = trimmed === '-' ? '' : trimmed.slice(2);
    const dashCol = indent + 2;
    rest = rest.replace(/^\s+/, (m) => m); // keep, column math below uses dashCol as fallback
    const contentCol = trimmed === '-' ? null : dashCol + (trimmed.slice(2).match(/^\s*/)[0].length - 0);
    // Recompute actual content column precisely: position in original line.
    let col = ind + 1; // position right after '-'
    while (line[col] === ' ') col++;
    const valueText = line.slice(col);

    if (valueText.trim() === '') {
      // Value is a nested block on following lines.
      let j = nextContentLine(state, i + 1);
      if (j >= state.lines.length) { arr.push(null); i = j; continue; }
      const childIndent = indentOf(stripComment(state.lines[j]));
      if (childIndent <= indent) { arr.push(null); i = i + 1; continue; }
      const [val, next] = parseNode(state, j, childIndent);
      arr.push(val);
      i = next;
      continue;
    }

    // Inline content after "- ". Could be "key: value" (mapping item) or scalar.
    const { anchor, rest: rest2 } = splitAnchorTag(valueText);
    const kv = matchMappingKey(rest2);
    if (kv) {
      // This sequence item is an inline mapping starting at column `col`.
      const [obj, next] = parseMappingFromInline(state, i, col, kv);
      if (anchor) state.anchors[anchor] = obj;
      arr.push(obj);
      i = next;
      continue;
    }
    const [scalar, next] = parseScalarValue(state, i, col, rest2);
    if (anchor) state.anchors[anchor] = scalar;
    arr.push(scalar);
    i = next;
  }
  return [arr, i];
}

// Matches "key: rest" (key possibly quoted) at the start of a string,
// distinguishing from a plain scalar. Returns {key, rest} or null.
function matchMappingKey(s) {
  if (s.startsWith('*')) return null; // alias, not a mapping
  let m = s.match(/^(['"])(.*?)\1\s*:(\s|$)(.*)$/);
  if (m) return { key: m[2], rest: m[4] };
  m = s.match(/^([^:#\[\]{}][^:]*?):(\s|$)(.*)$/);
  if (m) return { key: m[1].trim(), rest: m[3] };
  // "key:" with nothing after and key unquoted, no spaces issues
  m = s.match(/^([^\s:][^:]*):$/);
  if (m) return { key: m[1].trim(), rest: '' };
  return null;
}

function parseMappingFromInline(state, i, col, firstKv) {
  const obj = {};
  const firstLast = assignKv(state, obj, firstKv.key, firstKv.rest, col, i);
  let j = firstLast + 1;
  while (true) {
    j = nextContentLine(state, j);
    if (j >= state.lines.length) break;
    const line = stripComment(state.lines[j]);
    const ind = indentOf(line);
    if (ind !== col) break;
    const trimmed = line.slice(ind);
    if (trimmed.startsWith('- ') || trimmed === '-') break;
    const kv = matchMappingKey(trimmed);
    if (!kv) break;
    j = assignKv(state, obj, kv.key, kv.rest, col, j);
    j = j + 1;
  }
  return [obj, j];
}

function parseMapping(state, i, indent) {
  const obj = {};
  let j = i;
  while (true) {
    j = nextContentLine(state, j);
    if (j >= state.lines.length) break;
    const line = stripComment(state.lines[j]);
    const ind = indentOf(line);
    if (ind !== indent) break;
    const trimmed = line.slice(ind);
    if (trimmed.startsWith('- ') || trimmed === '-') break; // shouldn't happen at mapping level
    const kv = matchMappingKey(trimmed);
    if (!kv) break;
    j = assignKv(state, obj, kv.key, kv.rest, indent, j);
    j = j + 1;
  }
  return [obj, j];
}

// Assigns obj[key] from the "rest" text following "key:" on line at index j
// (whose key started at column `indent`). Returns the line index of the
// LAST line consumed (caller does j+1 to move past it), except for nested
// blocks where it returns the index of the last consumed line too.
function assignKv(state, obj, key, rest, indent, j) {
  const keyName = key;
  let r = rest;
  const { anchor, rest: r2 } = splitAnchorTag(r);
  r = r2;

  if (r.trim() === '') {
    // Nested block, alias-only, or null.
    let k = nextContentLine(state, j + 1);
    if (k < state.lines.length) {
      const childLine = stripComment(state.lines[k]);
      const childIndent = indentOf(childLine);
      if (childIndent > indent) {
        const childTrimmed = childLine.slice(childIndent);
        const looksLikeSeq = childTrimmed === '-' || childTrimmed.startsWith('- ') || childTrimmed.startsWith('-\t');
        const looksLikeKey = !looksLikeSeq && matchMappingKey(childTrimmed) !== null;
        if (looksLikeSeq || looksLikeKey) {
          const [val, next] = parseNode(state, k, childIndent);
          obj[keyName] = val;
          if (anchor) state.anchors[anchor] = val;
          return next - 1;
        }
        // Not a block start: this is a plain scalar whose text begins on
        // the line after "key:" (YAML allows the value to start indented
        // on the next line), possibly folding across further lines.
        const [val, next] = parseScalarValue(state, k, indent, childTrimmed);
        obj[keyName] = val;
        if (anchor) state.anchors[anchor] = val;
        return next - 1;
      }
    }
    obj[keyName] = null;
    if (anchor) state.anchors[anchor] = null;
    return j;
  }

  const [val, next] = parseScalarValue(state, j, indent, r);
  obj[keyName] = val;
  if (anchor) state.anchors[anchor] = val;
  return next - 1;
}

// Parses the value portion after "key:" or "- " when it starts on the
// same line as `rest` (non-empty, trimmed check done by caller).
// `col` is the column the key/dash started at (used to bound block scalars
// and to detect flow-continuation isn't needed since we only support
// single-line flow). Returns [value, nextLineIndexAfterConsumed].
function parseScalarValue(state, j, col, rest) {
  const t = rest.trim();
  if (t === '') return [null, j + 1];
  if (t === '*' || t.startsWith('*')) {
    // alias
    const m = t.match(/^\*(\S+)/);
    if (m && Object.prototype.hasOwnProperty.call(state.anchors, m[1])) {
      return [state.anchors[m[1]], j + 1];
    }
    return [null, j + 1];
  }
  if (t[0] === '|' || t[0] === '>') {
    return parseBlockScalar(state, j, col, t);
  }
  if (t[0] === '[' || t[0] === '{') {
    // Flow style; join continuation lines until brackets balance.
    let combined = t;
    let k = j;
    while (!bracketsBalanced(combined) && k + 1 < state.lines.length) {
      k++;
      combined += ' ' + stripComment(state.lines[k]).trim();
    }
    return [parseFlowTop(combined), k + 1];
  }
  // Plain or quoted scalar that may fold onto following more-indented
  // lines (YAML plain/quoted scalars continue until a line at or below
  // the key's own column). Fold: blank line -> paragraph break, regular
  // line -> joined with a single space.
  const quoted = t[0] === '"' || t[0] === "'";
  let combined = t;
  let k = j;
  // A quoted scalar whose closing quote hasn't appeared yet must continue
  // regardless of indent (rare in these specs, but handle it).
  const unterminatedQuoted = quoted && !isClosedQuoted(t);
  while (k + 1 < state.lines.length) {
    const peek = stripComment(state.lines[k + 1]);
    const peekTrimmed = peek.trim();
    if (peekTrimmed === '') {
      if (unterminatedQuoted) { k++; combined += '\n'; continue; }
      const after = nextContentLine(state, k + 2);
      if (after < state.lines.length && indentOf(stripComment(state.lines[after])) > col) {
        k = k + 1; combined += '\x00PARA\x00'; continue;
      }
      break;
    }
    const peekIndent = indentOf(peek);
    if (!unterminatedQuoted && peekIndent <= col) break;
    if (!unterminatedQuoted && (peekTrimmed === '-' || peekTrimmed.startsWith('- '))) break;
    k++;
    combined += (combined.endsWith('\x00PARA\x00') ? '' : ' ') + peekTrimmed;
    if (unterminatedQuoted && isClosedQuoted(combined)) break;
  }
  combined = combined.split('\x00PARA\x00').join('\n');
  return [coerceScalar(combined), k + 1];
}

function isClosedQuoted(s) {
  const q = s[0];
  if (s.length < 2) return false;
  if (q === '"') {
    // crude: count unescaped quotes
    let count = 0;
    for (let i = 1; i < s.length; i++) {
      if (s[i] === '\\') { i++; continue; }
      if (s[i] === '"') { count++; }
    }
    return count >= 1 && s[s.length - 1] === '"';
  }
  if (q === "'") {
    return s.length >= 2 && s[s.length - 1] === "'" && !(s.endsWith("''"));
  }
  return true;
}

function bracketsBalanced(s) {
  let depth = 0, inS = false, inD = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inS) { if (c === "'") inS = false; continue; }
    if (inD) { if (c === '"' && s[i - 1] !== '\\') inD = false; continue; }
    if (c === "'") inS = true;
    else if (c === '"') inD = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') depth--;
  }
  return depth <= 0;
}

function parseBlockScalar(state, j, col, indicator) {
  const style = indicator[0]; // '|' or '>'
  const m = indicator.slice(1).match(/^([+-]?)(\d*)/);
  const chomp = m ? m[1] : '';
  const lines = [];
  let k = j + 1;
  let blockIndent = null;
  while (k < state.lines.length) {
    const raw = state.lines[k];
    if (raw.trim() === '') { lines.push(''); k++; continue; }
    const ind = indentOf(raw);
    if (ind <= col) break;
    if (blockIndent === null) blockIndent = ind;
    lines.push(raw.slice(blockIndent));
    k++;
  }
  // Trim trailing blank lines recorded, chomping decides newline handling.
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  let text;
  if (style === '|') {
    text = lines.join('\n');
  } else {
    // Folded: blank lines become newlines, others join with space.
    const parts = [];
    let para = [];
    for (const l of lines) {
      if (l === '') { parts.push(para.join(' ')); para = []; parts.push(''); }
      else para.push(l);
    }
    parts.push(para.join(' '));
    text = parts.filter((p, idx) => !(p === '' && idx === parts.length - 1)).join('\n');
  }
  if (chomp === '-') { /* strip: no trailing newline */ }
  else if (chomp === '+') { text += '\n'; }
  else { /* clip: single trailing newline conventionally; skip for our purposes */ }
  return [text, k];
}
