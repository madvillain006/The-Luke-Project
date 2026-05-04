---
component_id: 1.2
component_name: Operator Command & Presentation Layer
---

# Operator Command & Presentation Layer

## Component Description

Translates internal system states into human-readable formats and processes operator-driven commands. It handles the logic for rendering complex data (like trade confluences or verdicts) into the UI.

---

## Key References:

### c:\Users\conor\luke\lib\operator\confluence-adapter.js (lines 45-80)
```
async function buildConfluenceResponse({
  instrument = 'ES',
  instruments = null,
  topN = 5,
  currentPrices = null,
  getLivePriceFn = getLivePrice,
  getMarketSnapshotFn = getMarketSnapshot,
  buildVerdictMarkdownFn = buildVerdictMarkdown,
} = {}) {
  const list = (instruments || [instrument])
    .map(item => String(item || '').toUpperCase())
    .filter(Boolean);
  const priceResult = currentPrices
    ? { currentPrices, warnings: [], marketData: {} }
    : await buildCurrentPrices(list, getLivePriceFn, getMarketSnapshotFn);
  const markdown = buildVerdictMarkdownFn(list, {
    currentPrices: priceResult.currentPrices,
    topN,
    priceError: priceResult.warnings.length > 0,
  });

  return {
    ok: true,
    endpoint_type: 'confluence',
    mode: 'confluence_only',
    instruments: list,
    trade_action: null,
    actionable: false,
    disclaimer: 'Confluence only. Use /entries ES or /api/decision for pass/trade decision truth.',
    rows: rowsFromMarkdown(markdown),
    markdown,
    marketData: priceResult.marketData,
    market_data: priceResult.marketData,
    warnings: priceResult.warnings,
  };
}
```

### c:\Users\conor\luke\lib\commands\entries-command.js (lines 18-78)
```
async function handleEntriesCommand(message, res, deps) {
  const {
    getKatContextSummary,
    formatKatSummaryLine,
    getLivePrice,
    getMarketPrice = defaultGetMarketPrice,
    loadState,
    buildTradeDecision,
  } = deps;

  const args = message.slice('/entries '.length).trim().split(/\s+/).filter(Boolean);
  if (args.length < 1) {
    return res.json({ reply: 'Use /entries <INSTRUMENT>' });
  }

  const instrument = args[0].toUpperCase();
  const katEntryLine = formatKatSummaryLine(
    getKatContextSummary(entriesKatInstrument(instrument)),
    'Kat context'
  );

  let marketData = null;
  try {
    marketData = getLivePrice
      ? null
      : await getMarketPrice(instrument);
  } catch {}

  let livePrice = null;
  if (getLivePrice) {
    try {
      livePrice = await getLivePrice();
    } catch {}
  }

  const legacyEntry = instrument === 'ES'
    ? livePrice?.instruments?.es
    : instrument === 'NQ'
      ? livePrice?.instruments?.nq
      : null;
  const legacyPrice = Number.isFinite(legacyEntry?.price) && legacyEntry.stale !== true && legacyEntry.delayed !== true && (legacyEntry.confidence ?? 0) >= 0.6
    ? legacyEntry.price
    : null;
  const providerPrice = Number.isFinite(marketData?.price) && marketData.stale !== true && marketData.delayed !== true && marketData.confidence >= 0.6
    ? marketData.price
    : null;
  const currentPrice = Number.isFinite(legacyPrice) ? legacyPrice : providerPrice;

  const tradeState = loadState();
  const decision = buildTradeDecision({
    instrument,
    mode: 'manual',
    currentPrice,
    state: tradeState,
    now: new Date(),
  });

  return res.json({
    reply: renderEntriesDecision({ instrument, currentPrice, decision, tradeState, katEntryLine }),
  });
}
```

### c:\Users\conor\luke\lib\renderers\verdict-renderer.js (lines 5-7)
```
function renderVerdict(instruments, opts = {}) {
  return buildVerdictMarkdown(instruments, opts);
}
```


## Source Files:

- `lib\commands\entries-command.js`
- `lib\commands\status-command.js`
- `lib\commands\verdict-command.js`
- `lib\operator\confluence-adapter.js`
- `lib\operator\decision-adapter.js`
- `lib\operator\fake-breakdown-watchlist-adapter.js`
- `lib\operator\ingestion-status-adapter.js`
- `lib\operator\level-memory-adapter.js`
- `lib\operator\log-adapter.js`
- `lib\operator\operator-status-adapter.js`
- `lib\renderers\entries-renderer.js`
- `lib\renderers\status-renderer.js`
- `lib\renderers\verdict-renderer.js`

