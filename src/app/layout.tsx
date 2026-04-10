import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Familie Kalender',
  description: 'Familiekalender for kjøkkenet',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nb">
      <body className="bg-slate-900 text-white antialiased">{children}</body>
    </html>
  );
}
