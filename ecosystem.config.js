module.exports = {
  apps: [
    {
      name: "jarvis-server",
      script: "index.js",
      cwd: "C:\\Users\\conor\\jarvis",
      env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY },
      restart_delay: 3000,
      autorestart: true
    },
    {
      name: "jarvis-scheduler",
      script: "scheduler.js",
      cwd: "C:\\Users\\conor\\jarvis",
      env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY },
      restart_delay: 3000,
      autorestart: true
    },
    {
      name: "jarvis-intraday",
      script: "intraday-scraper.js",
      cwd: "C:\\Users\\conor\\jarvis",
      env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY },
      autorestart: false
    }
  ]
};