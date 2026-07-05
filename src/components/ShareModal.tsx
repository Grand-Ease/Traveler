import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Trip } from '../types'
import { listShares, shareTrip, unshareTrip, type AclEntry } from '../google/calendar'
import { isOnline } from '../store/store'
import Modal from './Modal'

interface Props {
  trip: Trip
  onClose: () => void
}

export default function ShareModal({ trip, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'writer' | 'reader'>('writer')
  const [shares, setShares] = useState<AclEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const online = isOnline()
  const unsynced = trip.id.startsWith('tmp_')
  const canManage = trip.accessRole === 'owner' && online && !unsynced

  async function refresh() {
    try {
      setShares(await listShares(trip.id))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    if (canManage) refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function invite() {
    const value = email.trim()
    if (!value) return
    setBusy(true)
    setError('')
    try {
      await shareTrip(trip.id, value, role)
      setEmail('')
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(ruleId: string) {
    setBusy(true)
    try {
      await unshareTrip(trip.id, ruleId)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={`Share “${trip.name}”`} onClose={onClose}>
      {!online ? (
        <p className="text-white/60 text-sm">
          Sharing needs an internet connection. Reconnect to invite people.
        </p>
      ) : unsynced ? (
        <p className="text-white/60 text-sm">
          This trip hasn’t synced to Google yet. Once it’s uploaded you can share it.
        </p>
      ) : trip.accessRole !== 'owner' ? (
        <p className="text-white/60 text-sm">
          Only the trip owner can manage sharing. You have{' '}
          <span className="text-white">{trip.accessRole}</span> access.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-white/50 text-sm">
            Invite by Google email. Invitees just sign in — the trip appears automatically.
          </p>
          <div className="flex gap-2">
            <input
              className="field flex-1"
              type="email"
              placeholder="name@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && invite()}
            />
            <select
              className="field w-28"
              value={role}
              onChange={(e) => setRole(e.target.value as 'writer' | 'reader')}
            >
              <option value="writer">Can edit</option>
              <option value="reader">View only</option>
            </select>
          </div>
          <button className="btn-primary w-full" onClick={invite} disabled={busy}>
            {busy ? 'Working…' : 'Invite'}
          </button>

          {shares.length > 0 && (
            <div className="space-y-2">
              <p className="label">People with access</p>
              {shares.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{s.scope.value}</p>
                    <p className="text-white/40 text-xs">
                      {s.role === 'owner'
                        ? 'Owner'
                        : s.role === 'writer'
                          ? 'Can edit'
                          : 'View only'}
                    </p>
                  </div>
                  {s.role !== 'owner' && (
                    <button
                      onClick={() => remove(s.id)}
                      className="text-red-400 hover:opacity-80 p-1"
                      disabled={busy}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>
      )}
    </Modal>
  )
}
