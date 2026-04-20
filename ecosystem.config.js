module.exports = {
  apps: [
    {
      name: "jarvis-server",
      script: "index.js",
      cwd: "C:\\Users\\conor\\jarvis",
      env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, NODE_ENV: "production" },
      restart_delay: 3000,
      autorestart: false,
      watch: false
    },
    {
      name: "jarvis-scheduler",
      script: "scheduler.js",
      cwd: "C:\\Users\\conor\\jarvis",
      env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, NODE_ENV: "production" },
      restart_delay: 3000,
      autorestart: false,
      watch: false
    },
    {
      name: "jarvis-intraday",
      script: "intraday-scraper.js",
      cwd: "C:\\Users\\conor\\jarvis",
      env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, NODE_ENV: "production" },
      autorestart: false,
      watch: false
    }
  ]
};