import { createLogger } from '../Logger';

// We need to declare __DEV__ for the test environment
declare const __DEV__: boolean;

describe('Logger', () => {
    let debugSpy: jest.SpiedFunction<typeof console.debug>;
    let infoSpy: jest.SpiedFunction<typeof console.info>;
    let warnSpy: jest.SpiedFunction<typeof console.warn>;
    let errorSpy: jest.SpiedFunction<typeof console.error>;

    beforeEach(() => {
        debugSpy = jest.spyOn(console, 'debug').mockImplementation();
        infoSpy = jest.spyOn(console, 'info').mockImplementation();
        warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        errorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('prefixes messages with the tag in brackets', () => {
        const log = createLogger('TestTag');
        log.info('hello');
        expect(infoSpy).toHaveBeenCalledWith('[TestTag]', 'hello');
    });

    it('passes multiple arguments through', () => {
        const log = createLogger('T');
        log.debug('a', 42, { x: 1 });
        expect(debugSpy).toHaveBeenCalledWith('[T]', 'a', 42, { x: 1 });
    });

    it('routes to correct console methods', () => {
        const log = createLogger('X');
        log.debug('d');
        log.info('i');
        log.warn('w');
        log.error('e');

        expect(debugSpy).toHaveBeenCalledTimes(1);
        expect(infoSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledTimes(1);
    });

    it('logs all levels in __DEV__ mode', () => {
        // __DEV__ is set to true in jest.config.ts globals
        const log = createLogger('Dev');
        log.debug('test');
        log.info('test');
        log.warn('test');
        log.error('test');

        expect(debugSpy).toHaveBeenCalled();
        expect(infoSpy).toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalled();
    });

    it('creates independent loggers with different tags', () => {
        const logA = createLogger('A');
        const logB = createLogger('B');

        logA.info('from A');
        logB.info('from B');

        expect(infoSpy).toHaveBeenCalledWith('[A]', 'from A');
        expect(infoSpy).toHaveBeenCalledWith('[B]', 'from B');
    });
});
