import { describe, expect, it } from 'vitest';
import { audit, boot, exportState, injectWeird, mend, replay, sanitize } from './cartographer';

describe('memory scar cartographer', () => {
  it('boots deterministic rooms from seed', () => {
    expect(boot('708').rooms.map((room) => room.scar)).toEqual(boot('708').rooms.map((room) => room.scar));
  });

  it('mending leaves target calmer and neighbors displaced', () => {
    const state = audit(boot('708'));
    const before = state.rooms.find((room) => room.id === state.selected)!;
    const after = mend(state, state.selected);
    const repaired = after.rooms.find((room) => room.id === state.selected)!;
    expect(repaired.leak).toBeLessThan(before.leak);
    expect(after.logs.at(-1)?.text).toContain('隣室');
  });

  it('sanitizes hostile carryover without executable brackets', () => {
    const hostile = `<img src=x onerror=alert('cult')> 𓂀 {{7*7}}`;
    const after = injectWeird(boot('708'), 'archive', hostile);
    expect(after.rooms.find((room) => room.id === 'archive')?.quarantines.at(-1)).not.toContain('<');
    expect(sanitize(hostile)).not.toContain('onerror');
  });

  it('replay and exported state preserve second-run memory', () => {
    const after = exportState(replay(mend(boot('708'))));
    expect(after.loop).toBe(2);
    expect(after.exportedAt).toContain('1970');
    expect(after.logs.map((log) => log.id).length).toBe(new Set(after.logs.map((log) => log.id)).size);
  });
});
