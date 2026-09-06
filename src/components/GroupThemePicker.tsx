import { useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { GroupSet } from '../model';
import { groupThemes, themedGroupLook, type GroupThemeId } from '../groupThemes';
import { GroupVisual } from './GroupVisual';
import './groupThemes.css';

export function GroupThemePicker({ groupSet, onApply }: { groupSet: GroupSet; onApply: (id: GroupThemeId) => void }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<GroupThemeId>(groupSet.nameTheme ?? 'woodland');
  return <>
    <Button variant="outline" size="lg" onClick={() => { setSelected(groupSet.nameTheme ?? 'woodland'); setOpen(true); }}><Palette /> Group themes</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="group-theme-dialog">
        <DialogHeader>
          <DialogTitle>A new adventure for your teams</DialogTitle>
          <DialogDescription>Choose matching names and symbols for this arrangement. Students stay in their groups, and rotations and locks are kept.</DialogDescription>
        </DialogHeader>
        <fieldset className="group-theme-options">
          <legend className="sr-only">Group name themes</legend>
          {groupThemes.map((theme) => <button key={theme.id} type="button" className="group-theme-option" aria-pressed={selected === theme.id} onClick={() => setSelected(theme.id)}>
            <span className="theme-mascots" aria-hidden="true">{theme.teams.slice(0, 4).map(([name, symbol]) => <span key={name}>{symbol}</span>)}</span>
            <strong>{theme.name}{selected === theme.id && <Check aria-hidden="true" />}</strong>
            <span>{theme.description}</span>
          </button>)}
        </fieldset>
        <div className="group-theme-preview" aria-label="Preview of group names">
          <strong>Your teams</strong>
          <div>{groupSet.groups.map((group, index) => {
            const look = { ...group, ...themedGroupLook(selected, index), imageDataUrl: undefined };
            return <span key={group.id}><GroupVisual group={look} small />{look.name}</span>;
          })}</div>
        </div>
        <p className="group-theme-note">This replaces this arrangement’s group names and pictures. You can rename any team afterward, or use Undo to restore the previous look.</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { onApply(selected); setOpen(false); }}><Palette /> Apply theme</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
