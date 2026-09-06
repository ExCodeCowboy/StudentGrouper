import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ArrowLeft, ArrowRight, MapPin, Maximize, Minimize, Music2, Pause, Play, Plus, RotateCcw, Settings2, Sparkles, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RotationPresentationSettings } from '../components/RotationPresentationSettings';
import { TransitionVideo } from '../components/TransitionVideo';
import { TransitionMelody } from '../components/TransitionMelody';
import { prepareTransitionAudio } from '../transitionAudio';
import { formatRotationTime, type RotationClock } from '../rotationTimer';
import { useRotationTimer } from '../useRotationTimer';
import type { RotationPresentationSettings as PresentationSettings } from '../model';
import { GroupVisual } from '../components/GroupVisual';
import { StationVisual } from '../components/StationVisual';
import { RevealCover, RevealEffectLayer, RevealEffectPicker } from '../revealEffects/RevealEffects';
import { useRevealEffects } from '../revealEffects/useRevealEffects';
import type { DisplayRotation, DisplayRotationDay } from '../studentDisplay';
import './studentGroups.css';
import './studentRotations.css';
import './rotationTimer.css';

// The wide daily chart must be keyboard-focusable so arrow keys can scroll it.
// oxlint-disable jsx-a11y/no-noninteractive-tabindex

function Destination({ entry }: { entry?: DisplayRotation }) {
  if (!entry) return <span className="rotation-student-empty">—</span>;
  if (!entry.station) return <strong className="rotation-student-check">Check with your teacher</strong>;
  return <div className="rotation-student-destination">
    <StationVisual station={entry.station} compact />
    <span className="rotation-student-location"><MapPin aria-hidden="true" />{entry.location || 'Ask your teacher where to go'}</span>
  </div>;
}

export function StudentRotationsView({ day, settings, onSettingsChange, initialTimer, onRememberTimer, onClose }: {
  day: DisplayRotationDay;
  settings: PresentationSettings;
  onSettingsChange: (settings: PresentationSettings) => void;
  initialTimer?: RotationClock;
  onRememberTimer: (clock: RotationClock) => void;
  onClose: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [showNames, setShowNames] = useState(true);
  const { selection, select, reducedMotion, animate, playback, play, stop } = useRevealEffects();
  const [fullscreen, setFullscreen] = useState(false);
  const [issue, setIssue] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const { clock, dispatch, remainingMs, visible } = useRotationTimer(day.rounds.map((round) => round.id), settings.durationSeconds, initialTimer, onRememberTimer);
  const handledFinish = useRef(clock.runId);
  const roundIndex = day.rounds.findIndex((round) => round.id === clock.roundId);
  const nextRound = day.rounds[roundIndex + 1];
  const finished = clock.status === 'finished';
  const melodyOpen = videoOpen && (settings.transitionSource !== 'youtube' || !settings.youtubeUrl || videoFailed);
  const highlightedRound = melodyOpen && finished && nextRound ? nextRound.id : clock.roundId;
  const [screen, setScreen] = useState<HTMLElement | null>(null);
  const revealButton = useRef<HTMLButtonElement>(null);
  const hasPlan = day.groups.length > 0 && day.rounds.length > 0;
  const date = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${day.date}T12:00:00`));

  useEffect(() => {
    if (!finished || !visible || settingsOpen || clock.runId === handledFinish.current) return;
    const frame = requestAnimationFrame(() => {
      handledFinish.current = clock.runId;
      if (settings.autoplay) { setVideoFailed(false); setVideoOpen(true); }
    });
    return () => cancelAnimationFrame(frame);
  }, [finished, visible, settingsOpen, clock.runId, settings.autoplay]);

  useEffect(() => {
    revealButton.current?.focus();
    const updateFullscreen = () => setFullscreen(!!screen && document.fullscreenElement === screen);
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, [screen]);

  const close = async () => {
    if (document.fullscreenElement === screen) {
      try { await document.exitFullscreen(); } catch { /* Closing the screen still works. */ }
    }
    onClose();
  };
  const toggleFullscreen = async () => {
    setIssue('');
    try {
      if (document.fullscreenElement === screen) await document.exitFullscreen();
      else if (screen?.requestFullscreen) await screen.requestFullscreen();
      else setIssue('Full screen is not available here. You can maximize the app window.');
    } catch { setIssue('Full screen is not available here. You can maximize the app window.'); }
  };
  const handleKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || settingsOpen || videoOpen) return;
    if (event.key === 'Escape' && !document.fullscreenElement) { event.preventDefault(); void close(); }
  };
  const hideOrReveal = () => {
    if (!hasPlan) return;
    if (revealed) { setRevealed(false); stop(); dispatch({ type: 'pause', now: Date.now() }); }
    else { setRevealed(true); play(); }
  };
  const startNextRound = () => {
    prepareTransitionAudio();
    setVideoOpen(false);
    if (nextRound) dispatch({ type: 'round', roundId: nextRound.id, durationSeconds: settings.durationSeconds, start: true, now: Date.now() });
  };
  const playSong = () => {
    prepareTransitionAudio();
    setVideoFailed(false);
    stop();
    dispatch({ type: 'pause', now: Date.now() });
    setVideoOpen(true);
  };

  return (
    // Escape closes the presentation; arrow keys keep their normal scrolling behavior.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <main className={`student-show student-rotations${animate ? ' with-effects' : ''}`} ref={setScreen} onKeyDown={handleKey}>
      <div className="student-show-decor" aria-hidden="true"><Star className="show-star star-one" /><Star className="show-star star-two" /><span className="show-orbit orbit-one" /></div>
      <header className="student-show-top">
        <div className="student-day-heading"><span className="student-day-heading-icon" aria-hidden="true"><Sparkles /></span><div><h1>Our day together</h1><time dateTime={day.date}>{date}</time></div></div>
        <div className="student-show-tools">
          <label className="show-effects"><input type="checkbox" checked={showNames} onChange={(event) => setShowNames(event.target.checked)} /> Student names</label>
          <RevealEffectPicker selection={selection} onSelect={select} reducedMotion={reducedMotion} />
          <button type="button" onClick={() => setSettingsOpen(true)}><Settings2 />Timer &amp; transition</button>
          <button type="button" onClick={toggleFullscreen}>{fullscreen ? <Minimize /> : <Maximize />}{fullscreen ? 'Exit full screen' : 'Full screen'}</button>
          <button type="button" onClick={close}><ArrowLeft />Teacher view</button>
        </div>
      </header>
      {issue && <output className="student-show-issue">{issue}</output>}
      {hasPlan && !melodyOpen && <section className={`rotation-timer${finished ? ' is-finished' : ''}`} aria-label="Rotation timer">
        <div className="rotation-timer-round">
          <label>Our focus now<select aria-label="Current round" value={clock.roundId} onChange={(event) => dispatch({ type: 'round', roundId: event.target.value, durationSeconds: settings.durationSeconds, now: Date.now() })}>{day.rounds.map((round, index) => <option key={round.id} value={round.id}>Round {index + 1}</option>)}</select></label>
          <output>{finished ? nextRound ? 'Time to tidy up and switch!' : 'Time to tidy up. Well done!' : clock.status === 'running' ? 'Time to explore and learn' : clock.status === 'paused' ? 'Taking a little pause' : 'Ready when you are'}</output>
        </div>
        <div className="rotation-clock-face">
          <svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="25" /><circle className="rotation-clock-progress" cx="30" cy="30" r="25" strokeDasharray={`${157.08 * Math.min(1, remainingMs / clock.durationMs)} 157.08`} /></svg>
          <span role="timer" aria-label={`Round ${roundIndex + 1}: ${formatRotationTime(remainingMs)} remaining`} aria-live="off">{formatRotationTime(remainingMs)}</span>
        </div>
        <div className="rotation-timer-actions">
          <div>
            {finished && nextRound && <button type="button" className="timer-primary" title={`Start round ${roundIndex + 2}`} disabled={!revealed || !!playback} onClick={startNextRound}>Next round<ArrowRight /></button>}
            <button type="button" className={finished && nextRound ? undefined : 'timer-primary'} disabled={!revealed || !!playback} onClick={() => { prepareTransitionAudio(); dispatch({ type: clock.status === 'running' ? 'pause' : 'start', now: Date.now() }); }}>{clock.status === 'running' ? <><Pause />Pause</> : finished ? <><RotateCcw />Restart round</> : <><Play />{clock.status === 'paused' ? 'Resume' : 'Start timer'}</>}</button>
            <button type="button" onClick={() => dispatch({ type: 'add-minute', now: Date.now() })}><Plus />1 min</button>
            <button type="button" aria-label="Reset timer" title="Reset timer" onClick={() => dispatch({ type: 'reset', durationSeconds: settings.durationSeconds })}><RotateCcw /></button>
          </div>
          <div>
            <button type="button" onClick={playSong}><Music2 />Play transition music</button>
            {nextRound && !finished && <button type="button" title={`Start round ${roundIndex + 2}`} disabled={!revealed || !!playback} onClick={startNextRound}>Next round<ArrowRight /></button>}
          </div>
          {!revealed && <small>Reveal the day to start station time.</small>}
        </div>
      </section>}

      {melodyOpen && <section className="rotation-music-strip" aria-label="Transition time">
        <div className="rotation-music-heading"><Music2 /><span><strong>{finished && nextRound ? `Get ready for round ${roundIndex + 2}` : finished ? 'Time to tidy up. Well done!' : 'Time to tidy up'}</strong><small>{videoFailed ? 'YouTube could not start. Using your built-in tune.' : 'Small steps to your next adventure.'}</small></span></div>
        <TransitionMelody key={`${settings.melodyId}:${settings.transitionSeconds}`} melodyId={settings.melodyId} seconds={settings.transitionSeconds} banner />
        <div className="rotation-music-controls">{finished && nextRound ? <button type="button" className="timer-primary" title={`Start round ${roundIndex + 2}`} disabled={!revealed || !!playback} onClick={startNextRound}>Next round<ArrowRight /></button> : !finished && revealed ? <button type="button" className="timer-primary" onClick={() => { prepareTransitionAudio(); setVideoOpen(false); dispatch({ type: 'start', now: Date.now() }); }}>Resume round {roundIndex + 1}<Play /></button> : null}<button type="button" onClick={() => setVideoOpen(false)}>Close transition</button></div>
      </section>}

      {hasPlan ? <section className="student-day-table-wrap" tabIndex={0} aria-label="Scroll the daily rotation chart">
        <table className="student-day-table" style={{ minWidth: `${Math.max(720, (day.rounds.length + 1) * 205)}px` }}>
          <caption className="sr-only">Daily rotations for {date}</caption>
          <thead><tr><th scope="col">Team</th>{day.rounds.map((round, index) => <th scope="col" key={round.id} className={revealed && round.id === highlightedRound ? 'is-current-round' : undefined} aria-current={revealed && round.id === highlightedRound ? 'step' : undefined}><span className="student-day-round-number" aria-hidden="true">{index + 1}</span>Round {index + 1}{revealed && round.id === highlightedRound && <span className="current-round-label">{highlightedRound === clock.roundId ? 'Now' : 'Next'}</span>}</th>)}</tr></thead>
          <tbody>{day.groups.map((group) => {
            const entries = day.rounds.map((round) => round.entries.find((entry) => entry.group.id === group.id));
            const students = entries.find((entry) => entry)?.group.students ?? [];
            const memberIds = new Set(students.map((student) => student.id));
            // Show the roster once when it is the same all day. Historical rounds
            // with different learners retain their own names beside the activity.
            const sameRoster = entries.every((entry) => entry && entry.group.students.length === students.length && entry.group.students.every((student) => memberIds.has(student.id)));
            return <tr key={group.id} style={{ '--team-color': group.color } as CSSProperties}>
              <th scope="row"><div className="student-day-team"><GroupVisual group={group} /><strong>{group.name}</strong></div>{showNames && sameRoster && <p className="student-route-names">{students.map((student) => student.name).join(' · ')}</p>}</th>
              {day.rounds.map((round, index) => <td key={round.id} className={revealed && round.id === highlightedRound ? 'is-current-round' : undefined}>
                <div className="student-day-destination">
                  {revealed ? <>
                    <Destination entry={entries[index]} />
                    {showNames && !sameRoster && entries[index] && <p className="student-route-names">{entries[index].group.students.map((student) => student.name).join(' · ')}</p>}
                    {playback && <RevealCover key={playback.sequence} effect={playback.effect} />}
                  </> : <div className="student-day-mystery"><span aria-hidden="true">?</span><span className="sr-only">Activity hidden until the day is revealed</span></div>}
                </div>
              </td>)}
            </tr>;
          })}</tbody>
        </table>
      </section> : <p className="student-show-empty">Your day is getting ready. Check with your teacher.</p>}

      <footer className="student-show-controls">
        <div className="student-show-counter"><Sparkles /><span><strong>{day.groups.length} teams · {day.rounds.length} rounds</strong>One reveal for the whole day</span></div>
        <div className="student-show-buttons">
          <button ref={revealButton} type="button" className="show-primary" disabled={!hasPlan} onClick={hideOrReveal}>{revealed ? <><RotateCcw />Hide again</> : <><Sparkles />Reveal the day</>}</button>
        </div>
      </footer>
      <output className="sr-only" aria-live="polite" aria-atomic="true">{revealed ? `All ${day.rounds.length} rounds for ${date} are revealed. Find your team and read from left to right.` : 'The day is ready to reveal.'}</output>
      <RevealEffectLayer playback={playback} />
      {settingsOpen && <RotationPresentationSettings settings={settings} container={screen} onClose={() => setSettingsOpen(false)} onSave={(next) => {
        if (next.durationSeconds !== settings.durationSeconds) {
          setVideoOpen(false);
          dispatch({ type: 'set-duration', durationSeconds: next.durationSeconds, now: Date.now() });
        }
        onSettingsChange(next);
        setSettingsOpen(false);
      }} />}
      <Dialog open={videoOpen && !melodyOpen} onOpenChange={setVideoOpen}>
        <DialogContent portalContainer={screen} className="rotation-transition-dialog" onKeyDown={(event) => event.stopPropagation()}>
          <DialogHeader><DialogTitle><Music2 />Transition time</DialogTitle><DialogDescription>{finished ? nextRound ? `Tidy up, then get ready for round ${roundIndex + 2}.` : 'Tidy up and celebrate a day of learning.' : 'A little music for your next move.'}</DialogDescription></DialogHeader>
          {videoOpen && !melodyOpen && <TransitionVideo youtubeUrl={settings.youtubeUrl} onUnavailable={() => setVideoFailed(true)} />}
          <DialogFooter><Button variant="outline" onClick={() => setVideoOpen(false)}>Back to the day</Button>{finished && nextRound ? <Button title={`Start round ${roundIndex + 2}`} disabled={!revealed || !!playback} onClick={startNextRound}>Next round<ArrowRight /></Button> : !finished && revealed ? <Button onClick={() => { prepareTransitionAudio(); setVideoOpen(false); dispatch({ type: 'start', now: Date.now() }); }}>Resume round {roundIndex + 1}</Button> : null}</DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
