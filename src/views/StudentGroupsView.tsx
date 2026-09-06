import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ArrowLeft, Check, Maximize, Minimize, RotateCcw, Sparkles, Star } from 'lucide-react';
import { GroupVisual } from '../components/GroupVisual';
import type { DisplayGroup } from '../studentDisplay';
import { RevealCover, RevealEffectLayer, RevealEffectPicker } from '../revealEffects/RevealEffects';
import { useRevealEffects } from '../revealEffects/useRevealEffects';
import './studentGroups.css';

export function StudentGroupsView({ groups, onClose }: { groups: DisplayGroup[]; onClose: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [displayIssue, setDisplayIssue] = useState('');
  const screen = useRef<HTMLElement>(null);
  const revealButton = useRef<HTMLButtonElement>(null);
  const hideButton = useRef<HTMLButtonElement>(null);
  const { selection, select, reducedMotion, animate, playback, play, stop } = useRevealEffects();
  const complete = groups.length > 0 && revealed;

  useEffect(() => {
    revealButton.current?.focus({ preventScroll: true });
    const updateFullscreen = () => setFullscreen(document.fullscreenElement === screen.current);
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  const reveal = () => {
    if (revealed || groups.length === 0) return;
    setRevealed(true);
    play();
    requestAnimationFrame(() => hideButton.current?.focus({ preventScroll: true }));
  };
  const hideGroups = () => {
    stop();
    setRevealed(false);
    requestAnimationFrame(() => revealButton.current?.focus({ preventScroll: true }));
    screen.current?.scrollTo({ top: 0 });
  };
  const close = async () => {
    if (document.fullscreenElement === screen.current) {
      try { await document.exitFullscreen(); } catch { /* The student screen can still close. */ }
    }
    onClose();
  };
  const toggleFullscreen = async () => {
    setDisplayIssue('');
    try {
      if (document.fullscreenElement === screen.current) await document.exitFullscreen();
      else if (screen.current?.requestFullscreen) await screen.current.requestFullscreen();
      else setDisplayIssue('Full screen is not available here. You can maximize the app window.');
    } catch { setDisplayIssue('Full screen is not available here. You can maximize the app window.'); }
  };
  const handleKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !document.fullscreenElement) { event.preventDefault(); void close(); }
  };

  return (
    // Escape closes the presentation from any of its controls.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <main className={`student-show${animate ? ' with-effects' : ''}${revealed ? ' has-reveals' : ''}`} ref={screen} onKeyDown={handleKey}>
      <div className="student-show-decor" aria-hidden="true">
        <Star className="show-star star-one" /><Star className="show-star star-two" /><Star className="show-star star-three" /><Sparkles className="show-sparkle" />
        <span className="show-orbit orbit-one" /><span className="show-orbit orbit-two" />
      </div>
      <header className="student-show-top">
        <span className="student-show-brand"><span><Sparkles /></span> Better together</span>
        <div className="student-show-tools">
          <RevealEffectPicker selection={selection} onSelect={select} reducedMotion={reducedMotion} />
          <button type="button" onClick={toggleFullscreen}>{fullscreen ? <Minimize /> : <Maximize />}{fullscreen ? 'Exit full screen' : 'Full screen'}</button>
          <button type="button" onClick={close}><ArrowLeft />Teacher view</button>
        </div>
      </header>
      {displayIssue && <output className="student-show-issue">{displayIssue}</output>}
      <section className="student-show-intro" aria-labelledby="student-show-title">
        <p className="student-show-kicker"><Star fill="currentColor" /> OUR CLASS. OUR TEAMS. <Star fill="currentColor" /></p>
        <h1 id="student-show-title">{complete ? <>Together, we <span>shine!</span></> : <>Who’s on your <span>team?</span></>}</h1>
        <p>{complete ? 'Find your name. Find your team. Let’s do great things!' : 'A little mystery. A little magic. All our teams, together.'}</p>
      </section>
      <section className={`student-show-grid${groups.length > 8 ? ' show-many-groups' : ''}`} aria-label="Class teams">
        {groups.map((group, index) => <article
          key={group.id}
          className={`student-team${revealed ? ' is-revealed' : ' is-mystery'}`}
          style={{ '--team-color': group.color, '--team-tilt': `${index % 2 ? 1.1 : -1.1}deg` } as CSSProperties}
          aria-label={revealed ? group.name : `Mystery group ${index + 1}`}
        >
          {revealed ? <>
            <div className="student-team-revealed">
              <div className="student-team-heading"><GroupVisual group={group} /><h2>{group.name}</h2></div>
              <ul>{group.students.map((student) => <li key={student.id}>{student.name}</li>)}</ul>
              <span className="student-team-cheer"><Sparkles />Dream team!</span>
            </div>
            {playback && <RevealCover key={playback.sequence} effect={playback.effect} />}
          </> : <div className="student-team-cover">
            <span className="student-team-number">TEAM {String(index + 1).padStart(2, '0')}</span>
            <span className="student-mystery-symbol">?<Star className="mystery-star" fill="currentColor" /></span>
            <strong>Who could it be?</strong><span className="student-mystery-hint">Your team is a surprise!</span>
          </div>}
        </article>)}
        {groups.length === 0 && <p className="student-show-empty">Your teams are getting ready. Come back soon!</p>}
      </section>
      <footer className="student-show-controls" aria-label="Reveal controls">
        <div className="student-show-counter"><Sparkles /><span><strong>{groups.length}</strong> teams · one big reveal</span></div>
        <div className="student-show-buttons">
          <button ref={hideButton} type="button" className="show-secondary" disabled={!revealed} onClick={hideGroups}><RotateCcw />Hide again</button>
          <button ref={revealButton} type="button" className="show-primary" disabled={revealed || groups.length === 0} onClick={reveal}>{complete ? <><Check />Everyone’s here!</> : <><Sparkles />Reveal all teams</>}</button>
        </div>
      </footer>
      <output className="sr-only" aria-live="polite" aria-atomic="true">{revealed ? groups.map((group) => `${group.name}: ${group.students.map((student) => student.name).join(', ')}.`).join(' ') : 'All teams are hidden. Ready for the big reveal!'}</output>
      <RevealEffectLayer playback={playback} />
    </main>
  );
}
