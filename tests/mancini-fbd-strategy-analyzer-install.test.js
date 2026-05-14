const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE_PATH = path.join(ROOT, 'ninjatrader', 'ManciniFbdStrategyAnalyzer.cs');
const { auditStrategySource, patchProject } = require('../scripts/install-mancini-fbd-strategy-analyzer');

describe('Mancini FBD Strategy Analyzer installer', () => {
  it('passes the installer source gate', () => {
    const source = fs.readFileSync(SOURCE_PATH, 'utf8');
    const audit = auditStrategySource(source);

    expect(audit.status).toBe('clean');
    expect(audit.blockers).toEqual([]);
  });

  it('adds the NinjaTrader compile include once', () => {
    const project = [
      '<Project>',
      '  <ItemGroup>',
      '    <Compile Include="Strategies\\LukeAlertBridgeStrategy.cs" />',
      '    <Compile Include="Strategies\\LukeNativeShadowStrategy.cs" />',
      '  </ItemGroup>',
      '</Project>',
      '',
    ].join('\r\n');

    const patched = patchProject(project);
    expect(patched.changed).toBe(true);
    expect(patched.text).toContain('<Compile Include="Strategies\\ManciniFbdStrategyAnalyzer.cs" />');

    const second = patchProject(patched.text);
    expect(second.changed).toBe(false);
    expect((second.text.match(/ManciniFbdStrategyAnalyzer\.cs/g) || []).length).toBe(1);
  });
});
