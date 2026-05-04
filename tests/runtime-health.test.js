'use strict';

const { parseNetstat, parseWmicList, checkRuntimeHealth } = require('../scripts/check-runtime-health');
const { stopLukeDev } = require('../scripts/stop-luke-dev');

function response(body, ok = true, status = 200) {
  return {
    ok,
    status,
    async text() {
      return typeof body === 'string' ? body : JSON.stringify(body);
    },
  };
}

describe('runtime health utilities', () => {
  it('parses a listening pid from netstat output', () => {
    const output = '  TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       33092';

    expect(parseNetstat(output, 3000)).toBe(33092);
  });

  it('reports current Luke when /api/health responds as Luke', async () => {
    const execFile = (cmd) => {
      if (cmd === 'netstat') return '  TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       1234';
      return 'ProcessId=1234\r\nCommandLine=node index.js\r\nExecutablePath=C:\\Program Files\\nodejs\\node.exe\r\n';
    };
    const fetchFn = async () => response({ ok: true, app: 'Luke', pid: 1234, port: 3000 });

    const result = await checkRuntimeHealth({ port: 3000, execFile, fetchFn });

    expect(result.status).toBe('current Luke');
    expect(result.ok).toBe(true);
    expect(result.safe_to_stop_with_force).toBe(true);
  });

  it('still reports current Luke when PID lookup is unavailable but /api/health responds', async () => {
    const execFile = () => {
      throw new Error('spawn EPERM');
    };
    const fetchFn = async () => response({ ok: true, app: 'Luke', pid: 1234, port: 3000 });

    const result = await checkRuntimeHealth({ port: 3000, execFile, fetchFn });

    expect(result.status).toBe('current Luke');
    expect(result.pid).toBe(null);
    expect(result.ok).toBe(true);
    expect(result.safe_to_stop_with_force).toBe(false);
  });

  it('reports stale Luke when node index.js is serving old routes without /api/health', async () => {
    const execFile = (cmd) => {
      if (cmd === 'netstat') return '  TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       1234';
      return 'ProcessId=1234\r\nCommandLine=node index.js\r\nExecutablePath=C:\\Program Files\\nodejs\\node.exe\r\n';
    };
    const fetchFn = async () => response('Cannot GET /api/health', false, 404);

    const result = await checkRuntimeHealth({ port: 3000, execFile, fetchFn });

    expect(result.status).toBe('stale Luke');
    expect(result.ok).toBe(false);
    expect(result.safe_to_stop_with_force).toBe(true);
  });

  it('does not stop an unknown process by default', async () => {
    const calls = [];
    const execFile = (cmd, args) => {
      calls.push([cmd, args]);
      if (cmd === 'netstat') return '  TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       9999';
      return 'ProcessId=9999\r\nCommandLine=C:\\Other\\server.exe\r\nExecutablePath=C:\\Other\\server.exe\r\n';
    };
    const fetchFn = async () => response('not luke');

    const result = await stopLukeDev({ port: 3000, execFile, fetchFn, force: false });

    expect(result.ok).toBe(false);
    expect(result.action).toBe('refused');
    expect(calls.some(([cmd]) => cmd === 'taskkill')).toBe(false);
  });

  it('only reports would_stop for safe Luke without --force', async () => {
    const execFile = (cmd) => {
      if (cmd === 'netstat') return '  TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       1234';
      return 'ProcessId=1234\r\nCommandLine=node index.js\r\nExecutablePath=C:\\Program Files\\nodejs\\node.exe\r\n';
    };
    const fetchFn = async () => response({ ok: true, app: 'Luke', pid: 1234, port: 3000 });

    const result = await stopLukeDev({ port: 3000, execFile, fetchFn, force: false });

    expect(result.action).toBe('would_stop');
    expect(result.stopped).toBe(false);
  });

  it('parses WMIC list output', () => {
    expect(parseWmicList('CommandLine=node index.js\r\nProcessId=1234\r\n')).toEqual({
      CommandLine: 'node index.js',
      ProcessId: '1234',
    });
  });
});
