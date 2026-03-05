/** @type {import('pm2').StartOptions} */
module.exports = {
  apps: [
    {
      name: "time-flow",
      script: "src/index.ts",
      interpreter: "bun",
      cwd: "/root/time-flow",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3003,
      },
      error_file: "/root/time-flow/logs/err.log",
      out_file: "/root/time-flow/logs/out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
