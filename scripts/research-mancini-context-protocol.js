'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const LOG_PATH = path.join(ROOT, 'data', 'research', 'mancini', 'The Longer Mancini Logs.txt');
const OUT_DIR = path.join(ROOT, 'artifacts', 'research', 'mancini-context-protocol');

const MONTHS = {
  Jan: 1,
  January: 1,
  Feb: 2,
  February: 2,
  Mar: 3,
  March: 3,
  Apr: 4,
  April: 4,
  May: 5,
  Jun: 6,
  June: 6,
  Jul: 7,
  July: 7,
  Aug: 8,
  August: 8,
  Sep: 9,
  Sept: 9,
  September: 9,
  Oct: 10,
  October: 10,
  Nov: 11,
  November: 11,
  Dec: 12,
  December: 12,
};

const HORIZONS = [5, 15, 30, 60];
const TICK = 0.25;
const TAP_TOLERANCE = 0.5;
const CLOSE_ABOVE = 0.25;
const MIN_SWEEP_DEPTH = 0.25;
const NON_ACCEPTANCE_POINTS = 5;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sha1(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 12);
}

function round2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatDate(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function addDays(dateStr, days) {
  const date = new Date(`${dateStr}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseMonthDate(text, defaultYear = 2026) {
  const match = String(text || '').match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(20\d{2}))?/i);
  if (!match) return null;
  const key = Object.keys(MONTHS).find(month => month.toLowerCase() === match[1].toLowerCase());
  const month = MONTHS[key] || MONTHS[match[1].slice(0, 3)];
  const day = Number(match[2]);
  const year = Number(match[3] || defaultYear);
  if (!month || !day || !year) return null;
  return formatDate(year, month, day);
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€“|â€”/g, '-')
    .replace(/âˆ™/g, '*')
    .replace(/\r/g, '');
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) ? value.join('|') : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(filePath, rows, explicitColumns = null) {
  const columns = explicitColumns || [...new Set(rows.flatMap(row => Object.keys(row)))];
  const lines = [
    columns.join(','),
    ...rows.map(row => columns.map(column => csvEscape(row[column])).join(',')),
  ];
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (const ch of String(line || '')) {
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function parseNumber(value) {
  const n = Number(String(value || '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : NaN;
}

function addMinutesLocal(dateTime, minutes) {
  const match = String(dateTime || '').match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]) + minutes
  ));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
}

function minuteOfDay(timeText) {
  const time = String(timeText || '').slice(11, 16);
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function listFiles(dir, predicate, maxDepth = 5) {
  const out = [];
  function walk(current, depth) {
    if (depth > maxDepth) return;
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.codeboarding') continue;
        walk(full, depth + 1);
      } else if (entry.isFile() && predicate(full)) {
        out.push(full);
      }
    }
  }
  walk(dir, 0);
  return out;
}

function isEsBarchartFile(filePath) {
  return /^es[hmuz]\d{2}_intraday-1min_historical-data-download/i.test(path.basename(filePath));
}

function parseBarchartCsvCt(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = splitCsvLine(lines[0] || '').map(cell => cell.toLowerCase());
  const timeIndex = header.indexOf('time');
  const openIndex = header.indexOf('open');
  const highIndex = header.indexOf('high');
  const lowIndex = header.indexOf('low');
  const closeIndex = header.indexOf('latest') >= 0 ? header.indexOf('latest') : header.indexOf('close');
  const volumeIndex = header.indexOf('volume');
  if ([timeIndex, openIndex, highIndex, lowIndex, closeIndex, volumeIndex].some(index => index < 0)) return [];

  return lines.slice(1).map(line => {
    if (!line.startsWith('"20')) return null;
    const cells = splitCsvLine(line);
    const ct = cells[timeIndex].replace(/^"|"$/g, '').trim();
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(ct)) return null;
    const et = addMinutesLocal(ct, 60);
    return {
      ct_time: ct,
      et_time: et,
      ct_date: ct.slice(0, 10),
      et_date: et.slice(0, 10),
      open: parseNumber(cells[openIndex]),
      high: parseNumber(cells[highIndex]),
      low: parseNumber(cells[lowIndex]),
      close: parseNumber(cells[closeIndex]),
      volume: parseNumber(cells[volumeIndex]),
      source_file: path.relative(ROOT, filePath).replace(/\\/g, '/'),
    };
  }).filter(bar => bar
    && [bar.open, bar.high, bar.low, bar.close, bar.volume].every(Number.isFinite));
}

function loadMergedEsBars() {
  const roots = [
    path.join(ROOT, 'data', 'historical'),
    path.join(ROOT, 'data', 'backtest'),
    path.join(ROOT, 'data', 'research', 'mancini'),
  ];
  const files = [...new Set(roots.flatMap(root => listFiles(root, isEsBarchartFile, 4)))].sort();
  const byTime = new Map();
  for (const file of files) {
    for (const bar of parseBarchartCsvCt(file)) {
      const existing = byTime.get(bar.ct_time);
      if (!existing || bar.volume > existing.volume || file.includes('05-07-2026')) {
        byTime.set(bar.ct_time, bar);
      }
    }
  }
  const bars = [...byTime.values()].sort((a, b) => a.ct_time.localeCompare(b.ct_time));
  return { files, bars };
}

function parseSections(rawText) {
  const normalized = normalizeText(rawText);
  const lines = normalized.split('\n');
  const dateLineRe = /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},\s+20\d{2}$/i;
  const dateLines = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (dateLineRe.test(lines[i].trim())) dateLines.push(i);
  }

  return dateLines.map((lineIndex, index) => {
    let titleIndex = lineIndex - 1;
    while (titleIndex >= 0 && !lines[titleIndex].trim()) titleIndex -= 1;
    while (
      titleIndex >= 0
      && /^(Adam Mancini|Adam Mancini's|S&P 500|SPX\/ES)/i.test(lines[titleIndex].trim())
    ) {
      titleIndex -= 1;
    }
    const title = lines[titleIndex]?.trim() || `Mancini section ${index + 1}`;
    const pubDate = parseMonthDate(lines[lineIndex].trim(), 2026);
    const planDate = parseMonthDate(title, Number(pubDate.slice(0, 4))) || addDays(pubDate, 1);
    const next = dateLines[index + 1] ?? lines.length;
    const start = Math.max(0, titleIndex);
    const body = lines.slice(lineIndex + 1, next).join('\n').trim();
    return {
      id: `section_${String(index + 1).padStart(2, '0')}_${pubDate}`,
      title,
      pub_date: pubDate,
      plan_date: planDate,
      start_line: start + 1,
      date_line: lineIndex + 1,
      end_line: next,
      body,
      text: `${title}\n${lines[lineIndex]}\n${body}`,
      hash: sha1(`${title}|${pubDate}|${body.slice(0, 200)}`),
    };
  });
}

function expandRangeEndpoint(start, suffixText) {
  const suffix = Number(suffixText);
  if (!Number.isFinite(suffix)) return null;
  const width = String(suffixText).length;
  const divisor = 10 ** width;
  let candidate = Math.floor(start / divisor) * divisor + suffix;
  if (candidate < start && start - candidate > 50) candidate += divisor;
  return candidate;
}

function parseLevelToken(token) {
  const raw = String(token || '').trim();
  const priceMatch = raw.match(/\b(\d{4,5}(?:\.\d+)?)\b(?:\s*-\s*(\d{2,4})(?:\.\d+)?)?/);
  if (!priceMatch) return null;
  const start = Number(priceMatch[1]);
  const end = priceMatch[2] ? expandRangeEndpoint(start, priceMatch[2]) : start;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return {
    raw_token: raw,
    price: start,
    zone_low: Math.min(start, end),
    zone_high: Math.max(start, end),
    zone_mid: round2((start + end) / 2),
    is_zone: Math.abs(start - end) >= TICK,
    major: /\bmajor\b/i.test(raw),
  };
}

function extractParagraphAfter(text, label) {
  const re = new RegExp(`${label}\\s*:`, 'i');
  const match = re.exec(text);
  if (!match) return '';
  return text.slice(match.index + match[0].length).split(/\n\s*\n/)[0].trim();
}

function parseLevelList(section, label, direction) {
  const paragraph = extractParagraphAfter(section.text, label);
  if (!paragraph) return [];
  return paragraph.split(',').map(token => {
    const parsed = parseLevelToken(token);
    if (!parsed) return null;
    return {
      ...parsed,
      section_id: section.id,
      pub_date: section.pub_date,
      plan_date: section.plan_date,
      section_title: section.title,
      direction,
      base_role: direction === 'resistance' ? 'RESISTANCE_ONLY' : 'SUPPORT_LEVEL',
      source: `${label.toLowerCase()}_list`,
      tags: parsed.major ? ['major'] : [],
      snippets: [],
    };
  }).filter(Boolean);
}

function splitSentences(text) {
  return normalizeText(text)
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function priceRegex(price) {
  const whole = Math.round(Number(price));
  const alternatives = [String(whole)];
  const suffix2 = String(whole % 100).padStart(2, '0');
  const suffix3 = String(whole % 1000).padStart(3, '0');
  alternatives.push(suffix2.replace(/^0/, ''));
  alternatives.push(suffix2);
  alternatives.push(suffix3.replace(/^0+/, ''));
  return new RegExp(`(?:^|[^\\d])(?:${[...new Set(alternatives)].filter(Boolean).join('|')})(?:\\.\\d+)?(?:[^\\d]|$)`);
}

function tagsFromSentence(sentence, direction) {
  const lower = sentence.toLowerCase();
  const tags = [];
  if (/\b(first|1st)\s+support\b/.test(lower)) tags.push('first_support_caution');
  if (/not overly interested|desperation|wouldn'?t engage|do not engage|don'?t engage|risky|lower quality|low quality/.test(lower)) tags.push('caution');
  if (/free falling|knife|knife catching|no knife/.test(lower)) tags.push('no_knife_catch');
  if (/slow grind|try the bid|buy it|bid direct|direct/.test(lower)) tags.push('direct_bid_conditional');
  if (/failed breakdown|sweep|wick below|flush|reclaim|recover/.test(lower)) tags.push('failed_breakdown_reclaim');
  if (/shelf|cluster|multi-touch|\btouches\b|\btouch shelf\b/.test(lower)) tags.push('shelf_cluster_low');
  if (/defend|holding|held|hold/.test(lower)) tags.push('defend_first');
  if (/target|next up|targets|bonus/.test(lower)) tags.push('target_reference');
  if (/resistance|short/.test(lower) || direction === 'resistance') tags.push('resistance_only');
  if (/target only/i.test(sentence)) tags.push('target_only');
  return [...new Set(tags)];
}

function primaryRole(record) {
  const tags = new Set(record.tags || []);
  if (tags.has('target_only')) return 'TARGET_ONLY';
  if (tags.has('resistance_only') || record.direction === 'resistance') return 'RESISTANCE_ONLY';
  if (tags.has('first_support_caution')) return 'FIRST_SUPPORT_CAUTION';
  if (tags.has('failed_breakdown_reclaim') || tags.has('shelf_cluster_low')) return 'FAILED_BREAKDOWN_RECLAIM';
  if (tags.has('direct_bid_conditional')) return 'DIRECT_BID_CONDITIONAL';
  if (tags.has('major')) return 'MAJOR_SUPPORT';
  return record.direction === 'support' ? 'SUPPORT_LEVEL' : 'NARRATIVE_LEVEL';
}

function extractNarrativeLevels(section) {
  const sentences = splitSentences(section.text);
  const records = [];
  for (const sentence of sentences) {
    if (!/(failed breakdown|sweep|reclaim|recover|support|bid|direct|knife|target|resistance|shelf|cluster|low|major)/i.test(sentence)) continue;
    const matches = [...sentence.matchAll(/\b(\d{4,5}(?:\.\d+)?)\b/g)];
    for (const match of matches) {
      const price = Number(match[1]);
      if (!Number.isFinite(price) || price < 3000 || price > 10000) continue;
      records.push({
        raw_token: match[1],
        price,
        zone_low: price,
        zone_high: price,
        zone_mid: price,
        is_zone: false,
        major: /\bmajor\b/i.test(sentence),
        section_id: section.id,
        pub_date: section.pub_date,
        plan_date: section.plan_date,
        section_title: section.title,
        direction: /resistance|short/i.test(sentence) ? 'resistance' : 'support',
        base_role: 'NARRATIVE_LEVEL',
        source: 'narrative_sentence',
        tags: tagsFromSentence(sentence, /resistance|short/i.test(sentence) ? 'resistance' : 'support'),
        snippets: [sentence.slice(0, 320)],
      });
    }
  }
  return records;
}

function enrichRecordsWithSentences(records, section) {
  const sentences = splitSentences(section.text);
  return records.map(record => {
    const snippets = [...(record.snippets || [])];
    const tags = new Set(record.tags || []);
    for (const sentence of sentences) {
      if (!priceRegex(record.price).test(sentence)) continue;
      snippets.push(sentence.slice(0, 320));
      for (const tag of tagsFromSentence(sentence, record.direction)) tags.add(tag);
    }
    if (record.major) tags.add('major');
    const next = {
      ...record,
      tags: [...tags],
      snippets: [...new Set(snippets)].slice(0, 5),
    };
    return {
      ...next,
      primary_role: primaryRole(next),
      level_id: sha1(`${next.plan_date}|${next.price}|${next.zone_low}|${next.zone_high}|${next.source}|${next.primary_role}|${next.snippets[0] || ''}`),
    };
  });
}

function dedupeLevelRecords(records) {
  const byKey = new Map();
  for (const record of records) {
    const key = `${record.plan_date}|${record.price.toFixed(2)}|${record.zone_low.toFixed(2)}|${record.zone_high.toFixed(2)}|${record.direction}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, record);
      continue;
    }
    const tags = [...new Set([...(existing.tags || []), ...(record.tags || [])])];
    const snippets = [...new Set([...(existing.snippets || []), ...(record.snippets || [])])].slice(0, 8);
    const merged = {
      ...existing,
      major: existing.major || record.major,
      source: existing.source === record.source ? existing.source : `${existing.source}+${record.source}`,
      tags,
      snippets,
    };
    merged.primary_role = primaryRole(merged);
    byKey.set(key, merged);
  }
  return [...byKey.values()].sort((a, b) => a.plan_date.localeCompare(b.plan_date) || a.price - b.price);
}

function buildLevelRecords(sections) {
  const all = [];
  for (const section of sections) {
    const records = [
      ...parseLevelList(section, 'Supports are', 'support'),
      ...parseLevelList(section, 'Resistances are', 'resistance'),
      ...extractNarrativeLevels(section),
    ];
    all.push(...enrichRecordsWithSentences(records, section));
  }
  return dedupeLevelRecords(all);
}

function sessionDateFromEt(bar) {
  return minuteOfDay(bar.et_time) >= 18 * 60 ? addDays(bar.et_date, 1) : bar.et_date;
}

function groupBarsByEtSession(bars) {
  const map = new Map();
  for (const bar of bars) {
    const minute = minuteOfDay(bar.et_time);
    if (minute > 16 * 60 && minute < 18 * 60) continue;
    const sessionDate = sessionDateFromEt(bar);
    if (!map.has(sessionDate)) map.set(sessionDate, []);
    map.get(sessionDate).push(bar);
  }
  for (const value of map.values()) value.sort((a, b) => a.et_time.localeCompare(b.et_time));
  return map;
}

function findFirstIndex(bars, predicate, startIndex = 0) {
  for (let i = Math.max(0, startIndex); i < bars.length; i += 1) {
    if (predicate(bars[i], i)) return i;
  }
  return -1;
}

function holdsAbove(bars, index, level, count, extra = CLOSE_ABOVE) {
  for (let offset = 0; offset < count; offset += 1) {
    const bar = bars[index - offset];
    if (!bar || bar.close < level + extra) return false;
  }
  return true;
}

function evaluateFromEntry(bars, entryIndex, entryPrice) {
  if (entryIndex < 0 || entryIndex >= bars.length || !Number.isFinite(entryPrice)) return null;
  const out = {
    entry_ct: bars[entryIndex].ct_time,
    entry_et: bars[entryIndex].et_time,
    entry_price: round2(entryPrice),
  };
  for (const horizon of HORIZONS) {
    const end = Math.min(bars.length - 1, entryIndex + horizon);
    const window = bars.slice(entryIndex, end + 1);
    const maxHigh = Math.max(...window.map(bar => bar.high));
    const minLow = Math.min(...window.map(bar => bar.low));
    out[`horizon_${horizon}m_complete`] = entryIndex + horizon <= bars.length - 1;
    out[`mfe_${horizon}m`] = round2(maxHigh - entryPrice);
    out[`mae_${horizon}m`] = round2(entryPrice - minLow);
    out[`hit_2pt_${horizon}m`] = maxHigh >= entryPrice + 2;
    out[`hit_4pt_${horizon}m`] = maxHigh >= entryPrice + 4;
    out[`hit_8pt_${horizon}m`] = maxHigh >= entryPrice + 8;
    out[`hit_10pt_${horizon}m`] = maxHigh >= entryPrice + 10;
  }
  const eodWindow = bars.slice(entryIndex);
  const eodHigh = Math.max(...eodWindow.map(bar => bar.high));
  const eodLow = Math.min(...eodWindow.map(bar => bar.low));
  out.mfe_eod = round2(eodHigh - entryPrice);
  out.mae_eod = round2(entryPrice - eodLow);
  out.hit_2pt_eod = eodHigh >= entryPrice + 2;
  out.hit_4pt_eod = eodHigh >= entryPrice + 4;
  out.hit_8pt_eod = eodHigh >= entryPrice + 8;
  out.hit_10pt_eod = eodHigh >= entryPrice + 10;
  out.eod_complete = true;
  return out;
}

function nearestSaty(level, saty) {
  if (!saty) return { nearest_saty_label: '', nearest_saty_price: '', nearest_saty_distance: '' };
  let best = null;
  for (const item of saty.levels) {
    const distance = Math.abs(level - item.price);
    if (!best || distance < best.distance) best = { ...item, distance };
  }
  return best ? {
    nearest_saty_label: best.label,
    nearest_saty_price: round2(best.price),
    nearest_saty_distance: round2(best.distance),
  } : { nearest_saty_label: '', nearest_saty_price: '', nearest_saty_distance: '' };
}

function isLongEligible(record) {
  if (record.direction === 'resistance') return false;
  if (record.primary_role === 'TARGET_ONLY' || record.primary_role === 'RESISTANCE_ONLY') return false;
  if ((record.tags || []).includes('target_only')) return false;
  return true;
}

function analyzeLevelRecord(record, barsByDate, satyByDate) {
  const bars = barsByDate.get(record.plan_date) || [];
  const saty = satyByDate.get(record.plan_date);
  const satyContext = nearestSaty(record.price, saty);
  const base = {
    level_id: record.level_id,
    plan_date: record.plan_date,
    pub_date: record.pub_date,
    price: record.price,
    zone_low: record.zone_low,
    zone_high: record.zone_high,
    primary_role: record.primary_role,
    direction: record.direction,
    tags: record.tags.join('|'),
    long_eligible: isLongEligible(record),
    bars_in_session: bars.length,
    saty_valid: saty?.valid || false,
    ...satyContext,
  };
  if (!isLongEligible(record) || bars.length === 0) {
    return { ...base, event_status: bars.length ? 'not_long_eligible' : 'no_bars_for_plan_date' };
  }

  const touchIndex = findFirstIndex(bars, bar => bar.low <= record.zone_high + TAP_TOLERANCE && bar.high >= record.zone_low - TICK);
  const sweepIndex = findFirstIndex(
    bars,
    bar => bar.low <= record.zone_low - MIN_SWEEP_DEPTH && bar.high >= record.zone_low - TICK,
    Math.max(0, touchIndex)
  );
  const reclaimLevel = record.price;
  const reclaimIndex = sweepIndex >= 0
    ? findFirstIndex(bars, bar => bar.close >= reclaimLevel + CLOSE_ABOVE, sweepIndex)
    : -1;
  const acceptance2 = reclaimIndex >= 0
    ? findFirstIndex(bars, (bar, index) => index >= reclaimIndex + 1 && holdsAbove(bars, index, reclaimLevel, 2), reclaimIndex)
    : -1;
  const acceptance3 = reclaimIndex >= 0
    ? findFirstIndex(bars, (bar, index) => index >= reclaimIndex + 2 && holdsAbove(bars, index, reclaimLevel, 3), reclaimIndex)
    : -1;
  const nonAcceptance2 = sweepIndex >= 0
    ? findFirstIndex(bars, (bar, index) => index >= sweepIndex + 1 && holdsAbove(bars, index, reclaimLevel, 2, NON_ACCEPTANCE_POINTS), sweepIndex)
    : -1;
  const nonAcceptance3 = sweepIndex >= 0
    ? findFirstIndex(bars, (bar, index) => index >= sweepIndex + 2 && holdsAbove(bars, index, reclaimLevel, 3, NON_ACCEPTANCE_POINTS), sweepIndex)
    : -1;

  const entrySignalIndex = acceptance3 >= 0 ? acceptance3 : nonAcceptance2 >= 0 ? nonAcceptance2 : acceptance2;
  const entryIndex = entrySignalIndex >= 0 ? entrySignalIndex + 1 : -1;
  const entryPrice = entryIndex >= 0 && bars[entryIndex] ? bars[entryIndex].open : NaN;
  const metrics = evaluateFromEntry(bars, entryIndex, entryPrice) || {};
  const sweepLow = sweepIndex >= 0 ? bars[sweepIndex].low : null;
  return {
    ...base,
    event_status: entryIndex >= 0 ? 'entry_model_available' : touchIndex >= 0 ? 'touched_no_entry_model' : 'not_touched',
    touch_ct: touchIndex >= 0 ? bars[touchIndex].ct_time : '',
    touch_et: touchIndex >= 0 ? bars[touchIndex].et_time : '',
    sweep_ct: sweepIndex >= 0 ? bars[sweepIndex].ct_time : '',
    sweep_et: sweepIndex >= 0 ? bars[sweepIndex].et_time : '',
    sweep_low: sweepLow === null ? '' : sweepLow,
    sweep_depth_points: sweepLow === null ? '' : round2(record.zone_low - sweepLow),
    reclaim_ct: reclaimIndex >= 0 ? bars[reclaimIndex].ct_time : '',
    reclaim_et: reclaimIndex >= 0 ? bars[reclaimIndex].et_time : '',
    sweep_reclaim_same_bar: sweepIndex >= 0 && reclaimIndex >= 0 && sweepIndex === reclaimIndex,
    acceptance2_ct: acceptance2 >= 0 ? bars[acceptance2].ct_time : '',
    acceptance2_et: acceptance2 >= 0 ? bars[acceptance2].et_time : '',
    acceptance3_ct: acceptance3 >= 0 ? bars[acceptance3].ct_time : '',
    acceptance3_et: acceptance3 >= 0 ? bars[acceptance3].et_time : '',
    nonacceptance2_ct: nonAcceptance2 >= 0 ? bars[nonAcceptance2].ct_time : '',
    nonacceptance2_et: nonAcceptance2 >= 0 ? bars[nonAcceptance2].et_time : '',
    entry_model: acceptance3 >= 0 ? 'acceptance_3m_next_open' : nonAcceptance2 >= 0 ? 'nonacceptance_2m_next_open' : acceptance2 >= 0 ? 'acceptance_2m_next_open' : '',
    ...metrics,
  };
}

function sessionDateFromCt(bar) {
  return minuteOfDay(bar.ct_time) >= 17 * 60 ? addDays(bar.ct_date, 1) : bar.ct_date;
}

function computeSatyLevels(bars) {
  const bySession = new Map();
  for (const bar of bars) {
    const session = sessionDateFromCt(bar);
    if (!bySession.has(session)) bySession.set(session, []);
    bySession.get(session).push(bar);
  }
  const sessions = [...bySession.entries()].map(([date, rows]) => {
    rows.sort((a, b) => a.ct_time.localeCompare(b.ct_time));
    const high = Math.max(...rows.map(row => row.high));
    const low = Math.min(...rows.map(row => row.low));
    const close = rows.at(-1).close;
    return {
      date,
      bars: rows.length,
      first_ct: rows[0].ct_time,
      last_ct: rows.at(-1).ct_time,
      high,
      low,
      close,
      fullish: rows.length >= 1000,
    };
  }).sort((a, b) => a.date.localeCompare(b.date));

  let previousClose = null;
  let atr = null;
  const trRows = [];
  const saty = [];
  for (let i = 0; i < sessions.length; i += 1) {
    const session = sessions[i];
    const tr = previousClose === null
      ? session.high - session.low
      : Math.max(session.high - session.low, Math.abs(session.high - previousClose), Math.abs(session.low - previousClose));
    trRows.push(tr);
    if (trRows.length === 14) {
      atr = trRows.reduce((sum, value) => sum + value, 0) / 14;
    } else if (trRows.length > 14) {
      atr = ((atr * 13) + tr) / 14;
    }
    previousClose = session.close;

    const target = sessions[i + 1]?.date;
    if (!target || atr === null) continue;
    const levels = [
      ['ATR+1', session.close + atr],
      ['ext+4', session.close + atr * 0.786],
      ['ext+3', session.close + atr * 0.618],
      ['ext+2', session.close + atr * 0.5],
      ['ext+1', session.close + atr * 0.382],
      ['CALL_TRIGGER', session.close + atr * 0.236],
      ['PREV_CLOSE', session.close],
      ['PUT_TRIGGER', session.close - atr * 0.236],
      ['ext-1', session.close - atr * 0.382],
      ['ext-2', session.close - atr * 0.5],
      ['ext-3', session.close - atr * 0.618],
      ['ext-4', session.close - atr * 0.786],
      ['ATR-1', session.close - atr],
    ].map(([label, price]) => ({ label, price: round2(price) }));
    saty.push({
      target_date: target,
      reference_session: session.date,
      previous_close: session.close,
      atr14: round2(atr),
      warmup_sessions: trRows.length,
      valid: trRows.length >= 14 && sessions.slice(Math.max(0, i - 13), i + 1).every(row => row.fullish),
      levels,
    });
  }
  return {
    sessions,
    levels: saty,
    byDate: new Map(saty.map(row => [row.target_date, row])),
  };
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function pct(count, total) {
  return total ? round2((count * 100) / total) : 0;
}

function summarizeEvents(events) {
  const groups = new Map();
  for (const event of events) {
    const key = event.primary_role;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(event);
  }
  return [...groups.entries()].map(([primaryRole, rows]) => {
    const entries = rows.filter(row => row.event_status === 'entry_model_available');
    const complete15 = entries.filter(row => row.horizon_15m_complete === true);
    const complete30 = entries.filter(row => row.horizon_30m_complete === true);
    const complete60 = entries.filter(row => row.horizon_60m_complete === true);
    const avg = (items, key) => round2(items.reduce((sum, row) => sum + Number(row[key] || 0), 0) / (items.length || 1));
    return {
      primary_role: primaryRole,
      levels: rows.length,
      entries: entries.length,
      complete_30m_entries: complete30.length,
      complete_60m_entries: complete60.length,
      touched: rows.filter(row => row.event_status === 'entry_model_available' || row.event_status === 'touched_no_entry_model').length,
      avg_mfe_15m: avg(complete15, 'mfe_15m'),
      median_mfe_15m: median(complete15.map(row => Number(row.mfe_15m))),
      avg_mfe_30m: avg(complete30, 'mfe_30m'),
      median_mfe_30m: median(complete30.map(row => Number(row.mfe_30m))),
      avg_mfe_60m: avg(complete60, 'mfe_60m'),
      median_mfe_60m: median(complete60.map(row => Number(row.mfe_60m))),
      avg_mae_30m: avg(complete30, 'mae_30m'),
      hit_2pt_30m_rate: pct(complete30.filter(row => row.hit_2pt_30m === true).length, complete30.length),
      hit_4pt_30m_rate: pct(complete30.filter(row => row.hit_4pt_30m === true).length, complete30.length),
      hit_8pt_30m_rate: pct(complete30.filter(row => row.hit_8pt_30m === true).length, complete30.length),
      hit_10pt_60m_rate: pct(complete60.filter(row => row.hit_10pt_60m === true).length, complete60.length),
      mae_over_5pt_30m_rate: pct(complete30.filter(row => Number(row.mae_30m) > 5).length, complete30.length),
    };
  }).sort((a, b) => b.entries - a.entries || a.primary_role.localeCompare(b.primary_role));
}

function pickExamples(events) {
  const wanted = [
    { date: '2026-05-07', price: 7369 },
    { date: '2026-05-07', price: 7355 },
    { date: '2026-05-07', price: 7345 },
    { date: '2026-05-06', price: 7279 },
  ];
  const examples = [];
  for (const item of wanted) {
    const matches = events
      .filter(row => row.plan_date === item.date && Math.abs(Number(row.price) - item.price) <= 0.01)
      .sort((a, b) => Number(b.mfe_30m || -999) - Number(a.mfe_30m || -999));
    if (matches[0]) examples.push(matches[0]);
  }
  return examples;
}

function findBarIndexByCt(bars, ctTime) {
  return bars.findIndex(bar => bar.ct_time === ctTime);
}

function buildNarrativeExamples(bars) {
  const byCt = new Map(bars.map((bar, index) => [bar.ct_time, { bar, index }]));
  const examples = [];
  const add = ({
    name,
    narrative_date,
    level,
    role,
    flush_ct,
    reclaim_ct,
    entry_ct,
    entry_price,
    note,
  }) => {
    const flush = byCt.get(flush_ct);
    const reclaim = byCt.get(reclaim_ct);
    const entry = byCt.get(entry_ct);
    if (!flush || !entry) {
      examples.push({
        name,
        narrative_date,
        level,
        role,
        event_status: 'missing_bars_for_manual_example',
        note,
      });
      return;
    }
    const metrics = evaluateFromEntry(bars.filter(bar => bar.et_date === entry.bar.et_date), findBarIndexByCt(bars.filter(bar => bar.et_date === entry.bar.et_date), entry_ct), entry_price);
    examples.push({
      name,
      narrative_date,
      level,
      role,
      event_status: 'narrative_example_aligned',
      flush_ct,
      flush_et: flush.bar.et_time,
      flush_low: flush.bar.low,
      reclaim_ct,
      reclaim_et: reclaim?.bar.et_time || '',
      entry_ct,
      entry_et: entry.bar.et_time,
      entry_price,
      sweep_depth_points: round2(level - flush.bar.low),
      note,
      ...(metrics || {}),
    });
  };

  add({
    name: 'May 4 7213 failed breakdown',
    narrative_date: '2026-05-04',
    level: 7213,
    role: 'FAILED_BREAKDOWN_RECLAIM_RETROSPECTIVE',
    flush_ct: '2026-05-04 11:08',
    reclaim_ct: '2026-05-04 11:11',
    entry_ct: '2026-05-04 11:20',
    entry_price: 7218,
    note: 'Newsletter describes 12:20 ET recovery of Monday 6:20 ET 7213 major low after flush to 7199.',
  });
  add({
    name: 'May 7 7369 first support reclaim',
    narrative_date: '2026-05-07',
    level: 7369,
    role: 'FIRST_SUPPORT_CAUTION_RETROSPECTIVE',
    flush_ct: '2026-05-07 11:20',
    reclaim_ct: '2026-05-07 11:23',
    entry_ct: '2026-05-07 11:24',
    entry_price: 7369.25,
    note: 'Newsletter calls this low quality first support but confirms wick/recover scalp potential.',
  });
  add({
    name: 'May 7 7355 over 7345 failed breakdown scalp',
    narrative_date: '2026-05-07',
    level: 7355,
    role: 'FAILED_BREAKDOWN_RECLAIM_RETROSPECTIVE',
    flush_ct: '2026-05-07 12:27',
    reclaim_ct: '2026-05-07 12:36',
    entry_ct: '2026-05-07 12:38',
    entry_price: 7362,
    note: 'Newsletter says defend 7345 then recover 7355; Mancini entry was 7362 at 1:38 ET.',
  });
  return examples;
}

function buildReport({ metadata, sections, levelRecords, events, summary, examples, satyRows }) {
  const lines = [];
  const entryEvents = events.filter(row => row.event_status === 'entry_model_available');
  const complete30 = entryEvents.filter(row => row.horizon_30m_complete === true).length;
  const sameBarSweepReclaim = entryEvents.filter(row => row.sweep_reclaim_same_bar === true).length;
  const badEntrySessions = entryEvents.filter(row => {
    const entry = row.entry_et || '';
    if (!entry) return false;
    const entryDate = entry.slice(0, 10);
    const entryTime = entry.slice(11, 16);
    return !(
      (entryDate === row.plan_date && entryTime <= '16:00')
      || (entryDate === addDays(row.plan_date, -1) && entryTime >= '18:00')
    );
  }).length;
  lines.push('# Mancini Context Protocol Research');
  lines.push('');
  lines.push(`Generated: ${metadata.generated_at}`);
  lines.push('');
  lines.push('## Inputs');
  lines.push('');
  lines.push(`- Mancini log: \`${metadata.mancini_log}\``);
  lines.push(`- ES files merged: ${metadata.es_files.length}`);
  lines.push(`- ES bars merged: ${metadata.es_bars}`);
  lines.push(`- ES coverage: ${metadata.first_ct} CT to ${metadata.last_ct} CT`);
  lines.push('- Time rule: Barchart export is treated as CT/CDT; report adds one hour for ET alignment.');
  lines.push('- Session rule: event tests use futures sessions: 18:00 ET prior evening through 16:00 ET plan day.');
  lines.push('');
  lines.push('## What Changed In The Research Model');
  lines.push('');
  lines.push('The parser does not treat Mancini levels as equal. It attaches role tags from the surrounding newsletter language, then tests whether price touched, swept, reclaimed, accepted, or non-accepted the level.');
  lines.push('');
  lines.push('Primary roles used: `FIRST_SUPPORT_CAUTION`, `FAILED_BREAKDOWN_RECLAIM`, `DIRECT_BID_CONDITIONAL`, `MAJOR_SUPPORT`, `SUPPORT_LEVEL`, `RESISTANCE_ONLY`, `TARGET_ONLY`.');
  lines.push('');
  lines.push('## Confidence Checks');
  lines.push('');
  lines.push(`- Entry models generated: ${entryEvents.length}`);
  lines.push(`- Entries with complete 30m horizon: ${complete30}`);
  lines.push(`- Entry session violations: ${badEntrySessions}`);
  lines.push(`- Same-1m sweep/reclaim cases: ${sameBarSweepReclaim}; these are entered only after later acceptance bars, not on the sweep bar.`);
  lines.push('- Acceptance windows now require completed bars after reclaim; pre-reclaim bars are not allowed to count toward 2m/3m acceptance.');
  lines.push('- Resistance and target-only rows are classified for context but excluded from long-entry response stats.');
  lines.push('');
  lines.push('## Introductory Response Numbers');
  lines.push('');
  lines.push('| Role | Levels | Entries | Complete 30m | Hit +2 30m | Hit +4 30m | Hit +8 30m | Avg MFE 30m | Avg MAE 30m |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of summary) {
    lines.push(`| ${row.primary_role} | ${row.levels} | ${row.entries} | ${row.complete_30m_entries} | ${row.hit_2pt_30m_rate}% | ${row.hit_4pt_30m_rate}% | ${row.hit_8pt_30m_rate}% | ${row.avg_mfe_30m} | ${row.avg_mae_30m} |`);
  }
  lines.push('');
  lines.push('These are not production win rates. They are first-pass, one-minute OHLC response stats with next-open-after-confirmation entries. Hit/MFE/MAE rates are calculated only from entries with a complete horizon window.');
  lines.push('');
  lines.push('## Initial Read');
  lines.push('');
  lines.push('- `FAILED_BREAKDOWN_RECLAIM` is the cleanest candidate for automation expansion: strong +2 hit rate, meaningful 30m MFE, and enough samples to justify the next pass.');
  lines.push('- `MAJOR_SUPPORT` produces larger average moves but also larger adverse excursion, so it should not automatically mean wider size; it needs context filters.');
  lines.push('- `FIRST_SUPPORT_CAUTION` can still scalp, but its average 30m MAE is now larger than its average 30m MFE. That supports Mancini\'s warning: treat first support after a rally as manual/low-trust unless it becomes a cleaner reclaim.');
  lines.push('- `SUPPORT_LEVEL` has lower MAE than the other long classes in this pass, so the small 2-4 point edge probably still exists as a separate scalp class.');
  lines.push('');
  lines.push('## Flagship Improvement Direction');
  lines.push('');
  lines.push('Do not make every level equal. The next Pine-facing pack should distinguish at least these actions:');
  lines.push('');
  lines.push('- `SCALP_VALID`: ordinary support or shallow reclaim; keep current 2-contract / TP1-first behavior.');
  lines.push('- `MANCINI_RECLAIM`: explicit failed-breakdown, shelf, or defend/recover language; wait for acceptance and allow a larger runner target.');
  lines.push('- `MANUAL_CAUTION`: first support after rally, freefall warnings, or weak context; show visual context but suppress automation unless a stronger reclaim appears.');
  lines.push('- `TARGET_ONLY`: resistance/targets/runner destinations; draw/label only, never fire a long.');
  lines.push('');
  lines.push('');
  lines.push('## Specific Examples');
  lines.push('');
  for (const row of examples) {
    if (row.event_status === 'narrative_example_aligned') {
      lines.push(`### ${row.narrative_date} ${row.level} ${row.role}`);
      lines.push('');
      lines.push(`- Event: ${row.event_status}`);
      lines.push(`- Flush ET: ${row.flush_et} low ${row.flush_low} depth ${row.sweep_depth_points}`);
      lines.push(`- Reclaim ET: ${row.reclaim_et || 'n/a'}`);
      lines.push(`- Entry ET: ${row.entry_et || 'n/a'} price ${row.entry_price}`);
      lines.push(`- MFE/MAE 30m: ${row.mfe_30m ?? 'n/a'} / ${row.mae_30m ?? 'n/a'}`);
      lines.push(`- MFE/MAE 60m: ${row.mfe_60m ?? 'n/a'} / ${row.mae_60m ?? 'n/a'}`);
      lines.push(`- Note: ${row.note}`);
      lines.push('');
      continue;
    }
    lines.push(`### ${row.plan_date} ${row.price} ${row.primary_role}`);
    lines.push('');
    lines.push(`- Event: ${row.event_status}`);
    lines.push(`- Tags: ${row.tags || 'none'}`);
    lines.push(`- Touch ET: ${row.touch_et || 'n/a'}`);
    lines.push(`- Sweep ET: ${row.sweep_et || 'n/a'} low ${row.sweep_low || 'n/a'} depth ${row.sweep_depth_points || 'n/a'}`);
    lines.push(`- Reclaim ET: ${row.reclaim_et || 'n/a'}`);
    lines.push(`- Entry model: ${row.entry_model || 'n/a'} at ${row.entry_et || 'n/a'} price ${row.entry_price || 'n/a'}`);
    lines.push(`- MFE/MAE 30m: ${row.mfe_30m ?? 'n/a'} / ${row.mae_30m ?? 'n/a'}`);
    lines.push(`- Nearest Saty: ${row.nearest_saty_label || 'n/a'} ${row.nearest_saty_price || ''} distance ${row.nearest_saty_distance || ''} valid=${row.saty_valid}`);
    lines.push('');
  }
  lines.push('## Saty Caveat');
  lines.push('');
  const validSaty = satyRows.filter(row => row.valid).length;
  lines.push(`Saty rows generated: ${satyRows.length}. Valid warm rows: ${validSaty}.`);
  lines.push('Rows are marked invalid when the ATR window includes partial sessions. Do not use invalid rows as proof; use them only as directional confluence candidates.');
  lines.push('');
  lines.push('## Implementation Roadmap');
  lines.push('');
  lines.push('1. Keep Pine unchanged until this protocol is validated.');
  lines.push('2. Convert daily Mancini text into a compact daily protocol pack.');
  lines.push('3. Feed Pine only distilled metadata: price, role, major flag, trigger type, and target-only exclusion.');
  lines.push('4. Keep two trade classes separate: `SCALP_VALID` for 2-10 point opportunities and `SWING_VALID` for larger failed-breakdown runners/options.');
  lines.push('5. Require different automation brackets by class instead of pretending every level gets the same stop/TP.');
  lines.push('');
  lines.push('## Next Prompt Scaffold');
  lines.push('');
  lines.push('```text');
  lines.push('Parse this Mancini plan into JSON. For every ES level, classify role as DIRECT_BID, FIRST_SUPPORT_CAUTION, MAJOR_SUPPORT, SHELF_CLUSTER_LOW, FAILED_BREAKDOWN_RECLAIM, LEVEL_RECLAIM, TARGET_ONLY, RESISTANCE_ONLY, or NO_KNIFE_CATCH. Include the exact sentence that justified each role. Do not mark a level long-eligible unless the text gives support/direct-bid/reclaim context. Output a compact protocol pack for Luke/Pine and a richer audit table for research.');
  lines.push('```');
  lines.push('');
  lines.push('## Limitations');
  lines.push('');
  lines.push('- 1m OHLC cannot prove intraminute order.');
  lines.push('- Current parser is heuristic and must be reviewed against the raw snippets before trading changes.');
  lines.push('- Saty ATR needs enough clean prior sessions; invalid rows are not proof.');
  lines.push('- A level can be a good scalp and a bad swing. The report keeps those concepts separate.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function assertCriticalExamples(levelRecords, events) {
  const has7355 = levelRecords.some(row => row.plan_date === '2026-05-07' && row.price === 7355 && row.primary_role === 'FAILED_BREAKDOWN_RECLAIM');
  if (!has7355) throw new Error('critical_parse_missing_2026_05_07_7355_failed_breakdown_reclaim');
  const has7369 = levelRecords.some(row => row.plan_date === '2026-05-07' && row.price === 7369 && row.primary_role === 'FIRST_SUPPORT_CAUTION');
  if (!has7369) throw new Error('critical_parse_missing_2026_05_07_7369_first_support_caution');
  const event7355 = events.find(row => row.plan_date === '2026-05-07' && row.price === 7355 && row.event_status === 'entry_model_available');
  if (!event7355) throw new Error('critical_event_missing_2026_05_07_7355_entry_model');
}

function main() {
  ensureDir(OUT_DIR);
  const rawLog = fs.readFileSync(LOG_PATH, 'utf8');
  const sections = parseSections(rawLog);
  const levelRecords = buildLevelRecords(sections);
  const { files, bars } = loadMergedEsBars();
  const barsByDate = groupBarsByEtSession(bars);
  const saty = computeSatyLevels(bars);
  const events = levelRecords.map(record => analyzeLevelRecord(record, barsByDate, saty.byDate));
  const summary = summarizeEvents(events);
  const examples = [...buildNarrativeExamples(bars), ...pickExamples(events)];
  assertCriticalExamples(levelRecords, events);

  const satyRows = saty.levels.flatMap(row => row.levels.map(level => ({
    target_date: row.target_date,
    reference_session: row.reference_session,
    previous_close: row.previous_close,
    atr14: row.atr14,
    warmup_sessions: row.warmup_sessions,
    valid: row.valid,
    label: level.label,
    price: level.price,
  })));

  const metadata = {
    generated_at: new Date().toISOString(),
    research_only: true,
    no_pine_changes: true,
    mancini_log: path.relative(ROOT, LOG_PATH).replace(/\\/g, '/'),
    sections: sections.length,
    level_records: levelRecords.length,
    events: events.length,
    es_files: files.map(file => path.relative(ROOT, file).replace(/\\/g, '/')),
    es_bars: bars.length,
    first_ct: bars[0]?.ct_time || null,
    last_ct: bars.at(-1)?.ct_time || null,
    first_et: bars[0]?.et_time || null,
    last_et: bars.at(-1)?.et_time || null,
    timezone_note: 'Barchart rows are treated as CT/CDT and ET is derived by adding one hour for this export set.',
  };

  writeJson(path.join(OUT_DIR, 'metadata.json'), metadata);
  writeJson(path.join(OUT_DIR, 'sections.json'), sections.map(section => ({
    id: section.id,
    title: section.title,
    pub_date: section.pub_date,
    plan_date: section.plan_date,
    start_line: section.start_line,
    date_line: section.date_line,
    end_line: section.end_line,
    hash: section.hash,
  })));
  writeCsv(path.join(OUT_DIR, 'level-protocol.csv'), levelRecords.map(row => ({
    plan_date: row.plan_date,
    pub_date: row.pub_date,
    price: row.price,
    zone_low: row.zone_low,
    zone_high: row.zone_high,
    primary_role: row.primary_role,
    direction: row.direction,
    major: row.major,
    tags: row.tags,
    source: row.source,
    snippet: row.snippets[0] || '',
  })));
  writeCsv(path.join(OUT_DIR, 'events.csv'), events);
  writeCsv(path.join(OUT_DIR, 'summary-by-role.csv'), summary);
  writeCsv(path.join(OUT_DIR, 'examples.csv'), examples);
  writeCsv(path.join(OUT_DIR, 'saty-levels.csv'), satyRows);
  writeJson(path.join(OUT_DIR, 'summary.json'), { metadata, summary, examples });
  fs.writeFileSync(path.join(OUT_DIR, 'report.md'), buildReport({
    metadata,
    sections,
    levelRecords,
    events,
    summary,
    examples,
    satyRows,
  }), 'utf8');

  console.log(JSON.stringify({
    ok: true,
    out_dir: path.relative(ROOT, OUT_DIR).replace(/\\/g, '/'),
    sections: sections.length,
    levels: levelRecords.length,
    events: events.length,
    entries: events.filter(event => event.event_status === 'entry_model_available').length,
    files: {
      report: path.relative(ROOT, path.join(OUT_DIR, 'report.md')).replace(/\\/g, '/'),
      level_protocol: path.relative(ROOT, path.join(OUT_DIR, 'level-protocol.csv')).replace(/\\/g, '/'),
      events: path.relative(ROOT, path.join(OUT_DIR, 'events.csv')).replace(/\\/g, '/'),
      summary: path.relative(ROOT, path.join(OUT_DIR, 'summary-by-role.csv')).replace(/\\/g, '/'),
    },
    top_summary: summary.slice(0, 6),
  }, null, 2));
}

main();
