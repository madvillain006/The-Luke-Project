const cwd = __dirname;

module.exports = {
  apps: [
    {
      name: "luke-server",
      script: "index.js",
      cwd,
      env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, NODE_ENV: "production" },
      restart_delay: 3000,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '60s',
      watch: false
    },
    {
      name: "luke-scheduler",
      script: "scheduler.js",
      cwd,
      env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, NODE_ENV: "production" },
      restart_delay: 3000,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '60s',
      watch: false
    }
  ]
};
