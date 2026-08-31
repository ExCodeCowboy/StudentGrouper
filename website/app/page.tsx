import {
  Apple,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CircleCheck,
  Download,
  GraduationCap,
  Code2,
  Heart,
  Image as ImageIcon,
  LockKeyhole,
  MousePointer2,
  PencilLine,
  Printer,
  RotateCw,
  Shapes,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';

const groups = [
  { name: 'Blue Stars', symbol: '★', color: '#3778b8' },
  { name: 'Green Circles', symbol: '●', color: '#4c916a' },
  { name: 'Golden Moons', symbol: '☾', color: '#c58a24' },
];

const stations = [
  { name: 'Teacher Time', place: 'Short Table', icon: GraduationCap },
  { name: 'Independent Reading', place: 'Carpet', icon: BookOpen },
  { name: 'Writing Practice', place: 'Seatwork', icon: PencilLine },
  { name: 'Math Games', place: 'Whiteboard Table', icon: Shapes },
];

const schedule = [
  [0, 1, 2],
  [1, 2, 3],
  [2, 3, 0],
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Student Grouper home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
          </span>
          <span>Student Grouper</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#how-it-helps">How it helps</a>
          <a href="#privacy">Privacy</a>
          <a className="nav-download" href="https://github.com/ExCodeCowboy/StudentGrouper/releases/latest">
            Download
          </a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Made for real classroom mornings</p>
          <h1>A calmer way to make groups and plan stations.</h1>
          <p className="hero-lede">
            Build balanced student groups, continue rotations across days, and print
            picture-friendly schedules. No accounts. No cloud setup. No student data
            leaving your device.
          </p>
          <div className="hero-actions">
            <a className="primary-action" href="https://github.com/ExCodeCowboy/StudentGrouper/releases/latest">
              <Apple size={19} aria-hidden="true" />
              Download for Mac
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a className="secondary-action" href="https://excodecowboy.github.io/StudentGrouper/app/">
              Try it in your browser
            </a>
          </div>
          <p className="quiet-note">
            Free to use · Works offline after download · Intel and Apple silicon
          </p>
        </div>

        <div className="product-window" aria-label="Example station rotation schedule">
          <div className="window-bar">
            <span className="window-title">Tuesday’s rotations</span>
            <span className="window-date">Sep 2</span>
          </div>
          <div className="schedule-head">
            <span>Group</span>
            <span>Round 1</span>
            <span>Round 2</span>
            <span>Round 3</span>
          </div>
          {groups.map((group, groupIndex) => (
            <div className="schedule-row" key={group.name}>
              <div className="group-name">
                <span className="group-symbol" style={{ background: group.color }}>
                  {group.symbol}
                </span>
                <strong>{group.name}</strong>
              </div>
              {schedule[groupIndex].map((stationIndex, roundIndex) => {
                const station = stations[stationIndex];
                const StationIcon = station.icon;
                return (
                  <div className="station-cell" key={`${group.name}-${roundIndex}`}>
                    <StationIcon size={20} strokeWidth={1.8} aria-hidden="true" />
                    <span>
                      <strong>{station.name}</strong>
                      <small>{station.place}</small>
                    </span>
                    {groupIndex === 0 && roundIndex === 0 ? (
                      <LockKeyhole className="cell-lock" size={14} aria-label="Locked placement" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="window-footer">
            <span><ShieldCheck size={16} aria-hidden="true" /> Saved on this device</span>
            <span><Printer size={16} aria-hidden="true" /> Ready to print</span>
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Product highlights">
        <div><UsersRound aria-hidden="true" /><span><strong>Groups that make sense</strong>Mix or match skill levels, language, and gender.</span></div>
        <div><CalendarDays aria-hidden="true" /><span><strong>Rotations that remember</strong>Pick up tomorrow where today stopped.</span></div>
        <div><Download aria-hidden="true" /><span><strong>Your data stays yours</strong>Save locally and keep your own backups.</span></div>
      </section>

      <section className="workflow-section" id="how-it-helps">
        <div className="section-heading">
          <p className="section-kicker">From roster to printout</p>
          <h2>Keep the teacher in charge.</h2>
          <p>
            Student Grouper can do the tedious first pass. Every result stays easy to
            understand, move, lock, reset, and print.
          </p>
        </div>
        <div className="workflow-list">
          <article>
            <span className="step-number">01</span>
            <div>
              <UsersRound aria-hidden="true" />
              <h3>Make a useful first draft</h3>
              <p>Choose mixed or similar skill levels, then add one simple preference such as mixed gender or shared language.</p>
            </div>
          </article>
          <article>
            <span className="step-number">02</span>
            <div>
              <MousePointer2 aria-hidden="true" />
              <h3>Move one student—not the whole puzzle</h3>
              <p>Drag the student you mean to move. That choice locks deliberately, and nothing else jumps around behind your back.</p>
            </div>
          </article>
          <article>
            <span className="step-number">03</span>
            <div>
              <RotateCw aria-hidden="true" />
              <h3>Continue rotations across days</h3>
              <p>Plan two or three rounds today and pick up tomorrow with the activities each learner has actually completed.</p>
            </div>
          </article>
          <article>
            <span className="step-number">04</span>
            <div>
              <ImageIcon aria-hidden="true" />
              <h3>Print for emerging readers</h3>
              <p>Pair station words with familiar pictures, plus group colors and symbols that still work on a black-and-white printer.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="details-section">
        <div className="details-copy">
          <p className="section-kicker">Small choices, on purpose</p>
          <h2>Built around the moments that usually eat up planning time.</h2>
          <p>
            Save more than one group arrangement. Note which students work well
            together—or need space. Reuse yesterday’s station setup. See a plain-language
            warning only when the schedule truly needs attention.
          </p>
          <a className="text-link" href="https://excodecowboy.github.io/StudentGrouper/app/">
            Open the browser version <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
        <div className="principles-list" aria-label="Design principles">
          <p><CircleCheck aria-hidden="true" /><span><strong>Manual choices win.</strong> Automatic work never changes a locked placement.</span></p>
          <p><CircleCheck aria-hidden="true" /><span><strong>Success stays quiet.</strong> The app speaks up when it finds an actual problem.</span></p>
          <p><CircleCheck aria-hidden="true" /><span><strong>No scoring dashboard.</strong> Teachers see useful groups, not an opaque optimization score.</span></p>
          <p><CircleCheck aria-hidden="true" /><span><strong>Easy to leave.</strong> Export a complete backup whenever you want.</span></p>
        </div>
      </section>

      <section className="privacy-section" id="privacy">
        <div className="privacy-mark"><ShieldCheck aria-hidden="true" /></div>
        <div>
          <p className="section-kicker">Local by design</p>
          <h2>Student information stays in the classroom.</h2>
          <p>
            There is no account, cloud database, advertising, or analytics. The Mac app
            saves on that Mac. The browser version saves in that browser. Backups go only
            where the teacher chooses to save them.
          </p>
          <Link className="text-link" href="/privacy">
            Read the plain-language privacy notes <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="download-section" id="download">
        <div>
          <p className="section-kicker">Ready when the roster is</p>
          <h2>Try it with the sample class first.</h2>
          <p>Nothing to sign up for. Replace the fictional sample names only when you’re comfortable.</p>
        </div>
        <div className="download-actions">
          <a className="primary-action" href="https://github.com/ExCodeCowboy/StudentGrouper/releases/latest">
            <Apple size={19} aria-hidden="true" /> Download for Mac
          </a>
          <a className="secondary-action" href="https://excodecowboy.github.io/StudentGrouper/app/">Use in a browser</a>
        </div>
      </section>

      <footer>
        <div className="footer-brand">
          <span className="brand-mark" aria-hidden="true"><span /><span /></span>
          <span><strong>Student Grouper</strong><small>Created with AI for a teacher I know.</small></span>
        </div>
        <div className="footer-links">
          <Link href="/help">Help &amp; installing</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="https://github.com/ExCodeCowboy/StudentGrouper"><Code2 size={16} aria-hidden="true" /> Source on GitHub</a>
        </div>
        <p className="footer-heart"><Heart size={14} aria-hidden="true" /> Made to give teachers a little time back.</p>
      </footer>
    </main>
  );
}
