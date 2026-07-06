import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Trip } from '../types'
import { listShares, shareTrip, unshareTrip, type Share } from '../supabase/data'
import { isOnline } from '../store/store'
import Modal from './Modal'

interface Props {
  trip: Trip
  onClose: () => void
}

function roleLabel(role: string): string {
  if (role === 'owner') return 'Owner'
  if (role === 'editor') return 'Editor'
  return 'Viewer'
}

export default function ShareModal({ trip, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')
  const [shares, setShares] = useState<Share[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const online = isOnline()
  const canManage = trip.accessRole === 'owner' && online

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
    setNotice('')
    try {
      const res = await shareTrip(trip.id, value, role)
      setEmail('')
      setNotice(
        res.status === 'added'
          ? `${value} was added to the trip.`
          : `${value} isn’t signed up yet — they’ll get access automatically when they sign in.`,
      )
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(userId: string) {
    setBusy(true)
    setError('')
    try {
      await unshareTrip(trip.id, userId)
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
      ) : trip.accessRole !== 'owner' ? (
        <p className="text-white/60 text-sm">
          Only the trip owner can manage sharing. You have{' '}
          <span className="text-white">{roleLabel(
            trip.accessRole === 'writer' ? 'editor' : 'viewer',
          )}</span>{' '}
          access.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-white/50 text-sm">
            Invite by email. Invitees just sign in — the trip appears automatically.
          </p>
          <div className="flex gap-2">
            <input
              className="field flex-1"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && invite()}
            />
            <select
              className="field w-28"
              value={role}
              onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button className="btn-primary w-full" onClick={invite} disabled={busy}>
            {busy ? 'Working…' : 'Invite'}
          </button>

          {notice && <p className="text-teal text-sm">{notice}</p>}

          {shares.length > 0 && (
            <div className="space-y-2">
              <p className="label">People with access</p>
              {shares.map((s) => (
                <div
                  key={s.userId}
                  className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{s.email}</p>
                    <p className="text-white/40 text-xs">{roleLabel(s.role)}</p>
                  </div>
                  {s.role !== 'owner' && (
                    <button
                      onClick={() => remove(s.userId)}
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
