import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://student-grouper.jkodesign.chatgpt.site'),
  title: 'Student Grouper — Simple classroom groups and station rotations',
  description:
    'Build student groups, continue station rotations across days, and print picture-friendly schedules. Local-first and made for teachers.',
  openGraph: {
    title: 'Student Grouper',
    description: 'Classroom groups and station rotations, made simpler.',
    type: 'website',
    url: '/',
    images: [{
      url: 'https://raw.githubusercontent.com/ExCodeCowboy/StudentGrouper/master/website/public/og.png',
      width: 1737,
      height: 909,
      alt: 'Student Grouper — classroom groups and station rotations, made simpler',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Student Grouper',
    description: 'Classroom groups and station rotations, made simpler.',
    images: ['https://raw.githubusercontent.com/ExCodeCowboy/StudentGrouper/master/website/public/og.png'],
  },
  alternates: { canonical: '/' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
