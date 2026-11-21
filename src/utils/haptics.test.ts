import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HAPTIC_PATTERNS,
  isHapticsEnabled,
  setHapticsEnabled,
  triggerHaptic,
} from './haptics';

test('haptic patterns are well-formed and preference toggle gates triggerHaptic', () => {
  assert.equal(typeof HAPTIC_PATTERNS.selection, 'number');
  assert.ok(Array.isArray(HAPTIC_PATTERNS.success));
  assert.ok(Array.isArray(HAPTIC_PATTERNS.warning));

  const calls: Array<number | number[]> = [];
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      vibrate: (pattern: number | number[]) => {
        calls.push(pattern);
        return true;
      },
    },
  });

  try {
    setHapticsEnabled(true);
    assert.equal(isHapticsEnabled(), true);
    assert.equal(triggerHaptic('success'), true);
    assert.deepEqual(calls[0], HAPTIC_PATTERNS.success);

    setHapticsEnabled(false);
    assert.equal(isHapticsEnabled(), false);
    assert.equal(triggerHaptic('selection'), false);
    assert.equal(calls.length, 1);

    setHapticsEnabled(true);
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
  }
});
