/**
 * Tests for @nextrush/log/testing utilities.
 *
 * Regression coverage for DEAD-2 (REPORT.md): the mock logger's argument
 * parsing previously diverged from the real Logger's parseLogArgs, so a
 * test asserting on `mockLog.calls` could pass while production behavior
 * differed (e.g. numeric/boolean/bigint positional args were silently
 * dropped from the message).
 */

import { describe, expect, it } from 'vitest';
import { createMockLogger, createRecordingTransport, expectLogged, expectNoErrors } from '../src/testing/index.js';

describe('createMockLogger', () => {
  it('records a simple message', () => {
    const mock = createMockLogger();
    mock.info('hello');

    expect(mock.calls.info).toHaveLength(1);
    expect(mock.calls.info[0]?.message).toBe('hello');
  });

  it('folds numeric positional args into the message, matching production parseLogArgs', () => {
    const mock = createMockLogger();
    mock.info('count', 42);

    expect(mock.calls.info[0]?.message).toBe('count 42');
  });

  it('folds boolean positional args into the message, matching production parseLogArgs', () => {
    const mock = createMockLogger();
    mock.info('enabled', true);

    expect(mock.calls.info[0]?.message).toBe('enabled true');
  });

  it('folds bigint positional args into the message, matching production parseLogArgs', () => {
    const mock = createMockLogger();
    mock.info('id', 9007199254740993n);

    expect(mock.calls.info[0]?.message).toBe('id 9007199254740993');
  });

  it('merges object data across multiple object args', () => {
    const mock = createMockLogger();
    mock.info({ a: 1 }, { b: 2 });

    expect(mock.calls.info[0]?.data).toEqual({ a: 1, b: 2 });
  });

  it('records an Error and derives the message from it when no string is given', () => {
    const mock = createMockLogger();
    const err = new Error('boom');
    mock.error(err);

    expect(mock.calls.error[0]?.error).toBe(err);
    expect(mock.calls.error[0]?.message).toBe('boom');
  });

  it('falls back to "Empty log" when no args are given, matching production', () => {
    const mock = createMockLogger();
    mock.warn();

    expect(mock.calls.warn[0]?.message).toBe('Empty log');
  });

  it('child() prefixes context and clear() resets recorded calls', () => {
    const mock = createMockLogger('app');
    const child = mock.child('db');

    child.info('connected');
    expect(child.getContext()).toBe('app:db');

    mock.info('top-level');
    mock.clear();
    expect(mock.calls.all).toHaveLength(0);
  });

  it('wasLogged/assertLogged/expectLogged work against a matching message', () => {
    const mock = createMockLogger();
    mock.info('user created', { id: 1 });

    expect(mock.wasLogged('info', 'user created')).toBe(true);
    expect(() => { mock.assertLogged('info', 'user created'); }).not.toThrow();
    expect(() => { expectLogged(mock, 'info', /user created/); }).not.toThrow();
  });

  it('assertLogged throws a descriptive error when the message was not logged', () => {
    const mock = createMockLogger();
    mock.info('something else');

    expect(() => { mock.assertLogged('info', 'expected message'); }).toThrow(/expected message/);
  });

  it('expectNoErrors passes when nothing was logged at error/fatal and throws otherwise', () => {
    const clean = createMockLogger();
    clean.info('all good');
    expect(() => { expectNoErrors(clean); }).not.toThrow();

    const dirty = createMockLogger();
    dirty.error('bad thing', new Error('bad'));
    expect(() => { expectNoErrors(dirty); }).toThrow();
  });
});

describe('createRecordingTransport', () => {
  it('records every entry passed to it and clear() empties the log', () => {
    const { transport, entries, clear } = createRecordingTransport();

    transport({
      timestamp: new Date().toISOString(),
      level: 'info',
      context: 'test',
      message: 'hello',
      runtime: 'node',
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.message).toBe('hello');

    clear();
    expect(entries).toHaveLength(0);
  });
});
