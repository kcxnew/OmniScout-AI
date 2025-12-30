
import pino from 'pino';

// Use a browser-safe check for environment variables
const logLevel = (typeof process !== 'undefined' && process.env?.LOG_LEVEL) || 'info';

export const logger = pino({
  level: logLevel,
  base: { service: 'omni-engine' },
  browser: {
    asObject: true
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
