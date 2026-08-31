import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  CircleUserRound,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Upload,
  UsersRound,
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
import { GroupsView } from './views/GroupsView';
import { StudentsView } from './views/StudentsView';
import { TodayView } from './views/TodayView';
import type {
  AppData,
  Classroom,
  Group,
  GroupRecipe,
  Location,
  PlannedStation,
  RelationshipKind,
  RotationSession,
  Student,
} from './model';
import { makeId } from './model';
import { cloneData } from './platform';
import { createGroupShells, createSampleData } from './sample';
import { generateGroups, moveStudent } from './grouping';
import {
  changeSessionGroupSet,
  deleteGroupSet as removeGroupSet,
  resetGroupSet,
} from './groupSets';
import {
  addFilledRound,
  fillOpenSpots,
  moveGroupToStation,
  moveStationToGroup,
  rebuildUnlocked,
  removeRound,
  scheduleIssues,
  toggleAssignmentLock,
  toggleRoundCompleted,
  unlockAllAssignments,
} from './rotations';
import { exportBackup, persistence, readBackup } from './storage';
import {
  deleteClassroom as removeClassroomData,
  renameClassroom as renameClassroomData,
} from './classrooms';

type View = 'students' | 'groups' | 'today';

type NewDayPlan = {
  date: string;
  roundCount: number;
  plannedStations: PlannedStation[];
  groupSetId: string;
};

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shortDateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function replaceClassroom(data: AppData, classroom: Classroom): AppData {
  return {
    ...data,
    classrooms: data.classrooms.map((item) => item.id === classroom.id ? classroom : item),
  };
}

function createBlankClassroom(name: string): Classroom {
  const template = createSampleData().classrooms[0];
  const groupSetId = makeId('groups');
  const groups = createGroupShells(5).map((group) => ({ ...group, id: makeId('group') }));
  const locations = template.locations.map((location) => ({ ...location, id: makeId('location') }));
  const templateStations = template.sessions[0].plannedStations;
  const plannedStations = templateStations.slice(0, 5).map((station, index) => ({
    ...station,
    id: makeId('station'),
    locationId: locations[index]?.id ?? '',
    imageDataUrl: undefined,
  }));
  const sessionId = makeId('session');
  return {
    id: makeId('class'),
    name,
    students: [],
    relationships: [],
    groupSets: [
      {
        id: groupSetId,
        name: 'Center Groups',
        recipe: {
          groupCount: 5,
          primaryAttribute: 'reading',
          mode: 'mixed',
          secondaryGoal: 'none',
        },
        groups,
      },
    ],
    activeGroupSetId: groupSetId,
    locations,
    sessions: [
      {
        id: sessionId,
        label: 'Today',
        createdAt: new Date().toISOString(),
        date: localDateValue(),
        groupSetId,
        plannedStations,
        rounds: Array.from({ length: 3 }, () => ({ id: makeId('round'), assignments: [], completed: false })),
      },
    ],
    activeSessionId: sessionId,
  };
}

export function App() {
  const [data, setData] = useState<AppData>(() => createSampleData());
  const [view, setView] = useState<View>('groups');
  const [loaded, setLoaded] = useState(false);
  const [undoStack, setUndoStack] = useState<AppData[]>([]);
  const [actionIssue, setActionIssue] = useState('');
  const [saveIssue, setSaveIssue] = useState('');
  const [newClassOpen, setNewClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [renameClassOpen, setRenameClassOpen] = useState(false);
  const [renameClassName, setRenameClassName] = useState('');
  const [deleteClassOpen, setDeleteClassOpen] = useState(false);
  const backupInput = useRef<HTMLInputElement>(null);
  const appMenu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    let active = true;
    persistence
      .load()
      .then((saved) => {
        if (active && saved) setData(saved);
      })
      .catch(() => setSaveIssue('Student Grouper could not open its local saved data. Export a backup before closing.'))
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => {
      persistence
        .save(data)
        .then(() => setSaveIssue(''))
        .catch(() => setSaveIssue('Changes could not be saved on this device. Export a backup before closing.'));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [data, loaded]);

  const classroom = data.classrooms.find((item) => item.id === data.activeClassroomId) ?? data.classrooms[0];
  const groupSet = classroom.groupSets.find((item) => item.id === classroom.activeGroupSetId) ?? classroom.groupSets[0];
  const session = classroom.sessions.find((item) => item.id === classroom.activeSessionId) ?? classroom.sessions.at(-1);
  const rotationGroupSet = session
    ? classroom.groupSets.find((item) => item.id === session.groupSetId) ?? groupSet
    : groupSet;
  const allScheduleIssues = useMemo(
    () => session ? scheduleIssues(classroom, session, rotationGroupSet) : [],
    [classroom, session, rotationGroupSet],
  );
  const ignoredIssueIds = session?.ignoredIssueIds ?? [];
  const issues = allScheduleIssues.filter((issue) => !ignoredIssueIds.includes(issue.id));
  const ignoredIssueCount = allScheduleIssues.length - issues.length;

  const updateClassroom = (updater: (current: Classroom) => Classroom, remember = false) => {
    setData((currentData) => {
      const currentClassroom = currentData.classrooms.find((item) => item.id === currentData.activeClassroomId);
      if (!currentClassroom) return currentData;
      if (remember) {
        setUndoStack((stack) => [...stack.slice(-29), cloneData(currentData)]);
      }
      return replaceClassroom(currentData, updater(currentClassroom));
    });
  };

  const undo = () => {
    setUndoStack((stack) => {
      const previous = stack.at(-1);
      if (previous) setData(previous);
      return previous ? stack.slice(0, -1) : stack;
    });
    setActionIssue('');
  };

  const updateActiveGroupSet = (
    currentClassroom: Classroom,
    updater: (current: typeof groupSet) => typeof groupSet,
  ) => ({
    ...currentClassroom,
    groupSets: currentClassroom.groupSets.map((item) =>
      item.id === currentClassroom.activeGroupSetId ? updater(item) : item,
    ),
  });

  const updateActiveSession = (
    currentClassroom: Classroom,
    updater: (current: RotationSession) => RotationSession,
  ) => ({
    ...currentClassroom,
    sessions: currentClassroom.sessions.map((item) =>
      item.id === currentClassroom.activeSessionId ? updater(item) : item,
    ),
  });

  const addStudents = (names: string[]) => {
    updateClassroom((current) => ({
      ...current,
      students: [
        ...current.students,
        ...names.map((name) => ({
          id: makeId('student'),
          name,
          language: '',
          gender: '' as const,
          reading: 2 as const,
          math: 2 as const,
          writing: 2 as const,
          absent: false,
        })),
      ],
    }), true);
  };

  const updateStudent = (studentId: string, patch: Partial<Student>) => {
    updateClassroom((current) => ({
      ...current,
      students: current.students.map((student) => student.id === studentId ? { ...student, ...patch } : student),
    }));
  };

  const removeStudent = (studentId: string) => {
    updateClassroom((current) => ({
      ...current,
      students: current.students.filter((student) => student.id !== studentId),
      relationships: current.relationships.filter(
        (relationship) => relationship.studentAId !== studentId && relationship.studentBId !== studentId,
      ),
      groupSets: current.groupSets.map((set) => ({
        ...set,
        groups: set.groups.map((group) => ({
          ...group,
          studentIds: group.studentIds.filter((id) => id !== studentId),
          lockedStudentIds: group.lockedStudentIds.filter((id) => id !== studentId),
        })),
      })),
    }), true);
  };

  const addRelationship = (studentAId: string, studentBId: string, kind: RelationshipKind) => {
    updateClassroom((current) => {
      const remaining = current.relationships.filter(
        (relationship) =>
          !(
            (relationship.studentAId === studentAId && relationship.studentBId === studentBId) ||
            (relationship.studentAId === studentBId && relationship.studentBId === studentAId)
          ),
      );
      return {
        ...current,
        relationships: [...remaining, { id: makeId('relationship'), studentAId, studentBId, kind }],
      };
    }, true);
  };

  const changeRecipe = (patch: Partial<GroupRecipe>) => {
    updateClassroom((current) => updateActiveGroupSet(current, (set) => ({
      ...set,
      recipe: { ...set.recipe, ...patch },
    })));
  };

  const generate = () => {
    updateClassroom((current) => updateActiveGroupSet(current, (set) =>
      generateGroups(current.students, current.relationships, set)), true);
  };

  const moveStudentCard = (studentId: string, groupId: string) => {
    updateClassroom((current) => updateActiveGroupSet(current, (set) =>
      moveStudent(set, studentId, groupId)), true);
  };

  const toggleStudentLock = (studentId: string, groupId: string) => {
    updateClassroom((current) => updateActiveGroupSet(current, (set) => ({
      ...set,
      groups: set.groups.map((group) => {
        if (group.id !== groupId) return group;
        const locked = group.lockedStudentIds.includes(studentId);
        return {
          ...group,
          lockedStudentIds: locked
            ? group.lockedStudentIds.filter((id) => id !== studentId)
            : [...group.lockedStudentIds, studentId],
        };
      }),
    })), true);
  };

  const updateGroup = (
    groupId: string,
    patch: Pick<Group, 'name' | 'imageDataUrl'>,
  ) => {
    updateClassroom((current) => updateActiveGroupSet(current, (set) => ({
      ...set,
      groups: set.groups.map((group) => group.id === groupId ? { ...group, ...patch } : group),
    })), true);
  };

  const createGroupSet = (name: string) => {
    updateClassroom((current) => {
      const id = makeId('groups');
      const next = {
        id,
        name,
        recipe: { ...groupSet.recipe },
        groups: createGroupShells(groupSet.recipe.groupCount).map((group) => ({ ...group, id: makeId('group') })),
      };
      return { ...current, groupSets: [...current.groupSets, next], activeGroupSetId: id };
    }, true);
  };

  const resetCurrentGroupSet = () => {
    updateClassroom((current) => updateActiveGroupSet(current, resetGroupSet), true);
  };

  const deleteCurrentGroupSet = () => {
    updateClassroom((current) => removeGroupSet(current, current.activeGroupSetId), true);
    setActionIssue('');
  };

  const selectRotationGroupSet = (groupSetId: string) => {
    updateClassroom(
      (current) => changeSessionGroupSet(current, current.activeSessionId, groupSetId),
      true,
    );
    setActionIssue('');
  };

  const buildOptimizeSchedule = () => {
    if (!session) return;
    updateClassroom((current) => updateActiveSession(current, (currentSession) => {
      const set = current.groupSets.find((item) => item.id === currentSession.groupSetId) ?? current.groupSets[0];
      return rebuildUnlocked(current, currentSession, set);
    }), true);
    setActionIssue('');
  };

  const unlockSchedule = () => {
    if (!session) return;
    updateClassroom(
      (current) => updateActiveSession(current, unlockAllAssignments),
      true,
    );
    setActionIssue('');
  };

  const ignoreScheduleIssue = (issueId: string) => {
    if (!session) return;
    updateClassroom((current) => updateActiveSession(current, (currentSession) => ({
      ...currentSession,
      ignoredIssueIds: Array.from(new Set([
        ...(currentSession.ignoredIssueIds ?? []),
        issueId,
      ])),
    })), true);
  };

  const restoreIgnoredScheduleIssues = () => {
    if (!session) return;
    updateClassroom((current) => updateActiveSession(current, (currentSession) => ({
      ...currentSession,
      ignoredIssueIds: [],
    })), true);
  };

  const addRound = () => {
    if (!session) return;
    updateClassroom((current) => updateActiveSession(current, (currentSession) => {
      const set = current.groupSets.find((item) => item.id === currentSession.groupSetId) ?? current.groupSets[0];
      return addFilledRound(current, currentSession, set);
    }), true);
    setActionIssue('');
  };

  const removeRotationRound = (roundId: string) => {
    if (!session) return;
    updateClassroom(
      (current) => updateActiveSession(current, (currentSession) =>
        removeRound(currentSession, roundId)),
      true,
    );
    setActionIssue('');
  };

  const moveRotation = (roundId: string, groupId: string, stationId: string) => {
    if (!session) return;
    const result = moveGroupToStation(session, roundId, groupId, stationId);
    if (result.issue) {
      setActionIssue(result.issue);
      return;
    }
    updateClassroom((current) => updateActiveSession(current, () => result.session), true);
    setActionIssue('');
  };

  const moveRotationStation = (roundId: string, groupId: string, stationId: string) => {
    if (!session) return;
    const result = moveStationToGroup(session, roundId, groupId, stationId);
    if (result.issue) {
      setActionIssue(result.issue);
      return;
    }
    updateClassroom((current) => updateActiveSession(current, () => result.session), true);
    setActionIssue('');
  };

  const planNextDay = ({ date, roundCount, plannedStations, groupSetId }: NewDayPlan) => {
    updateClassroom((current) => {
      const existingSession = current.sessions.find((item) => item.date === date);
      if (existingSession) {
        return { ...current, activeSessionId: existingSession.id };
      }
      const id = makeId('session');
      const selectedGroupSetId = current.groupSets.some((item) => item.id === groupSetId)
        ? groupSetId
        : current.activeGroupSetId;
      let nextSession: RotationSession = {
        id,
        label: shortDateLabel(date),
        createdAt: new Date().toISOString(),
        date,
        groupSetId: selectedGroupSetId,
        plannedStations: plannedStations.map((station) => ({
          ...station,
          id: makeId('station'),
        })),
        rounds: Array.from({ length: roundCount }, () => ({
          id: makeId('round'),
          assignments: [],
          completed: false,
        })),
      };
      const withEmpty = { ...current, sessions: [...current.sessions, nextSession], activeSessionId: id };
      const set = current.groupSets.find((item) => item.id === selectedGroupSetId) ?? current.groupSets[0];
      nextSession = fillOpenSpots(withEmpty, nextSession, set);
      return { ...withEmpty, sessions: [...current.sessions, nextSession] };
    }, true);
    setActionIssue('');
  };

  const updateStation = (stationId: string, patch: Partial<PlannedStation>) => {
    updateClassroom((current) => updateActiveSession(current, (currentSession) => ({
      ...currentSession,
      plannedStations: currentSession.plannedStations.map((station) =>
        station.id === stationId ? { ...station, ...patch } : station),
    })));
  };

  const addStation = () => {
    updateClassroom((current) => updateActiveSession(current, (currentSession) => {
      const usedLocationIds = new Set(
        currentSession.plannedStations.map((station) => station.locationId),
      );
      const location = current.locations.find(
        (item) => !item.archived && !usedLocationIds.has(item.id),
      ) ?? current.locations.find((item) => !item.archived);
      return {
        ...currentSession,
        plannedStations: [
          ...currentSession.plannedStations,
          {
            id: makeId('station'),
            activityName: '',
            locationId: location?.id ?? '',
            iconKey: 'independent',
          },
        ],
      };
    }), true);
  };

  const removeStation = (stationId: string) => {
    updateClassroom((current) => updateActiveSession(current, (currentSession) => ({
      ...currentSession,
      plannedStations: currentSession.plannedStations.filter((station) => station.id !== stationId),
      rounds: currentSession.rounds.map((round) => round.completed
        ? round
        : {
            ...round,
            assignments: round.assignments.filter((assignment) => assignment.stationId !== stationId),
          }),
    })), true);
  };

  const updateLocation = (locationId: string, patch: Partial<Location>) => {
    updateClassroom((current) => ({
      ...current,
      locations: current.locations.map((location) =>
        location.id === locationId ? { ...location, ...patch } : location),
    }));
  };

  const addLocation = () => {
    updateClassroom((current) => ({
      ...current,
      locations: [
        ...current.locations,
        { id: makeId('location'), name: 'New Location' },
      ],
    }), true);
  };

  const deleteLocation = (locationId: string) => {
    updateClassroom((current) => {
      const inUse = current.sessions.some((item) =>
        item.plannedStations.some((station) => station.locationId === locationId));
      return {
        ...current,
        locations: inUse
          ? current.locations.map((location) =>
              location.id === locationId ? { ...location, archived: true } : location)
          : current.locations.filter((location) => location.id !== locationId),
      };
    }, true);
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const restored = await readBackup(file);
      setUndoStack((stack) => [...stack.slice(-29), cloneData(data)]);
      setData(restored);
      setActionIssue('');
    } catch (error) {
      setActionIssue(error instanceof Error ? error.message : 'The backup could not be restored.');
    }
  };

  const addClassroom = () => {
    const name = newClassName.trim();
    if (!name) return;
    const next = createBlankClassroom(name);
    setUndoStack((stack) => [...stack.slice(-29), cloneData(data)]);
    setData((current) => ({
      ...current,
      classrooms: [...current.classrooms, next],
      activeClassroomId: next.id,
    }));
    setNewClassName('');
    setNewClassOpen(false);
    setView('students');
  };

  const openNewClass = () => {
    appMenu.current?.removeAttribute('open');
    setNewClassName('');
    setNewClassOpen(true);
  };

  const openRenameClass = () => {
    appMenu.current?.removeAttribute('open');
    setRenameClassName(classroom.name);
    setRenameClassOpen(true);
  };

  const renameActiveClass = () => {
    const name = renameClassName.trim();
    if (!name) return;
    setUndoStack((stack) => [...stack.slice(-29), cloneData(data)]);
    setData((current) => renameClassroomData(current, current.activeClassroomId, name));
    setRenameClassOpen(false);
  };

  const openDeleteClass = () => {
    if (data.classrooms.length <= 1) return;
    appMenu.current?.removeAttribute('open');
    setDeleteClassOpen(true);
  };

  const deleteActiveClass = () => {
    if (data.classrooms.length <= 1) return;
    setUndoStack((stack) => [...stack.slice(-29), cloneData(data)]);
    setData((current) => removeClassroomData(current, current.activeClassroomId));
    setDeleteClassOpen(false);
    setActionIssue('');
  };

  if (!classroom || !groupSet) return null;

  return (
    <div className="app-shell">
      <header className="topbar screen-only">
        <div className="brand-mark" aria-hidden="true"><UsersRound /></div>
        <div className="brand-copy">
          <span className="brand-title">Student Grouper</span>
          <label className="class-switcher">
            <span className="sr-only">Class</span>
            <select
              value={classroom.id}
              onChange={(event) => setData((current) => ({ ...current, activeClassroomId: event.target.value }))}
            >
              {data.classrooms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <ChevronDown />
          </label>
        </div>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={view === 'students' ? 'active' : ''} type="button" onClick={() => setView('students')}>Students</button>
          <button className={view === 'groups' ? 'active' : ''} type="button" onClick={() => setView('groups')}>Groups</button>
          <button className={view === 'today' ? 'active' : ''} type="button" onClick={() => setView('today')}>Today</button>
        </nav>
        <div className="top-actions">
          {view === 'today' && <Button variant="outline" size="lg" onClick={() => window.print()}><Printer /> Print</Button>}
          <details className="app-menu" ref={appMenu}>
            <summary aria-label="Application menu"><MoreHorizontal /></summary>
            <div>
              <button type="button" onClick={() => exportBackup(data)}><Download /> Export backup</button>
              <button type="button" onClick={() => backupInput.current?.click()}><Upload /> Restore backup</button>
              <span className="app-menu-divider" />
              <button type="button" onClick={openNewClass}><Plus /> New class</button>
              <button type="button" onClick={openRenameClass}><Pencil /> Rename class</button>
              <button
                className="danger-menu-item"
                disabled={data.classrooms.length <= 1}
                title={data.classrooms.length <= 1 ? 'Keep at least one class' : `Delete ${classroom.name}`}
                type="button"
                onClick={openDeleteClass}
              >
                <Trash2 /> Delete class
              </button>
            </div>
          </details>
          <CircleUserRound className="profile-icon" aria-hidden="true" />
          <input ref={backupInput} hidden type="file" accept="application/json,.json" onChange={(event) => importBackup(event.target.files?.[0])} />
        </div>
      </header>
      {saveIssue && <output className="save-issue">{saveIssue}</output>}

      {view === 'students' && (
        <StudentsView
          classroom={classroom}
          canUndo={undoStack.length > 0}
          onUndo={undo}
          onAddStudents={addStudents}
          onUpdateStudent={updateStudent}
          onRemoveStudent={removeStudent}
          onAddRelationship={addRelationship}
          onRemoveRelationship={(relationshipId) => updateClassroom((current) => ({ ...current, relationships: current.relationships.filter((item) => item.id !== relationshipId) }), true)}
        />
      )}
      {view === 'groups' && (
        <GroupsView
          classroom={classroom}
          groupSet={groupSet}
          canUndo={undoStack.length > 0}
          onSelectGroupSet={(id) => updateClassroom((current) => ({ ...current, activeGroupSetId: id }))}
          onNewGroupSet={createGroupSet}
          onResetGroupSet={resetCurrentGroupSet}
          onDeleteGroupSet={deleteCurrentGroupSet}
          onUpdateGroup={updateGroup}
          onRecipeChange={changeRecipe}
          onGenerate={generate}
          onMoveStudent={moveStudentCard}
          onToggleLock={toggleStudentLock}
          onUndo={undo}
        />
      )}
      {view === 'today' && session && (
        <TodayView
          classroom={classroom}
          groupSet={rotationGroupSet}
          session={session}
          issues={issues}
          ignoredIssueCount={ignoredIssueCount}
          actionIssue={actionIssue}
          onSelectSession={(id) => updateClassroom((current) => ({ ...current, activeSessionId: id }))}
          onSelectGroupSet={selectRotationGroupSet}
          onBuildOptimize={buildOptimizeSchedule}
          onUnlockAll={unlockSchedule}
          onIgnoreIssue={ignoreScheduleIssue}
          onRestoreIgnoredIssues={restoreIgnoredScheduleIssues}
          onAddRound={addRound}
          onRemoveRound={removeRotationRound}
          canUndo={undoStack.length > 0}
          onUndo={undo}
          onPlanNextDay={planNextDay}
          onMove={moveRotation}
          onMoveStation={moveRotationStation}
          onToggleLock={(roundId, groupId) => updateClassroom((current) => updateActiveSession(current, (currentSession) => toggleAssignmentLock(currentSession, roundId, groupId)), true)}
          onToggleCompleted={(roundId) => updateClassroom((current) => updateActiveSession(current, (currentSession) => {
            const set = current.groupSets.find((item) => item.id === currentSession.groupSetId) ?? current.groupSets[0];
            return toggleRoundCompleted(currentSession, roundId, set, current.students);
          }), true)}
          onUpdateStation={updateStation}
          onAddStation={addStation}
          onRemoveStation={removeStation}
          onUpdateLocation={updateLocation}
          onAddLocation={addLocation}
          onDeleteLocation={deleteLocation}
          onPrint={() => window.print()}
        />
      )}

      <Dialog open={newClassOpen} onOpenChange={setNewClassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New class</DialogTitle>
            <DialogDescription>Create a clean roster, groups, and rotation schedule.</DialogDescription>
          </DialogHeader>
          <Input aria-label="New class name" placeholder="Mrs. Carter’s Class" value={newClassName} onChange={(event) => setNewClassName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addClassroom(); }} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewClassOpen(false)}>Cancel</Button>
            <Button disabled={!newClassName.trim()} onClick={addClassroom}>Create class</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameClassOpen} onOpenChange={setRenameClassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename class</DialogTitle>
            <DialogDescription>Change the name shown in the class selector and on printed schedules.</DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Class name"
            value={renameClassName}
            onChange={(event) => setRenameClassName(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') renameActiveClass(); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameClassOpen(false)}>Cancel</Button>
            <Button disabled={!renameClassName.trim()} onClick={renameActiveClass}>Save name</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteClassOpen} onOpenChange={setDeleteClassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {classroom.name}?</DialogTitle>
            <DialogDescription>
              This removes its students, groups, station plans, and history from this device. You can use Undo until the app is closed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteClassOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteActiveClass}><Trash2 /> Delete class</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
