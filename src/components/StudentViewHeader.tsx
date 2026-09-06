import type { ReactNode } from 'react';
import { ArrowLeft, CalendarDays, Maximize, Minimize, Sparkles, UsersRound } from 'lucide-react';

export type StudentPage = 'groups' | 'today';
export type StudentNavigation = {
  page: StudentPage;
  onNavigate: (page: StudentPage) => void;
  hasDay: boolean;
  fullscreen: boolean;
  onFullscreen: () => void;
  onClose: () => void;
  issue: string;
};

export function StudentViewHeader({ navigation, title, subtitle, children }: {
  navigation: StudentNavigation;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return <>
    <header className="student-show-top student-compact-header">
      <div className="student-display-heading"><span aria-hidden="true"><Sparkles /></span><div><h1>{title}</h1>{subtitle}</div></div>
      <nav className="student-page-nav" aria-label="Student view navigation">
        <button type="button" aria-current={navigation.page === 'groups' ? 'page' : undefined} onClick={() => navigation.onNavigate('groups')}><UsersRound />Groups</button>
        <button type="button" aria-current={navigation.page === 'today' ? 'page' : undefined} disabled={!navigation.hasDay} onClick={() => navigation.onNavigate('today')}><CalendarDays />Today</button>
      </nav>
      <div className="student-show-tools student-compact-tools">
        {children}
        <button className="student-icon-button" type="button" aria-label={navigation.fullscreen ? 'Exit full screen' : 'Full screen'} title={navigation.fullscreen ? 'Exit full screen' : 'Full screen'} onClick={navigation.onFullscreen}>{navigation.fullscreen ? <Minimize /> : <Maximize />}</button>
        <button className="student-icon-button" type="button" aria-label="Teacher view" title="Teacher view" onClick={navigation.onClose}><ArrowLeft /></button>
      </div>
    </header>
    {navigation.issue && <output className="student-show-issue">{navigation.issue}</output>}
  </>;
}
