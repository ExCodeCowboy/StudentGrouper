import { useEffect, useRef } from 'react';
import { Shuffle, Sparkles, Star } from 'lucide-react';
import { StudentViewHeader, type StudentNavigation } from '../components/StudentViewHeader';
import { RevealCover, RevealEffectLayer, RevealSoundToggle } from '../revealEffects/RevealEffects';
import { useRevealEffects } from '../revealEffects/useRevealEffects';
import { pickStudent, type PickerStudent } from '../studentPicker';
import './studentGroups.css';
import './studentPicker.css';

export type StudentPick = { studentId: string; draw: number };

export function StudentPickerView({ students, navigation, selection, onPick }: {
  students: PickerStudent[];
  navigation: StudentNavigation;
  selection: StudentPick | null;
  onPick: (selection: StudentPick) => void;
}) {
  const pickButton = useRef<HTMLButtonElement>(null);
  const stage = useRef<HTMLElement>(null);
  const { playback, play, reducedMotion, soundEnabled, soundUnavailable, setSoundEnabled } = useRevealEffects('confetti');
  // Recheck against the live eligible roster; a stale choice must not show an
  // absent or removed student when attendance changes.
  const student = students.find((candidate) => candidate.id === selection?.studentId);
  const empty = students.length === 0;

  useEffect(() => {
    (pickButton.current?.disabled ? stage.current : pickButton.current)?.focus({ preventScroll: true });
  }, []);

  const choose = () => {
    if (playback) return;
    const chosen = pickStudent(students);
    if (!chosen) return;
    onPick({ studentId: chosen.id, draw: (selection?.draw ?? 0) + 1 });
    play();
  };

  return <main className="student-show student-picker">
    <div className="student-show-decor" aria-hidden="true">
      <Star className="show-star star-one" /><Star className="show-star star-two" /><Sparkles className="show-sparkle" />
      <span className="show-orbit orbit-one" /><span className="show-orbit orbit-two" />
    </div>
    <StudentViewHeader navigation={navigation} title="Who’s up next?" />
    <section className="student-picker-stage" ref={stage} tabIndex={-1} aria-label="Random student picker">
      <div className={`student-picker-card${student ? ' has-pick' : ''}`} aria-busy={!!playback}>
        <div className="student-picker-content" aria-hidden={!!playback}>
          <span className="student-picker-kicker">{student ? 'A moment to shine' : 'A classroom surprise'}</span>
          <div className="student-picker-badge" aria-hidden="true">{student ? <Star fill="currentColor" /> : <span>?</span>}</div>
          {student ? <>
            <h2 className="student-picker-name">{student.name}</h2>
            <p>It’s your turn!</p>
          </> : <>
            <h2>{empty ? 'Your class is getting ready' : 'Who will it be?'}</h2>
            <p>{empty ? 'Mark students Here in Teacher view to start picking.' : 'Let’s find out together.'}</p>
          </>}
        </div>
        {student && playback && <RevealCover key={playback.sequence} effect={playback.effect} />}
      </div>
      <p className="student-picker-hint">{empty ? 'No students are marked Here.' : 'Everyone here is in the draw.'}</p>
    </section>
    <footer className="student-show-controls" aria-label="Student picker controls">
      <div className="student-picker-count"><strong>{students.length}</strong> {students.length === 1 ? 'student' : 'students'} here<span>A fresh draw every time</span></div>
      <div className="student-show-buttons">
        <RevealSoundToggle enabled={soundEnabled} unavailable={soundUnavailable} onChange={setSoundEnabled} />
        <button ref={pickButton} type="button" className="show-primary" disabled={empty} aria-disabled={!!playback || empty} onClick={choose}>
          {playback ? <><Sparkles />Revealing…</> : <><Shuffle />{student ? 'Pick again' : 'Pick a student'}</>}
        </button>
      </div>
    </footer>
    {reducedMotion && <span className="sr-only">Reduced motion: instant reveals.</span>}
    <output className="sr-only" aria-live="polite" aria-atomic="true">{playback ? 'Picking a student.' : student ? `Pick ${selection?.draw}: ${student.name}. It’s your turn!` : empty ? 'No students are marked Here.' : 'Ready to pick a student.'}</output>
    <RevealEffectLayer playback={playback} />
  </main>;
}
