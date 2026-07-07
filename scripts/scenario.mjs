const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [rawKey, ...rest] = arg.replace(/^--/, '').split('=');
  return [rawKey, rest.join('=') || 'true'];
}));
const seed = args.seed || '708';
const loop = Number(args.loop || 2);
const weird = String(args.weird || 'CLI持ち越し札 <img src=x onerror=alert(1)> 𓂀');
const hash = (text) => [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
const sanitize = (input) => input.replace(/[<>]/g, '').replace(/onerror/gi, 'on-error').slice(0, 160);
const rooms = ['玄関の証言灯','記録棚の二重底','台所の謝罪鍋','寝不足サーバー室','未完了の子供部屋','屋上の持ち越し鉢'].map((name, index) => ({
  id: `room-${index}`,
  name,
  scar: 8 + (hash(`${seed}:scar:${index}`) % 23),
  leak: 18 + (hash(`${seed}:leak:${index}`) % 39),
  trust: 42 + (hash(`${seed}:trust:${index}`) % 45),
  ghost: { x: (hash(`${seed}:x:${index}`) % 17) - 8, y: (hash(`${seed}:y:${index}`) % 17) - 8 },
}));
const logs = [];
for (let i = 0; i < loop; i += 1) {
  const worst = rooms.toSorted((a, b) => b.leak + b.scar - b.trust - (a.leak + a.scar - a.trust))[0];
  worst.leak = Math.max(0, worst.leak - 18);
  worst.scar += 6;
  rooms.forEach((room, index) => {
    if (room !== worst && Math.abs(index - Number(worst.id.split('-')[1])) <= 1) {
      room.scar += 3;
      room.ghost.x += index % 2 ? 4 : -4;
    }
  });
  logs.push({ id: `cli-${i}-${hash(worst.name + i).toString(36)}`, text: `${worst.name}を縫合し、隣接する記憶がずれた` });
}
rooms[1].quarantine = sanitize(weird);
const summary = { seed, loop, scars: rooms.reduce((sum, r) => sum + r.scar, 0), leaks: rooms.reduce((sum, r) => sum + r.leak, 0), sanitizedWeird: rooms[1].quarantine, movedGhosts: rooms.filter((r) => r.ghost.x !== 0 || r.ghost.y !== 0).length, logs, rooms };
console.log(JSON.stringify(summary, null, args.json ? 2 : 0));
