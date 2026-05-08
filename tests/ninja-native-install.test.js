const { patchProject } = require('../scripts/install-ninja-native-shadow');

describe('Ninja-native shadow installer', () => {
  it('adds the strategy compile include after the existing Luke bridge include', () => {
    const input = [
      '<ItemGroup>',
      '    <Compile Include="Strategies\\@SampleMACrossOver.cs" />',
      '    <Compile Include="Strategies\\LukeAlertBridgeStrategy.cs" />',
      '</ItemGroup>',
      '',
    ].join('\r\n');

    const patched = patchProject(input);
    expect(patched.changed).toBe(true);
    expect(patched.text).toContain('    <Compile Include="Strategies\\LukeAlertBridgeStrategy.cs" />\r\n    <Compile Include="Strategies\\LukeNativeShadowStrategy.cs" />');
  });

  it('does not duplicate the compile include', () => {
    const input = [
      '<ItemGroup>',
      '    <Compile Include="Strategies\\LukeAlertBridgeStrategy.cs" />',
      '    <Compile Include="Strategies\\LukeNativeShadowStrategy.cs" />',
      '</ItemGroup>',
      '',
    ].join('\r\n');

    const patched = patchProject(input);
    expect(patched.changed).toBe(false);
    expect((patched.text.match(/LukeNativeShadowStrategy/g) || []).length).toBe(1);
  });
});
