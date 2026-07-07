import { useEffect, useMemo, useRef, useState } from 'react';
import { audit, boot, encodeShare, exportState, injectWeird, mend, replay, sanitize, type AppState, type RoomId } from './lib/cartographer';
import './styles.css';

declare global {
  interface Window {
    __SCAR_CARTOGRAPHER__?: {
      getState: () => AppState;
      audit: () => AppState;
      mend: (roomId?: RoomId) => AppState;
      replay: () => AppState;
      injectWeird: (note: string, roomId?: RoomId) => AppState;
      importCarry: (text: string) => AppState;
      exportCarry: () => string;
      share: () => string;
    };
  }
}

function getInitial() {
  const params = new URLSearchParams(location.search);
  const seed = params.get('seed') ?? '708';
  const carry = params.get('carry');
  if (carry) {
    try {
      return boot(seed, decodeURIComponent(escape(atob(carry))));
    } catch {
      return boot(seed, carry);
    }
  }
  return boot(seed);
}

export default function App() {
  const [state, setState] = useState<AppState>(getInitial);
  const [carryText, setCarryText] = useState('');
  const [weirdText, setWeirdText] = useState('昨日の修復者が家具に謝らなかった <img src=x onerror=alert(1)> 𓂀');
  const stateRef = useRef(state);
  const selected = state.rooms.find((room) => room.id === state.selected) ?? state.rooms[0];
  const totals = useMemo(() => ({
    scar: state.rooms.reduce((sum, room) => sum + room.scar, 0),
    leak: state.rooms.reduce((sum, room) => sum + room.leak, 0),
    trust: Math.round(state.rooms.reduce((sum, room) => sum + room.trust, 0) / state.rooms.length),
  }), [state.rooms]);

  const commit = (next: AppState) => {
    stateRef.current = next;
    setState(next);
    return next;
  };

  useEffect(() => {
    stateRef.current = state;
    window.__SCAR_CARTOGRAPHER__ = {
      getState: () => stateRef.current,
      audit: () => commit(audit(stateRef.current)),
      mend: (roomId) => commit(mend(stateRef.current, roomId)),
      replay: () => commit(replay(stateRef.current)),
      injectWeird: (note, roomId) => commit(injectWeird(stateRef.current, roomId ?? stateRef.current.selected, note)),
      importCarry: (text) => commit(boot(stateRef.current.seed, text)),
      exportCarry: () => JSON.stringify(exportState(stateRef.current), null, 2),
      share: () => `${location.origin}${location.pathname}?seed=${encodeURIComponent(stateRef.current.seed)}&carry=${encodeURIComponent(encodeShare(stateRef.current))}`,
    };
    return () => { delete window.__SCAR_CARTOGRAPHER__; };
  }, []);

  const shareUrl = `${location.origin}${location.pathname}?seed=${encodeURIComponent(state.seed)}&carry=${encodeURIComponent(encodeShare(state))}`;
  const exportJson = JSON.stringify(exportState(state), null, 2);

  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow">Memory Scar Cartographer / loop {state.loop}</p>
          <h1>昨日の傷をインポートすると、部屋の幽霊座標が変わる地図</h1>
          <p>Patchquakeで弱かった「全状態の持ち越し」を前面にした。JSONや怪文書を食わせると、部屋の傷・公開記録・本当の履歴・家具の影が再配置される。</p>
        </div>
        <div className="meters" aria-label="全体メトリクス">
          <span>傷 {totals.scar}</span>
          <span>漏れ {totals.leak}</span>
          <span>平均信頼 {totals.trust}</span>
        </div>
      </section>

      <section className="grid">
        <div className="panel mapPanel">
          <div className="panelHead">
            <h2>傷地図</h2>
            <button onClick={() => commit(audit(state))}>一番危険な部屋を監査</button>
          </div>
          <div className="map" role="img" aria-label="部屋の傷と幽霊座標マップ">
            {state.rooms.map((room) => (
              <button
                className={`room ${room.id === state.selected ? 'selected' : ''}`}
                key={room.id}
                style={{ left: `${room.x}%`, top: `${room.y}%`, transform: `translate(${room.ghostX}px, ${room.ghostY}px)` }}
                onClick={() => commit({ ...state, selected: room.id })}
                aria-label={`${room.name} scar ${room.scar} leak ${room.leak}`}
              >
                <strong>{room.name}</strong>
                <small>scar {room.scar} / leak {room.leak}</small>
                <i style={{ width: `${Math.min(92, room.scar + room.leak)}%` }} />
              </button>
            ))}
          </div>
          <p className="hint">修復すると対象は落ち着くが、近い部屋の座標と傷がずれる。二周目で幽霊座標が残る。</p>
        </div>

        <div className="panel inspector">
          <h2>{selected.name}</h2>
          <dl>
            <dt>公開記録</dt><dd>{selected.publicStory}</dd>
            <dt>本当の履歴</dt><dd>{selected.privateTruth}</dd>
            <dt>隔離札</dt><dd>{selected.quarantines.length ? selected.quarantines.join(' / ') : 'なし'}</dd>
          </dl>
          <div className="actions">
            <button onClick={() => commit(mend(state, selected.id))}>この部屋を縫合</button>
            <button onClick={() => commit(replay(state))}>二周目を再演</button>
            <button onClick={() => commit(injectWeird(state, selected.id, weirdText))}>変な持ち越し札を隔離</button>
          </div>
          <textarea aria-label="変な持ち越し札" value={weirdText} onChange={(event) => setWeirdText(event.target.value)} />
          <p className="sanitized">保存予定: {sanitize(weirdText)}</p>
        </div>
      </section>

      <section className="grid lower">
        <div className="panel">
          <h2>持ち越しインポート</h2>
          <p className="carry">{state.carryoverLabel}</p>
          <textarea aria-label="持ち越しJSONまたは怪文書" placeholder="昨日のexport JSON、または怪文書を貼る" value={carryText} onChange={(event) => setCarryText(event.target.value)} />
          <button onClick={() => commit(boot(state.seed, carryText))}>この持ち越しで地図を作り直す</button>
          <button onClick={() => setCarryText(exportJson)}>現在状態を入力欄へコピー</button>
        </div>
        <div className="panel">
          <h2>Export / Share</h2>
          <input readOnly value={shareUrl} aria-label="share url" />
          <textarea aria-label="export json" readOnly value={exportJson} />
        </div>
        <div className="panel logPanel">
          <h2>証拠ログ</h2>
          <ol>
            {state.logs.slice().reverse().map((log) => <li key={log.id}><b>{log.kind}</b>{log.text}</li>)}
          </ol>
        </div>
      </section>
    </main>
  );
}
