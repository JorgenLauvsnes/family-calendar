'use client';

import { useEffect, useState } from 'react';
import { Member } from '@/types';

interface MemberWithGcal extends Member {
  hasGcal: boolean;
}

export default function GoogleCalendarPage() {
  const [adults, setAdults] = useState<MemberWithGcal[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [syncing, setSyncing] = useState<number | 'all' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success')) setMessage('Google Kalender koblet til!');
    if (params.get('error')) {
      const errCode = params.get('error');
      setError(
        errCode === 'access_denied'
          ? 'Tilgang ble avslått'
          : `Feil ved tilkobling: ${errCode}`
      );
    }
  }, []);

  const load = async () => {
    const res = await fetch('/api/members');
    const list: Member[] = await res.json();
    setAllMembers(list);

    const detailed = await Promise.all(
      list
        .filter((m) => m.role === 'adult')
        .map(async (m) => {
          const r = await fetch(`/api/members/${m.id}`);
          const data = await r.json();
          return { ...m, hasGcal: data.hasGcal } as MemberWithGcal;
        })
    );
    setAdults(detailed);
  };

  useEffect(() => { load(); }, []);

  const connect = (memberId: number) => {
    window.location.href = `/api/google/auth?memberId=${memberId}`;
  };

  const disconnect = async (memberId: number) => {
    if (!confirm('Koble fra Google Kalender for denne personen?')) return;
    const res = await fetch('/api/google/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    });
    if (res.ok) {
      setMessage('Google Kalender frakoblet');
      await load();
    }
  };

  const syncMember = async (memberId: number) => {
    setSyncing(memberId);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/google/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (res.ok) {
        setMessage('Synkronisering fullført!');
      } else {
        setError('Synkronisering feilet');
      }
    } finally {
      setSyncing(null);
    }
  };

  const syncAll = async () => {
    setSyncing('all');
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/google/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setMessage('Alle kalendere synkronisert!');
      } else {
        setError('Synkronisering feilet');
      }
    } finally {
      setSyncing(null);
    }
  };

  const hasAnyGcal = adults.some((m) => m.hasGcal);

  // Build hashtag for a member name (first name, lowercased)
  const memberTag = (name: string) =>
    '#' + name.split(' ')[0].toLowerCase()
      .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">📆 Google Kalender</h1>
        {hasAnyGcal && (
          <button
            onClick={syncAll}
            disabled={syncing !== null}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {syncing === 'all' ? 'Synkroniserer…' : '🔄 Synkroniser alle'}
          </button>
        )}
      </div>

      {message && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Tagging guide */}
      <section className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h2 className="font-semibold text-blue-900 text-base mb-2">🏷️ Slik tagger du hendelser i Google Kalender</h2>
        <p className="text-sm text-blue-800 mb-3">
          Legg til en av disse hashtaggene i tittelen eller beskrivelsen på en hendelse i Google Kalender
          for at den skal vises i familiekalenderen. Bare taggede hendelser hentes inn.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {/* Special tags */}
          <div className="bg-white rounded-lg border border-blue-200 px-4 py-3">
            <div className="font-mono text-sm font-bold text-blue-700 mb-1">#familie&nbsp; / &nbsp;#alle</div>
            <div className="text-xs text-gray-600">Vises for alle familiemedlemmer</div>
          </div>

          {/* Per-member tags */}
          {allMembers.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-lg border border-blue-200 px-4 py-3 flex items-center gap-3"
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: m.color }}
              >
                {m.avatar_initials ?? m.name[0]}
              </span>
              <div>
                <div className="font-mono text-sm font-bold text-blue-700">{memberTag(m.name)}</div>
                <div className="text-xs text-gray-600">Vises kun for {m.name.split(' ')[0]}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg border border-blue-100 px-4 py-3 text-sm text-gray-700">
          <span className="font-semibold">Eksempel:</span>{' '}
          Skriv{' '}
          <span className="font-mono bg-blue-50 px-1.5 py-0.5 rounded text-blue-700">Fotballkamp {allMembers[0] ? memberTag(allMembers[0].name) : '#markus'}</span>
          {' '}eller legg taggen i beskrivelsen. Du kan bruke flere tagger på én hendelse.
        </div>
      </section>

      {/* Setup instructions */}
      {!process.env.NEXT_PUBLIC_GOOGLE_CONFIGURED && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <h3 className="font-semibold mb-2">⚠️ Oppsett kreves</h3>
          <p className="mb-2">
            For å bruke Google Kalender-integrasjonen må du sette opp OAuth2 i Google Cloud Console:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-amber-700">
            <li>Gå til console.cloud.google.com og opprett et nytt prosjekt</li>
            <li>Aktiver &quot;Google Calendar API&quot;</li>
            <li>Opprett OAuth2-legitimasjon (Web Application)</li>
            <li>Legg til autorisert redirect URI: <code className="bg-amber-100 px-1 rounded">{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/google/callback</code></li>
            <li>Kopier Client ID og Client Secret til <code className="bg-amber-100 px-1 rounded">.env.local</code></li>
            <li>Start appen på nytt</li>
          </ol>
        </div>
      )}

      <div className="grid gap-4">
        {adults.map((member) => (
          <div
            key={member.id}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: member.color }}
                >
                  {member.avatar_initials ?? member.name[0]}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{member.name}</div>
                  <div className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                    {member.hasGcal ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                        <span className="text-green-700">Tilkoblet</span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
                        <span>Ikke tilkoblet</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                {member.hasGcal ? (
                  <>
                    <button
                      onClick={() => syncMember(member.id)}
                      disabled={syncing !== null}
                      className="px-3 py-1.5 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
                    >
                      {syncing === member.id ? 'Synkroniserer…' : '🔄 Synkroniser'}
                    </button>
                    <button
                      onClick={() => disconnect(member.id)}
                      className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Koble fra
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => connect(member.id)}
                    className="px-4 py-1.5 text-sm bg-white border-2 border-gray-300 rounded-lg text-gray-700 hover:border-gray-400 hover:bg-gray-50 font-medium transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Koble til Google
                  </button>
                )}
              </div>
            </div>

            {member.hasGcal && (
              <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                Hendelser synkroniseres automatisk hvert 30. minutt. Husk å tagge hendelsene dine med
                {' '}<span className="font-mono text-blue-600">#familie</span> eller et medlemsnavn for at de skal vises.
              </div>
            )}
          </div>
        ))}
      </div>

      {adults.length === 0 && (
        <div className="text-gray-400 text-center py-8">
          Ingen voksne familiemedlemmer funnet.
          Gå til <a href="/admin/members" className="text-blue-600 underline">Familiemedlemmer</a> for å legge til.
        </div>
      )}
    </div>
  );
}
