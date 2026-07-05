import { type ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export default function Modal({ title, onClose, children, footer }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-[#111] sm:rounded-2xl rounded-b-2xl border border-white/10 max-h-[100dvh] sm:max-h-[92vh] sm:mt-6 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 safe-top sm:pt-3 border-b border-white/10">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10">
            <X size={20} />
          </button>
        </div>
        <div
          className={`overflow-y-auto px-4 py-4 flex-1 ${footer ? '' : 'safe-bottom'}`}
        >
          {children}
        </div>
        {footer && (
          <div className="px-4 pt-3 safe-bottom border-t border-white/10 flex gap-2 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
