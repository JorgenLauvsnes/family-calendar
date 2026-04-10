import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/auth/session';
import Link from 'next/link';
import LogoutButton from './LogoutButton';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const session = await getIronSession<SessionData>(
    cookieStore,
    sessionOptions
  );

  if (!session.isAdmin) {
    redirect('/login');
  }

  const navItems = [
    { href: '/admin/members', label: '👥 Familiemedlemmer' },
    { href: '/admin/events', label: '📅 Hendelser' },
    { href: '/admin/google', label: '📆 Google Kalender' },
    { href: '/admin/settings', label: '⚙️ Innstillinger' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Top bar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-8">
          <Link href="/admin" className="font-bold text-lg text-blue-700">
            📅 Familie Kalender
          </Link>
          <div className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/display"
            target="_blank"
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Vis kalender →
          </Link>
          <LogoutButton />
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
