import { useEffect, useState, type KeyboardEvent } from 'react';
import type { GroupSet, RotationPresentationSettings } from '../model';
import type { DisplayGroup, DisplayRotationDay } from '../studentDisplay';
import type { RotationClock } from '../rotationTimer';
import type { StudentPage, StudentNavigation } from '../components/StudentViewHeader';
import { StudentGroupsView } from './StudentGroupsView';
import { StudentRotationsView } from './StudentRotationsView';

export function StudentPresentation({ page, onNavigate, onClose, groups, groupOptions, groupSetId, onSelectGroupSet, onRebuild, canRebuild, groupsNeedCheck, saveIssue, day, dayId, settings, onSettingsChange, initialTimer, onRememberTimer }: {
  page: StudentPage;
  onNavigate: (page: StudentPage) => void;
  onClose: () => void;
  groups: DisplayGroup[];
  groupOptions: Pick<GroupSet, 'id' | 'name'>[];
  groupSetId: string;
  onSelectGroupSet: (id: string) => void;
  onRebuild: () => void;
  canRebuild: boolean;
  groupsNeedCheck: boolean;
  saveIssue: string;
  day?: DisplayRotationDay;
  dayId: string;
  settings: RotationPresentationSettings;
  onSettingsChange: (settings: RotationPresentationSettings) => void;
  initialTimer?: RotationClock;
  onRememberTimer: (clock: RotationClock) => void;
}) {
  const [screen, setScreen] = useState<HTMLDivElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [issue, setIssue] = useState('');
  const [revealedGroupSet, setRevealedGroupSet] = useState<string | null>(null);
  const [revealedDay, setRevealedDay] = useState<string | null>(null);
  const [showNames, setShowNames] = useState(true);

  useEffect(() => {
    const update = () => setFullscreen(!!screen && document.fullscreenElement === screen);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, [screen]);

  const close = async () => {
    if (screen && document.fullscreenElement === screen) {
      try { await document.exitFullscreen(); } catch { /* Returning to teaching still works. */ }
    }
    onClose();
  };
  const toggleFullscreen = async () => {
    setIssue('');
    try {
      if (screen && document.fullscreenElement === screen) await document.exitFullscreen();
      else if (screen?.requestFullscreen) await screen.requestFullscreen();
      else setIssue('Full screen is not available here. You can maximize the app window.');
    } catch { setIssue('Full screen is not available here. You can maximize the app window.'); }
  };
  const handleKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || (event.target instanceof HTMLElement && event.target.closest('[role="dialog"], select'))) return;
    if (event.key === 'Escape' && !document.fullscreenElement) { event.preventDefault(); void close(); }
  };
  const navigation: StudentNavigation = { page, onNavigate, hasDay: !!day, fullscreen, onFullscreen: () => { void toggleFullscreen(); }, onClose: () => { void close(); }, issue: issue || saveIssue };

  return (
    // The stable fullscreen container survives Groups / Today navigation.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="student-presentation" ref={setScreen} onKeyDown={handleKey}>
      {page === 'today' && day ? <StudentRotationsView
        key={dayId}
        day={day}
        navigation={navigation}
        screen={screen}
        revealed={revealedDay === dayId}
        onRevealedChange={(value) => setRevealedDay(value ? dayId : null)}
        showNames={showNames}
        onShowNamesChange={setShowNames}
        settings={settings}
        onSettingsChange={onSettingsChange}
        initialTimer={initialTimer}
        onRememberTimer={onRememberTimer}
      /> : <StudentGroupsView
        groups={groups}
        navigation={navigation}
        groupOptions={groupOptions}
        groupSetId={groupSetId}
        onSelectGroupSet={(id) => { setRevealedGroupSet(null); onSelectGroupSet(id); }}
        onRebuild={() => { setRevealedGroupSet(null); onRebuild(); }}
        canRebuild={canRebuild}
        needsTeacherCheck={groupsNeedCheck}
        revealed={revealedGroupSet === groupSetId}
        onRevealedChange={(value) => setRevealedGroupSet(value ? groupSetId : null)}
      />}
    </div>
  );
}
