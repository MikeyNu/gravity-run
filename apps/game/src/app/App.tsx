import { useCallback, useEffect, useRef, useState } from 'react';
import { CHARACTER_ROSTER, TETHER_COSMETICS } from '@gravity-run/game-config';
import { createMovementLab } from '../bootstrap/createMovementLab';
import type { GameRuntime } from '../game/core/GameRuntime';
import { useChallengeStore } from '../ui/challengeStore';
import { useCharacterStore } from '../ui/characterStore';
import { useControlsStore } from '../ui/controlsStore';
import { useHudStore } from '../ui/hudStore';
import { useTutorialStore } from '../ui/tutorialStore';

const features = [
  { icon: 'mouse', title: 'ONE BUTTON CONTROLS', copy: 'Simple to learn, difficult to master.' },
  { icon: 'target', title: 'PERFECT RELEASES', copy: 'Time releases for maximum speed and combo growth.' },
  { icon: 'risk', title: 'RISKY ROUTES', copy: 'Split paths reward precision, bravery and route memory.' },
  { icon: 'infinity', title: 'SHORT RUNS', copy: 'Instant restarts and endless replayability.' },
  { icon: 'crown', title: 'DAILY CHALLENGES', copy: 'Compete for leaderboard control in fixed seeded runs.' },
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
  const tutorialVisible = useTutorialStore((state) => state.visible);
  const tutorialHint = useTutorialStore((state) => state.hint);
  const tutorialEnabled = useTutorialStore((state) => state.enabled);
  const tutorialSkip = useTutorialStore((state) => state.skip);
  const selectedCharacterId = useCharacterStore((state) => state.selectedCharacterId);
  const selectedTetherId = useCharacterStore((state) => state.selectedTetherCosmeticId);
  const unlockedCharacterIds = useCharacterStore((state) => state.unlockedCharacterIds);
  const selectCharacter = useCharacterStore((state) => state.selectCharacter);
  const selectTether = useCharacterStore((state) => state.selectTether);
  const primaryKey = useControlsStore((state) => state.primaryKey);
  const gamepadButton = useControlsStore((state) => state.gamepadButton);
  const leftHanded = useControlsStore((state) => state.leftHanded);
  const textScale = useControlsStore((state) => state.textScale);
  const isListening = useControlsStore((state) => state.isListening);
  const setPrimaryKey = useControlsStore((state) => state.setPrimaryKey);
  const setGamepadButton = useControlsStore((state) => state.setGamepadButton);
  const setLeftHanded = useControlsStore((state) => state.setLeftHanded);
  const setTextScale = useControlsStore((state) => state.setTextScale);
  const startListening = useControlsStore((state) => state.startListening);
  const cancelListening = useControlsStore((state) => state.cancelListening);
  const isValidActionCode = useControlsStore((state) => state.isValidActionCode);
  const challengeMode = useChallengeStore((state) => state.mode);
  const manifest = useChallengeStore((state) => state.manifest);
  const attemptsUsed = useChallengeStore((state) => state.attemptsUsed);
  const leaderboard = useChallengeStore((state) => state.leaderboard);
  const submission = useChallengeStore((state) => state.submission);
  const fetchDailyManifest = useChallengeStore((state) => state.fetchDailyManifest);
  const fetchLeaderboard = useChallengeStore((state) => state.fetchLeaderboard);
  const submitReplay = useChallengeStore((state) => state.submitReplay);
  const resetSubmission = useChallengeStore((state) => state.resetSubmission);
  const setChallengeMode = useChallengeStore((state) => state.setMode);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    let disposed = false;
    let disposeGame: (() => void) | null = null;
    createMovementLab(viewport).then((game) => {
      if (disposed) { game.dispose(); return; }
      runtimeRef.current = game;
      game.start();
      game.pause();
      disposeGame = () => { runtimeRef.current = null; game.dispose(); };
    });
    return () => {
      disposed = true;
      disposeGame?.();
    };
  }, []);

  useEffect(() => {
    void fetchDailyManifest();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (isListening) {
        event.preventDefault();
        if (event.code === 'Escape') { cancelListening(); return; }
        setPrimaryKey(event.code);
        return;
      }
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
  }, [screen, isListening, cancelListening, setPrimaryKey]);

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    const handler = () => {
      setScreen('playing');
      useHudStore.setState({ phase: 'failed', failureReason: 'collision' });
    };
    window.addEventListener('gravity-run:test-trigger-failure', handler);
    return () => window.removeEventListener('gravity-run:test-trigger-failure', handler);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.leftHanded = String(leftHanded);
  }, [leftHanded]);

  useEffect(() => {
    document.documentElement.style.setProperty('--text-scale', String(textScale));
  }, [textScale]);

  const formatKeyLabel = useCallback((code: string): string => {
    const MAP: Record<string, string> = {
      Space: 'SPACE', Enter: 'ENTER', ArrowUp: '↑', ArrowDown: '↓',
      ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT',
      ControlLeft: 'L-CTRL', ControlRight: 'R-CTRL', AltLeft: 'L-ALT', AltRight: 'R-ALT',
    };
    if (code in MAP) return MAP[code]!;
    // KeyA → A, Digit1 → 1
    return code.replace(/^Key/, '').replace(/^Digit/, '').toUpperCase();
  }, []);

  const confirmUi = () => window.dispatchEvent(new Event('gravity-run:ui-confirm'));

  const startRun = (daily = false) => {
    confirmUi();
    resetSubmission();
    if (daily && manifest) {
      runtimeRef.current?.reset({ seed: manifest.seed, mode: 'daily' });
    } else {
      runtimeRef.current?.reset();
    }
    runtimeRef.current?.resume();
    setScreen('playing');
  };

  // Auto-submit replay when a daily run ends
  useEffect(() => {
    if (challengeMode === 'daily' && phase === 'failed' && screen === 'playing' && manifest && submission.status === 'idle') {
      const replay = runtimeRef.current?.createReplaySubmission();
      if (replay) {
        void submitReplay({
          playerId: 'anon-' + (localStorage.getItem('gravity-run:player-id') ?? (() => {
            const id = crypto.randomUUID();
            localStorage.setItem('gravity-run:player-id', id);
            return id;
          })()),
          challenge: manifest,
          submission: replay,
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, screen]);

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
                <button className="primary-action" type="button" data-testid="start-endless" onClick={() => { setChallengeMode('endless'); startRun(false); }}>START RUN</button>
                <button className="secondary-action" type="button" data-testid="open-settings" onClick={() => { confirmUi(); setScreen('settings'); }}>SETTINGS</button>
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
              <div className="panel-heading" data-testid="open-characters"><h2>CHARACTERS</h2><span>(SELECTABLE)</span></div>
              <div className="roster-grid">
                {CHARACTER_ROSTER.map((character) => {
                  const unlocked = unlockedCharacterIds.has(character.id);
                  const selected = selectedCharacterId === character.id;
                  return (
                    <figure
                      key={character.id}
                      className={`portrait-card ${selected ? 'portrait-selected' : ''} ${unlocked ? '' : 'portrait-locked'}`}
                      title={unlocked ? character.lore : `Locked: ${character.unlockCondition ?? ''}`}
                      role="button"
                      tabIndex={0}
                      aria-pressed={selected}
                      aria-label={`${character.name}${unlocked ? '' : ' (locked)'}`}
                      onClick={() => { confirmUi(); selectCharacter(character.id); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); confirmUi(); selectCharacter(character.id); } }}
                    >
                      <SpriteArt source="/ui/characters/gravity-characters.svg" symbol={character.symbol} label={character.name} viewBox="0 0 180 300" />
                      {!unlocked && <span className="portrait-lock" aria-hidden="true">🔒</span>}
                      {selected && <span className="portrait-badge" aria-hidden="true">✓</span>}
                      <figcaption>{character.name}</figcaption>
                    </figure>
                  );
                })}
              </div>
              <div className="tether-picker" role="group" aria-label="Tether colour">
                <span className="tether-label">TETHER</span>
                {TETHER_COSMETICS.map((cosmetic) => (
                  <button
                    key={cosmetic.id}
                    type="button"
                    className={`tether-swatch ${selectedTetherId === cosmetic.id ? 'tether-swatch-active' : ''}`}
                    style={{ '--swatch-color': cosmetic.color } as React.CSSProperties}
                    aria-label={cosmetic.label}
                    aria-pressed={selectedTetherId === cosmetic.id}
                    onClick={() => { confirmUi(); selectTether(cosmetic.id); }}
                  />
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
              {manifest ? (
                <>
                  <div className="challenge-subtitle">{manifest.attemptLimit - attemptsUsed} ATTEMPT{manifest.attemptLimit - attemptsUsed === 1 ? '' : 'S'} REMAINING</div>
                  <svg className="challenge-map" viewBox="0 0 500 220" role="img" aria-label="Daily challenge route map"><use href="/ui/flow/gravity-flow-cards.svg#challenge" /></svg>
                  <p>Beat everyone. Own the leaderboard.</p>
                  <div className="challenge-actions">
                    <button
                      type="button"
                      className="primary-action"
                      disabled={attemptsUsed >= manifest.attemptLimit}
                      onClick={() => { confirmUi(); setChallengeMode('daily'); startRun(true); }}
                      data-ui-control
                    >
                      {attemptsUsed >= manifest.attemptLimit ? 'NO ATTEMPTS LEFT' : `PLAY — ${manifest.challengeCode}`}
                    </button>
                    <button type="button" className="secondary-action" onClick={() => { confirmUi(); void fetchLeaderboard(); }} data-ui-control>LEADERBOARD</button>
                  </div>
                </>
              ) : (
                <p className="challenge-loading">Loading today's challenge…</p>
              )}
              {leaderboard.status === 'loaded' && leaderboard.entries.length > 0 && (
                <ol className="leaderboard-list" aria-label="Daily leaderboard">
                  {leaderboard.entries.slice(0, 10).map((entry, i) => (
                    <li key={entry.runId} className="leaderboard-entry">
                      <span className="lb-rank">#{i + 1}</span>
                      <span className="lb-name">{entry.playerName}</span>
                      <span className="lb-score">{entry.score.toLocaleString()}</span>
                      <span className="lb-dist">{Math.floor(entry.distance)}m</span>
                    </li>
                  ))}
                </ol>
              )}
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
        <section className="status-ribbon panel" data-testid="hud">
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
            <span><strong>REDUCED MOTION</strong><small>Disables decorative UI motion and lowers camera intensity.</small></span>
            <input type="checkbox" checked={reducedMotion} onChange={(event) => setReducedMotion(event.target.checked)} />
          </label>
          <label className="setting-row">
            <span><strong>LEFT-HANDED LAYOUT</strong><small>Mirrors the HUD so score and status appear on the right side.</small></span>
            <input type="checkbox" checked={leftHanded} onChange={(event) => setLeftHanded(event.target.checked)} />
          </label>
          <label className="setting-row">
            <span><strong>TEXT SIZE</strong><small>Scales all UI text from 85% to 150%.</small></span>
            <input className="volume-slider" type="range" min="0.85" max="1.5" step="0.05" value={textScale} onChange={(event) => setTextScale(Number(event.target.value))} />
          </label>

          <div className="setting-row">
            <span><strong>GAME ACTION KEY</strong><small>Press to rebind. Space / Enter always work as fallback.</small></span>
            <button
              type="button"
              className={`keybind-button ${isListening ? 'keybind-listening' : ''}`}
              onClick={() => { if (isListening) { cancelListening(); } else { startListening(); } }}
            >
              {isListening ? 'PRESS A KEY…' : formatKeyLabel(primaryKey)}
            </button>
          </div>
          <div className="setting-row">
            <span><strong>GAMEPAD BUTTON</strong><small>Button index on connected gamepads. 0 = A/Cross (default).</small></span>
            <input
              type="number"
              min="0"
              max="15"
              value={gamepadButton}
              className="gamepad-button-input"
              onChange={(event) => { const n = Number(event.target.value); if (n >= 0 && n <= 15) setGamepadButton(n); }}
            />
          </div>

          <label className="setting-row">
            <span><strong>MASTER VOLUME</strong><small>Controls all gameplay, interface and ambience output.</small></span>
            <input className="volume-slider" type="range" min="0" max="1" step="0.01" value={masterVolume} onChange={(event) => setMasterVolume(Number(event.target.value))} />
          </label>
          <label className="setting-row">
            <span><strong>MUTE AUDIO</strong><small>Silences the master bus without changing the saved volume.</small></span>
            <input type="checkbox" checked={muted} onChange={(event) => setMuted(event.target.checked)} />
          </label>
          <div className="setting-row static-setting"><span><strong>ACTIVE QUALITY PROFILE</strong><small>Selected automatically from device capability.</small></span><b>{quality.toUpperCase()}</b></div>
          <div className="modal-actions"><button className="primary-action" type="button" onClick={() => { confirmUi(); cancelListening(); setScreen('menu'); }}>DONE</button></div>
        </section>
      ) : null}

      {screen === 'playing' && phase === 'failed' ? (
        <section className="failure-panel panel" role="dialog" aria-modal="true" data-ui-control data-testid="failure-screen">
          <span>{challengeMode === 'daily' ? 'DAILY CHALLENGE' : 'RUN TERMINATED'}</span>
          <h1>{failureReason?.toUpperCase()}</h1>
          <p>{Math.floor(distance)} m · {score.toLocaleString()} points</p>
          {challengeMode === 'daily' && submission.status === 'submitting' && (
            <p className="submission-status">Submitting score…</p>
          )}
          {challengeMode === 'daily' && submission.status === 'submitted' && submission.rank != null && (
            <p className="submission-status submission-rank">You placed #{submission.rank} today!</p>
          )}
          {challengeMode === 'daily' && submission.status === 'error' && (
            <p className="submission-status submission-error">
              {submission.error === 'attempt_limit_reached' ? 'Attempt limit reached.' : 'Could not submit score.'}
            </p>
          )}
          <div className="modal-actions">
            {challengeMode === 'daily' && manifest && attemptsUsed < manifest.attemptLimit ? (
              <button className="primary-action" type="button" onClick={() => startRun(true)}>RETRY CHALLENGE</button>
            ) : (
              <button className="primary-action" type="button" onClick={() => { setChallengeMode('endless'); startRun(false); }}>ENDLESS RUN</button>
            )}
            <button className="secondary-action" type="button" onClick={returnToMenu}>MENU</button>
          </div>
        </section>
      ) : null}

      {screen === 'playing' ? (
        <div className={`reticle ${targetLocked ? 'reticle-locked' : ''}`} aria-hidden="true"><i /><i /><i /><i /></div>
      ) : null}

      {screen === 'playing' && tutorialEnabled && tutorialVisible && tutorialHint.title ? (
        <aside className="tutorial-hint panel" role="status" aria-live="polite">
          <strong className="tutorial-hint-title">{tutorialHint.title}</strong>
          <p className="tutorial-hint-body">{tutorialHint.body}</p>
          <button type="button" className="tutorial-skip" onClick={tutorialSkip}>Skip tutorial</button>
        </aside>
      ) : null}
    </main>
  );
}
