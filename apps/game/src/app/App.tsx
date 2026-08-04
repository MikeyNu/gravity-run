import { useEffect, useRef, useState } from 'react';
import { createMovementLab } from '../bootstrap/createMovementLab';
import type { GameRuntime } from '../game/core/GameRuntime';
import { useHudStore } from '../ui/hudStore';

const features = [
  { icon: 'mouse', title: 'ONE BUTTON CONTROLS', copy: 'Simple to learn, difficult to master.' },
  { icon: 'target', title: 'PERFECT RELEASES', copy: 'Time releases for maximum speed and combo growth.' },
  { icon: 'risk', title: 'RISKY ROUTES', copy: 'Split paths reward precision, bravery and route memory.' },
  { icon: 'infinity', title: 'SHORT RUNS', copy: 'Instant restarts and endless replayability.' },
  { icon: 'crown', title: 'DAILY CHALLENGES', copy: 'Compete for leaderboard control in fixed seeded runs.' },
] as const;

const characters = [
  { name: 'Courier', symbol: 'courier' },
  { name: 'Nomad', symbol: 'nomad' },
  { name: 'Sentinel', symbol: 'sentinel' },
  { name: 'Glitch', symbol: 'glitch' },
  { name: 'Wisp', symbol: 'wisp' },
] as const;

const flow = [
  { step: '1', title: 'FIND A TARGET', symbol: 'step-1' },
  { step: '2', title: 'ORBIT & BUILD SPEED', symbol: 'step-2' },
  { step: '3', title: 'RELEASE', symbol: 'step-3' },
  { step: '4', title: 'FLY & CHOOSE YOUR NEXT TARGET', symbol: 'step-4' },
] as const;

const comboList = ['PERFECT', 'PERFECT x2', 'PERFECT x3', 'SUPER ORBIT x5', 'GRAVITY FLOW x10'] as const;
type ShellScreen = 'menu' | 'playing' | 'paused' | 'settings';
type IconName = 'mouse' | 'target' | 'risk' | 'infinity' | 'crown' | 'pause';

function readStoredVolume(): number {
  const value = Number(localStorage.getItem('gravity-run:master-volume') ?? 0.78);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0.78;
}

function SpriteArt({ source, symbol, label, viewBox }: { source: string; symbol: string; label: string; viewBox: string }) {
  return (
    <svg className="sprite-art" viewBox={viewBox} role="img" aria-label={label}>
      <use href={`${source}#${symbol}`} />
    </svg>
  );
}

function Icon({ name, label }: { name: IconName; label?: string }) {
  return (
    <svg className="ui-icon" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <use href={`/ui/icons/gravity-ui-icons.svg#${name}`} />
    </svg>
  );
}

export function App() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<GameRuntime | null>(null);
  const [screen, setScreen] = useState<ShellScreen>('menu');
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem('gravity-run:reduced-motion') === 'true');
  const [masterVolume, setMasterVolume] = useState(readStoredVolume);
  const [muted, setMuted] = useState(() => localStorage.getItem('gravity-run:muted') === 'true');
  const phase = useHudStore((state) => state.phase);
  const speed = useHudStore((state) => state.speed);
  const quality = useHudStore((state) => state.quality);
  const targetLocked = useHudStore((state) => state.targetLocked);
  const score = useHudStore((state) => state.score);
  const bestScore = useHudStore((state) => state.bestScore);
  const combo = useHudStore((state) => state.combo);
  const maxCombo = useHudStore((state) => state.maxCombo);
  const fragments = useHudStore((state) => state.fragments);
  const distance = useHudStore((state) => state.distance);
  const bestDistance = useHudStore((state) => state.bestDistance);
  const failureReason = useHudStore((state) => state.failureReason);
  const countdownTicks = useHudStore((state) => state.countdownTicks);
  const lastReleaseGrade = useHudStore((state) => state.lastReleaseGrade);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const game = createMovementLab(viewport);
    runtimeRef.current = game;
    game.start();
    game.pause();
    return () => {
      runtimeRef.current = null;
      game.dispose();
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
    localStorage.setItem('gravity-run:reduced-motion', String(reducedMotion));
  }, [reducedMotion]);

  useEffect(() => {
    localStorage.setItem('gravity-run:master-volume', String(masterVolume));
    localStorage.setItem('gravity-run:muted', String(muted));
    window.dispatchEvent(new CustomEvent('gravity-run:audio-settings', {
      detail: { masterVolume, muted },
    }));
  }, [masterVolume, muted]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') return;
      if (screen === 'playing') {
        runtimeRef.current?.pause();
        setScreen('paused');
      } else if (screen === 'paused') {
        runtimeRef.current?.resume();
        setScreen('playing');
      } else if (screen === 'settings') {
        setScreen('menu');
      }
    };
    const onVisibility = () => {
      if (document.hidden && screen === 'playing') {
        runtimeRef.current?.pause();
        setScreen('paused');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [screen]);

  const confirmUi = () => window.dispatchEvent(new Event('gravity-run:ui-confirm'));

  const startRun = () => {
    confirmUi();
    runtimeRef.current?.reset();
    runtimeRef.current?.resume();
    setScreen('playing');
  };

  const returnToMenu = () => {
    confirmUi();
    runtimeRef.current?.reset();
    runtimeRef.current?.pause();
    setScreen('menu');
  };

  const countdown = screen === 'playing' && phase === 'countdown' ? Math.max(Math.ceil(countdownTicks / 60), 1) : null;
  const menuVisible = screen === 'menu';
  const gameHudVisible = screen === 'playing' || screen === 'paused';

  return (
    <main className={`game-shell screen-${screen}`}>
      <div ref={viewportRef} className="game-viewport" aria-label="Gravity Run" />

      {menuVisible ? (
        <>
          <aside className="left-rail">
            <header className="hero-card panel surface-hero" aria-label="Gravity Run overview">
              <img className="hero-logo" src="/brand/gravity-run-logo.svg" alt="Gravity Run" />
              <h1>SWING. LAUNCH. SURVIVE.</h1>
              <p>A fast paced 3D game where you tether between gravity wells, chase huge combos and escape a collapsing world.</p>
              <div className="hero-actions" data-ui-control>
                <button className="primary-action" type="button" onClick={startRun}>START RUN</button>
                <button className="secondary-action" type="button" onClick={() => { confirmUi(); setScreen('settings'); }}>SETTINGS</button>
              </div>
            </header>

            <section className="panel info-card how-to-play">
              <h2>HOW TO PLAY</h2>
              <div className="how-to-grid">
                <Icon name="mouse" label="Mouse" />
                <div><strong>HOLD TO TETHER</strong><strong>RELEASE TO LAUNCH</strong></div>
              </div>
            </section>

            <section className="panel info-card key-features">
              <h2>KEY FEATURES</h2>
              <ul>
                {features.map((feature) => (
                  <li key={feature.title}>
                    <Icon name={feature.icon} />
                    <div><strong>{feature.title}</strong><span>{feature.copy}</span></div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel roster-card">
              <div className="panel-heading"><h2>CHARACTERS</h2><span>(UNLOCKABLE)</span></div>
              <div className="roster-grid">
                {characters.map((character) => (
                  <figure key={character.name} className="portrait-card"><SpriteArt source="/ui/characters/gravity-characters.svg" symbol={character.symbol} label={character.name} viewBox="0 0 180 300" /></figure>
                ))}
              </div>
            </section>
          </aside>

          <section className="bottom-dock">
            <section className="panel flow-panel">
              <h2>THE FLOW</h2>
              <div className="flow-grid">
                {flow.map((item) => (
                  <article key={item.step} className="flow-card"><SpriteArt source="/ui/flow/gravity-flow-cards.svg" symbol={item.symbol} label={`${item.step}. ${item.title}`} viewBox="0 0 300 420" /></article>
                ))}
              </div>
            </section>

            <section className="panel combo-panel">
              <h2>PERFECT COMBO</h2>
              <ul>{comboList.map((item) => <li key={item}>{item}</li>)}</ul>
              <div className="combo-streaks" aria-hidden="true"><span /><span /><span /><span /></div>
            </section>

            <section className="panel challenge-panel">
              <h2>DAILY CHALLENGE</h2>
              <div className="challenge-subtitle">3 OFFICIAL ATTEMPTS</div>
              <svg className="challenge-map" viewBox="0 0 500 220" role="img" aria-label="Daily challenge route map"><use href="/ui/flow/gravity-flow-cards.svg#challenge" /></svg>
              <p>Beat everyone. Own the leaderboard.</p>
              <button type="button" data-ui-control>CHALLENGE CODE: XR7Q9</button>
            </section>
          </section>
        </>
      ) : null}

      <section className="score-panel panel" aria-label="Score panel">
        <div className="metric-current">{Math.floor(distance).toLocaleString()}m</div>
        <div className="metric-best">BEST {Math.floor(bestDistance).toLocaleString()}m</div>
        <div className="combo-callout">
          <strong>{lastReleaseGrade ? `${lastReleaseGrade.toUpperCase()} ` : 'PERFECT '}x{Math.max(1, Math.floor(maxCombo))}</strong>
          <div className="combo-bars" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => <i key={index} className={index < Math.min(6, Math.floor(combo)) ? 'active' : ''} />)}
          </div>
        </div>
      </section>

      {gameHudVisible ? (
        <section className="status-ribbon panel">
          <div className="status-item"><span>SCORE</span><strong>{score.toLocaleString()}</strong></div>
          <div className="status-item"><span>BEST</span><strong>{bestScore.toLocaleString()}</strong></div>
          <div className="status-item"><span>FRAGMENTS</span><strong>{fragments}</strong></div>
          <div className="status-item"><span>QUALITY</span><strong>{quality.toUpperCase()}</strong></div>
          <div className="status-item"><span>SPEED</span><strong>{speed.toFixed(1)} m/s</strong></div>
          <button type="button" className="pause-button" data-ui-control onClick={() => { confirmUi(); runtimeRef.current?.pause(); setScreen('paused'); }}>PAUSE</button>
        </section>
      ) : null}

      {lastReleaseGrade && screen === 'playing' && phase !== 'failed' ? (
        <div className={`release-grade release-grade-${lastReleaseGrade}`}>{lastReleaseGrade}</div>
      ) : null}
      {countdown ? <div className="countdown" aria-live="polite">{countdown}</div> : null}

      {screen === 'paused' ? (
        <section className="modal-panel panel" role="dialog" aria-modal="true" data-ui-control>
          <span>RUN PAUSED</span><h1>HOLD YOUR LINE.</h1><p>The simulation is frozen. Resume when you are ready.</p>
          <div className="modal-actions">
            <button className="primary-action" type="button" onClick={() => { confirmUi(); runtimeRef.current?.resume(); setScreen('playing'); }}>RESUME</button>
            <button className="secondary-action" type="button" onClick={returnToMenu}>RETURN TO MENU</button>
          </div>
        </section>
      ) : null}

      {screen === 'settings' ? (
        <section className="modal-panel panel settings-panel" role="dialog" aria-modal="true" data-ui-control>
          <span>ACCESSIBILITY & COMFORT</span><h1>SETTINGS</h1>
          <label className="setting-row">
            <span><strong>REDUCED MOTION</strong><small>Disables decorative UI motion and lowers camera presentation intensity.</small></span>
            <input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} />
          </label>
          <label className="setting-row">
            <span><strong>MASTER VOLUME</strong><small>Controls all gameplay, interface and ambience output.</small></span>
            <input className="volume-slider" type="range" min="0" max="1" step="0.01" value={masterVolume} onChange={(event) => setMasterVolume(Number(event.target.value))} />
          </label>
          <label className="setting-row">
            <span><strong>MUTE AUDIO</strong><small>Silences the master bus without changing the saved volume.</small></span>
            <input type="checkbox" checked={muted} onChange={(event) => setMuted(event.target.checked)} />
          </label>
          <div className="setting-row static-setting"><span><strong>ACTIVE QUALITY PROFILE</strong><small>Selected automatically from device capability.</small></span><b>{quality.toUpperCase()}</b></div>
          <div className="modal-actions"><button className="primary-action" type="button" onClick={() => { confirmUi(); setScreen('menu'); }}>DONE</button></div>
        </section>
      ) : null}

      {screen === 'playing' && phase === 'failed' ? (
        <section className="failure-panel panel" role="dialog" aria-modal="true" data-ui-control>
          <span>RUN TERMINATED</span><h1>{failureReason?.toUpperCase()}</h1>
          <p>{Math.floor(distance)} m · {score.toLocaleString()} points</p>
          <div className="modal-actions">
            <button className="primary-action" type="button" onClick={startRun}>RESTART</button>
            <button className="secondary-action" type="button" onClick={returnToMenu}>MENU</button>
          </div>
        </section>
      ) : null}

      {screen === 'playing' ? (
        <div className={`reticle ${targetLocked ? 'reticle-locked' : ''}`} aria-hidden="true"><i /><i /><i /><i /></div>
      ) : null}
    </main>
  );
}
