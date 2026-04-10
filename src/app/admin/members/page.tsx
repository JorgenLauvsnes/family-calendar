'use client';

import { useEffect, useState } from 'react';
import { Member, Schedule, EventCategory } from '@/types';
import CategoryIcon from '@/components/ui/CategoryIcon';
import { ALL_CATEGORIES, CATEGORY_META } from '@/lib/utils/categories';

const PRESET_COLORS = [
  '#2563EB', '#DB2777', '#0D9488', '#7C3AED', '#EA580C', '#16A34A',
  '#DC2626', '#D97706', '#0891B2', '#9333EA', '#059669', '#E11D48',
];

const DAYS = [
  { key: 0, label: 'Søn' },
  { key: 1, label: 'Man' },
  { key: 2, label: 'Tir' },
  { key: 3, label: 'Ons' },
  { key: 4, label: 'Tor' },
  { key: 5, label: 'Fre' },
  { key: 6, label: 'Lør' },
];

interface MemberWithDetails extends Member {
  schedules: Schedule[];
  hasGcal: boolean;
}

interface ScheduleForm {
  label: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
  category: EventCategory;
  active: boolean;
  valid_from: string;
  valid_until: string;
}

const emptyScheduleForm = (): ScheduleForm => ({
  label: '',
  day_of_week: 1,
  start_time: '08:00',
  end_time: '16:00',
  location: '',
  category: 'work',
  active: true,
  valid_from: '',
  valid_until: '',
});

export default function MembersPage() {
  const [members, setMembers] = useState<MemberWithDetails[]>([]);
  const [editing, setEditing] = useState<MemberWithDetails | null>(null);
  const [editForm, setEditForm] = useState<Partial<Member>>({});
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>(emptyScheduleForm());
  const [addingSchedule, setAddingSchedule] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    const res = await fetch('/api/members');
    const list: Member[] = await res.json();
    const detailed = await Promise.all(
      list.map(async (m) => {
        const r = await fetch(`/api/members/${m.id}`);
        return r.json() as Promise<MemberWithDetails>;
      })
    );
    setMembers(detailed);
  };

  useEffect(() => { load(); }, []);

  const startEdit = (m: MemberWithDetails) => {
    setEditing(m);
    setEditForm({ ...m });
    setAddingSchedule(false);
    setMessage('');
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditForm({});
    setAddingSchedule(false);
  };

  const saveMember = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/members/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setMessage('Lagret!');
        await load();
        const updated = members.find((m) => m.id === editing.id);
        if (updated) {
          const r = await fetch(`/api/members/${editing.id}`);
          setEditing(await r.json());
        }
      } else {
        setMessage('Feil ved lagring');
      }
    } finally {
      setSaving(false);
    }
  };

  const addSchedule = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: editing.id, ...scheduleForm }),
      });
      if (res.ok) {
        setMessage('Timeplan lagt til!');
        setAddingSchedule(false);
        setScheduleForm(emptyScheduleForm());
        // Refresh editing member details
        const r = await fetch(`/api/members/${editing.id}`);
        setEditing(await r.json());
        await load();
      } else {
        setMessage('Feil ved lagring av timeplan');
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteSchedule = async (scheduleId: number) => {
    if (!confirm('Slette denne timeplanen?')) return;
    await fetch(`/api/schedules/${scheduleId}`, { method: 'DELETE' });
    if (editing) {
      const r = await fetch(`/api/members/${editing.id}`);
      setEditing(await r.json());
    }
    await load();
    setMessage('Timeplan slettet');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">👥 Familiemedlemmer</h1>

      {message && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {members.map((member) => (
          <div
            key={member.id}
            className={`bg-white rounded-xl border-2 shadow-sm overflow-hidden ${
              editing?.id === member.id
                ? 'border-blue-500'
                : 'border-gray-200'
            }`}
          >
            {/* Member header */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderLeft: `6px solid ${member.color}` }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ backgroundColor: member.color }}
              >
                {member.avatar_initials ?? member.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900">{member.name}</div>
                <div className="text-sm text-gray-500 flex gap-2">
                  <span>{member.role === 'adult' ? 'Voksen' : 'Barn'}</span>
                  {member.birthdate && (
                    <span>· Født {member.birthdate}</span>
                  )}
                  {member.hasGcal && (
                    <span className="text-green-600">· 📆 Google</span>
                  )}
                </div>
              </div>
              <button
                onClick={() =>
                  editing?.id === member.id ? cancelEdit() : startEdit(member)
                }
                className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
              >
                {editing?.id === member.id ? 'Lukk' : 'Rediger'}
              </button>
            </div>

            {/* Edit form */}
            {editing?.id === member.id && (
              <div className="px-4 pb-4 pt-2 space-y-4 border-t border-gray-100 bg-gray-50/50">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Navn</label>
                    <input
                      type="text"
                      value={editForm.name ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Initialer</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={editForm.avatar_initials ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, avatar_initials: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                      placeholder="JØ"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Fødselsdato</label>
                    <input
                      type="date"
                      value={editForm.birthdate ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, birthdate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
                    <select
                      value={editForm.role ?? 'child'}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'adult' | 'child' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    >
                      <option value="adult">Voksen</option>
                      <option value="child">Barn</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Sted (jobb/skole)</label>
                    <input
                      type="text"
                      value={editForm.institution_name ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, institution_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                      placeholder="f.eks. Trondheim kommune"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1">Adresse</label>
                    <input
                      type="text"
                      value={editForm.institution_address ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, institution_address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                      placeholder="f.eks. Kongens gate 1"
                    />
                  </div>
                </div>

                {/* Color picker */}
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-2">Farge</label>
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, color: c })}
                        className={`w-7 h-7 rounded-full transition-transform ${
                          editForm.color === c
                            ? 'ring-2 ring-offset-1 ring-gray-800 scale-110'
                            : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={editForm.color ?? '#2563EB'}
                      onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                      className="w-7 h-7 rounded cursor-pointer border-0 p-0"
                      title="Egendefinert farge"
                    />
                  </div>
                </div>

                {/* Save button */}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={cancelEdit}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-100"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={saveMember}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Lagrer…' : 'Lagre endringer'}
                  </button>
                </div>

                {/* Schedules section */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">
                      Timeplan (ukentlig)
                    </h3>
                    <button
                      onClick={() => setAddingSchedule(!addingSchedule)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                    >
                      + Legg til
                    </button>
                  </div>

                  {/* Existing schedules */}
                  <div className="space-y-2">
                    {editing.schedules.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <CategoryIcon category={s.category} size={14} className="text-gray-500" />
                          <span className="font-medium">{s.label}</span>
                          <span className="text-gray-500">
                            {DAYS.find((d) => d.key === s.day_of_week)?.label}
                            {' '}{s.start_time}–{s.end_time}
                          </span>
                          {!s.active && (
                            <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Pause</span>
                          )}
                        </div>
                        <button
                          onClick={() => deleteSchedule(s.id)}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          Slett
                        </button>
                      </div>
                    ))}
                    {editing.schedules.length === 0 && (
                      <p className="text-sm text-gray-400">Ingen timeplan ennå</p>
                    )}
                  </div>

                  {/* New schedule form */}
                  {addingSchedule && (
                    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
                      <h4 className="text-xs font-semibold text-blue-800">Ny timeplanoppføring</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-600 block mb-0.5">Betegnelse</label>
                          <input
                            type="text"
                            value={scheduleForm.label}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, label: e.target.value })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                            placeholder="f.eks. Jobb, Skole"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-0.5">Kategori</label>
                          <select
                            value={scheduleForm.category}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, category: e.target.value as EventCategory })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                          >
                            {ALL_CATEGORIES.map((c) => (
                              <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-0.5">Ukedag</label>
                          <select
                            value={scheduleForm.day_of_week}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, day_of_week: Number(e.target.value) })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                          >
                            {DAYS.map((d) => (
                              <option key={d.key} value={d.key}>{d.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-0.5">Sted / adresse</label>
                          <input
                            type="text"
                            value={scheduleForm.location}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-0.5">Fra kl.</label>
                          <input
                            type="time"
                            value={scheduleForm.start_time}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-0.5">Til kl.</label>
                          <input
                            type="time"
                            value={scheduleForm.end_time}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-0.5">Gyldig fra (valgfri)</label>
                          <input
                            type="date"
                            value={scheduleForm.valid_from}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, valid_from: e.target.value })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-0.5">Gyldig til (valgfri)</label>
                          <input
                            type="date"
                            value={scheduleForm.valid_until}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, valid_until: e.target.value })}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setAddingSchedule(false)}
                          className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                        >
                          Avbryt
                        </button>
                        <button
                          onClick={addSchedule}
                          disabled={saving || !scheduleForm.label}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving ? 'Lagrer…' : 'Lagre timeplan'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="mt-6 text-sm text-gray-500">
        <strong>Tips:</strong> Bruk timeplan-funksjonen for å legge inn faste ukentlige aktiviteter (jobb, skole, osv).
        Disse genereres automatisk som hendelser de neste 90 dagene.
      </p>
    </div>
  );
}
