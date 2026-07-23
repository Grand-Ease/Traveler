import { useEffect, useState } from 'react'
import { RefreshCw, Trash2 } from 'lucide-react'
import type { Trip } from '../types'
import {
  listShares,
  removePendingInvite,
  shareTrip,
  unshareTrip,
  type Share,
} from '../supabase/data'
import { isOnline, isTripPending } from '../store/store'
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
  // A trip that hasn't synced to the server yet has no Postgres row, so
  // invite_member would fail with an owner-permission error. Block sharing
  // until it syncs.
  const pending = isTripPending(trip.id)
  const canManage = trip.accessRole === 'owner' && online && !pending

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
      const accessNotice =
        res.status === 'added'
          ? `${value} already has access to the trip.`
          : `${value} will get access when they sign in.`
      setNotice(
        res.emailSent
          ? `${accessNotice} Invite email sent.`
          : res.emailSkipped
            ? accessNotice
            : `${accessNotice} ${res.emailError ?? 'The invite email was not sent.'}`,
      )
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function resend(share: Share) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const res = await shareTrip(
        trip.id,
        share.email,
        share.role as 'editor' | 'viewer',
      )
      setNotice(
        res.emailSent
          ? `Invite resent to ${share.email}.`
          : res.emailError ?? `The invite to ${share.email} was not sent.`,
      )
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(share: Share) {
    setBusy(true)
    setError('')
    try {
      if (share.accepted && share.userId) {
        await unshareTrip(trip.id, share.userId)
      } else {
        await removePendingInvite(trip.id, share.id)
      }
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
      ) : pending ? (
        <p className="text-white/60 text-sm">
          Save &amp; sync this trip before sharing — you’re offline or it hasn’t synced yet.
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
            Invite by email. Invitees sign in with the same address and the trip appears
            automatically.
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
                  key={s.id}
                  className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{s.email}</p>
                    <p className="text-white/40 text-xs">
                      {roleLabel(s.role)}
                      {s.role !== 'owner' && (
                        <>
                          {' · '}
                          <span className={s.accepted ? 'text-teal' : 'text-amber-300'}>
                            {s.accepted ? 'Accepted' : 'Pending'}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!s.accepted && (
                      <button
                        onClick={() => resend(s)}
                        className="text-teal hover:opacity-80 p-1"
                        disabled={busy}
                        title={
                          s.lastSentAt
                            ? `Last sent ${new Date(s.lastSentAt).toLocaleString()}`
                            : 'Send invite again'
                        }
                        aria-label={`Resend invite to ${s.email}`}
                      >
                        <RefreshCw size={16} />
                      </button>
                    )}
                    {s.role !== 'owner' && (
                      <button
                        onClick={() => remove(s)}
                        className="text-red-400 hover:opacity-80 p-1"
                        disabled={busy}
                        title={s.accepted ? 'Remove access' : 'Cancel invite'}
                        aria-label={
                          s.accepted
                            ? `Remove access for ${s.email}`
                            : `Cancel invite for ${s.email}`
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
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
