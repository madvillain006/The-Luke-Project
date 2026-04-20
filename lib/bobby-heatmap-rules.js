'use strict';

// Extracted from Bobby's actual Discord messages in bobby-spx-coms export.
// All definitions use his own words.
const BOBBY_HEATMAP_RULES = {
  king_node: "the largest, most magnetic node — price gets pulled toward it like gravity; primary price target once confirmed by trinity; 'Big Nodes = Gravity'; 'make sure the king node is big enough for a strong pull otherwise you could get caught up in a reshuffle'",
  purple: "deflection floor when below price ('Purple bottom node = deflection floor'); gatekeeper/barrier when above price; chop zone mid-range — 'avoid trading purple zones'; 'avoid mid ranges or purple zones'",
  upper_nodes: "resistance stack above price limiting upside; when lit/glowing = ceiling; stacked upper nodes = strong resistance; 'upside limiting stack of nodes above price'",
  lower_nodes: "downside nodes / support targets below price; when lighting up = bearish signal; 'lower stack lighting up' = downside continuation expected",
  gatekeeper: "barrier nodes (often purple) preventing full move in either direction; once gatekeepers reduce/disappear, expansion is possible — 'gate keeper nodes on SPY disappeared now a move for SPX to its upper nodes is possible'",
  air_pocket: "empty area between meaningful node clusters with no support or resistance — fast movement zone; 'an area between meaningful node clusters where there is [no support]'; 'price entered a low-(air pocket)'",
  cushion_pillow: "supportive stack of nodes below price that buffers downside; 'pillow support nodes' / 'supportive cushion preventing more downside'; cushion above price = limits upside",
  trinity: "alignment of SPX, SPY, and QQQ maps — 'Trinity = Confirmation'; 'no alignment across trinity' = avoid trading; all three aligned = highest conviction",
  rule: "Big Nodes = Gravity. Trinity = Confirmation. Context = Edge.",
  bias_signals: {
    bullish: "support nodes under price intact, upper nodes lighting up, king node above price gaining weight, VIX king node lower, gatekeepers clearing",
    bearish: "lower nodes lighting up / gaining weight, upper gatekeepers present, no floor on SPY/QQQ, king node reshuffled lower, VIX between two high-value nodes",
    neutral: "choppy map, mid-range between high-value nodes, purple zone, no alignment across trinity, 'hard to read rn'"
  }
};

module.exports = { BOBBY_HEATMAP_RULES };
