import { describe, expect, it } from 'vitest';

import {
  WORKING_TIPS,
  currentWorkingTip,
  pickRandomWorkingTip,
} from '#/tui/components/chrome/working-tips';
import { tipText } from '#/tui/constant/tips';

describe('currentWorkingTip', () => {
  it('returns a tip from WORKING_TIPS', () => {
    const now = Date.now();
    const tip = currentWorkingTip(now);
    expect(tip).toBeDefined();
    expect(WORKING_TIPS.some((t) => t.en === tip!.en)).toBe(true);
  });

  it('returns the same tip for the same timestamp', () => {
    const now = 1_000_000;
    const first = currentWorkingTip(now);
    const second = currentWorkingTip(now);
    expect(first).toBe(second);
  });
});

describe('pickRandomWorkingTip', () => {
  it('returns a tip from WORKING_TIPS', () => {
    const tip = pickRandomWorkingTip();
    expect(tip).toBeDefined();
    expect(WORKING_TIPS.some((t) => t.en === tip!.en)).toBe(true);
  });

  it('avoids the excluded text when possible', () => {
    const first = pickRandomWorkingTip()!;
    const firstText = tipText(first);
    let different = false;
    for (let i = 0; i < 50; i++) {
      const next = pickRandomWorkingTip(firstText);
      if (next !== undefined && tipText(next) !== firstText) {
        different = true;
        break;
      }
    }
    if (WORKING_TIPS.length > 1) {
      expect(different).toBe(true);
    }
  });

  it('falls back to the rotation when every tip would be excluded', () => {
    // If all working tips share the same text, exclusion cannot be satisfied.
    const onlyTip = WORKING_TIPS[0];
    if (onlyTip !== undefined && WORKING_TIPS.every((t) => t.en === onlyTip.en)) {
      expect(pickRandomWorkingTip(tipText(onlyTip))).toBeDefined();
    }
  });
});
