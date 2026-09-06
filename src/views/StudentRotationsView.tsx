import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ArrowLeft, MapPin, Maximize, Minimize, RotateCcw, Sparkles, Star } from 'lucide-react';
import { GroupVisual } from '../components/GroupVisual';
import { StationVisual } from '../components/StationVisual';
import { RevealCover, RevealEffectLayer, RevealEffectPicker } from '../revealEffects/RevealEffects';
import { useRevealEffects } from '../revealEffects/useRevealEffects';
import type { DisplayRotation, DisplayRotationDay } from '../studentDisplay';
import './studentGroups.css';
import './studentRotations.css';

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

export function StudentRotationsView({ day, onClose }: { day: DisplayRotationDay; onClose: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [showNames, setShowNames] = useState(true);
  const { selection, select, reducedMotion, animate, playback, play, stop } = useRevealEffects();
  const [fullscreen, setFullscreen] = useState(false);
  const [issue, setIssue] = useState('');
  const screen = useRef<HTMLElement>(null);
  const revealButton = useRef<HTMLButtonElement>(null);
  const hasPlan = day.groups.length > 0 && day.rounds.length > 0;
  const date = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${day.date}T12:00:00`));

  useEffect(() => {
    revealButton.current?.focus();
    const updateFullscreen = () => setFullscreen(document.fullscreenElement === screen.current);
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  const close = async () => {
    if (document.fullscreenElement === screen.current) {
      try { await document.exitFullscreen(); } catch { /* Closing the screen still works. */ }
    }
    onClose();
  };
  const toggleFullscreen = async () => {
    setIssue('');
    try {
      if (document.fullscreenElement === screen.current) await document.exitFullscreen();
      else if (screen.current?.requestFullscreen) await screen.current.requestFullscreen();
      else setIssue('Full screen is not available here. You can maximize the app window.');
    } catch { setIssue('Full screen is not available here. You can maximize the app window.'); }
  };
  const handleKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !document.fullscreenElement) { event.preventDefault(); void close(); }
  };
  const hideOrReveal = () => {
    if (!hasPlan) return;
    if (revealed) { setRevealed(false); stop(); }
    else { setRevealed(true); play(); }
  };

  return (
    // Escape closes the presentation; arrow keys keep their normal scrolling behavior.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <main className={`student-show student-rotations${animate ? ' with-effects' : ''}`} ref={screen} onKeyDown={handleKey}>
      <div className="student-show-decor" aria-hidden="true"><Star className="show-star star-one" /><Star className="show-star star-two" /><span className="show-orbit orbit-one" /></div>
      <header className="student-show-top">
        <span className="student-show-brand"><span><Sparkles /></span> Our day together</span>
        <div className="student-show-tools">
          <label className="show-effects"><input type="checkbox" checked={showNames} onChange={(event) => setShowNames(event.target.checked)} /> Student names</label>
          <RevealEffectPicker selection={selection} onSelect={select} reducedMotion={reducedMotion} />
          <button type="button" onClick={toggleFullscreen}>{fullscreen ? <Minimize /> : <Maximize />}{fullscreen ? 'Exit full screen' : 'Full screen'}</button>
          <button type="button" onClick={close}><ArrowLeft />Teacher view</button>
        </div>
      </header>
      {issue && <output className="student-show-issue">{issue}</output>}
      <section className="student-show-intro" aria-labelledby="student-rotations-title">
        <p className="student-show-kicker">{date}</p>
        <h1 id="student-rotations-title">{revealed ? <>Our day of <span>discovery</span></> : <>What’s in store <span>today?</span></>}</h1>
        <p>{revealed ? 'Find your team. Follow your day from left to right.' : 'Find your team. A whole day of adventures is waiting!'}</p>
      </section>

      {hasPlan ? <section className="student-day-table-wrap" tabIndex={0} aria-label="Scroll the daily rotation chart">
        <table className="student-day-table" style={{ minWidth: `${Math.max(720, (day.rounds.length + 1) * 205)}px` }}>
          <caption className="sr-only">Daily rotations for {date}</caption>
          <thead><tr><th scope="col">Team</th>{day.rounds.map((round, index) => <th scope="col" key={round.id}><span className="student-day-round-number" aria-hidden="true">{index + 1}</span>Round {index + 1}</th>)}</tr></thead>
          <tbody>{day.groups.map((group) => {
            const entries = day.rounds.map((round) => round.entries.find((entry) => entry.group.id === group.id));
            const students = entries.find((entry) => entry)?.group.students ?? [];
            const memberIds = new Set(students.map((student) => student.id));
            // Show the roster once when it is the same all day. Historical rounds
            // with different learners retain their own names beside the activity.
            const sameRoster = entries.every((entry) => entry && entry.group.students.length === students.length && entry.group.students.every((student) => memberIds.has(student.id)));
            return <tr key={group.id} style={{ '--team-color': group.color } as CSSProperties}>
              <th scope="row"><div className="student-day-team"><GroupVisual group={group} /><strong>{group.name}</strong></div>{showNames && sameRoster && <p className="student-route-names">{students.map((student) => student.name).join(' · ')}</p>}</th>
              {day.rounds.map((round, index) => <td key={round.id}>
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
    </main>
  );
}
