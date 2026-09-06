import { useState } from 'react';
import { Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { GroupSet, PlannedStation } from '../model';
import { GroupVisual } from './GroupVisual';
import './stationPins.css';

export function StationPins({ station, groupSet, onChange }: {
  station: PlannedStation;
  groupSet: GroupSet;
  onChange: (patch: Partial<PlannedStation>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const saved = station.dailyPinGroupIds ?? [];
  const name = station.activityName || 'new station';
  const missing = selected.filter((id) => !groupSet.groups.some((group) => group.id === id));
  const choose = (id: string, checked: boolean) => setSelected((ids) =>
    checked ? [...new Set([...ids, id])] : ids.filter((item) => item !== id));
  return <div className="station-pins-control">
    <span>Pin groups every day</span>
    <Button variant="outline" type="button" aria-label={`Pin groups for ${name}`} onClick={() => {
      setSelected([...saved]); setOpen(true);
    }}><Pin aria-hidden="true" />{saved.length ? `${saved.length} ${saved.length === 1 ? 'group' : 'groups'} pinned` : 'Choose groups'}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="station-pins-dialog">
        <DialogHeader>
          <DialogTitle>Daily visits to {name}</DialogTitle>
          <DialogDescription>Choose the groups that need one visit here each day. The planner chooses their rounds. Other groups can still rotate through this station.</DialogDescription>
        </DialogHeader>
        <div className="station-pins-actions"><strong>{selected.length} selected</strong><Button variant="ghost" type="button" onClick={() => setSelected([])}>Clear selection</Button></div>
        <fieldset className="station-pin-options">
          <legend className="sr-only">Groups to pin each day</legend>
          {groupSet.groups.map((group) => <label key={group.id} className={selected.includes(group.id) ? 'is-selected' : ''}>
            <input type="checkbox" checked={selected.includes(group.id)} onChange={(event) => choose(group.id, event.target.checked)} />
            <GroupVisual group={group} small /><span>{group.name}</span>
          </label>)}
          {missing.map((id, index) => <label key={id} className="is-missing">
            <input type="checkbox" checked onChange={() => choose(id, false)} />
            <span>Unavailable group {index + 1}<small>This group is no longer in this arrangement. Uncheck it to remove its pin.</small></span>
          </label>)}
          {groupSet.groups.length === 0 && <p>Create groups before pinning a daily visit.</p>}
        </fieldset>
        <p className="station-pins-note">{(station.groupCapacity ?? 1) === 1 ? 'One group at a time: selected groups visit in different rounds.' : `Up to ${station.groupCapacity} groups can visit at the same time.`} Build / Optimize fits the visits around completed work and manual locks.</p>
        {station.visitRule === 'once-per-block' && selected.length > 0 && <p className="station-pins-note">Only once per block still applies. To allow a visit on every day of a multi-day block, choose Rotate normally in the station’s visit settings.</p>}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" onClick={() => { onChange({ dailyPinGroupIds: [...selected] }); setOpen(false); }}>Save pins</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
