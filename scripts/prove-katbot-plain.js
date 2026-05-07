#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  buildKatPlainProof,
  writeKatPlainProof,
} = require('../lib/kat-plain-proof');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'proof', 'katbot-plain');

function pngLooksValid(file) {
  if (!fs.existsSync(file)) return false;
  const buffer = fs.readFileSync(file);
  return buffer.length > 1000 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
}

function renderPlainTextPng(text, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const inputFile = file + '.txt.tmp';
  const scriptFile = file + '.tmp.ps1';
  fs.writeFileSync(inputFile, String(text == null ? '' : text), 'utf8');
  fs.writeFileSync(scriptFile, String.raw`
param(
  [Parameter(Mandatory=$true)][string]$InputFile,
  [Parameter(Mandatory=$true)][string]$OutputFile
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$text = [System.IO.File]::ReadAllText($InputFile)
$maxChars = 148
$lines = New-Object System.Collections.Generic.List[string]
foreach ($line in ($text -split '\r?\n')) {
  $remaining = [string]$line
  if ($remaining.Length -eq 0) {
    $lines.Add('')
    continue
  }
  while ($remaining.Length -gt $maxChars) {
    $breakAt = $remaining.LastIndexOf(' ', $maxChars)
    if ($breakAt -lt 48) { $breakAt = $maxChars }
    $lines.Add($remaining.Substring(0, $breakAt))
    $remaining = $remaining.Substring($breakAt).TrimStart()
  }
  $lines.Add($remaining)
}

$width = 1400
$font = New-Object System.Drawing.Font('Consolas', 11, [System.Drawing.FontStyle]::Regular)
$titleFont = New-Object System.Drawing.Font('Segoe UI', 13, [System.Drawing.FontStyle]::Bold)
$lineHeight = [int][Math]::Ceiling($font.GetHeight()) + 5
$height = [Math]::Max(700, 92 + ($lines.Count * $lineHeight) + 36)
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $graphics.Clear([System.Drawing.Color]::FromArgb(17, 24, 39))
  $headerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(11, 17, 32))
  $graphics.FillRectangle($headerBrush, 0, 0, $width, 58)
  $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 250, 252))
  $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(229, 231, 235))
  $mutedBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(147, 197, 253))
  $graphics.DrawString('Katbot plain output proof - current generated command text', $titleFont, $titleBrush, 34, 17)
  $y = 82
  foreach ($line in $lines) {
    $brush = if ($line.StartsWith('Kat simulated output:') -or $line.StartsWith('KATBOT')) { $mutedBrush } else { $textBrush }
    $graphics.DrawString($line, $font, $brush, 34, $y)
    $y += $lineHeight
  }
  $bitmap.Save($OutputFile, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  if ($graphics) { $graphics.Dispose() }
  if ($bitmap) { $bitmap.Dispose() }
  if ($font) { $font.Dispose() }
  if ($titleFont) { $titleFont.Dispose() }
}
`, 'utf8');

  try {
    const result = spawnSync('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptFile,
      inputFile,
      file,
    ], { encoding: 'utf8', timeout: 30000 });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error('PNG renderer failed: ' + (result.stderr || result.stdout || 'exit ' + result.status));
    }
  } finally {
    for (const tempFile of [inputFile, scriptFile]) {
      try { fs.unlinkSync(tempFile); } catch {}
    }
  }
}

async function main() {
  const proof = buildKatPlainProof({ rootDir: ROOT, ticker: 'SPX' });
  const files = writeKatPlainProof(proof, OUT_DIR);
  const png = path.join(OUT_DIR, 'katbot-sanity.png');
  renderPlainTextPng(proof.proof_text, png);

  const result = {
    ok: proof.config.heatmap_requests_configured === true &&
      proof.config.secondary_research_configured === true &&
      proof.counts.raw > 0 &&
      proof.counts.processed > 0 &&
      /chart-backed posts/.test(proof.outputs.equity_chart || '') &&
      pngLooksValid(png),
    generated_at: proof.generated_at,
    as_of: proof.as_of,
    counts: proof.counts,
    heatmap_requests_configured: proof.config.heatmap_requests_configured,
    secondary_research_configured: proof.config.secondary_research_configured,
    discord_output_gated: {
      responses_enabled: proof.config.discord_responses_enabled,
      posts_enabled: proof.config.discord_posts_enabled,
    },
    files: {
      ...files,
      png,
    },
    png_valid: pngLooksValid(png),
  };

  fs.writeFileSync(path.join(OUT_DIR, 'katbot-proof-result.json'), JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
