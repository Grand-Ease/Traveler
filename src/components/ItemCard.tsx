import { useState } from 'react'
import { ChevronDown, MapPin, Pencil, Phone, Trash2 } from 'lucide-react'
import type { ItineraryItem } from '../types'
import { formatTime } from '../lib/format'
import { deviceTimezone, tzAbbrev, tzCity } from '../lib/timezones'
import { iconFor } from './icons'

interface Props {
  item: ItineraryItem
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}

export default function ItemCard({ item, canEdit, onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const Ico = iconFor(item)

  const timeText =
    item.type === 'lodging'
      ? `${item.nights || 1} night${(item.nights || 1) > 1 ? 's' : ''}`
      : [formatTime(item.startTime), formatTime(item.endTime)]
          .filter(Boolean)
          .join(' – ')

  // Show the destination zone whenever it differs from where the viewer is,
  // so a Paris 7pm event reads clearly even when viewed from New York.
  const showTz =
    !!item.startTime &&
    item.type !== 'lodging' &&
    !!item.timezone &&
    item.timezone !== deviceTimezone
  const tzText = showTz ? `${tzAbbrev(item.timezone!)} · ${tzCity(item.timezone!)}` : ''

  const mapsUrl = item.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`
    : undefined

  const hasDetails = item.confirmation || item.phone || item.notes || item.seatsOrRoom

  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-white/90">
          <Ico size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-white truncate">
              {item.title}
              {item.type === 'travel' && item.number ? ` · ${item.number}` : ''}
            </h3>
            {hasDetails && (
              <button
                onClick={() => setOpen((o) => !o)}
                className="text-white/40 hover:text-white shrink-0"
              >
                <ChevronDown
                  size={18}
                  className={`transition ${open ? 'rotate-180' : ''}`}
                />
              </button>
            )}
          </div>

          {item.type === 'travel' && (item.from || item.to) && (
            <p className="text-white/60 text-sm">
              {item.from || '?'} → {item.to || '?'}
            </p>
          )}
          {timeText && (
            <p className="text-white/60 text-sm">
              {timeText}
              {tzText && <span className="text-teal/80"> · {tzText}</span>}
            </p>
          )}
          {item.location && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-white/50 text-sm inline-flex items-center gap-1 hover:text-teal"
            >
              <MapPin size={13} /> {item.location}
            </a>
          )}

          {open && hasDetails && (
            <div className="mt-3 space-y-1 text-sm border-t border-white/10 pt-3">
              {item.seatsOrRoom && (
                <Detail
                  label={item.type === 'lodging' ? 'Room' : 'Seats'}
                  value={item.seatsOrRoom}
                />
              )}
              {item.confirmation && <Detail label="Confirmation" value={item.confirmation} />}
              {item.phone && (
                <p className="flex items-center gap-2 text-white/80">
                  <Phone size={13} className="text-white/50" />
                  <a href={`tel:${item.phone}`} className="text-teal">
                    {item.phone}
                  </a>
                </p>
              )}
              {item.notes && <p className="text-white/70 whitespace-pre-wrap">{item.notes}</p>}
            </div>
          )}

          {canEdit && (
            <div className="mt-3 flex gap-4 text-sm">
              <button
                onClick={onEdit}
                className="inline-flex items-center gap-1 text-teal hover:opacity-80"
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                onClick={onDelete}
                className="inline-flex items-center gap-1 text-red-400 hover:opacity-80"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-white/80">
      <span className="text-white/50">{label}: </span>
      {value}
    </p>
  )
}
