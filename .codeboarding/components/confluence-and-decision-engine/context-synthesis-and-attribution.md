---
component_id: 4.3
component_name: Context Synthesis & Attribution
---

# Context Synthesis & Attribution

## Component Description

The final stage of the decision spine that prepares data for the 'Brain' (LLM) and evaluates the accuracy of the engine's logic. It aggregates complex quantitative metrics into natural language context blocks and performs post-hoc attribution to identify which mentors or strategies are currently outperforming.

---

## Key References:

### c:\Users\conor\luke\lib\system-prompt.js (lines 101-114)
```
function buildTradingContextBlock() {
  const packs = loadTradingContextPacks();
  if (!packs.length) return "";
  return "\nTRADING CONTEXT PACKS:\n" + packs.map(pack => {
    const summary = (pack.summary || []).slice(0, 18).map(item => "- " + item).join("\n");
    const rules = (pack.rules || []).slice(0, 8).map(item => "- " + item).join("\n");
    return [
      `${pack.title} (${pack.id})`,
      pack.applies_to?.length ? `Applies to: ${pack.applies_to.join(", ")}` : null,
      summary ? "Context:\n" + summary : null,
      rules ? "Rules:\n" + rules : null,
    ].filter(Boolean).join("\n");
  }).join("\n\n") + "\n";
}
```


## Source Files:

- `lib\research\replay-engine.js`
- `lib\research\source-attribution.js`
- `lib\research\source-timeline.js`
- `lib\system-prompt.js`

