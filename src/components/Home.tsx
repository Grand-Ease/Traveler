import { useState } from 'react'
import { LogOut, Pencil, Plus, Settings, Share2, Trash2 } from 'lucide-react'
import type { Trip } from '../types'
import { supabase } from '../supabase/client'
import { asset } from '../config'
import { shortRange } from '../lib/format'
import * as store from '../store/store'
import { useSyncStatus, useTrips } from '../store/hooks'
import AddTripModal from './AddTripModal'
import ShareModal from './ShareModal'
import SettingsModal from './SettingsModal'
import SyncBadge from './SyncBadge'

interface Props {
  onOpenTrip: (trip: Trip) => void
  onSignOut: () => void
}

export default function Home({ onOpenTrip, onSignOut }: Props) {
  const trips = useTrips()
  const status = useSyncStatus()
  const [selected, setSelected] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Trip | null>(null)
  const [sharing, setSharing] = useState<Trip | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const loading = trips.length === 0 && status.syncing
  const selectedTrip = trips.find((t) => t.id === selected) || null

  function removeTrip(trip: Trip) {
    const owned = trip.accessRole === 'owner'
    const msg = owned
      ? `Delete “${trip.name}”? This removes the trip calendar for everyone.`
      : `Remove “${trip.name}” from your list? (The owner still has it.)`
    if (!confirm(msg)) return
    store.deleteTrip(trip)
    setSelected(null)
  }

  return (
    <div className="h-full flex flex-col max-w-2xl mx-auto w-full">
      <header className="flex items-center gap-3 px-4 pb-4 safe-top">
        <img
          src={asset('logo-cube.png')}
          alt=""
          className="w-11 h-11 object-contain"
          draggable={false}
        />
        <div className="flex-1">
          <p className="text-xs text-white/60 font-medium">GrandEase Traveler</p>
          <h1 className="text-xl font-semibold">Where will you go?</h1>
        </div>
        <SyncBadge />
        <button
          onClick={() => setSettingsOpen(true)}
          className="text-white/50 hover:text-white p-2"
          title="Settings"
        >
          <Settings size={20} />
        </button>
        <button
          onClick={() => {
            void supabase.auth.signOut()
            onSignOut()
          }}
          className="text-white/50 hover:text-white p-2"
          title="Sign out"
        >
          <LogOut size={20} />
        </button>
      </header>

      <div className="border-t border-white/10 mx-4" />

      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-semibold">Trips</h2>
        <button onClick={() => setAdding(true)} className="text-teal hover:opacity-80">
          <Plus size={26} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-bar space-y-2">
        {loading && <p className="text-white/40 text-center py-10">Loading trips…</p>}
        {!loading && trips.length === 0 && (
          <div className="text-center py-16 text-white/40">
            <p>No trips yet.</p>
            <button className="btn-primary mt-4" onClick={() => setAdding(true)}>
              Create your first trip
            </button>
          </div>
        )}
        {trips.map((trip) => {
          const active = selected === trip.id
          return (
            <div key={trip.id} className="flex items-center gap-2">
              <button
                onClick={() => setSelected(trip.id)}
                onDoubleClick={() => onOpenTrip(trip)}
                className={`flex-1 text-left rounded-lg px-4 py-3 border transition ${
                  active
                    ? 'bg-headerCard border-teal-deep'
                    : 'bg-white/10 border-transparent hover:bg-white/[0.14]'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold truncate">{trip.name}</span>
                  <span className="text-white/50 text-sm shrink-0">
                    {trip.startDate && trip.endDate
                      ? shortRange(trip.startDate, trip.endDate)
                      : ''}
                  </span>
                </div>
              </button>
              {active && (
                <button className="btn-primary shrink-0" onClick={() => onOpenTrip(trip)}>
                  Go!
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 inset-x-0 border-t border-white/10 bg-black">
        <div className="max-w-2xl mx-auto flex items-center justify-around pt-3 safe-bottom">
          <IconBtn
            label="Edit"
            disabled={!selectedTrip}
            onClick={() => selectedTrip && setEditing(selectedTrip)}
          >
            <Pencil size={22} />
          </IconBtn>
          <IconBtn
            label="Share"
            disabled={!selectedTrip}
            onClick={() => selectedTrip && setSharing(selectedTrip)}
          >
            <Share2 size={22} />
          </IconBtn>
          <IconBtn
            label="Delete"
            disabled={!selectedTrip}
            onClick={() => selectedTrip && removeTrip(selectedTrip)}
          >
            <Trash2 size={22} />
          </IconBtn>
        </div>
      </div>

      {adding && (
        <AddTripModal
          onClose={() => setAdding(false)}
          onSaved={(t) => {
            setAdding(false)
            setSelected(t.id)
          }}
        />
      )}
      {editing && (
        <AddTripModal
          edit={editing}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
      {sharing && <ShareModal trip={sharing} onClose={() => setSharing(null)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  )
}

function IconBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 text-xs px-6 ${
        disabled ? 'text-white/25' : 'text-white hover:text-teal'
      }`}
    >
      {children}
      {label}
    </button>
  )
}
