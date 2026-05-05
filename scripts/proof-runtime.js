'use strict';

const net = require('net');

function getPortFromBaseUrl(baseUrl, fallback = 3000) {
  try {
    return Number(new URL(baseUrl).port || fallback);
  } catch {
    return fallback;
  }
}

function isPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        server.close(() => resolve(true));
      })
      .listen(port, '127.0.0.1');
  });
}

async function resolveProofPort(options) {
  const {
    baseUrl,
    proofPort,
    checkRuntimeHealth,
    portAvailable = isPortAvailable,
  } = options;
  const requestedPort = getPortFromBaseUrl(baseUrl);
  const runtime = await checkRuntimeHealth({ port: requestedPort });
  if (runtime.status === 'free') return requestedPort;

  const preferred = Number(proofPort || requestedPort + 1);
  const seen = new Set([requestedPort]);
  const candidates = [preferred, requestedPort + 1, preferred + 1]
    .filter(port => {
      if (!Number.isInteger(port) || port <= 0 || port >= 65536 || seen.has(port)) return false;
      seen.add(port);
      return true;
    });

  for (const port of candidates) {
    if (await portAvailable(port)) return port;
  }

  for (let port = Math.max(requestedPort, preferred) + 2; port < Math.max(requestedPort, preferred) + 50 && port < 65536; port += 1) {
    if (await portAvailable(port)) return port;
  }

  throw new Error(`No free proof port near ${requestedPort}`);
}

module.exports = {
  getPortFromBaseUrl,
  isPortAvailable,
  resolveProofPort,
};
