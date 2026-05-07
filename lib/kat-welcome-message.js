'use strict';

function getKatWelcomeMessage() {
  return [
    'Katbot is live in trade-floor.',
    '',
    'She reads selected analyst channels and returns source-backed SPX and stock context. She does not place trades.',
    '',
    'Direct commands:',
    '`!bias spx` - 18h SPX bias if enough fresh signals exist.',
    '`!levels spx` - confirmed SPX levels from repeated analyst mentions.',
    '`!heatmap spx` / `!queue spx heatmap` - latest saved SPX heatmap.',
    '`!recent spx` - recent SPX chart posts and images.',
    '`!equity ups` - recent chart posts and images for a ticker. Lowercase is fine.',
    '`!kat` - command menu.',
    '',
    'To get her to yap: use long forms like `!kat recent spx`, `!kat heatmap spx`, `!kat equity ups`.'
  ].join('\n');
}

module.exports = {
  getKatWelcomeMessage,
};
