import type { ParsedProperty } from '../types.js';

export function parsePythonDict(raw: string): ParsedProperty {
  if (!raw || typeof raw !== 'string') return {};
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return {};
  if (trimmed === '{}') return {};

  try {
    let json = trimmed;
    json = json.replace(/\bTrue\b/g, 'true');
    json = json.replace(/\bFalse\b/g, 'false');
    json = json.replace(/\bNone\b/g, 'null');
    json = replaceSingleQuotes(json);
    return JSON.parse(json);
  } catch {
    return regexParse(trimmed);
  }
}

function replaceSingleQuotes(s: string): string {
  const result: string[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === "'") {
      result.push('"');
      i++;
      while (i < s.length && s[i] !== "'") {
        if (s[i] === '\\' && i + 1 < s.length && s[i + 1] === "'") {
          result.push("'");
          i += 2;
        } else if (s[i] === '"') {
          result.push('\\"');
          i++;
        } else {
          result.push(s[i]);
          i++;
        }
      }
      result.push('"');
      i++;
    } else {
      result.push(s[i]);
      i++;
    }
  }
  return result.join('');
}

function regexParse(raw: string): ParsedProperty {
  const result: ParsedProperty = {};
  const pairRegex = /['"](\w+)['"]\s*:\s*(?:'([^']*)'|"([^"]*)"|(\d+\.?\d*)|(\btrue\b|\bfalse\b|\bnull\b|\bTrue\b|\bFalse\b|\bNone\b)|(\{[^}]*\}))/gi;
  let match;
  while ((match = pairRegex.exec(raw)) !== null) {
    const key = match[1];
    if (match[2] !== undefined) result[key] = match[2];
    else if (match[3] !== undefined) result[key] = match[3];
    else if (match[4] !== undefined) result[key] = parseFloat(match[4]);
    else if (match[5] !== undefined) {
      const v = match[5].toLowerCase();
      if (v === 'true') result[key] = true;
      else if (v === 'false') result[key] = false;
      else result[key] = null;
    } else if (match[6] !== undefined) {
      try { result[key] = parsePythonDict(match[6]); }
      catch { result[key] = match[6]; }
    }
  }
  return result;
}

export function extractScreen(raw: string): string {
  const parsed = parsePythonDict(raw);
  return (parsed.screen_name as string) ?? 'unknown';
}

export function extractAllProperties(raw: string): ParsedProperty {
  return parsePythonDict(raw);
}
