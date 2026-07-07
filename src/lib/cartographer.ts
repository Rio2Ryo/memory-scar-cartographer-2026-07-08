export type RoomId = 'foyer' | 'archive' | 'kitchen' | 'server' | 'nursery' | 'roof';

export type Room = {
  id: RoomId;
  name: string;
  x: number;
  y: number;
  trust: number;
  leak: number;
  scar: number;
  ghostX: number;
  ghostY: number;
  publicStory: string;
  privateTruth: string;
  quarantines: string[];
};

export type LogEntry = { id: string; text: string; kind: 'audit' | 'mend' | 'import' | 'replay' | 'weird' };

export type AppState = {
  seed: string;
  loop: number;
  selected: RoomId;
  rooms: Room[];
  logs: LogEntry[];
  carryoverLabel: string;
  exportedAt?: string;
};

const roomSeeds: Array<Omit<Room, 'trust' | 'leak' | 'scar' | 'ghostX' | 'ghostY' | 'quarantines'>> = [
  { id: 'foyer', name: '玄関の証言灯', x: 14, y: 24, publicStory: '全員が同じ出口から帰った', privateTruth: '一人だけ昨日の傷を持ち込んだ' },
  { id: 'archive', name: '記録棚の二重底', x: 42, y: 18, publicStory: '昨日のJSONは綺麗に保存された', privateTruth: '修復ログだけが3分未来から来ている' },
  { id: 'kitchen', name: '台所の謝罪鍋', x: 70, y: 32, publicStory: '鍋は誰も責めていない', privateTruth: '鍋はパッチ名を全部覚えている' },
  { id: 'server', name: '寝不足サーバー室', x: 26, y: 64, publicStory: '再起動で落ち着いた', privateTruth: '再起動後に壁紙だけが移動した' },
  { id: 'nursery', name: '未完了の子供部屋', x: 56, y: 68, publicStory: 'おもちゃは片付いた', privateTruth: 'おもちゃは昨日の部屋名を名乗っている' },
  { id: 'roof', name: '屋上の持ち越し鉢', x: 82, y: 62, publicStory: '鉢植えは新しい朝を待つ', privateTruth: '鉢植えは前回の弱点だけを育てる' },
];

export const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

export function sanitize(input: string) {
  return input.replace(/[<>]/g, '').replace(/onerror/gi, 'on-error').slice(0, 160);
}

function hash(text: string) {
  let h = 2166136261;
  for (const char of text) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function jitter(seed: string, index: number, span: number) {
  return (hash(`${seed}:${index}`) % (span * 2 + 1)) - span;
}

function logId(seed: string, loop: number, kind: string, text: string, count: number) {
  return `${kind}-${loop}-${count}-${hash(seed + text + count).toString(36)}`;
}

export function boot(seed = '708', carryText = ''): AppState {
  const carry = parseCarry(carryText);
  const label = carry.label;
  const rooms = roomSeeds.map((base, index) => {
    const carried = carry.scars[index % Math.max(1, carry.scars.length)] ?? 0;
    return {
      ...base,
      trust: clamp(54 + jitter(seed, index, 23) - carried),
      leak: clamp(26 + jitter(seed, index + 7, 20) + carried),
      scar: clamp(4 + Math.abs(jitter(seed, index + 13, 13)) + carried),
      ghostX: jitter(seed + label, index + 17, 8) + carried / 3,
      ghostY: jitter(seed + label, index + 23, 8) - carried / 4,
      quarantines: carry.notes[index] ? [carry.notes[index]] : [],
    };
  });
  return {
    seed,
    loop: carry.loop,
    selected: worstRoom(rooms).id,
    rooms,
    carryoverLabel: label,
    logs: [
      { id: logId(seed, carry.loop, 'import', label, 0), kind: 'import', text: `持ち越し: ${label}。傷合計 ${rooms.reduce((sum, r) => sum + r.scar, 0)} / 漏れ合計 ${rooms.reduce((sum, r) => sum + r.leak, 0)}` },
    ],
  };
}

function parseCarry(text: string) {
  const safe = sanitize(text.trim());
  if (!safe) return { label: '昨日の傷なし・ただし疑いは残る', scars: [0], notes: [] as string[], loop: 1 };
  try {
    const parsed = JSON.parse(text) as Partial<AppState> & { scars?: number[]; note?: string };
    const rooms = Array.isArray(parsed.rooms) ? parsed.rooms : [];
    const scars = rooms.map((room) => Number((room as Partial<Room>).scar ?? 0)).filter(Number.isFinite);
    const exported = typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '未署名JSON';
    return { label: `インポートJSON ${exported} / rooms:${rooms.length}`, scars: scars.length ? scars : [7], notes: [`輸入JSON:${exported}`], loop: clamp(Number(parsed.loop ?? 1) + 1, 1, 9) };
  } catch {
    return { label: `手書き持ち越し「${safe}」`, scars: [safe.length % 17, (hash(safe) % 19) + 3], notes: [safe], loop: 2 };
  }
}

export function worstRoom(rooms: Room[]) {
  return [...rooms].sort((a, b) => b.leak + b.scar - b.trust - (a.leak + a.scar - a.trust))[0];
}

export function audit(state: AppState): AppState {
  const target = worstRoom(state.rooms);
  const text = `${target.name}を監査: 公的記録「${target.publicStory}」/ 本当は「${target.privateTruth}」。危険度 ${target.leak + target.scar - target.trust}`;
  return addLog({ ...state, selected: target.id }, 'audit', text);
}

export function mend(state: AppState, roomId = state.selected): AppState {
  const target = state.rooms.find((room) => room.id === roomId) ?? worstRoom(state.rooms);
  let after: AppState = { ...state, selected: target.id, rooms: state.rooms.map((room) => {
    const distance = Math.hypot(room.x - target.x, room.y - target.y);
    if (room.id === target.id) {
      return { ...room, leak: clamp(room.leak - 24), trust: clamp(room.trust + 17), scar: clamp(room.scar + 6), publicStory: '修復済みとして掲示された', privateTruth: `${room.privateTruth} / 修復の縫い目が増えた` };
    }
    if (distance < 36) {
      return { ...room, x: clamp(room.x + Math.sign(room.x - target.x || 1) * 4, 6, 94), y: clamp(room.y + Math.sign(room.y - target.y || 1) * 3, 10, 90), leak: clamp(room.leak + 8), scar: clamp(room.scar + 3), ghostX: room.ghostX + Math.sign(room.x - target.x || 1) * 4, ghostY: room.ghostY + Math.sign(room.y - target.y || 1) * 3 };
    }
    return room;
  }) };
  const moved = after.rooms.filter((room) => room.id !== target.id && (room.ghostX !== state.rooms.find((r) => r.id === room.id)?.ghostX || room.ghostY !== state.rooms.find((r) => r.id === room.id)?.ghostY)).length;
  after = addLog(after, 'mend', `${target.name}を縫合。対象は落ち着いたが、隣室${moved}件が幽霊座標ごとずれた。`);
  return after;
}

export function replay(state: AppState): AppState {
  const rooms = state.rooms.map((room, index) => ({
    ...room,
    ghostX: room.ghostX + jitter(state.seed + state.loop, index, 4),
    ghostY: room.ghostY + jitter(state.seed + state.loop, index + 3, 4),
    scar: clamp(room.scar + (room.quarantines.length ? 2 : 1)),
    publicStory: room.publicStory.replace('昨日', '前回'),
  }));
  return addLog({ ...state, loop: state.loop + 1, rooms, selected: worstRoom(rooms).id }, 'replay', `二周目再演: loop ${state.loop + 1}。前回の傷が家具の影として再配置された。`);
}

export function injectWeird(state: AppState, roomId: RoomId, note: string): AppState {
  const safe = sanitize(note);
  const rooms = state.rooms.map((room) => room.id === roomId ? { ...room, quarantines: [...room.quarantines, safe], scar: clamp(room.scar + 5), leak: clamp(room.leak + 3) } : room);
  return addLog({ ...state, rooms, selected: roomId }, 'weird', `変な持ち越し札を隔離: ${safe || '空白の札'}`);
}

export function exportState(state: AppState): AppState {
  return addLog({ ...state, exportedAt: new Date(0).toISOString() }, 'import', `JSONを書き出し可能。scar合計 ${state.rooms.reduce((sum, room) => sum + room.scar, 0)}`);
}

function addLog(state: AppState, kind: LogEntry['kind'], text: string): AppState {
  const logs = [...state.logs, { id: logId(state.seed, state.loop, kind, text, state.logs.length), kind, text }];
  return { ...state, logs };
}

export function encodeShare(state: AppState) {
  const payload = JSON.stringify({ seed: state.seed, loop: state.loop, rooms: state.rooms.map(({ id, scar, leak, trust, ghostX, ghostY, quarantines }) => ({ id, scar, leak, trust, ghostX, ghostY, quarantines })) });
  return btoa(unescape(encodeURIComponent(payload)));
}

export function decodeShare(encoded: string) {
  return decodeURIComponent(escape(atob(encoded)));
}
