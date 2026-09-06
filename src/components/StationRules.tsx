import type { GroupSet, PlannedStation } from '../model';
import { StationPins } from './StationPins';

export function StationRules({
  station,
  groupSet,
  onChange,
}: {
  station: PlannedStation;
  groupSet: GroupSet;
  onChange: (patch: Partial<PlannedStation>) => void;
}) {
  return (
    <div className="station-rules">
      <label>
        Visits per group
        <select
          className="native-control"
          aria-label={`Visit rule for ${station.activityName || 'new station'}`}
          value={station.visitRule ?? 'rotate'}
          onChange={(event) =>
            onChange({
              visitRule: event.target.value as PlannedStation['visitRule'],
            })
          }
        >
          <option value="rotate">Rotate normally</option>
          <option value="once-per-block">Only once per block</option>
          <option value="daily">Once each day</option>
          <option value="repeatable">May repeat (makeup / desk work)</option>
        </select>
      </label>
      <label>
        Groups at the same time
        <select
          className="native-control"
          aria-label={`Group capacity for ${station.activityName || 'new station'}`}
          value={station.groupCapacity ?? 1}
          onChange={(event) =>
            onChange({ groupCapacity: Number(event.target.value) })
          }
        >
          {Array.from(
            {
              length: Math.max(
                8,
                groupSet.groups.length,
                station.groupCapacity ?? 1,
              ),
            },
            (_, index) => index + 1,
          ).map((count) => (
            <option key={count} value={count}>
              {count === 1 ? '1 group' : `${count} groups`}
            </option>
          ))}
        </select>
      </label>
      <StationPins station={station} groupSet={groupSet} onChange={onChange} />
      <label className="station-priority-choice">
        <span><input type="checkbox" aria-label={`Priority station: ${station.activityName || 'new station'}`} checked={station.priority === true} onChange={(event) => onChange({ priority: event.target.checked })} />Priority station</span>
        <small>Aim for everyone’s first visit here early.</small>
      </label>
      {station.visitRule === 'daily' && (
        <>
          <label>
            Daily visits for
            <select
              className="native-control"
              aria-label={`Daily groups for ${station.activityName}`}
              value={station.dailyGroupIds === undefined ? 'all' : 'selected'}
              onChange={(event) =>
                onChange({
                  dailyGroupIds: event.target.value === 'all' ? undefined : [],
                })
              }
            >
              <option value="all">Every group</option>
              <option value="selected">Choose groups</option>
            </select>
          </label>
          {station.dailyGroupIds !== undefined && (
            <fieldset className="daily-group-choices">
              <legend>Must visit each day</legend>
              {groupSet.groups.map((group) => (
                <label key={group.id}>
                  <input
                    type="checkbox"
                    checked={station.dailyGroupIds!.includes(group.id)}
                    onChange={(event) =>
                      onChange({
                        dailyGroupIds: event.target.checked
                          ? [...station.dailyGroupIds!, group.id]
                          : station.dailyGroupIds!.filter(
                              (id) => id !== group.id,
                            ),
                      })
                    }
                  />
                  {group.name}
                </label>
              ))}
              <small>Other groups may visit when there is room.</small>
            </fieldset>
          )}
        </>
      )}
      {station.visitRule === 'once-per-block' && (
        <small>
          Planning favors a turn here for every group, with no learner repeating
          it in the block. Without a block, this applies to the selected day.
        </small>
      )}
      {station.visitRule === 'repeatable' && (
        <small>
          Allows repeats when needed. In a block, activities students have not
          yet visited come first.
        </small>
      )}
    </div>
  );
}
