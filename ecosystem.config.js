module.exports = {
  apps: [{
    name: 'buildhive-api',
    script: 'dist/server.js',
    instances: process.env.NODE_ENV === 'production' ? 'max' : 1,
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'debug'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3000,
      LOG_LEVEL: 'info'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    reload_delay: 1000,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    // Health check
    health_check_grace_period: 3000,
    // Graceful shutdown
    shutdown_with_message: true,
    // Environment specific settings
    node_args: process.env.NODE_ENV === 'production' ? 
      ['--max-old-space-size=2048'] : 
      ['--max-old-space-size=1024', '--inspect=0.0.0.0:9229'],
    // Monitoring
    monitoring: false,
    pmx: true,
    // Advanced PM2 features
    vizion: false,
    automation: false,
    // Custom environment variables
    env_vars: {
      'COMMON_VARIABLE': 'true'
    },
    // Log rotation
    log_type: 'json',
    // Graceful start/stop
    wait_ready: true,
    listen_timeout: 8000,
    kill_timeout: 5000
  }],

  // Deployment configuration for different environments
  deploy: {
    production: {
      user: 'deploy',
      host: ['buildhive-prod-1', 'buildhive-prod-2'],
      ref: 'origin/main',
      repo: 'git@github.com:FlameGreat-1/BuildHive-Backend.git',
      path: '/var/www/buildhive-api',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt update && apt install git -y'
    },
    staging: {
      user: 'deploy',
      host: 'buildhive-staging',
      ref: 'origin/develop',
      repo: 'git@github.com:FlameGreat-1/BuildHive-Backend.git',
      path: '/var/www/buildhive-api-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging'
    }
  }
};
