'use strict';

const { buildVerdictMarkdown } = require('../confluence-engine');

function renderVerdict(instruments, opts = {}) {
  return buildVerdictMarkdown(instruments, opts);
}

module.exports = { renderVerdict };
