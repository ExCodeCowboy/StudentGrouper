import { useEffect, useRef, type CSSProperties } from 'react';
import { Check, RotateCcw, Shuffle, Sparkles, Star } from 'lucide-react';
import { GroupVisual } from '../components/GroupVisual';
import { StarterStar } from '../components/StarterStar';
import type { DisplayGroup } from '../studentDisplay';
import type { GroupSet } from '../model';
import { StudentViewHeader, type StudentNavigation } from '../components/StudentViewHeader';
import { RevealCover, RevealEffectLayer, RevealEffectPicker } from '../revealEffects/RevealEffects';
import { useRevealEffects } from '../revealEffects/useRevealEffects';
import './studentGroups.css';

export function StudentGroupsView({ groups, navigation, groupOptions, groupSetId, onSelectGroupSet, onRebuild, canRebuild, needsTeacherCheck, revealed, onRevealedChange: setRevealed }: {
  groups: DisplayGroup[];
  navigation: StudentNavigation;
  groupOptions: Pick<GroupSet, 'id' | 'name'>[];
  groupSetId: string;
  onSelectGroupSet: (id: string) => void;
  onRebuild: () => void;
  canRebuild: boolean;
  needsTeacherCheck: boolean;
  revealed: boolean;
  onRevealedChange: (value: boolean) => void;
}) {
  const screen = useRef<HTMLElement>(null);
  const revealButton = useRef<HTMLButtonElement>(null);
  const hideButton = useRef<HTMLButtonElement>(null);
  const { selection, select, reducedMotion, animate, playback, play, stop } = useRevealEffects();
  const complete = groups.length > 0 && revealed;
  const hasStarters = groups.some((group) => group.starterStudentId);

  useEffect(() => {
    (revealButton.current?.disabled ? hideButton.current : revealButton.current)?.focus({ preventScroll: true });
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
  return (
    <main className={`student-show student-groups${animate ? ' with-effects' : ''}${revealed ? ' has-reveals' : ''}`} ref={screen}>
      <div className="student-show-decor" aria-hidden="true">
        <Star className="show-star star-one" /><Star className="show-star star-two" /><Star className="show-star star-three" /><Sparkles className="show-sparkle" />
        <span className="show-orbit orbit-one" /><span className="show-orbit orbit-two" />
      </div>
      <StudentViewHeader navigation={navigation} title={complete ? 'Together, we shine!' : 'Who’s on your team?'}>
        <select className="student-arrangement-picker" aria-label="Saved group arrangement" title="Choose groups to show" value={groupSetId} onChange={(event) => { stop(); onSelectGroupSet(event.target.value); }}>
          {groupOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
        <button type="button" disabled={!canRebuild} title="Make new groups using this arrangement’s saved settings and locks" onClick={() => { stop(); onRebuild(); requestAnimationFrame(() => revealButton.current?.focus({ preventScroll: true })); }}><Shuffle />Rebuild groups</button>
      </StudentViewHeader>
      {needsTeacherCheck && <output className="student-show-issue">Some placements need a teacher check. Open Teacher view to review.</output>}
      <section className={`student-show-grid${groups.length > 8 ? ' show-many-groups' : ''}`} aria-label="Class teams" style={{ '--student-columns': Math.ceil(groups.length / Math.max(1, Math.ceil(groups.length / 5))) || 1, '--student-wide-columns': Math.ceil(groups.length / Math.max(1, Math.ceil(groups.length / 6))) || 1 } as CSSProperties}>
        {groups.map((group, index) => <article
          key={group.id}
          className={`student-team${revealed ? ' is-revealed' : ' is-mystery'}`}
          style={{ '--team-color': group.color, '--team-tilt': `${index % 2 ? 1.1 : -1.1}deg` } as CSSProperties}
          aria-label={revealed ? group.name : `Mystery group ${index + 1}`}
        >
          {revealed ? <>
            <div className="student-team-revealed">
              <div className="student-team-heading"><GroupVisual group={group} /><h2>{group.name}</h2></div>
              <ul>{group.students.map((student) => <li key={student.id}>{student.name}{group.starterStudentId === student.id && <StarterStar />}</li>)}</ul>
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
        <div className="student-show-counter"><span><strong>{groups.length}</strong> teams{hasStarters && <span className="starter-legend"><StarterStar /> The starter goes first</span>}</span></div>
        <div className="student-show-buttons">
          <button ref={hideButton} type="button" className="show-secondary" disabled={!revealed} onClick={hideGroups}><RotateCcw />Hide again</button>
          <div className="reveal-split-button">
            <button ref={revealButton} type="button" className="show-primary" disabled={revealed || groups.length === 0} onClick={reveal}>{complete ? <><Check />Everyone’s here!</> : <><Sparkles />Reveal all teams</>}</button>
            <RevealEffectPicker compact selection={selection} onSelect={select} reducedMotion={reducedMotion} />
          </div>
        </div>
      </footer>
      <output className="sr-only" aria-live="polite" aria-atomic="true">{revealed ? groups.map((group) => `${group.name}: ${group.students.map((student) => `${student.name}${student.id === group.starterStudentId ? ', starter' : ''}`).join(', ')}.`).join(' ') : 'All teams are hidden. Ready for the big reveal!'}</output>
      <RevealEffectLayer playback={playback} />
    </main>
  );
}
