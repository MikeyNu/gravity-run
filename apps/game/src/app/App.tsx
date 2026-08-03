import { useEffect, useRef } from 'react';
import { createMovementLab } from '../bootstrap/createMovementLab';
import { useHudStore } from '../ui/hudStore';

const features = [
  {
    icon: '/ui/icons/mouse.svg',
    title: 'ONE BUTTON CONTROLS',
    copy: 'Simple to learn, difficult to master.',
  },
  {
    icon: '/ui/icons/target.svg',
    title: 'PERFECT RELEASES',
    copy: 'Time releases for maximum speed and combo growth.',
  },
  {
    icon: '/ui/icons/diamond.svg',
    title: 'RISKY ROUTES',
    copy: 'Split paths reward precision, bravery and route memory.',
  },
  {
    icon: '/ui/icons/infinity.svg',
    title: 'SHORT RUNS',
    copy: 'Instant restarts and endless replayability.',
  },
  {
    icon: '/ui/icons/crown.svg',
    title: 'DAILY CHALLENGES',
    copy: 'Compete for leaderboard control in fixed seeded runs.',
  },
] as const;

const characters = [
  { name: 'Courier', art: '/ui/characters/courier.svg' },
  { name: 'Nomad', art: '/ui/characters/nomad.svg' },
  { name: 'Sentinel', art: '/ui/characters/sentinel.svg' },
  { name: 'Glitch', art: '/ui/characters/glitch.svg' },
  { name: 'Wisp', art: '/ui/characters/wisp.svg' },
] as const;

const flow = [
  { step: '1', title: 'FIND A TARGET', art: '/ui/flow/step-1.svg' },
  { step: '2', title: 'ORBIT & BUILD SPEED', art: '/ui/flow/step-2.svg' },
  { step: '3', title: 'RELEASE', art: '/ui/flow/step-3.svg' },
  { step: '4', title: 'FLY & CHOOSE YOUR NEXT TARGET', art: '/ui/flow/step-4.svg' },
] as const;

const comboList = [
  'PERFECT',
  'PERFECT x2',
  'PERFECT x3',
  'SUPER ORBIT x5',
  'GRAVITY FLOW x10',
] as const;

export function App() {
  const viewportRef = useRef<HTMLDivElement>(null);
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
    game.start();
    return () => game.dispose();
  }, []);

  const countdown = phase === 'countdown' ? Math.max(Math.ceil(countdownTicks / 60), 1) : null;

  return (
    <main className="game-shell">
      <div ref={viewportRef} className="game-viewport" aria-label="Gravity Run" />

      <aside className="left-rail">
        <header className="hero-card panel surface-hero" aria-label="Gravity Run overview">
          <img className="hero-logo" src="/brand/gravity-run-logo.svg" alt="Gravity Run" />
          <h1>SWING. LAUNCH. SURVIVE.</h1>
          <p>
            A fast paced 3D game where you tether between gravity wells, chase huge combos and
            escape a collapsing world.
          </p>
        </header>

        <section className="panel info-card how-to-play">
          <h2>HOW TO PLAY</h2>
          <div className="how-to-grid">
            <img src="/ui/icons/mouse.svg" alt="Mouse" />
            <div>
              <strong>HOLD TO TETHER</strong>
              <strong>RELEASE TO LAUNCH</strong>
            </div>
          </div>
        </section>

        <section className="panel info-card key-features">
          <h2>KEY FEATURES</h2>
          <ul>
            {features.map((feature) => (
              <li key={feature.title}>
                <img src={feature.icon} alt="" aria-hidden="true" />
                <div>
                  <strong>{feature.title}</strong>
                  <span>{feature.copy}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel roster-card">
          <div className="panel-heading">
            <h2>CHARACTERS</h2>
            <span>(UNLOCKABLE)</span>
          </div>
          <div className="roster-grid">
            {characters.map((character) => (
              <figure key={character.name} className="portrait-card">
                <img src={character.art} alt={character.name} />
              </figure>
            ))}
          </div>
        </section>
      </aside>

      <section className="score-panel panel" aria-label="Score panel">
        <div className="metric-current">{Math.floor(distance).toLocaleString()}m</div>
        <div className="metric-best">BEST {Math.floor(bestDistance).toLocaleString()}m</div>
        <div className="combo-callout">
          <strong>
            {lastReleaseGrade ? `${lastReleaseGrade.toUpperCase()} ` : 'PERFECT '}
            x{Math.max(1, Math.floor(maxCombo))}
          </strong>
          <div className="combo-bars" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <i key={index} className={index < Math.min(6, Math.floor(combo)) ? 'active' : ''} />
            ))}
          </div>
        </div>
      </section>

      <section className="bottom-dock">
        <section className="panel flow-panel">
          <h2>THE FLOW</h2>
          <div className="flow-grid">
            {flow.map((item) => (
              <article key={item.step} className="flow-card">
                <span className="flow-step">{item.step}</span>
                <img src={item.art} alt="" aria-hidden="true" />
                <strong>{item.title}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="panel combo-panel">
          <h2>PERFECT COMBO</h2>
          <ul>
            {comboList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="combo-streaks" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </section>

        <section className="panel challenge-panel">
          <h2>DAILY CHALLENGE</h2>
          <div className="challenge-subtitle">3 OFFICIAL ATTEMPTS</div>
          <img className="challenge-map" src="/ui/flow/challenge-map.svg" alt="Daily challenge route map" />
          <p>Beat everyone. Own the leaderboard.</p>
          <button type="button">CHALLENGE CODE: XR7Q9</button>
        </section>
      </section>

      <section className="status-ribbon panel">
        <div className="status-item"><span>SCORE</span><strong>{score.toLocaleString()}</strong></div>
        <div className="status-item"><span>BEST</span><strong>{bestScore.toLocaleString()}</strong></div>
        <div className="status-item"><span>FRAGMENTS</span><strong>{fragments}</strong></div>
        <div className="status-item"><span>QUALITY</span><strong>{quality.toUpperCase()}</strong></div>
        <div className="status-item"><span>SPEED</span><strong>{speed.toFixed(1)} m/s</strong></div>
        <div className="status-item"><span>STATE</span><strong>{targetLocked ? 'TETHERED' : phase.toUpperCase()}</strong></div>
      </section>

      {lastReleaseGrade && phase !== 'failed' ? (
        <div className={`release-grade release-grade-${lastReleaseGrade}`}>{lastReleaseGrade}</div>
      ) : null}

      {countdown ? <div className="countdown" aria-live="polite">{countdown}</div> : null}

      {phase === 'failed' ? (
        <section className="failure-panel panel" role="dialog" aria-modal="true">
          <span>RUN TERMINATED</span>
          <h1>{failureReason?.toUpperCase()}</h1>
          <p>
            {Math.floor(distance)} m · {score.toLocaleString()} points
          </p>
          <strong>PRESS TO RESTART</strong>
        </section>
      ) : null}

      <div className={`reticle ${targetLocked ? 'reticle-locked' : ''}`} aria-hidden="true">
        <i /><i /><i /><i />
      </div>
    </main>
  );
}
