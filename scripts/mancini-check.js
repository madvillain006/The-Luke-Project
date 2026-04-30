'use strict';
const fs = require('fs');
const text = fs.readFileSync('C:/Users/conor/luke/data/backtest/es-long-bracket/raw/mancini/Mancini.txt', 'utf8');

// Non-ASCII scan
const nonAscii = [];
for (let i = 0; i < text.length && nonAscii.length < 20; i++) {
  const c = text.charCodeAt(i);
  if (c > 127) {
    const ctx = text.slice(Math.max(0, i - 5), i + 10);
    nonAscii.push({ pos: i, code: '0x' + c.toString(16), char: text[i], ctx });
  }
}
console.log('Non-ASCII chars found:', nonAscii.length);
nonAscii.forEach(x => console.log(' ', x.pos, x.code, JSON.stringify(x.ctx)));

// Specific mojibake sequences
['â€"', 'Â©', 'â€™'].forEach(s => {
  const count = (text.match(new RegExp(s, 'g')) || []).length;
  console.log('Occurrences of', s, ':', count);
});

// Post split
const posts = text.split('[–]Adam_Mankini');
console.log('Posts:', posts.length - 1);
console.log('Earliest post (last chunk):', posts[posts.length - 1].slice(0, 300).trim());
