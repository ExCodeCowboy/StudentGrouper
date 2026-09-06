import { useState, type CSSProperties, type DragEvent } from 'react';
import {
  ChevronDown,
  CopyPlus,
  Eraser,
  Eye,
  EyeOff,
  ImagePlus,
  Lock,
  LockKeyholeOpen,
  MoreHorizontal,
  Presentation,
  RotateCcw,
  Scale,
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
import type {
  Classroom,
  Group,
  GroupRecipe,
  GroupSet,
  PrimaryAttribute,
  GroupingMode,
  SecondaryGoal,
} from '../model';
import { levelLabel } from '../model';
import { GroupVisual } from '../components/GroupVisual';
import { normalizeUploadedImage } from '../storage';
import { readDrag, writeDrag } from '../dragDrop';
import { groupingCautions } from '../grouping';
import { GroupThemePicker } from '../components/GroupThemePicker';
import type { GroupThemeId } from '../groupThemes';

type Props = {
  classroom: Classroom;
  groupSet: GroupSet;
  canUndo: boolean;
  onSelectGroupSet: (id: string) => void;
  onStudentView: () => void;
  onApplyTheme: (themeId: GroupThemeId) => void;
  onNewGroupSet: (name: string) => void;
  onResetGroupSet: () => void;
  onDeleteGroupSet: () => void;
  onUpdateGroup: (groupId: string, patch: Pick<Group, 'name' | 'imageDataUrl'>) => void;
  onRecipeChange: (patch: Partial<GroupRecipe>) => void;
  onGenerate: () => void;
  onMoveStudent: (studentId: string, groupId: string) => void;
  onToggleLock: (studentId: string, groupId: string) => void;
  onUndo: () => void;
};

export function GroupsView({
  classroom,
  groupSet,
  canUndo,
  onSelectGroupSet,
  onStudentView,
  onApplyTheme,
  onNewGroupSet,
  onResetGroupSet,
  onDeleteGroupSet,
  onUpdateGroup,
  onRecipeChange,
  onGenerate,
  onMoveStudent,
  onToggleLock,
  onUndo,
}: Props) {
  const [newOpen, setNewOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState('');
  const [editingName, setEditingName] = useState('');
  const [editingImageDataUrl, setEditingImageDataUrl] = useState<string | undefined>();
  const [groupImageIssue, setGroupImageIssue] = useState('');
  const [newName, setNewName] = useState('');
  const [showLevels, setShowLevels] = useState(false);
  const placed = new Set(groupSet.groups.flatMap((group) => group.studentIds));
  const unassigned = classroom.students.filter((student) => !student.absent && !placed.has(student.id));
  const groupSizes = groupSet.groups.map((group) => group.studentIds.length);
  const sizeSpread = groupSizes.length > 0
    ? Math.max(...groupSizes) - Math.min(...groupSizes)
    : 0;
  const editingGroup = groupSet.groups.find((group) => group.id === editingGroupId);
  const cautions = groupingCautions(groupSet, classroom.students, classroom.relationships);
  const presentCount = classroom.students.filter((student) => !student.absent).length;

  const beginDrag = (event: DragEvent, studentId: string) => {
    writeDrag(event.dataTransfer, 'student', studentId);
  };
  const dropOnGroup = (event: DragEvent, groupId: string) => {
    event.preventDefault();
    const studentId = readDrag(event.dataTransfer, 'student');
    if (studentId) onMoveStudent(studentId, groupId);
  };
  const openGroupEditor = (group: Group) => {
    setEditingGroupId(group.id);
    setEditingName(group.name);
    setEditingImageDataUrl(group.imageDataUrl);
    setGroupImageIssue('');
  };
  const uploadGroupImage = async (file?: File) => {
    if (!file) return;
    try {
      setGroupImageIssue('');
      setEditingImageDataUrl(await normalizeUploadedImage(file));
    } catch (error) {
      setGroupImageIssue(error instanceof Error ? error.message : 'The picture could not be added.');
    }
  };

  return (
    <main className="workspace">
      <section className="page-heading group-page-heading">
        <div>
          <p className="eyebrow">Saved arrangement</p>
          <div className="arrangement-title-row">
            <select
              aria-label="Saved group arrangement"
              className="title-select"
              value={groupSet.id}
              onChange={(event) => onSelectGroupSet(event.target.value)}
            >
              {classroom.groupSets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <ChevronDown aria-hidden="true" />
            <Button variant="ghost" size="icon-sm" aria-label="Create another group arrangement" onClick={() => setNewOpen(true)}>
              <CopyPlus />
            </Button>
            {classroom.groupSets.length > 1 && (
              <Button variant="ghost" size="icon-sm" aria-label={`Delete ${groupSet.name}`} onClick={() => setDeleteOpen(true)}>
                <Trash2 />
              </Button>
            )}
          </div>
          <p>Move a student to choose their place. Your move will be locked.</p>
        </div>
        <div className="heading-actions">
          <GroupThemePicker groupSet={groupSet} onApply={onApplyTheme} />
          <Button id="open-student-view" variant="outline" size="lg" disabled={!classroom.students.some((student) => !student.absent && placed.has(student.id))} onClick={onStudentView}>
            <Presentation /> Student view
          </Button>
          <Button variant="outline" size="lg" disabled={!canUndo} onClick={onUndo}>
            <RotateCcw /> Undo
          </Button>
          <Button variant="outline" size="lg" onClick={() => setResetOpen(true)}>
            <Eraser /> Reset
          </Button>
          <Button size="lg" onClick={onGenerate}>
            <Sparkles /> Make groups
          </Button>
        </div>
      </section>

      <section className="recipe-bar" aria-label="Grouping choices">
        <label>
          <span>Groups</span>
          <select
            aria-label="Group count"
            className="inline-select"
            value={groupSet.recipe.sizeMode === 'pairs' ? 'pairs' : groupSet.recipe.groupCount}
            onChange={(event) => onRecipeChange(event.target.value === 'pairs' ? { sizeMode: 'pairs' } : { sizeMode: 'count', groupCount: Number(event.target.value) })}
          >
            <option value="pairs">Pairs ({Math.max(1, Math.floor(presentCount / 2))} groups)</option>
            {Array.from({ length: Math.max(8, classroom.students.length, groupSet.groups.length, groupSet.recipe.groupCount) - 1 }, (_, index) => index + 2).map((count) => <option key={count}>{count}</option>)}
          </select>
        </label>
        <div className="recipe-divider" />
        <label>
          <span>Group by</span>
          <select
            className="inline-select"
            aria-label="Grouping method"
            value={groupSet.recipe.mode === 'random' ? 'random' : groupSet.recipe.primaryAttribute}
            onChange={(event) => onRecipeChange(event.target.value === 'random' ? { mode: 'random', secondaryGoal: 'none' } : { primaryAttribute: event.target.value as PrimaryAttribute, mode: groupSet.recipe.mode === 'random' ? 'mixed' : groupSet.recipe.mode })}
          >
            <option value="random">Random</option>
            <option value="reading">Reading level</option>
            <option value="math">Math level</option>
            <option value="writing">Writing level</option>
          </select>
          {groupSet.recipe.mode !== 'random' && <select
            className="inline-select"
            value={groupSet.recipe.mode}
            onChange={(event) => onRecipeChange({ mode: event.target.value as GroupingMode })}
          >
            <option value="mixed">Mixed</option>
            <option value="similar">Similar</option>
          </select>}
        </label>
        <div className="recipe-divider" />
        <label>
          <span>Also try to</span>
          <select
            className="inline-select"
            value={groupSet.recipe.secondaryGoal}
            onChange={(event) => onRecipeChange({ secondaryGoal: event.target.value as SecondaryGoal })}
          >
            <option value="none">Nothing else</option>
            <option value="mix-gender">Mix genders</option>
            <option value="share-language">Share language</option>
          </select>
        </label>
        <button
          className="level-visibility-toggle"
          type="button"
          aria-pressed={showLevels}
          onClick={() => setShowLevels((visible) => !visible)}
        >
          {showLevels ? <EyeOff /> : <Eye />}
          {showLevels ? 'Hide levels' : 'Show levels'}
        </button>
        <div className="recipe-summary">
          <span><span className="status-dot" /> {classroom.students.filter((student) => !student.absent).length} students</span>
          {unassigned.length === 0 && (
            <span className={sizeSpread > 1 ? 'balance-status is-uneven' : 'balance-status'}>
              <Scale aria-hidden="true" />
              {sizeSpread > 1 ? 'Locks made sizes uneven' : 'Sizes kept even'}
            </span>
          )}
        </div>
      </section>

      {groupSet.recipe.sizeMode === 'pairs' && <p className="grouping-note">Pairs use the students who are here. With an odd number, one group has three. Existing locks are kept.</p>}
      {groupSet.recipe.mode === 'random' && <p className="grouping-note">Make groups shuffles unlocked students. Keep-apart notes are respected; if a full arrangement cannot be found, some students stay unassigned.</p>}
      {cautions.map((caution) => <p key={caution} className="dialog-issue">{caution}</p>)}

      {unassigned.length > 0 && (
        <section className="unassigned-tray">
          <strong>Not placed yet</strong>
          <span>Make groups or drag these students into a group. Student view shows placed students only.</span>
          <div>
            {unassigned.map((student) => (
              <button
                draggable
                key={student.id}
                type="button"
                onDragStart={(event) => beginDrag(event, student.id)}
              >
                {student.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section
        className={`group-board${groupSet.groups.length > 8 ? ' many-groups' : ''}`}
        style={{ '--group-count': groupSet.groups.length } as CSSProperties}
        aria-label="Student groups"
      >
        {groupSet.groups.map((group) => {
          const students = group.studentIds
            .map((id) => classroom.students.find((student) => student.id === id))
            .filter((student) => Boolean(student));
          return (
            // This article is a native drag-and-drop destination, not a clickable control.
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <article
              className="group-column"
              key={group.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => dropOnGroup(event, group.id)}
            >
              <header style={{ '--group-color': group.color } as CSSProperties}>
                <GroupVisual group={group} />
                <div>
                  <h2>{group.name}</h2>
                  <p>{students.length} students</p>
                </div>
                <button type="button" aria-label={`Edit ${group.name}`} onClick={() => openGroupEditor(group)}>
                  <MoreHorizontal />
                </button>
              </header>
              <div className="student-list">
                {students.map((student) => {
                  if (!student) return null;
                  const locked = group.lockedStudentIds.includes(student.id);
                  return (
                    <div
                      className={`student-card${locked ? ' is-locked' : ''}`}
                      draggable
                      key={student.id}
                      onDragStart={(event) => beginDrag(event, student.id)}
                    >
                      <span className="student-avatar">{student.name[0]}</span>
                      <span className="student-name">{student.name}</span>
                      {showLevels && (
                        <span className={`level level-${levelLabel(student[groupSet.recipe.primaryAttribute]).toLowerCase()}`}>
                          {levelLabel(student[groupSet.recipe.primaryAttribute])}
                        </span>
                      )}
                      <button
                        className="card-lock"
                        type="button"
                        aria-label={locked ? `Unlock ${student.name}` : `Lock ${student.name}`}
                        onClick={() => onToggleLock(student.id, group.id)}
                      >
                        {locked ? <Lock /> : <LockKeyholeOpen />}
                      </button>
                    </div>
                  );
                })}
              </div>
              <button className="drop-space" type="button">Drop student here</button>
            </article>
          );
        })}
      </section>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New group arrangement</DialogTitle>
            <DialogDescription>Save separate groups for reading, math, centers, or another activity.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Reading Groups" value={newName} onChange={(event) => setNewName(event.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button disabled={!newName.trim()} onClick={() => { onNewGroupSet(newName.trim()); setNewName(''); setNewOpen(false); }}>Create groups</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingGroupId)}
        onOpenChange={(open) => { if (!open) setEditingGroupId(''); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit group</DialogTitle>
            <DialogDescription>Rename the group or choose a picture children will recognize.</DialogDescription>
          </DialogHeader>
          {groupImageIssue && <p className="dialog-issue">{groupImageIssue}</p>}
          <div className="group-edit-form">
            <label htmlFor="group-name-input">
              <span>Group name</span>
              <Input id="group-name-input" value={editingName} onChange={(event) => setEditingName(event.target.value)} />
            </label>
            {editingGroup && (
              <div className="group-picture-editor">
                <GroupVisual group={{ ...editingGroup, name: editingName, imageDataUrl: editingImageDataUrl }} />
                <div>
                  <strong>Group picture</strong>
                  <span>Shown in rotations and on printed charts.</span>
                </div>
                <label className="image-upload-button" htmlFor="group-picture-upload">
                  <ImagePlus /> {editingImageDataUrl ? 'Change picture' : 'Choose picture'}
                  <input id="group-picture-upload" type="file" accept="image/gif,image/jpeg,image/png" onChange={(event) => uploadGroupImage(event.target.files?.[0])} />
                </label>
                {editingImageDataUrl && (
                  <Button variant="ghost" size="sm" onClick={() => setEditingImageDataUrl(undefined)}>
                    Use default symbol
                  </Button>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGroupId('')}>Cancel</Button>
            <Button
              disabled={!editingName.trim() || !editingGroup}
              onClick={() => {
                if (!editingGroup) return;
                onUpdateGroup(editingGroup.id, {
                  name: editingName.trim(),
                  imageDataUrl: editingImageDataUrl,
                });
                setEditingGroupId('');
              }}
            >
              Save group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {groupSet.name}?</DialogTitle>
            <DialogDescription>
              This saved arrangement will be removed. Rotation days using it will switch to another arrangement and be rebuilt. You can Undo afterward.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { onDeleteGroupSet(); setDeleteOpen(false); }}>
              <Trash2 /> Delete arrangement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset {groupSet.name}?</DialogTitle>
            <DialogDescription>
              Every student will move back to Not placed yet, and all student locks in this arrangement will be cleared. You can Undo afterward.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { onResetGroupSet(); setResetOpen(false); }}>
              <Eraser /> Reset groups
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
