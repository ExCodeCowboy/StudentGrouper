import { useState } from 'react';
import { CalendarPlus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Classroom, RotationSession } from '../model';
import {
  blockDates,
  blockPlanIssue,
  type NewBlockPlan,
} from '../planningBlocks';
import { shiftSchoolDay } from '../dateNavigation';
import { scheduleIssues } from '../rotations';
import { assignmentActivityKey } from '../rotations';
import type { PlannerResult } from '../planner/optimizer';

type Props = {
  classroom: Classroom;
  session: RotationSession;
  onCreate: (plan: NewBlockPlan) => void;
  onBuild: () => void;
  onSelect: (id: string) => void;
  planning?: string;
  report?: PlannerResult;
  onCancel: () => void;
};

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00`));

export function PlanningBlockPanel({
  classroom,
  session,
  onCreate,
  onBuild,
  onSelect,
  planning,
  report,
  onCancel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showRoutes, setShowRoutes] = useState(true);
  const [plan, setPlan] = useState<NewBlockPlan>({
    name: 'Two-day stations',
    startDate: session.date,
    endDate: shiftSchoolDay(session.date, 1),
    roundCount: 3,
  });
  const block = classroom.planningBlocks?.find(
    (item) => item.id === session.blockId,
  );
  const days = block
    ? classroom.sessions
        .filter((item) => item.blockId === block.id)
        .sort((a, b) => a.date.localeCompare(b.date))
    : [];
  const groupIds = [
    ...new Set(
      days.flatMap(
        (day) =>
          classroom.groupSets
            .find((set) => set.id === day.groupSetId)
            ?.groups.map((group) => group.id) ?? [],
      ),
    ),
  ];
  const issue = blockPlanIssue(classroom, plan);
  const existingDays = classroom.sessions.filter(
    (item) => item.date >= plan.startDate && item.date <= plan.endDate,
  ).length;
  const adjacentRepeats = days.reduce(
    (total, day) =>
      total +
      day.rounds.slice(1).reduce(
        (count, round, index) =>
          count +
          round.assignments.filter((assignment) => {
            const previous = day.rounds[index].assignments.find(
              (item) => item.groupId === assignment.groupId,
            );
            return (
              previous &&
              assignmentActivityKey(
                day,
                previous,
                day.rounds[index].completed,
              ) === assignmentActivityKey(day, assignment, round.completed)
            );
          }).length,
        0,
      ),
    0,
  );
  const openNewBlock = () => {
    const startDate = block ? shiftSchoolDay(block.endDate, 1) : session.date;
    setPlan({
      name: 'Two-day stations',
      startDate,
      endDate: shiftSchoolDay(startDate, 1),
      roundCount: session.rounds.length || 3,
    });
    setOpen(true);
  };
  return (
    <>
      <section className="planning-block-panel" aria-label="Planning block">
        <div className="block-heading">
          <div>
            <strong>
              {block?.name ?? 'Plan stations across a block of days'}
            </strong>
            <p>
              {block
                ? `${dayLabel(block.startDate)} – ${dayLabel(block.endDate)} · Tracking starts fresh in each block.`
                : 'Keep a two-day route together, share stations, and limit activities to once per block.'}
            </p>
          </div>
          <div className="heading-actions">
            {block && (
              <Button onClick={onBuild} disabled={Boolean(planning)}>
                <Sparkles /> Build / Optimize block
              </Button>
            )}
            <Button
              variant="outline"
              onClick={openNewBlock}
              disabled={Boolean(planning)}
            >
              <CalendarPlus /> {block ? 'Start next block' : 'Plan a block'}
            </Button>
          </div>
        </div>
        {planning && (
          <output className="planner-status">
            <span>{planning}…</span>
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel planning
            </Button>
          </output>
        )}
        {!planning && report && (
          <output className="planner-status">
            <strong>
              {report.status === 'optimal'
                ? 'Best plan for these rules'
                : 'Best plan found so far'}
            </strong>
            <span>
              {report.after[0] > 0 ? `${report.after[0]} pinned daily visits could not fit. Check the schedule cautions. ` : ''}
              {report.after[1] === 0
                ? 'All groups placed.'
                : `${report.after[1]} places could not be filled.`}{' '}
              {report.after[2] > 0
                ? `${report.after[2]} required daily visits are still missing. `
                : ''}
              {report.after[4] === 0
                ? 'Every student covers all available activities.'
                : `${report.after[4]} activity visits are still missing across the students.`}{' '}
              {adjacentRepeats === 0
                ? 'No back-to-back group repeats.'
                : `${adjacentRepeats} back-to-back group repeats.`}{' '}
              {report.status === 'limited'
                ? 'Search stopped at its limit; a better plan may exist.'
                : ''}
            </span>
          </output>
        )}
        {block ? (
          <>
            <p className="block-history-note">
              Planning favors stations students have not yet visited in this
              block before repeating an activity. Once-only activities get extra
              priority among new visits. Earlier planned and completed rounds
              count. Remove canceled rounds to free their activities. Station
              settings apply across the block; locks and completed rounds are
              kept.
            </p>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={showRoutes}
              onClick={() => setShowRoutes(!showRoutes)}
            >
              {showRoutes ? 'Hide block routes' : 'Show block routes'}
            </Button>
            {showRoutes && (
              <div className="block-overview-scroll">
                <table className="block-overview">
                  <caption>
                    Whole-block routes · activities are shown in round order
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Group</th>
                      {days.map((day) => {
                        const set = classroom.groupSets.find(
                          (item) => item.id === day.groupSetId,
                        );
                        const cautions = set
                          ? scheduleIssues(classroom, day, set).filter(
                              (item) => !day.ignoredIssueIds?.includes(item.id),
                            ).length
                          : 0;
                        return (
                          <th scope="col" key={day.id}>
                            <button
                              type="button"
                              className={
                                day.id === session.id ? 'selected-day' : ''
                              }
                              onClick={() => {
                                onSelect(day.id);
                                setShowRoutes(false);
                              }}
                              aria-label={`Edit ${dayLabel(day.date)}`}
                            >
                              {dayLabel(day.date)}
                              {day.id === session.id ? ' · editing' : ''}
                            </button>
                            {cautions > 0 && (
                              <small>
                                {cautions} caution{cautions === 1 ? '' : 's'}
                              </small>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {groupIds.map((groupId) => {
                      const group = classroom.groupSets
                        .flatMap((set) => set.groups)
                        .find((item) => item.id === groupId);
                      return (
                        <tr key={groupId}>
                          <th scope="row">{group?.name ?? 'Group'}</th>
                          {days.map((day) => {
                            const belongs = classroom.groupSets
                              .find((set) => set.id === day.groupSetId)
                              ?.groups.some((item) => item.id === groupId);
                            return (
                              <td key={day.id}>
                                {belongs ? (
                                  <ol>
                                    {day.rounds.map((round) => {
                                      const assignment = round.assignments.find(
                                        (item) => item.groupId === groupId,
                                      );
                                      const station = day.plannedStations.find(
                                        (item) =>
                                          item.id === assignment?.stationId,
                                      );
                                      return (
                                        <li
                                          key={round.id}
                                          className={
                                            !assignment ? 'route-gap' : ''
                                          }
                                        >
                                          {round.completed
                                            ? (assignment?.activityName ??
                                              station?.activityName)
                                            : (station?.activityName ??
                                              'Unassigned')}
                                          {assignment?.locked && (
                                            <span
                                              aria-label={
                                                assignment.pinned
                                                  ? 'Daily pin'
                                                  : 'Locked'
                                              }
                                            >
                                              {assignment.pinned
                                                ? ' · daily pin'
                                                : ' · locked'}
                                            </span>
                                          )}
                                          {round.completed && (
                                            <span aria-label="Completed">
                                              {' '}
                                              ✓
                                            </span>
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ol>
                                ) : (
                                  '—'
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="block-history-note">
            Outside a block, earlier day plans count as activity history.
            Completed rounds retain who was present.
          </p>
        )}
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {block ? 'Start a fresh planning block' : 'Plan a block of days'}
            </DialogTitle>
            <DialogDescription>
              Choose the dates for this set of activities. Tracking starts fresh
              and stays within these dates. Weekends are skipped when adding
              days.
            </DialogDescription>
          </DialogHeader>
          <div className="block-form">
            <label htmlFor="block-name">
              Block name
              <Input
                id="block-name"
                value={plan.name}
                onChange={(event) =>
                  setPlan({ ...plan, name: event.target.value })
                }
              />
            </label>
            <label htmlFor="block-start">
              First day
              <input
                id="block-start"
                className="native-control"
                type="date"
                value={plan.startDate}
                onInput={(event) => {
                  const startDate = event.currentTarget.value;
                  setPlan((current) => ({ ...current, startDate }));
                }}
              />
            </label>
            <label htmlFor="block-end">
              Last day
              <input
                id="block-end"
                className="native-control"
                type="date"
                value={plan.endDate}
                onInput={(event) => {
                  const endDate = event.currentTarget.value;
                  setPlan((current) => ({ ...current, endDate }));
                }}
              />
            </label>
            <label>
              Rounds per new day
              <select
                className="native-control"
                value={plan.roundCount}
                onChange={(event) =>
                  setPlan({ ...plan, roundCount: Number(event.target.value) })
                }
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => (
                  <option key={count}>{count}</option>
                ))}
              </select>
            </label>
          </div>
          <p>
            {blockDates(plan.startDate, plan.endDate).length} school days.
            Stations and groups are copied from the day you are viewing.{' '}
            {existingDays > 0
              ? `${existingDays} existing day plan(s) will join the block with assignments and locks preserved.`
              : 'New days will be filled automatically.'}
          </p>
          {issue && <output className="dialog-issue">{issue}</output>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={Boolean(issue)}
              onClick={() => {
                onCreate(plan);
                setOpen(false);
                setShowRoutes(true);
              }}
            >
              Create block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
