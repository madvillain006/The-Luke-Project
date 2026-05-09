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
    expect(source).toContain('LevelSourceForLine');
    expect(source).toContain('mancini_target');
    expect(source).toContain('mancini_read');
    expect(source).toContain('Source.StartsWith("saty", StringComparison.Ordinal)');
    expect(source).toContain('LevelWindowPoints = 80.0');
    expect(source).toContain('VisibleLevels()');
    expect(source).toContain('if (source == "both") return Brushes.Yellow');
    expect(source).toContain('LevelFilePath = @"C:\\Users\\conor\\luke\\data\\ninjatrader\\luke-native-levels.txt"');
    expect(source).not.toContain('PineBridgeEventsPath');
    expect(source).not.toContain('pine L ');
    expect(source).not.toContain('| pine ');
    expect(source).toContain('NativeTelemetryPath = @"C:\\Users\\conor\\luke\\state\\events\\ninja-native-shadow.jsonl"');
    expect(source).toContain('NoteDouble');
    expect(source).toContain('Note = note');
    expect(source).toContain('public string Note;');
    expect(source).toContain('public double Entry;');
    expect(source).toContain('IsShadowOnly');
    expect(source).toContain('score incl cxl');
    expect(source).toContain('realistic net');
    expect(source).toContain('cxl net');
    expect(source).toContain('gross total');
    expect(source).toContain('watch/long/cxl');
    expect(source).toContain('native L/C');
    expect(source).toContain('costPerContract');
    expect(source).toContain('base lines         M blue | S lime | both yellow');
    expect(source).toContain('chart-only: no order APIs');
    expect(source).toContain('sim score');
    expect(source).toContain('sim net');
    expect(source).toContain('sim detail');
    expect(source).toContain('EntryTp2');
    expect(source).toContain('SimulateLong');
    expect(source).toContain('SimResult');
    expect(source).toContain('NOFILL');
    expect(source).toContain('"BE"');
    expect(source).toContain('2.0 * costPerContract');
    expect(source).toContain('--- sim: what should have happened ---');
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
