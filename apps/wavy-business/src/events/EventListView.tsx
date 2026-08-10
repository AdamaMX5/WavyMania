import { Link } from 'react-router-dom'
import { useEvents } from './EventsContext'
import type { EventState } from '../types'

const STATE_LABEL: Record<EventState, string> = {
  draft: 'Entwurf',
  published: 'Veröffentlicht',
  cancelled: 'Storniert',
  completed: 'Abgeschlossen',
}

const STATE_CLASS: Record<EventState, string> = {
  draft: 'bg-neutral-800 text-neutral-300',
  published: 'bg-cyan-950 text-cyan-300',
  cancelled: 'bg-red-950 text-red-300',
  completed: 'bg-neutral-800 text-neutral-400',
}

export function EventListView() {
  const { events, loading, error } = useEvents()

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-neutral-100">Meine Events</h1>

      {error && (
        <p className="mb-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>
      )}

      {loading && events.length === 0 && <p className="text-sm text-neutral-400">Lade Events …</p>}

      {!loading && events.length === 0 && !error && (
        <p className="text-sm text-neutral-400">
          Noch keine Events angelegt. <Link to="/erstellen" className="text-cyan-400 underline">Erstes Event anlegen</Link>
        </p>
      )}

      <div className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
        {events.map((event) => (
          <Link
            key={event.id}
            to={`/events/${event.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-neutral-900"
          >
            <div>
              <p className="font-medium text-neutral-100">{event.title}</p>
              <p className="text-sm text-neutral-400">
                {new Date(event.startsAt).toLocaleString('de-DE')} · {event.venue.name || 'Kein Ort angegeben'}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATE_CLASS[event.state]}`}>
              {STATE_LABEL[event.state]}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
