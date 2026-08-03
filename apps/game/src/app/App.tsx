import { useEffect, useRef } from 'react';
import { createMovementLab } from '../bootstrap/createMovementLab';
import { useHudStore } from '../ui/hudStore';

export function App() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const phase = useHudStore((state) => state.phase);
  const speed = useHudStore((state) => state.speed);
  const quality = useHudStore((state) => state.quality);
  const targetLocked = useHudStore((state) => state.targetLocked);
  const score = useHudStore((state) => state.score);
  const combo = useHudStore((state) => state.combo);
  const fragments = useHudStore((state) => state.fragments);
  const distance = useHudStore((state) => state.distance);
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

      <header className="brand-lockup" aria-label="Gravity Run">
        <span className="brand-kicker">PUBLIC ALPHA</span>
        <strong>GRAVITY RUN</strong>
      </header>

      <section className="telemetry telemetry-primary" aria-label="Run telemetry">
        <Telemetry label="SCORE" value={score.toLocaleString()} />
        <Telemetry label="DISTANCE" value={`${Math.floor(distance)} m`} />
        <Telemetry label="COMBO" value={`${combo.toFixed(2)}x`} />
        <Telemetry label="FRAGMENTS" value={String(fragments)} />
      </section>

      <section className="telemetry telemetry-secondary" aria-label="Movement telemetry">
        <Telemetry label="STATE" value={phase} />
        <Telemetry label="SPEED" value={`${speed.toFixed(1)} m/s`} />
        <Telemetry label="TARGET" value={targetLocked ? 'TETHERED' : 'SEARCHING'} />
        <Telemetry label="QUALITY" value={quality.toUpperCase()} />
      </section>

      {lastReleaseGrade && phase !== 'failed' ? (
        <div className={`release-grade release-grade-${lastReleaseGrade}`}>{lastReleaseGrade}</div>
      ) : null}

      {countdown ? <div className="countdown" aria-live="polite">{countdown}</div> : null}

      {phase === 'failed' ? (
        <section className="failure-panel" role="dialog" aria-modal="true">
          <span>RUN TERMINATED</span>
          <h1>{failureReason?.toUpperCase()}</h1>
          <p>{Math.floor(distance)} m · {score.toLocaleString()} points</p>
          <strong>PRESS TO RESTART</strong>
        </section>
      ) : (
        <section className="control-hint">
          <span className="control-icon" aria-hidden="true" />
          <div>
            <strong>HOLD TO TETHER</strong>
            <span>Release on the tangent. Space, touch or primary click.</span>
          </div>
        </section>
      )}

      <div className={`reticle ${targetLocked ? 'reticle-locked' : ''}`} aria-hidden="true">
        <i /><i /><i /><i />
      </div>
    </main>
  );
}

function Telemetry({ label, value }: { label: string; value: string }) {
  return (
    <div className="telemetry-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
