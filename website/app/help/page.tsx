import type { Metadata } from 'next';
import { Apple, ArrowLeft, Download, ExternalLink, FileJson, Monitor, Printer } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Help and installing — Student Grouper',
  description: 'How to try Student Grouper, install it on a Mac, print schedules, and keep a backup.',
};

export default function HelpPage() {
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
          <Apple aria-hidden="true" />
          <p className="section-kicker">Getting started</p>
          <h1>Use the browser, or keep it on your Mac.</h1>
          <p>
            Both versions use the same classroom workflow and keep their own local copy of
            the data. Start with the fictional sample class, then replace it when ready.
          </p>
        </div>

        <section>
          <h2><Monitor aria-hidden="true" /> Try it in a browser</h2>
          <ol>
            <li>Open the browser version and explore the sample class.</li>
            <li>Use it in the same browser on the same computer so its saved data is there.</li>
            <li>Export a backup before clearing browser data or moving to another device.</li>
          </ol>
          <a className="text-link" href="https://excodecowboy.github.io/StudentGrouper/">Open the browser version <ExternalLink size={16} aria-hidden="true" /></a>
        </section>

        <section>
          <h2><Download aria-hidden="true" /> Install on a Mac</h2>
          <ol>
            <li>On the download page, choose <strong>Intel</strong> for an older MacBook Air or <strong>Apple silicon</strong> for an M1, M2, M3, M4, or later Mac.</li>
            <li>Open the downloaded DMG and drag Student Grouper into Applications.</li>
            <li>For the first public build, macOS may say the developer is unidentified. Control-click the app, choose <strong>Open</strong>, then confirm. You only need to do this once.</li>
          </ol>
          <a className="text-link" href="https://github.com/ExCodeCowboy/StudentGrouper/releases/latest">Go to Mac downloads <ExternalLink size={16} aria-hidden="true" /></a>
        </section>

        <section>
          <h2><FileJson aria-hidden="true" /> Keep a backup</h2>
          <p>
            Use <strong>Export backup</strong> after entering a real roster and again after
            meaningful planning changes. Keep the newest copy in a school-approved location.
            Importing a backup checks it before replacing the open copy.
          </p>
        </section>

        <section>
          <h2><Printer aria-hidden="true" /> Print a rotation</h2>
          <p>
            Open Today, choose the date, and use the print button. The print view is designed
            for landscape paper and includes activity pictures, words, group names, colors,
            and symbols.
          </p>
        </section>

        <aside className="plain-note">
          <strong>Found something confusing?</strong>
          <p>This is an early public release. A short description and a screenshot are the most helpful kind of bug report.</p>
          <a className="text-link" href="https://github.com/ExCodeCowboy/StudentGrouper/issues">Open an issue on GitHub <ExternalLink size={16} aria-hidden="true" /></a>
        </aside>
      </article>

      <footer className="simple-footer">
        <span>Created with AI for a teacher I know.</span>
        <Link href="/privacy">Privacy notes</Link>
      </footer>
    </main>
  );
}
