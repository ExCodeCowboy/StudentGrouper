import { useMemo, useState } from 'react';
import { Link2, Plus, RotateCcw, Trash2, UserMinus, UserPlus } from 'lucide-react';
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
  RelationshipKind,
  SkillLevel,
  Student,
} from '../model';
import { levelLabel } from '../model';

type Props = {
  classroom: Classroom;
  canUndo: boolean;
  onUndo: () => void;
  onAddStudents: (names: string[]) => void;
  onUpdateStudent: (studentId: string, patch: Partial<Student>) => void;
  onRemoveStudent: (studentId: string) => void;
  onAddRelationship: (studentAId: string, studentBId: string, kind: RelationshipKind) => void;
  onRemoveRelationship: (relationshipId: string) => void;
};

const levels: SkillLevel[] = [1, 2, 3];

export function StudentsView({
  classroom,
  canUndo,
  onUndo,
  onAddStudents,
  onUpdateStudent,
  onRemoveStudent,
  onAddRelationship,
  onRemoveRelationship,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [relationshipOpen, setRelationshipOpen] = useState(false);
  const [names, setNames] = useState('');
  const [studentAId, setStudentAId] = useState('');
  const [studentBId, setStudentBId] = useState('');
  const [kind, setKind] = useState<RelationshipKind>('apart');
  const sortedStudents = useMemo(
    () => [...classroom.students].sort((left, right) => left.name.localeCompare(right.name)),
    [classroom.students],
  );

  const addNames = () => {
    const parsed = names
      .split(/\r?\n|,/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (!parsed.length) return;
    onAddStudents(parsed);
    setNames('');
    setAddOpen(false);
  };

  const addRelationship = () => {
    if (!studentAId || !studentBId || studentAId === studentBId) return;
    onAddRelationship(studentAId, studentBId, kind);
    setRelationshipOpen(false);
    setStudentAId('');
    setStudentBId('');
  };

  return (
    <main className="workspace student-workspace">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Class roster</p>
          <h1>Students</h1>
          <p>Add what helps with grouping. Leave anything else blank.</p>
        </div>
        <div className="heading-actions">
          <Button variant="outline" size="lg" disabled={!canUndo} onClick={onUndo}>
            <RotateCcw /> Undo
          </Button>
          <Button variant="outline" size="lg" onClick={() => setRelationshipOpen(true)}>
            <Link2 /> Grouping notes
          </Button>
          <Button size="lg" onClick={() => setAddOpen(true)}>
            <UserPlus /> Add students
          </Button>
        </div>
      </section>

      <section className="student-layout">
        <div className="roster-card">
          <div className="roster-table roster-head" aria-hidden="true">
            <span>Student</span>
            <span>Language</span>
            <span>Gender</span>
            <span>Reading</span>
            <span>Math</span>
            <span>Writing</span>
            <span>Today</span>
            <span />
          </div>
          {sortedStudents.length === 0 && (
            <div className="empty-roster">
              <UserPlus />
              <strong>Add your students to get started</strong>
              <span>Paste the whole class list at once.</span>
              <Button onClick={() => setAddOpen(true)}>Add students</Button>
            </div>
          )}
          {sortedStudents.map((student) => (
            <div className={`roster-table roster-row${student.absent ? ' is-absent' : ''}`} key={student.id}>
              <Input
                aria-label="Student name"
                value={student.name}
                onChange={(event) => onUpdateStudent(student.id, { name: event.target.value })}
              />
              <Input
                aria-label={`${student.name} language`}
                placeholder="Not set"
                value={student.language}
                onChange={(event) => onUpdateStudent(student.id, { language: event.target.value })}
              />
              <select
                aria-label={`${student.name} gender`}
                className="native-control"
                value={student.gender}
                onChange={(event) => onUpdateStudent(student.id, { gender: event.target.value as Student['gender'] })}
              >
                <option value="">Not set</option>
                <option value="Girl">Girl</option>
                <option value="Boy">Boy</option>
              </select>
              {(['reading', 'math', 'writing'] as const).map((property) => (
                <select
                  aria-label={`${student.name} ${property} level`}
                  className="native-control level-control"
                  key={property}
                  value={student[property]}
                  onChange={(event) =>
                    onUpdateStudent(student.id, { [property]: Number(event.target.value) as SkillLevel })
                  }
                >
                  {levels.map((level) => <option key={level} value={level}>{levelLabel(level)}</option>)}
                </select>
              ))}
              <button
                className={`attendance-button${student.absent ? ' absent' : ''}`}
                type="button"
                onClick={() => onUpdateStudent(student.id, { absent: !student.absent })}
              >
                {student.absent ? <UserMinus /> : <UserPlus />}
                {student.absent ? 'Away' : 'Here'}
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${student.name}`}
                onClick={() => onRemoveStudent(student.id)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>

        <aside className="relationship-card">
          <div className="aside-heading">
            <div>
              <h2>Grouping notes</h2>
              <p>Only instructions the group maker needs.</p>
            </div>
            <Button variant="outline" size="icon-sm" aria-label="Add grouping note" onClick={() => setRelationshipOpen(true)}>
              <Plus />
            </Button>
          </div>
          {classroom.relationships.length ? (
            <div className="relationship-list">
              {classroom.relationships.map((relationship) => {
                const left = classroom.students.find((student) => student.id === relationship.studentAId);
                const right = classroom.students.find((student) => student.id === relationship.studentBId);
                if (!left || !right) return null;
                return (
                  <div className="relationship-item" key={relationship.id}>
                    <span className={`relationship-mark ${relationship.kind}`}>
                      {relationship.kind === 'apart' ? '↔' : '＋'}
                    </span>
                    <div>
                      <strong>{left.name} & {right.name}</strong>
                      <span>{relationship.kind === 'apart' ? 'Keep apart' : 'Prefer together'}</span>
                    </div>
                    <button type="button" aria-label="Remove grouping note" onClick={() => onRemoveRelationship(relationship.id)}>
                      <Trash2 />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty-copy">No grouping notes yet.</p>
          )}
        </aside>
      </section>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>Add students</DialogTitle>
            <DialogDescription>Paste one name per line, or separate names with commas.</DialogDescription>
          </DialogHeader>
          <textarea
            className="large-textarea"
            placeholder={'Ava\nMateo\nSofia'}
            value={names}
            onChange={(event) => setNames(event.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addNames}>Add students</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={relationshipOpen} onOpenChange={setRelationshipOpen}>
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>Add a grouping note</DialogTitle>
            <DialogDescription>Tell the group maker what to do with this pair.</DialogDescription>
          </DialogHeader>
          <div className="relationship-form">
            <select className="native-control" value={studentAId} onChange={(event) => setStudentAId(event.target.value)}>
              <option value="">Choose student</option>
              {sortedStudents.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
            <select className="native-control" value={kind} onChange={(event) => setKind(event.target.value as RelationshipKind)}>
              <option value="apart">Keep apart</option>
              <option value="together">Prefer together</option>
            </select>
            <select className="native-control" value={studentBId} onChange={(event) => setStudentBId(event.target.value)}>
              <option value="">Choose student</option>
              {sortedStudents.filter((student) => student.id !== studentAId).map((student) => (
                <option key={student.id} value={student.id}>{student.name}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRelationshipOpen(false)}>Cancel</Button>
            <Button disabled={!studentAId || !studentBId} onClick={addRelationship}>Add note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
