const fs = require('fs');
const path = require('path');

const {
  auditIndicatorSource,
  patchProject,
} = require('../scripts/install-ninja-parity-overlay');

const ROOT = path.join(__dirname, '..');
const SOURCE_PATH = path.join(ROOT, 'ninjatrader', 'LukeParityOverlayIndicator.cs');

function readSource() {
  return fs.readFileSync(SOURCE_PATH, 'utf8');
}

describe('LukeParityOverlayIndicator', () => {
  it('is a chart-only NinjaTrader indicator with local parity file defaults', () => {
    const source = readSource();
    const audit = auditIndicatorSource(source);

    expect(audit.status).toBe('clean');
    expect(audit.no_order_apis).toBe(true);
    expect(source).toContain('namespace NinjaTrader.NinjaScript.Indicators');
    expect(source).toContain('public class LukeParityOverlayIndicator : Indicator');
    expect(source).toContain('IsOverlay = true');
    expect(source).toContain('Draw.TextFixed');
    expect(source).toContain('Draw.HorizontalLine');
    expect(source).toContain('TextPosition.TopRight');
    expect(source).toContain('AddDataSeries(BarsPeriodType.Day, 1)');
    expect(source).toContain('ComputeSatyAtr');
    expect(source).toContain('SatyTriggerPct = 0.236');
    expect(source).toContain('previousClose + satyAtr * 0.382');
    expect(source).toContain('AddMilliseconds(epochMs).ToLocalTime()');
    expect(source).toContain('WAIT daily bars');
    expect(source).toContain('set chart Days to load >= 30 and reload');
    expect(source).toContain('EMPTY paste Mancini levels into luke-native-levels.txt');
    expect(source).toContain('Source.StartsWith("saty", StringComparison.Ordinal)');
    expect(source).toContain('LevelFilePath = @"C:\\Users\\conor\\luke\\data\\ninjatrader\\luke-native-levels.txt"');
    expect(source).toContain('PineBridgeEventsPath = @"C:\\Users\\conor\\luke\\state\\events\\ninjatrader-bridge.jsonl"');
    expect(source).toContain('NativeTelemetryPath = @"C:\\Users\\conor\\luke\\state\\events\\ninja-native-shadow.jsonl"');
    expect(source).toContain('base lines         M blue | S lime | both yellow');
    expect(source).toContain('chart-only: no order APIs');
  });

  it('adds the indicator compile include under NinjaTrader Indicators without duplicating it', () => {
    const input = [
      '<ItemGroup>',
      '    <Compile Include="Indicators\\@SampleCustomPlot.cs" />',
      '    <Compile Include="Strategies\\LukeAlertBridgeStrategy.cs" />',
      '</ItemGroup>',
      '',
    ].join('\r\n');

    const patched = patchProject(input);
    expect(patched.changed).toBe(true);
    expect(patched.text).toContain('    <Compile Include="Indicators\\@SampleCustomPlot.cs" />\r\n    <Compile Include="Indicators\\LukeParityOverlayIndicator.cs" />');

    const second = patchProject(patched.text);
    expect(second.changed).toBe(false);
    expect((second.text.match(/LukeParityOverlayIndicator/g) || []).length).toBe(1);
  });
});
