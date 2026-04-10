'use client';

import { useEffect, useState } from 'react';
import { CalendarEvent, EventCategory, Member } from '@/types';
import CategoryIcon from '@/components/ui/CategoryIcon';
import { ALL_CATEGORIES, CATEGORY_META } from '@/lib/utils/categories';
import { format, parseISO } from 'date-fns';

interface EventRow extends CalendarEvent {
  member_ids_str?: string;
  member_ids: number[];
}

interface EventFormData {
  title: string;
  description: string;
  category: EventCategory;
  start_datetime: string;
  end_datetime: string;
  all_day: boolean;
  location: string;
  member_ids: number[];
}

const emptyForm = (): EventFormData => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return {
    title: '',
    description: '',
    category: 'other',
    start_datetime: `${dateStr}T08:00`,
    end_datetime: `${dateStr}T09:00`,
    all_day: false,
    location: '',
    member_ids: [],
  };
};

export default function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [form, setForm] = useState<EventFormData>(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState({ source: '', memberId: '' });

  const loadEvents = async () => {
    const params = new URLSearchParams();
    // Load next 60 days
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    params.set('start', now.toISOString());
    const end = new Date(now);
    end.setDate(end.getDate() + 60);
    params.set('end', end.toISOString());
    if (filter.source) params.set('source', filter.source);
    if (filter.memberId) params.set('memberId', filter.memberId);

    const res = await fetch(`/api/events?${params}`);
    const data = await res.json();
    setEvents(
      data.map((e: EventRow) => ({
        ...e,
        member_ids: e.member_ids_str
          ? e.member_ids_str.split(',').map(Number)
          : e.member_ids ?? [],
      }))
    );
  };

  const loadMembers = async () => {
    const res = await fetch('/api/members');
    setMembers(await res.json());
  };

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    loadEvents();
  }, [filter]);

  const openAdd = () => {
    setForm(emptyForm());
    setEditingId(null);
    setModal('add');
    setMessage('');
  };

  const openEdit = async (event: EventRow) => {
    const res = await fetch(`/api/events/${event.id}`);
    const data = await res.json();
    const fmt = (dt: string) => {
      try {
        return format(parseISO(dt), "yyyy-MM-dd'T'HH:mm");
      } catch {
        return dt.slice(0, 16);
      }
    };
    setForm({
      title: data.title,
      description: data.description ?? '',
      category: data.category,
      start_datetime: fmt(data.start_datetime),
      end_datetime: fmt(data.end_datetime),
      all_day: data.all_day === 1,
      location: data.location ?? '',
      member_ids: data.member_ids ?? [],
    });
    setEditingId(event.id);
    setModal('edit');
    setMessage('');
  };

  const closeModal = () => {
    setModal(null);
    setEditingId(null);
  };

  const saveEvent = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        start_datetime: form.all_day
          ? `${form.start_datetime.slice(0, 10)}T00:00:00`
          : form.start_datetime + ':00',
        end_datetime: form.all_day
          ? `${form.end_datetime.slice(0, 10)}T23:59:00`
          : form.end_datetime + ':00',
      };

      const url = editingId ? `/api/events/${editingId}` : '/api/events';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMessage('Hendelse lagret!');
        await loadEvents();
        closeModal();
      } else {
        setMessage('Feil ved lagring');
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (id: number) => {
    if (!confirm('Slette denne hendelsen?')) return;
    await fetch(`/api/events/${id}`, { method: 'DELETE' });
    await loadEvents();
    setMessage('Hendelse slettet');
  };

  const toggleMember = (id: number) => {
    setForm((f) => ({
      ...f,
      member_ids: f.member_ids.includes(id)
        ? f.member_ids.filter((m) => m !== id)
        : [...f.member_ids, id],
    }));
  };

  const formatDt = (dt: string) => {
    try {
      return format(parseISO(dt), 'dd.MM HH:mm');
    } catch {
      return dt.slice(0, 16);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">📅 Hendelser</h1>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm"
        >
          + Ny hendelse
        </button>
      </div>

      {message && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-green-50 text-green-700 border border-green-200 text-sm">
          {message}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <select
          value={filter.source}
          onChange={(e) => setFilter({ ...filter, source: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">Alle kilder</option>
          <option value="manual">Manuell</option>
          <option value="google">Google</option>
          <option value="generated">Automatisk</option>
        </select>
        <select
          value={filter.memberId}
          onChange={(e) => setFilter({ ...filter, memberId: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">Alle personer</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {/* Event table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Hendelse</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Tidspunkt</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Hvem</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Kilde</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {events.map((event) => (
              <tr key={event.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CategoryIcon category={event.category} size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="font-medium text-gray-900">{event.title}</span>
                    {event.all_day === 1 && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Hele dagen</span>
                    )}
                  </div>
                  {event.location && (
                    <div className="text-xs text-gray-400 mt-0.5 pl-6">📍 {event.location}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                  {formatDt(event.start_datetime)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {event.member_ids.map((mid) => {
                      const m = members.find((x) => x.id === mid);
                      if (!m) return null;
                      return (
                        <span
                          key={mid}
                          className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: m.color }}
                          title={m.name}
                        >
                          {(m.avatar_initials || m.name[0]).slice(0, 2)}
                        </span>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    event.source === 'manual'
                      ? 'bg-blue-50 text-blue-700'
                      : event.source === 'google'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {event.source === 'manual' ? 'Manuell'
                      : event.source === 'google' ? 'Google'
                      : 'Auto'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => openEdit(event)}
                      className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 text-gray-600"
                    >
                      Rediger
                    </button>
                    <button
                      onClick={() => deleteEvent(event.id)}
                      className="text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50 text-red-600"
                    >
                      Slett
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Ingen hendelser funnet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                {modal === 'add' ? 'Ny hendelse' : 'Rediger hendelse'}
              </h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Tittel *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Kategori</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {ALL_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm({ ...form, category: cat })}
                      className={`flex items-center gap-1.5 px-2 py-2 rounded-lg border text-xs font-medium transition-colors ${
                        form.category === cat
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <CategoryIcon category={cat} size={12} />
                      {CATEGORY_META[cat].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    {form.all_day ? 'Dato fra' : 'Start *'}
                  </label>
                  <input
                    type={form.all_day ? 'date' : 'datetime-local'}
                    value={form.all_day ? form.start_datetime.slice(0, 10) : form.start_datetime}
                    onChange={(e) => setForm({ ...form, start_datetime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    {form.all_day ? 'Dato til' : 'Slutt *'}
                  </label>
                  <input
                    type={form.all_day ? 'date' : 'datetime-local'}
                    value={form.all_day ? form.end_datetime.slice(0, 10) : form.end_datetime}
                    onChange={(e) => setForm({ ...form, end_datetime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.all_day}
                  onChange={(e) => setForm({ ...form, all_day: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-gray-700">Heldagsarrangement</span>
              </label>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Sted</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Beskrivelse</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Hvem gjelder det?</label>
                <div className="flex gap-2 flex-wrap">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMember(m.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors ${
                        form.member_ids.includes(m.id)
                          ? 'border-transparent text-white'
                          : 'border-gray-300 text-gray-600 bg-white'
                      }`}
                      style={
                        form.member_ids.includes(m.id)
                          ? { backgroundColor: m.color, borderColor: m.color }
                          : {}
                      }
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
              >
                Avbryt
              </button>
              <button
                onClick={saveEvent}
                disabled={saving || !form.title}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Lagrer…' : 'Lagre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
