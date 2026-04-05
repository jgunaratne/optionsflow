module.exports = {
  apps: [{
    name: 'optionsflow',
    script: 'server.ts',
    interpreter: 'npx',
    interpreter_args: 'tsx',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    restart_delay: 5000,
    max_restarts: 10,
    log_file: '/var/log/optionsflow.log',
    error_file: '/var/log/optionsflow.error.log',
    time: true,
  }],
};
