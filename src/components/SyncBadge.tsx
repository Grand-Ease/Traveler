import { Cloud, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react'
import { useSyncStatus } from '../store/hooks'
import { sync } from '../store/store'

// Compact online/offline + pending-changes indicator.
export default function SyncBadge() {
  const { online, pending, syncing, lastError } = useSyncStatus()

  let Icon = Cloud
  let text = 'Up to date'
  let cls = 'text-white/40'

  if (!online) {
    Icon = CloudOff
    cls = 'text-amber-400'
    text = pending ? `Offline · ${pending} to sync` : 'Offline'
  } else if (syncing) {
    Icon = RefreshCw
    cls = 'text-teal'
    text = 'Syncing…'
  } else if (pending) {
    Icon = RefreshCw
    cls = 'text-teal'
    text = `${pending} to sync`
  } else if (lastError) {
    Icon = TriangleAlert
    cls = 'text-amber-400'
    text = 'Sync issue'
  }

  return (
    <button
      onClick={() => online && sync()}
      title={lastError || text}
      className={`inline-flex items-center gap-1 text-xs ${cls} px-2 py-1 rounded-lg hover:bg-white/5`}
    >
      <Icon size={14} className={syncing ? 'animate-spin' : ''} />
      <span>{text}</span>
    </button>
  )
}
