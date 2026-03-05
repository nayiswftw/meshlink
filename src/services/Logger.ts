/**
 * Logger — Structured logging utility for Meshlink.
 *
 * Wraps console methods with tag prefixes and can be
 * silenced in production builds via __DEV__ flag.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ENABLED_IN_PRODUCTION: Set<LogLevel> = new Set(['warn', 'error']);

function shouldLog(level: LogLevel): boolean {
    if (__DEV__) return true;
    return ENABLED_IN_PRODUCTION.has(level);
}

export function createLogger(tag: string) {
    const prefix = `[${tag}]`;

    return {
        debug: (...args: unknown[]) => {
            if (shouldLog('debug')) console.debug(prefix, ...args);
        },
        info: (...args: unknown[]) => {
            if (shouldLog('info')) console.info(prefix, ...args);
        },
        warn: (...args: unknown[]) => {
            if (shouldLog('warn')) console.warn(prefix, ...args);
        },
        error: (...args: unknown[]) => {
            if (shouldLog('error')) console.error(prefix, ...args);
        },
    };
}
