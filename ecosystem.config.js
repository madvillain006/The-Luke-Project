module.exports = {
  apps: [
    {
      name: "luke-server",
      script: "index.js",
      cwd: "C:\\Users\\conor\\luke",
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
      cwd: "C:\\Users\\conor\\luke",
      env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, NODE_ENV: "production" },
      restart_delay: 3000,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '60s',
      watch: false
    },
    {
      name: "luke-intraday",
      script: "intraday-scraper.js",
      cwd: "C:\\Users\\conor\\luke",
      env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, NODE_ENV: "production" },
      autorestart: false,
      watch: false
    }
  ]
};