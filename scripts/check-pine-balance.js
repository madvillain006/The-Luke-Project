'use strict';

const fs = require('fs');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/check-pine-balance.js <file.pine>');
  process.exit(2);
}

const source = fs.readFileSync(file, 'utf8');
const stack = [];
const pairs = { ')': '(', ']': '[', '}': '{' };
let inString = false;
let escaped = false;

for (let i = 0; i < source.length; i += 1) {
  const char = source[i];
  if (inString) {
    if (escaped) escaped = false;
    else if (char === '\\') escaped = true;
    else if (char === '"') inString = false;
    continue;
  }
  if (char === '"') {
    inString = true;
    continue;
  }
  if (char === '(' || char === '[' || char === '{') {
    stack.push([char, i]);
  } else if (char === ')' || char === ']' || char === '}') {
    const top = stack.pop();
    if (!top || top[0] !== pairs[char]) {
      console.error(`mismatch ${char} at ${i}; top=${top ? top.join(':') : 'none'}`);
      process.exit(1);
    }
  }
}

if (inString) {
  console.error('unterminated string');
  process.exit(1);
}

if (stack.length) {
  console.error(`unclosed ${JSON.stringify(stack.slice(-5))}`);
  process.exit(1);
}

console.log(`pine-static-balance-ok ${source.length}`);
