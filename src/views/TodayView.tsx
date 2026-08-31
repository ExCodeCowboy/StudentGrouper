import { useState, type DragEvent } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Lock,
  LockKeyholeOpen,
  LockOpen,
  Plus,
  Printer,
  RefreshCcw,
  RotateCcw,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { StationVisual } from '../components/StationVisual';
import { GroupVisual } from '../components/GroupVisual';
import type {
  Classroom,
  GroupSet,
  Location,
  PlannedStation,
  RotationSession,
  ScheduleIssue,
  StationIconKey,
} from '../model';
import { makeId } from '../model';
import { normalizeUploadedImage } from '../storage';
import {
  calendarMonth,
  shiftCalendarMonth,
  shiftSchoolDay,
} from '../dateNavigation';

type Props = {
  classroom: Classroom;
  groupSet: GroupSet;
  session: RotationSession;
  issues: ScheduleIssue[];
  ignoredIssueCount: number;
  actionIssue?: string;
  onSelectSession: (id: string) => void;
  onSelectGroupSet: (id: string) => void;
  onBuildOptimize: () => void;
  onUnlockAll: () => void;
  onIgnoreIssue: (issueId: string) => void;
  onRestoreIgnoredIssues: () => void;
  onAddRound: () => void;
  onRemoveRound: (roundId: string) => void;
  canUndo: boolean;
  onUndo: () => void;
  onPlanNextDay: (plan: {
    date: string;
    roundCount: number;
    plannedStations: PlannedStation[];
    groupSetId: string;
  }) => void;
  onMove: (roundId: string, groupId: string, stationId: string) => void;
  onMoveStation: (roundId: string, groupId: string, stationId: string) => void;
  onToggleLock: (roundId: string, groupId: string) => void;
  onToggleCompleted: (roundId: string) => void;
  onUpdateStation: (stationId: string, patch: Partial<PlannedStation>) => void;
  onAddStation: () => void;
  onRemoveStation: (stationId: string) => void;
  onUpdateLocation: (locationId: string, patch: Partial<Location>) => void;
  onAddLocation: () => void;
  onDeleteLocation: (locationId: string) => void;
  onPrint: () => void;
};

const iconOptions: { value: StationIconKey; label: string }[] = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'reading', label: 'Reading' },
  { value: 'writing', label: 'Writing' },
  { value: 'math', label: 'Math' },
  { value: 'computer', label: 'Computer' },
  { value: 'art', label: 'Art' },
  { value: 'listening', label: 'Listening' },
  { value: 'word-work', label: 'Word work' },
  { value: 'independent', label: 'Independent' },
  { value: 'partners', label: 'Partners' },
  { value: 'science', label: 'Science' },
  { value: 'music', label: 'Music' },
  { value: 'puzzles', label: 'Puzzles' },
  { value: 'blocks', label: 'Blocks' },
  { value: 'cutting', label: 'Cutting' },
  { value: 'movement', label: 'Movement' },
  { value: 'library', label: 'Library' },
  { value: 'fine-motor', label: 'Fine motor' },
  { value: 'nature', label: 'Nature' },
  { value: 'snack', label: 'Snack' },
];

function dateAtNoon(value: string) {
  return new Date(`${value}T12:00:00`);
}

function formatDay(value: string, compact = false) {
  return new Intl.DateTimeFormat(undefined, compact
    ? { weekday: 'short', month: 'short', day: 'numeric' }
    : { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
  ).format(dateAtNoon(value));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(dateAtNoon(`${value}-01`));
}

function StationAndLocation({
  station,
  location,
  compact = false,
}: {
  station: PlannedStation;
  location?: Location;
  compact?: boolean;
}) {
  return (
    <span className="station-and-location">
      <StationVisual station={station} compact={compact} />
      <span className={`location-name${location ? '' : ' missing'}`}>
        {location?.name ?? 'Choose location'}
      </span>
    </span>
  );
}

export function TodayView({
  classroom,
  groupSet,
  session,
  issues,
  ignoredIssueCount,
  actionIssue,
  onSelectSession,
  onSelectGroupSet,
  onBuildOptimize,
  onUnlockAll,
  onIgnoreIssue,
  onRestoreIgnoredIssues,
  onAddRound,
  onRemoveRound,
  canUndo,
  onUndo,
  onPlanNextDay,
  onMove,
  onMoveStation,
  onToggleLock,
  onToggleCompleted,
  onUpdateStation,
  onAddStation,
  onRemoveStation,
  onUpdateLocation,
  onAddLocation,
  onDeleteLocation,
  onPrint,
}: Props) {
  const [view, setView] = useState<'station' | 'group'>('station');
  const [dayStep, setDayStep] = useState<'stations' | 'assignments'>('assignments');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [visualStationId, setVisualStationId] = useState('');
  const [calendarMonthValue, setCalendarMonthValue] = useState(session.date.slice(0, 7));
  const [draftDate, setDraftDate] = useState('');
  const [draftRounds, setDraftRounds] = useState(3);
  const [draftStations, setDraftStations] = useState<PlannedStation[]>([]);
  const [draftGroupSetId, setDraftGroupSetId] = useState('');
  const [pendingRemoveRoundId, setPendingRemoveRoundId] = useState('');
  const [pendingGroupSetId, setPendingGroupSetId] = useState('');
  const [imageIssue, setImageIssue] = useState('');
  const [issuesOpen, setIssuesOpen] = useState(false);
  const activeStations = session.plannedStations;
  const displayDate = draftDate || session.date;
  const editingStations = draftDate ? draftStations : session.plannedStations;
  const editingGroupSet = draftDate
    ? classroom.groupSets.find((item) => item.id === draftGroupSetId) ?? groupSet
    : groupSet;
  const plannedStationCount = editingStations.length;
  const visibleIssues = actionIssue
    ? [{ id: 'action', severity: 'attention' as const, message: actionIssue }, ...issues]
    : issues;
  const pendingGroupSet = classroom.groupSets.find((item) => item.id === pendingGroupSetId);
  const pendingRemoveRoundIndex = session.rounds.findIndex(
    (round) => round.id === pendingRemoveRoundId,
  );
  const canUnlock = session.rounds.some(
    (round) => !round.completed && round.assignments.some((assignment) => assignment.locked),
  );
  const locationForStation = (
    stationId: string,
    plans = session.plannedStations,
  ) => {
    const locationId = plans.find((plan) => plan.id === stationId)?.locationId;
    return classroom.locations.find((location) => location.id === locationId);
  };
  const startDayDraft = (targetDate = shiftSchoolDay(displayDate, 1)) => {
    const earlierSessions = classroom.sessions
      .filter((item) => item.date < targetDate)
      .sort((left, right) => left.date.localeCompare(right.date));
    const template = earlierSessions.at(-1) ?? session;
    setDayStep('stations');
    setDraftDate(targetDate);
    setDraftRounds(template.rounds.length || 3);
    setDraftStations(template.plannedStations.map((plan) => ({ ...plan })));
    setDraftGroupSetId(template.groupSetId);
    setImageIssue('');
  };

  const chooseDate = (date: string) => {
    setCalendarOpen(false);
    const existing = classroom.sessions
      .filter((item) => item.date === date)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .at(-1);
    if (existing) {
      setDraftDate('');
      setDraftStations([]);
      onSelectSession(existing.id);
      return;
    }
    startDayDraft(date);
  };

  const openCalendar = () => {
    setCalendarMonthValue(displayDate.slice(0, 7));
    setCalendarOpen(true);
  };

  const openStationSetup = () => {
    setDayStep('stations');
  };

  const addEditingStation = () => {
    if (!draftDate) {
      onAddStation();
      return;
    }
    setDraftStations((plans) => {
      const usedLocationIds = new Set(plans.map((plan) => plan.locationId));
      const location = classroom.locations.find(
        (item) => !item.archived && !usedLocationIds.has(item.id),
      ) ?? classroom.locations.find((item) => !item.archived);
      return [...plans, {
        id: makeId('station'),
        activityName: '',
        locationId: location?.id ?? '',
        iconKey: 'independent',
      }];
    });
  };

  const updateEditingStation = (stationId: string, patch: Partial<PlannedStation>) => {
    if (!draftDate) {
      onUpdateStation(stationId, patch);
      return;
    }
    setDraftStations((plans) => plans.map((plan) =>
      plan.id === stationId ? { ...plan, ...patch } : plan));
  };

  const removeEditingStation = (stationId: string) => {
    if (!draftDate) {
      onRemoveStation(stationId);
      return;
    }
    setDraftStations((plans) => plans.filter((plan) => plan.id !== stationId));
  };
  const recentActivityNames = Array.from(new Map(
    classroom.sessions
      .slice()
      .reverse()
      .flatMap((item) => item.plannedStations.map((station) => station.activityName.trim()))
      .filter(Boolean)
      .map((name) => [name.toLocaleLowerCase(), name]),
  ).values()).slice(0, 24);
  const plannedDateSet = new Set(classroom.sessions.map((item) => item.date));
  const visibleCalendarMonth = calendarMonth(calendarMonthValue);
  const draftLocationIds = draftStations.map((plan) => plan.locationId);
  const canCreateDraft = Boolean(draftDate && draftGroupSetId) &&
    draftStations.length > 0 &&
    draftStations.every((station) => station.activityName.trim()) &&
    draftLocationIds.every(Boolean) &&
    draftLocationIds.every((locationId) => classroom.locations.some((location) => location.id === locationId));
  const repeatedLocations = classroom.locations.filter((location) =>
    editingStations.filter((station) => station.locationId === location.id).length > 1);
  const activityLocations = new Map<string, { name: string; locationIds: Set<string> }>();
  editingStations.forEach((station) => {
    const name = station.activityName.trim();
    const key = name.toLocaleLowerCase();
    if (!key || !station.locationId) return;
    const existing = activityLocations.get(key) ?? { name, locationIds: new Set<string>() };
    existing.locationIds.add(station.locationId);
    activityLocations.set(key, existing);
  });
  const repeatedActivityLocations = Array.from(activityLocations.values())
    .filter((activity) => activity.locationIds.size > 1);
  const repeatedActivityKeys = new Set(
    repeatedActivityLocations.map((activity) => activity.name.trim().toLocaleLowerCase()),
  );

  const cancelDraft = () => {
    setDraftDate('');
    setDraftStations([]);
    setDayStep('assignments');
    setImageIssue('');
  };

  const continueToAssignments = () => {
    if (draftDate) {
      if (!canCreateDraft) return;
      onPlanNextDay({
        date: draftDate,
        roundCount: draftRounds,
        plannedStations: draftStations,
        groupSetId: draftGroupSetId,
      });
      setDraftDate('');
      setDraftStations([]);
    } else {
      onBuildOptimize();
    }
    setDayStep('assignments');
  };
  const issueTouchesRound = (issue: ScheduleIssue, roundId: string) =>
    issue.roundId === roundId || issue.roundIds?.includes(roundId);
  const issueTouchesCell = (
    issue: ScheduleIssue,
    roundId: string,
    groupId?: string,
    stationId?: string,
  ) => {
    if (!issueTouchesRound(issue, roundId)) return false;
    if (!issue.groupId && !issue.stationId) return false;
    if (issue.groupId && issue.groupId !== groupId) return false;
    if (issue.stationId && issue.stationId !== stationId) return false;
    return true;
  };

  const requestGroupSetChange = (groupSetId: string) => {
    if (draftDate) {
      setDraftGroupSetId(groupSetId);
      return;
    }
    if (groupSetId === session.groupSetId) return;
    const hasScheduleWork = session.rounds.some(
      (round) => round.completed || round.assignments.length > 0,
    );
    if (hasScheduleWork) {
      setPendingGroupSetId(groupSetId);
    } else {
      onSelectGroupSet(groupSetId);
    }
  };

  const dragGroup = (event: DragEvent, groupId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-group-id', groupId);
  };
  const dragStation = (event: DragEvent, stationId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-station-id', stationId);
  };
  const dropGroupAtStation = (event: DragEvent, roundId: string, stationId: string) => {
    event.preventDefault();
    const groupId = event.dataTransfer.getData('application/x-group-id');
    if (groupId) onMove(roundId, groupId, stationId);
  };
  const dropStationAtGroup = (event: DragEvent, roundId: string, groupId: string) => {
    event.preventDefault();
    const stationId = event.dataTransfer.getData('application/x-station-id');
    if (stationId) onMoveStation(roundId, groupId, stationId);
  };

  const uploadImage = async (stationId: string, file?: File) => {
    if (!file) return;
    try {
      setImageIssue('');
      const imageDataUrl = await normalizeUploadedImage(file);
      updateEditingStation(stationId, { imageDataUrl });
    } catch (error) {
      setImageIssue(error instanceof Error ? error.message : 'The picture could not be added.');
    }
  };
  const visualStation = editingStations.find((station) => station.id === visualStationId);

  return (
    <main className="workspace rotation-workspace">
      <section className="page-heading rotation-heading">
        <div>
          <p className="eyebrow">Rotation schedule</p>
          <div className="date-navigator">
            <Button
              aria-label="Previous school day"
              title="Previous school day"
              variant="outline"
              size="icon-lg"
              onClick={() => chooseDate(shiftSchoolDay(displayDate, -1))}
            >
              <ChevronLeft />
            </Button>
            <button
              type="button"
              className="date-picker-trigger"
              aria-label={`Choose schedule date. ${formatDay(displayDate)}`}
              onClick={openCalendar}
            >
              <CalendarDays aria-hidden="true" />
              <span>
                <strong>{formatDay(displayDate)}</strong>
                <small>Choose a date</small>
              </span>
            </button>
            <Button
              aria-label="Next school day"
              title="Next school day"
              variant="outline"
              size="icon-lg"
              onClick={() => chooseDate(shiftSchoolDay(displayDate, 1))}
            >
              <ChevronRight />
            </Button>
          </div>
          <div className="rotation-group-choice">
            <label>
              <span>Groups</span>
              <select
                aria-label="Groups used for this day"
                className="native-control"
                value={editingGroupSet.id}
                disabled={classroom.groupSets.length < 2}
                onChange={(event) => requestGroupSetChange(event.target.value)}
              >
                {classroom.groupSets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <span>{editingGroupSet.groups.length} groups · {plannedStationCount} activities</span>
          </div>
        </div>
        <div className="heading-actions rotation-actions">
          {draftDate ? (
            <Button variant="outline" size="lg" onClick={cancelDraft}>
              <RotateCcw /> Cancel new day
            </Button>
          ) : (
            <Button variant="outline" size="lg" onClick={() => startDayDraft()}>
              <CalendarPlus /> Plan next day
            </Button>
          )}
          <Button variant="outline" size="lg" disabled={Boolean(draftDate)} onClick={onPrint}>
            <Printer /> Print
          </Button>
        </div>
      </section>

      <div className="day-steps" aria-label="Day setup" role="tablist">
        <button
          aria-controls="stations-panel"
          aria-selected={dayStep === 'stations'}
          className={dayStep === 'stations' ? 'active' : ''}
          id="stations-tab"
          role="tab"
          type="button"
          onClick={openStationSetup}
        >
          <span>1</span>
          <strong>Stations</strong>
          <small>Activities, locations, and visuals</small>
        </button>
        <button
          aria-controls="assignments-panel"
          aria-disabled={Boolean(draftDate) && !canCreateDraft}
          aria-selected={dayStep === 'assignments'}
          className={dayStep === 'assignments' ? 'active' : ''}
          disabled={Boolean(draftDate) && !canCreateDraft}
          id="assignments-tab"
          role="tab"
          type="button"
          onClick={() => draftDate ? continueToAssignments() : setDayStep('assignments')}
        >
          <span>2</span>
          <strong>Assignments</strong>
          <small>Fill, adjust, and lock the rotation</small>
        </button>
      </div>

      {dayStep === 'stations' ? (
        <section
          aria-labelledby="stations-tab"
          className="station-setup-workspace"
          id="stations-panel"
          role="tabpanel"
        >
          <header className="station-setup-heading">
            <div>
              <p className="eyebrow">{draftDate ? 'New day · ' : ''}Step 1 of 2</p>
              <h2>Stations for {formatDay(displayDate)}</h2>
              <p>Type or choose an activity, select its location, then choose the visual children will recognize.</p>
            </div>
            <div>
              {draftDate && (
                <label className="draft-round-count">
                  <span>Rounds</span>
                  <select className="native-control" value={draftRounds} onChange={(event) => setDraftRounds(Number(event.target.value))}>
                    {Array.from({ length: 8 }, (_, index) => index + 1).map((count) => (
                      <option value={count} key={count}>{count}</option>
                    ))}
                  </select>
                </label>
              )}
              <Button variant="outline" onClick={() => setLocationsOpen(true)}><Settings2 /> Manage locations</Button>
              <Button variant="outline" onClick={addEditingStation}><Plus /> Add station</Button>
              <Button disabled={Boolean(draftDate) && !canCreateDraft} onClick={continueToAssignments}>
                Continue to assignments <ChevronRight />
              </Button>
            </div>
          </header>
          {imageIssue && <p className="dialog-issue">{imageIssue}</p>}
          {draftDate && !canCreateDraft && (
            <p className="dialog-issue">Give every station an activity and location before continuing.</p>
          )}
          {repeatedLocations.length > 0 && (
            <p className="station-setup-caution">
              <AlertTriangle aria-hidden="true" />
              {repeatedLocations.map((location) => location.name).join(', ')} {repeatedLocations.length === 1 ? 'is' : 'are'} used by more than one station. That is allowed; check the assignment caution if those stations run together.
            </p>
          )}
          {repeatedActivityLocations.length > 0 && (
            <p className="station-setup-caution">
              <AlertTriangle aria-hidden="true" />
              {repeatedActivityLocations.map((activity) => activity.name).join(', ')} {repeatedActivityLocations.length === 1 ? 'is' : 'are'} used at more than one location. Use distinct activity names if they should have separate history.
            </p>
          )}
          <div className="station-setup-layout">
            <section className="station-editor-card" aria-label="Stations for this day">
              <div className="station-editor-header" aria-hidden="true">
                <span>Visual</span>
                <span>Activity</span>
                <span>Location</span>
                <span>Library icon</span>
                <span>Custom picture</span>
                <span />
                <span />
              </div>
              <div className="station-editor-list">
                {editingStations.map((station) => {
                  const usedInCompletedRound = !draftDate && session.rounds.some(
                    (round) => round.completed &&
                      round.assignments.some((assignment) => assignment.stationId === station.id),
                  );
                  const hasRepeatedActivityLocation = repeatedActivityKeys.has(
                    station.activityName.trim().toLocaleLowerCase(),
                  );
                  return (
                    <div className="station-editor-row" key={station.id}>
                      <StationVisual station={station} />
                      <div className={`station-activity-field${hasRepeatedActivityLocation ? ' has-caution' : ''}`}>
                        <Input
                          aria-label={`Activity name for ${station.activityName || 'new station'}`}
                          list="recent-activities"
                          placeholder="Type or choose an activity"
                          value={station.activityName}
                          onChange={(event) => updateEditingStation(station.id, { activityName: event.target.value })}
                        />
                        {hasRepeatedActivityLocation && (
                          <AlertTriangle
                            aria-label={`${station.activityName} is used at more than one location`}
                            className="station-activity-caution"
                          />
                        )}
                      </div>
                      <select
                        aria-label={`Location for ${station.activityName || 'new activity'}`}
                        className="native-control"
                        value={station.locationId}
                        onChange={(event) => updateEditingStation(station.id, { locationId: event.target.value })}
                      >
                        <option value="">Choose location</option>
                        {classroom.locations
                          .filter((location) => !location.archived || location.id === station.locationId)
                          .map((location) => (
                          <option
                            key={location.id}
                            value={location.id}
                          >
                            {location.name}
                          </option>
                        ))}
                      </select>
                      <button
                        aria-label={`Choose an icon for ${station.activityName || 'new activity'}`}
                        className="visual-picker-button"
                        type="button"
                        onClick={() => setVisualStationId(station.id)}
                      >
                        <StationVisual
                          compact
                          station={{
                            ...station,
                            activityName: iconOptions.find((option) => option.value === station.iconKey)?.label ?? 'Choose icon',
                            imageDataUrl: undefined,
                          }}
                        />
                      </button>
                      <label className="image-upload-button">
                        <ImagePlus /> Picture
                        <input type="file" accept="image/gif,image/jpeg,image/png" onChange={(event) => uploadImage(station.id, event.target.files?.[0])} />
                      </label>
                      {station.imageDataUrl ? (
                        <Button variant="ghost" size="sm" onClick={() => updateEditingStation(station.id, { imageDataUrl: undefined })}>Default</Button>
                      ) : <span />}
                      <Button
                        aria-label={`Remove ${station.activityName || 'new activity'}`}
                        disabled={usedInCompletedRound}
                        title={usedInCompletedRound ? 'Completed rounds keep this station' : 'Remove station'}
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEditingStation(station.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  );
                })}
                {editingStations.length === 0 && (
                  <div className="empty-station-setup">
                    <strong>No stations yet</strong>
                    <span>Add the first activity for this day.</span>
                    <Button onClick={addEditingStation}><Plus /> Add station</Button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      ) : (
      <div aria-labelledby="assignments-tab" id="assignments-panel" role="tabpanel">
      <section className="rotation-toolbar">
        <div className="view-toggle" aria-label="Schedule view">
          <button className={view === 'station' ? 'active' : ''} type="button" onClick={() => setView('station')}>By station</button>
          <button className={view === 'group' ? 'active' : ''} type="button" onClick={() => setView('group')}>By group</button>
        </div>
        <span className="toolbar-hint">Dragging an assignment locks your choice.</span>
        <Button variant="outline" disabled={!canUndo} onClick={onUndo}>
          <RotateCcw /> Undo
        </Button>
        <Button variant="outline" disabled={!canUnlock} onClick={onUnlockAll}>
          <LockOpen /> Unlock all
        </Button>
        <Button variant="outline" onClick={onAddRound}>
          <Plus /> Add next round
        </Button>
        <Button
          title={issues.length > 0
            ? 'Rebuild unlocked assignments to resolve schedule cautions'
            : 'Build the schedule or improve every unlocked assignment using learner activity history and earlier plans'}
          onClick={onBuildOptimize}
        >
          <Sparkles /> {issues.length > 0 ? 'Fix issues' : 'Build / Optimize'}
        </Button>
      </section>

      {(visibleIssues.length > 0 || ignoredIssueCount > 0) && (
        <section className={`issue-banner${visibleIssues.length === 0 ? ' ignored-only' : ''}`} aria-label="Schedule cautions">
          <AlertTriangle />
          <div className="issue-content">
            {visibleIssues.length > 0 ? (
              <>
                <strong>{issuesOpen ? `${visibleIssues.length} schedule caution${visibleIssues.length === 1 ? '' : 's'}` : visibleIssues[0].message}</strong>
                {!issuesOpen && visibleIssues.length > 1 && (
                  <span>{visibleIssues.length - 1} more item{visibleIssues.length > 2 ? 's' : ''} need attention.</span>
                )}
                {issuesOpen && (
                  <ul className="issue-list">
                    {visibleIssues.map((issue) => (
                      <li key={issue.id}>
                        <AlertTriangle aria-hidden="true" />
                        <span>{issue.message}</span>
                        {issue.id !== 'action' && (
                          <button type="button" onClick={() => onIgnoreIssue(issue.id)}>Ignore</button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <strong>{ignoredIssueCount} intentional caution{ignoredIssueCount === 1 ? '' : 's'} hidden.</strong>
            )}
          </div>
          <div className="issue-controls">
            {visibleIssues.length > 1 && (
              <button type="button" onClick={() => setIssuesOpen((open) => !open)}>
                {issuesOpen ? 'Hide details' : `Show all (${visibleIssues.length})`}
              </button>
            )}
            {ignoredIssueCount > 0 && (
              <button type="button" onClick={onRestoreIgnoredIssues}>Restore ignored</button>
            )}
          </div>
        </section>
      )}

      <section className={`rotation-board ${view === 'station' ? 'by-station' : 'by-group'}`}>
        <div className="rotation-grid header-row" style={{ '--rotation-columns': view === 'station' ? activeStations.length : groupSet.groups.length + 1 } as React.CSSProperties}>
          <div className="round-heading">Round</div>
          {(view === 'station' ? activeStations : groupSet.groups).map((item) => (
            <div className="rotation-column-heading" key={item.id}>
              {'iconKey' in item ? (
                <StationAndLocation
                  station={item}
                  location={locationForStation(item.id)}
                  compact
                />
              ) : (
                <span className="group-heading">
                  <GroupVisual group={item} small />
                  <span>{item.name}</span>
                </span>
              )}
            </div>
          ))}
          {view === 'group' && <div className="rotation-column-heading unused-heading">Unused stations</div>}
          <div className="done-heading">Done</div>
        </div>

        {session.rounds.map((round, roundIndex) => {
          const unusedStations = activeStations.filter(
            (station) => !round.assignments.some((assignment) => assignment.stationId === station.id),
          );
          const roundIssues = issues.filter((issue) => issueTouchesRound(issue, round.id));
          return (
            <div
              className={`rotation-grid round-row${round.completed ? ' is-completed' : ''}${roundIssues.length > 0 ? ' has-caution' : ''}`}
              style={{ '--rotation-columns': view === 'station' ? activeStations.length : groupSet.groups.length + 1 } as React.CSSProperties}
              key={round.id}
            >
            <div className="round-number">
              <span>{roundIndex + 1}</span>
              {roundIssues.length > 0 && <AlertTriangle className="round-caution" aria-label={`${roundIssues.length} caution${roundIssues.length === 1 ? '' : 's'} in Round ${roundIndex + 1}`} />}
              <button
                type="button"
                disabled={round.completed}
                title={round.completed ? 'Reopen this round before removing it' : `Remove Round ${roundIndex + 1}`}
                aria-label={round.completed ? `Reopen Round ${roundIndex + 1} before removing it` : `Remove Round ${roundIndex + 1}`}
                onClick={() => setPendingRemoveRoundId(round.id)}
              >
                <Trash2 />
              </button>
            </div>
              {view === 'station'
              ? activeStations.map((station) => {
                  const assignment = round.assignments.find((item) => item.stationId === station.id);
                  const group = groupSet.groups.find((item) => item.id === assignment?.groupId);
                  const hasCaution = issues.some((issue) =>
                    issueTouchesCell(issue, round.id, group?.id, station.id));
                  return (
                    <div
                      className={`rotation-cell${assignment?.locked ? ' is-locked' : ''}${hasCaution ? ' has-caution' : ''}`}
                      key={station.id}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => dropGroupAtStation(event, round.id, station.id)}
                    >
                      {hasCaution && <AlertTriangle className="cell-caution" aria-hidden="true" />}
                      {group && assignment ? (
                        <div className="group-assignment" draggable={!round.completed} onDragStart={(event) => dragGroup(event, group.id)}>
                          <GroupVisual group={group} />
                          <strong>{group.name}</strong>
                          <button type="button" aria-label={assignment.locked ? 'Unlock placement' : 'Lock placement'} onClick={() => onToggleLock(round.id, group.id)}>
                            {assignment.locked ? <Lock /> : <LockKeyholeOpen />}
                          </button>
                        </div>
                      ) : (
                        <span className="empty-cell">Open</span>
                      )}
                    </div>
                  );
                })
              : <>
                {groupSet.groups.map((group) => {
                  const assignment = round.assignments.find((item) => item.groupId === group.id);
                  const station = session.plannedStations.find(
                    (item) => item.id === assignment?.stationId,
                  );
                  const hasCaution = issues.some((issue) =>
                    issueTouchesCell(issue, round.id, group.id, station?.id));
                  return (
                    <div
                      className={`rotation-cell station-assignment${assignment?.locked ? ' is-locked' : ''}${hasCaution ? ' has-caution' : ''}`}
                      key={group.id}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => dropStationAtGroup(event, round.id, group.id)}
                    >
                      {hasCaution && <AlertTriangle className="cell-caution" aria-hidden="true" />}
                      {station && assignment ? (
                        <div draggable={!round.completed} onDragStart={(event) => dragStation(event, station.id)}>
                          <StationAndLocation
                            station={station}
                            location={locationForStation(station.id)}
                            compact
                          />
                          <button type="button" aria-label={assignment.locked ? 'Unlock placement' : 'Lock placement'} onClick={() => onToggleLock(round.id, group.id)}>
                            {assignment.locked ? <Lock /> : <LockKeyholeOpen />}
                          </button>
                        </div>
                      ) : (
                        <span className="empty-cell">Open</span>
                      )}
                    </div>
                  );
                })}
                <div className="rotation-cell unused-stations">
                  {unusedStations.length > 0 ? (
                    <div className="unused-station-list" aria-label={`Unused stations for Round ${roundIndex + 1}`}>
                      {unusedStations.map((station) => (
                        <div
                          className="unused-station"
                          draggable={!round.completed}
                          key={station.id}
                          title={`Drag ${station.activityName || 'activity'} to a group`}
                          onDragStart={(event) => dragStation(event, station.id)}
                        >
                          <StationAndLocation
                            station={station}
                            location={locationForStation(station.id)}
                            compact
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="empty-cell">All in use</span>
                  )}
                </div>
              </>}
              <div className="round-done">
                <button
                  className={round.completed ? 'complete' : ''}
                  type="button"
                  aria-label={round.completed ? `Reopen Round ${roundIndex + 1}` : `Mark Round ${roundIndex + 1} complete`}
                  onClick={() => onToggleCompleted(round.id)}
                >
                  {round.completed && <Check />}
                </button>
              </div>
            </div>
          );
        })}
      </section>
      </div>
      )}

      <RotationPrintSheet classroom={classroom} groupSet={groupSet} session={session} />
      <datalist id="recent-activities">
        {recentActivityNames.map((name) => <option key={name} value={name}>{name}</option>)}
      </datalist>

      <Dialog
        open={Boolean(pendingRemoveRoundId)}
        onOpenChange={(open) => { if (!open) setPendingRemoveRoundId(''); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Round {pendingRemoveRoundIndex + 1}?</DialogTitle>
            <DialogDescription>
              Its assignments and locks will be removed, and the remaining rounds will be renumbered. You can Undo afterward.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingRemoveRoundId('')}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingRemoveRoundId) onRemoveRound(pendingRemoveRoundId);
                setPendingRemoveRoundId('');
              }}
            >
              <Trash2 /> Remove round
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingGroupSetId)}
        onOpenChange={(open) => { if (!open) setPendingGroupSetId(''); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Use {pendingGroupSet?.name ?? 'these groups'}?</DialogTitle>
            <DialogDescription>
              This day&apos;s rounds will be rebuilt for the selected arrangement. Completed marks and placement locks on this day will be cleared. You can Undo afterward.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingGroupSetId('')}>Cancel</Button>
            <Button onClick={() => {
              if (pendingGroupSetId) onSelectGroupSet(pendingGroupSetId);
              setPendingGroupSetId('');
            }}>
              <RefreshCcw /> Use and rebuild
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={locationsOpen} onOpenChange={setLocationsOpen}>
        <DialogContent className="location-dialog">
          <DialogHeader>
            <DialogTitle>Manage locations</DialogTitle>
            <DialogDescription>
              These are the reusable places in your room. You will choose one for each station when planning a day.
            </DialogDescription>
          </DialogHeader>
          <div className="location-dialog-list">
            {classroom.locations.filter((location) => !location.archived).map((location) => (
              <span className="location-editor-item" key={location.id}>
                <Input
                  aria-label={`Location name for ${location.name}`}
                  value={location.name}
                  onChange={(event) => onUpdateLocation(location.id, { name: event.target.value })}
                />
                <button type="button" aria-label={`Delete ${location.name}`} onClick={() => onDeleteLocation(location.id)}>
                  <Trash2 />
                </button>
              </span>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onAddLocation}><Plus /> Add location</Button>
            <Button onClick={() => setLocationsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(visualStationId)}
        onOpenChange={(open) => { if (!open) setVisualStationId(''); }}
      >
        <DialogContent className="icon-library-dialog">
          <DialogHeader>
            <DialogTitle>Choose an icon</DialogTitle>
            <DialogDescription>
              Pick a familiar symbol for {visualStation?.activityName || 'this activity'}, or close this and use the Picture button for your own image.
            </DialogDescription>
          </DialogHeader>
          <div className="icon-library" aria-label="Station icon library">
            {iconOptions.map((option) => {
              const iconStation: PlannedStation = {
                id: option.value,
                activityName: option.label,
                locationId: '',
                iconKey: option.value,
              };
              return (
                <button
                  aria-pressed={visualStation?.iconKey === option.value && !visualStation.imageDataUrl}
                  className={visualStation?.iconKey === option.value && !visualStation.imageDataUrl ? 'selected' : ''}
                  key={option.value}
                  type="button"
                  onClick={() => {
                    if (visualStationId) updateEditingStation(visualStationId, { iconKey: option.value, imageDataUrl: undefined });
                    setVisualStationId('');
                  }}
                >
                  <StationVisual station={iconStation} />
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="date-picker-dialog">
          <DialogHeader>
            <DialogTitle>Choose a day</DialogTitle>
            <DialogDescription>
              A dot means that day already has a plan. Choosing an empty day starts a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="calendar-month-heading">
            <Button
              aria-label="Previous month"
              variant="ghost"
              size="icon"
              onClick={() => setCalendarMonthValue((value) => shiftCalendarMonth(value, -1))}
            >
              <ChevronLeft />
            </Button>
            <strong>{formatMonth(calendarMonthValue)}</strong>
            <Button
              aria-label="Next month"
              variant="ghost"
              size="icon"
              onClick={() => setCalendarMonthValue((value) => shiftCalendarMonth(value, 1))}
            >
              <ChevronRight />
            </Button>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <fieldset className="schedule-calendar">
            <legend className="sr-only">{formatMonth(calendarMonthValue)}</legend>
            {Array.from({ length: visibleCalendarMonth.leadingBlanks }, (_, index) => (
              <span className="calendar-blank" aria-hidden="true" key={`blank-${index}`} />
            ))}
            {visibleCalendarMonth.dates.map((date) => {
              const planned = plannedDateSet.has(date);
              const weekend = [0, 6].includes(dateAtNoon(date).getDay());
              return (
                <button
                  type="button"
                  className={`${planned ? 'planned ' : ''}${date === displayDate ? 'selected ' : ''}${weekend ? 'weekend' : ''}`}
                  aria-label={`${formatDay(date)}${planned ? ', planned' : ', no plan'}`}
                  aria-current={date === displayDate ? 'date' : undefined}
                  key={date}
                  onClick={() => chooseDate(date)}
                >
                  <span>{Number(date.slice(-2))}</span>
                  {planned && <i aria-hidden="true" />}
                </button>
              );
            })}
          </fieldset>
          <div className="calendar-legend">
            <i aria-hidden="true" /> Planned day
            <span>Weekends are available only when you choose them directly.</span>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function RotationPrintSheet({
  classroom,
  groupSet,
  session,
}: {
  classroom: Classroom;
  groupSet: GroupSet;
  session: RotationSession;
}) {
  return (
    <section className="print-sheet" aria-hidden="true">
      <header>
        <div>
          <p>Station rotations</p>
          <h1>{session.label}</h1>
          <time dateTime={session.date}>{formatDay(session.date)}</time>
        </div>
        <span>{groupSet.name}</span>
      </header>
      <div className="print-rotation-grid" style={{ '--print-rounds': session.rounds.length } as React.CSSProperties}>
        <div className="print-corner">Group</div>
        {session.rounds.map((round, index) => <div className="print-round-title" key={round.id}>Round {index + 1}</div>)}
        {groupSet.groups.flatMap((group) => {
          const members = group.studentIds
            .map((id) => classroom.students.find((student) => student.id === id)?.name)
            .filter(Boolean)
            .join(', ');
          return [
            <div className="print-group" key={`${group.id}-name`}>
              <GroupVisual group={group} />
              <strong>{group.name}</strong>
              <small>{members}</small>
            </div>,
            ...session.rounds.map((round) => {
              const assignment = round.assignments.find((item) => item.groupId === group.id);
              const station = session.plannedStations.find(
                (item) => item.id === assignment?.stationId,
              );
              const location = classroom.locations.find(
                (item) => item.id === station?.locationId,
              );
              return (
                <div className="print-station" key={`${group.id}-${round.id}`}>
                  {station ? (
                    <StationAndLocation station={station} location={location} />
                  ) : <strong>Open</strong>}
                </div>
              );
            }),
          ];
        })}
      </div>
    </section>
  );
}
