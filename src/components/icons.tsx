import {
  Plane,
  TrainFront,
  Car,
  TramFront,
  Ship,
  BedDouble,
  Utensils,
  Binoculars,
  StickyNote,
  Compass,
  type LucideIcon,
} from 'lucide-react'
import type { ItineraryItem, ItemType } from '../types'

const TRAVEL_ICONS: Record<string, LucideIcon> = {
  airplane: Plane,
  train: TrainFront,
  car: Car,
  subway: TramFront,
  ship: Ship,
}

const TYPE_ICONS: Record<ItemType, LucideIcon> = {
  travel: Plane,
  lodging: BedDouble,
  dining: Utensils,
  activity: Binoculars,
  note: StickyNote,
}

export function iconFor(item: Pick<ItineraryItem, 'type' | 'subtype'>): LucideIcon {
  if (item.type === 'travel') return TRAVEL_ICONS[item.subtype || ''] || Plane
  if (item.type === 'activity') return item.subtype ? Compass : Binoculars
  return TYPE_ICONS[item.type]
}

export { TYPE_ICONS }
