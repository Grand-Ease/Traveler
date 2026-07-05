import { asset } from '../config'

// Branded launch screen (reuses the iOS app's splash art).
export default function Splash() {
  return (
    <div
      className="min-h-full w-full flex items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #b4b1a9 0%, #6d6b66 100%)' }}
    >
      <img
        src={asset('splash.png')}
        alt="The GrandEase Traveler"
        className="max-h-full max-w-full object-contain select-none"
        draggable={false}
      />
    </div>
  )
}
