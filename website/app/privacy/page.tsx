import type { Metadata } from 'next';
import { ArrowLeft, Database, Download, EyeOff, ShieldCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy notes — Student Grouper',
  description: 'Plain-language notes about what Student Grouper stores and where it stays.',
};

export default function PrivacyPage() {
  return (
    <main className="content-page">
      <header className="simple-header">
        <Link className="brand" href="/" aria-label="Student Grouper home">
          <span className="brand-mark" aria-hidden="true"><span /><span /></span>
          <span>Student Grouper</span>
        </Link>
        <Link className="back-link" href="/"><ArrowLeft size={16} aria-hidden="true" /> Back home</Link>
      </header>

      <article className="prose-page">
        <div className="prose-heading">
          <ShieldCheck aria-hidden="true" />
          <p className="section-kicker">Privacy, in plain language</p>
          <h1>Student data is not collected.</h1>
          <p>
            Student Grouper has no account system, cloud database, analytics, advertising,
            or tracking. The information a teacher enters stays in that copy of the app.
          </p>
        </div>

        <section>
          <h2><Database aria-hidden="true" /> What the app stores</h2>
          <p>
            The app can store student names, language and skill information, relationship
            notes, groups, station plans, rotation history, locations, and custom station
            pictures. It stores these only so the teacher can use the app’s features.
          </p>
        </section>

        <section>
          <h2><EyeOff aria-hidden="true" /> Where it stays</h2>
          <p>
            The Mac app saves on that Mac. The browser version saves inside that browser on
            that device. Student Grouper does not send classroom information to this website,
            GitHub, an AI service, or the person who made the app.
          </p>
        </section>

        <section>
          <h2><Download aria-hidden="true" /> Backups are the teacher’s copy</h2>
          <p>
            An exported backup contains the classroom information in the app. Treat that file
            like any other student record: save it in an approved place and do not share it
            casually. Restoring a backup happens locally on the chosen device.
          </p>
        </section>

        <section>
          <h2><Trash2 aria-hidden="true" /> Removing information</h2>
          <p>
            Classes can be deleted inside Student Grouper. Browser users can also clear the
            site’s stored data. Removing the Mac app’s local data removes its saved classroom
            information; keep an exported backup first if it may be needed later.
          </p>
        </section>

        <aside className="plain-note">
          <strong>One important distinction</strong>
          <p>
            The app was created with help from AI, but AI is not part of the running app.
            Student information is not submitted to an AI model.
          </p>
        </aside>
      </article>

      <footer className="simple-footer">
        <span>Created with AI for a teacher I know.</span>
        <a href="https://github.com/ExCodeCowboy/StudentGrouper">View the public source</a>
      </footer>
    </main>
  );
}
