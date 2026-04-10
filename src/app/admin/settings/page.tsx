'use client';

import { useEffect, useState, FormEvent } from 'react';

interface SettingsForm {
  family_name: string;
  weather_lat: string;
  weather_lon: string;
  weather_location: string;
  vacation_mode: string;
  vacation_lat: string;
  vacation_lon: string;
  vacation_location: string;
  new_password: string;
  confirm_password: string;
}

export default function SettingsPage() {
  const [form, setForm] = useState<SettingsForm>({
    family_name: '',
    weather_lat: '',
    weather_lon: '',
    weather_location: '',
    vacation_mode: '0',
    vacation_lat: '',
    vacation_lon: '',
    vacation_location: '',
    new_password: '',
    confirm_password: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => setForm((f) => ({ ...f, ...data })));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (form.new_password && form.new_password !== form.confirm_password) {
      setError('Passordene er ikke like');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = {
        family_name: form.family_name,
        weather_lat: form.weather_lat,
        weather_lon: form.weather_lon,
        weather_location: form.weather_location,
        vacation_mode: form.vacation_mode,
        vacation_lat: form.vacation_lat,
        vacation_lon: form.vacation_lon,
        vacation_location: form.vacation_location,
      };
      if (form.new_password) {
        payload.new_password = form.new_password;
      }

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMessage('Innstillinger lagret!');
        setForm((f) => ({ ...f, new_password: '', confirm_password: '' }));
      } else {
        setError('Feil ved lagring');
      }
    } finally {
      setSaving(false);
    }
  };

  const isVacation = form.vacation_mode === '1';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">⚙️ Innstillinger</h1>

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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 text-lg">Generelt</h2>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Familienavn</label>
            <input
              type="text"
              value={form.family_name}
              onChange={(e) => setForm({ ...form, family_name: e.target.value })}
              className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              placeholder="f.eks. Familien Stavsberg"
            />
          </div>
        </section>

        {/* Weather */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 text-lg">🌤 Vær (Yr.no)</h2>
          <p className="text-sm text-gray-500">
            Standardsted er Ranheim, Trondheim. Koordinater finner du på{' '}
            <a
              href="https://www.yr.no"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              yr.no
            </a>{' '}
            — høyreklikk på kartet og velg &ldquo;Kopier koordinater&rdquo;.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Stedsnavn</label>
              <input
                type="text"
                value={form.weather_location}
                onChange={(e) => setForm({ ...form, weather_location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Breddegrad (lat)</label>
              <input
                type="text"
                value={form.weather_lat}
                onChange={(e) => setForm({ ...form, weather_lat: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                placeholder="63.4350"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Lengdegrad (lon)</label>
              <input
                type="text"
                value={form.weather_lon}
                onChange={(e) => setForm({ ...form, weather_lon: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                placeholder="10.5167"
              />
            </div>
          </div>
        </section>

        {/* Vacation mode */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 text-lg">✈️ Feriemode</h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isVacation}
                  onChange={(e) =>
                    setForm({ ...form, vacation_mode: e.target.checked ? '1' : '0' })
                  }
                />
                <div
                  className={`w-11 h-6 rounded-full transition-colors ${
                    isVacation ? 'bg-cyan-500' : 'bg-gray-300'
                  }`}
                />
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    isVacation ? 'translate-x-5' : ''
                  }`}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">
                {isVacation ? 'Aktiv (ferie)' : 'Inaktiv'}
              </span>
            </label>
          </div>

          <p className="text-sm text-gray-500">
            Når feriemode er aktiv, vises vær for feriestedet i stedet for hjemstedet.
          </p>

          {isVacation && (
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Feriested</label>
                <input
                  type="text"
                  value={form.vacation_location}
                  onChange={(e) => setForm({ ...form, vacation_location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  placeholder="f.eks. Gran Canaria"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Breddegrad (lat)</label>
                <input
                  type="text"
                  value={form.vacation_lat}
                  onChange={(e) => setForm({ ...form, vacation_lat: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Lengdegrad (lon)</label>
                <input
                  type="text"
                  value={form.vacation_lon}
                  onChange={(e) => setForm({ ...form, vacation_lon: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </section>

        {/* Password */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 text-lg">🔒 Endre passord</h2>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Nytt passord</label>
              <input
                type="password"
                value={form.new_password}
                onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                placeholder="La stå for å beholde"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Bekreft passord</label>
              <input
                type="password"
                value={form.confirm_password}
                onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Lagrer…' : 'Lagre innstillinger'}
          </button>
        </div>
      </form>
    </div>
  );
}
