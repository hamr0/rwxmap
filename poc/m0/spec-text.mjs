// Targeted OpenAPI-YAML text extractor for M0's text signal (PRD §4.5).
// This is not a YAML parser: it walks the file by indentation looking for
// a fixed set of keys (paths -> <path> -> <method> -> summary/description/
// callbacks/responses/requestBody), because a general parser is out of
// proportion to what five fields need.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseCsv } from './csv.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.join(HERE, '..', '..', 'data', 'camara-2026-09-01');
const SPECS_ROOT = path.join(DATA_ROOT, 'specs');
const OPERATIONS_CSV = path.join(DATA_ROOT, 'operations.csv');

function indentOf(line) {
  return line.length - line.trimStart().length;
}

// Parse one line into {indent, key, rest} where key is the (quote-stripped)
// YAML key if the line looks like "key: rest", or null for anything else
// (list items, block-scalar content, blank/comment lines are filtered by
// the caller before this is invoked defensively but this also returns
// null for comments/blanks).
function parseLine(line) {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('#')) return null;
  const indent = indentOf(line);
  let m = trimmed.match(/^(['"])(.*?)\1\s*:\s*(.*)$/);
  if (m) return { indent, key: m[2], rest: m[3] };
  m = trimmed.match(/^([^:#]+):\s*(.*)$/);
  if (m) return { indent, key: m[1].trim(), rest: m[2] };
  return { indent, key: null, rest: trimmed };
}

function stripQuotes(s) {
  const t = s.trim();
  if (t.length >= 2) {
    const a = t[0], b = t[t.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) return t.slice(1, -1);
  }
  return t;
}

// Find the deeper block that follows a key line: its child indent (the
// indent of the first non-blank/non-comment line after it) and the index
// just past the block (first line at or above the key's own indent).
function getBlock(lines, keyLineIdx) {
  const keyIndent = indentOf(lines[keyLineIdx]);
  let i = keyLineIdx + 1;
  let childIndent = null;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) { i++; continue; }
    const ind = indentOf(line);
    if (ind <= keyIndent) break;
    if (childIndent === null) childIndent = ind;
    i++;
  }
  return { start: keyLineIdx + 1, end: i, indent: childIndent };
}

function findKeyAtIndent(lines, start, end, indent, keyPred) {
  for (let i = start; i < end; i++) {
    const p = parseLine(lines[i]);
    if (!p || p.key === null) continue;
    if (p.indent !== indent) continue;
    if (keyPred(p.key)) return i;
  }
  return -1;
}

function findKeyAnyIndent(lines, start, end, keyPred) {
  for (let i = start; i < end; i++) {
    const p = parseLine(lines[i]);
    if (!p || p.key === null) continue;
    if (keyPred(p.key)) return i;
  }
  return -1;
}

function findTopLevelKey(lines, name) {
  for (let i = 0; i < lines.length; i++) {
    const p = parseLine(lines[i]);
    if (p && p.indent === 0 && p.key === name) return i;
  }
  return -1;
}

// Read a scalar value that starts at keyLineIdx ("key: rest"), handling
// both a plain (possibly multi-line) scalar and a block scalar (>, |, with
// optional +/- and digit indentation indicators). Block content is joined
// into a single space-separated string, collapsing whitespace runs.
function readScalar(lines, keyLineIdx, boundEnd) {
  const keyIndent = indentOf(lines[keyLineIdx]);
  const p = parseLine(lines[keyLineIdx]);
  const rest = (p.rest ?? '').trim();
  const isBlockIndicator = /^[>|][+-]?\d*$/.test(rest);
  const parts = [];
  if (rest && !isBlockIndicator) parts.push(stripQuotes(rest));

  let i = keyLineIdx + 1;
  while (i < boundEnd) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) { i++; continue; }
    const ind = indentOf(line);
    if (ind <= keyIndent) break;
    parts.push(trimmed);
    i++;
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function findRefLine(lines, start, end) {
  return findKeyAnyIndent(lines, start, end, (k) => k === '$ref');
}

function extractSchemaName(line) {
  const m = line.match(/#\/components\/schemas\/([A-Za-z0-9_]+)/);
  return m ? m[1] : null;
}

function resolveSchemaHasSink(lines, schemaName) {
  const componentsIdx = findTopLevelKey(lines, 'components');
  if (componentsIdx === -1) return false;
  const componentsBlock = getBlock(lines, componentsIdx);
  if (componentsBlock.indent === null) return false;

  const schemasIdx = findKeyAtIndent(
    lines, componentsBlock.start, componentsBlock.end, componentsBlock.indent,
    (k) => k === 'schemas'
  );
  if (schemasIdx === -1) return false;
  const schemasBlock = getBlock(lines, schemasIdx);
  if (schemasBlock.indent === null) return false;

  const schemaIdx = findKeyAtIndent(
    lines, schemasBlock.start, schemasBlock.end, schemasBlock.indent,
    (k) => k === schemaName
  );
  if (schemaIdx === -1) return false;
  const schemaBlock = getBlock(lines, schemaIdx);
  if (schemaBlock.indent === null) return false;

  return findKeyAnyIndent(lines, schemaBlock.start, schemaBlock.end, (k) => k === 'sink') !== -1;
}

/**
 * Pull the text signal out of one operation in an OpenAPI 3 YAML spec.
 * @param {string} specPath absolute or relative path to the spec YAML file
 * @param {string} targetPath the OpenAPI path key, e.g. "/sessions/{id}"
 * @param {string} method HTTP method, any case
 * @returns {{summary: string, description: string, hasCallbacks: boolean, has409: boolean, hasSink: boolean, opBlockText: string, infoDescription: string, fileText: string}}
 */
export function extractText(specPath, targetPath, method) {
  const raw = readFileSync(specPath, 'utf8').replace(/\r\n/g, '\n');
  const lines = raw.split('\n');

  const pathsIdx = findTopLevelKey(lines, 'paths');
  if (pathsIdx === -1) throw new Error(`paths: not found in ${specPath}`);
  const pathsBlock = getBlock(lines, pathsIdx);
  if (pathsBlock.indent === null) throw new Error(`empty paths: block in ${specPath}`);

  const pathLineIdx = findKeyAtIndent(
    lines, pathsBlock.start, pathsBlock.end, pathsBlock.indent,
    (k) => k === targetPath
  );
  if (pathLineIdx === -1) throw new Error(`path ${targetPath} not found in ${specPath}`);
  const pathBlock = getBlock(lines, pathLineIdx);
  if (pathBlock.indent === null) throw new Error(`empty block for path ${targetPath} in ${specPath}`);

  const methodLower = String(method).toLowerCase();
  const methodLineIdx = findKeyAtIndent(
    lines, pathBlock.start, pathBlock.end, pathBlock.indent,
    (k) => k.toLowerCase() === methodLower
  );
  if (methodLineIdx === -1) throw new Error(`method ${method} not found for ${targetPath} in ${specPath}`);
  const opBlock = getBlock(lines, methodLineIdx);
  if (opBlock.indent === null) throw new Error(`empty operation block for ${method} ${targetPath} in ${specPath}`);

  let summary = '';
  const summaryIdx = findKeyAtIndent(lines, opBlock.start, opBlock.end, opBlock.indent, (k) => k === 'summary');
  if (summaryIdx !== -1) summary = readScalar(lines, summaryIdx, opBlock.end);

  let description = '';
  const descIdx = findKeyAtIndent(lines, opBlock.start, opBlock.end, opBlock.indent, (k) => k === 'description');
  if (descIdx !== -1) description = readScalar(lines, descIdx, opBlock.end);

  const hasCallbacks = findKeyAtIndent(
    lines, opBlock.start, opBlock.end, opBlock.indent, (k) => k === 'callbacks'
  ) !== -1;

  let has409 = false;
  const responsesIdx = findKeyAtIndent(
    lines, opBlock.start, opBlock.end, opBlock.indent, (k) => k === 'responses'
  );
  if (responsesIdx !== -1) {
    const responsesBlock = getBlock(lines, responsesIdx);
    if (responsesBlock.indent !== null) {
      has409 = findKeyAtIndent(
        lines, responsesBlock.start, responsesBlock.end, responsesBlock.indent,
        (k) => k === '409'
      ) !== -1;
    }
  }

  let hasSink = findKeyAnyIndent(lines, opBlock.start, opBlock.end, (k) => k === 'sink') !== -1;
  if (!hasSink) {
    const rbIdx = findKeyAtIndent(
      lines, opBlock.start, opBlock.end, opBlock.indent, (k) => k === 'requestBody'
    );
    if (rbIdx !== -1) {
      const rbBlock = getBlock(lines, rbIdx);
      if (rbBlock.indent !== null) {
        const refLineIdx = findRefLine(lines, rbBlock.start, rbBlock.end);
        if (refLineIdx !== -1) {
          const p = parseLine(lines[refLineIdx]);
          const schemaName = extractSchemaName(p.rest ?? '');
          if (schemaName) hasSink = resolveSchemaHasSink(lines, schemaName);
        }
      }
    }
  }

  const opBlockText = lines.slice(methodLineIdx, opBlock.end).join('\n');

  let infoDescription = '';
  const infoIdx = findTopLevelKey(lines, 'info');
  if (infoIdx !== -1) {
    const infoBlock = getBlock(lines, infoIdx);
    if (infoBlock.indent !== null) {
      const infoDescIdx = findKeyAtIndent(
        lines, infoBlock.start, infoBlock.end, infoBlock.indent, (k) => k === 'description'
      );
      if (infoDescIdx !== -1) infoDescription = readScalar(lines, infoDescIdx, infoBlock.end);
    }
  }

  const fileText = raw;

  return { summary, description, hasCallbacks, has409, hasSink, opBlockText, infoDescription, fileText };
}

/**
 * Load operations.csv and attach the text signal to every row.
 * @returns {Array<Record<string, unknown>>}
 */
export function loadOps() {
  const text = readFileSync(OPERATIONS_CSV, 'utf8');
  const rows = parseCsv(text);
  return rows.map((row) => {
    const specPath = path.join(SPECS_ROOT, row.repo, row.file);
    const extracted = extractText(specPath, row.path, row.method);
    return { ...row, ...extracted };
  });
}
