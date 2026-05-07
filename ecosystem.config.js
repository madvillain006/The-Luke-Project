const cwd = __dirname;
require("dotenv").config({ path: require("path").join(cwd, ".env") });

module.exports = {
  apps: [
    {
      name: "luke-server",
      script: "index.js",
      cwd,
      env: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        GEMINI_MODEL: process.env.GEMINI_MODEL,
        GEMINI_MODELS: process.env.GEMINI_MODELS,
        GROQ_API_KEY: process.env.GROQ_API_KEY,
        GROQ_MODEL: process.env.GROQ_MODEL,
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
        DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
        DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
        FALLBACK_PROVIDER_ORDER: process.env.FALLBACK_PROVIDER_ORDER,
        OLLAMA_HOST: process.env.OLLAMA_HOST,
        OLLAMA_MODEL: process.env.OLLAMA_MODEL,
        KAT_BOT_TOKEN: process.env.KAT_BOT_TOKEN,
        KATBOT_ENABLE_LIVE_VISION: process.env.KATBOT_ENABLE_LIVE_VISION,
        NODE_ENV: "production"
      },
      restart_delay: 3000,
      autorestart: true,
      stop_exit_codes: [0],
      max_restarts: 5,
      min_uptime: '60s',
      watch: false
    },
    {
      name: "luke-scheduler",
      script: "scheduler.js",
      cwd,
      env: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        GEMINI_MODEL: process.env.GEMINI_MODEL,
        GEMINI_MODELS: process.env.GEMINI_MODELS,
        GROQ_API_KEY: process.env.GROQ_API_KEY,
        GROQ_MODEL: process.env.GROQ_MODEL,
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
        DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
        DEEPSEEK_BASE_URL: process.env.DEEPSEEK_BASE_URL,
        FALLBACK_PROVIDER_ORDER: process.env.FALLBACK_PROVIDER_ORDER,
        OLLAMA_HOST: process.env.OLLAMA_HOST,
        OLLAMA_MODEL: process.env.OLLAMA_MODEL,
        NODE_ENV: "production"
      },
      restart_delay: 3000,
      autorestart: true,
      stop_exit_codes: [0],
      max_restarts: 5,
      min_uptime: '60s',
      watch: false
    },
    {
      name: "luke-tunnel",
      script: "scripts/start-luke-cloudflare-tunnel.js",
      cwd,
      env: { NODE_ENV: "production" },
      restart_delay: 10000,
      // Quick-tunnel URLs are pasted into TradingView alerts. Never let PM2
      // silently respawn this process with a new URL.
      autorestart: false,
      stop_exit_codes: [0],
      max_restarts: 0,
      min_uptime: '10s',
      watch: false
    },
    {
      name: "luke-ninja-tunnel-watchdog",
      script: "agents/agent-15-ninja-tunnel-watchdog.js",
      cwd,
      env: { NODE_ENV: "production" },
      restart_delay: 10000,
      autorestart: true,
      stop_exit_codes: [0],
      max_restarts: 20,
      min_uptime: '10s',
      watch: false
    }
  ]
};
