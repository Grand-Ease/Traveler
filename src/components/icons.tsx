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
  Users,
  Palette,
  Umbrella,
  Clapperboard,
  ShoppingBag,
  Accessibility,
  Footprints,
  createLucideIcon,
  type LucideIcon,
} from 'lucide-react'
import {
  baseball,
  basketball,
  flowerLotus,
  football,
  tennisBall,
} from '@lucide/lab'
import type { ItineraryItem, ItemType } from '../types'

// Lab icons ship as raw nodes; wrap them so they match LucideIcon usage.
const Baseball = createLucideIcon('baseball', baseball)
const Basketball = createLucideIcon('basketball', basketball)
const Football = createLucideIcon('football', football)
const TennisBall = createLucideIcon('tennis-ball', tennisBall)
const FlowerLotus = createLucideIcon('flower-lotus', flowerLotus)

const TRAVEL_ICONS: Record<string, LucideIcon> = {
  airplane: Plane,
  train: TrainFront,
  car: Car,
  subway: TramFront,
  ship: Ship,
}

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  activity: Compass,
  meeting: Users,
  driving: Car,
  art: Palette,
  sightseeing: Binoculars,
  beach: Umbrella,
  entertainment: Clapperboard,
  // Closest available: two people (no dancing couple in Lucide/Lab).
  dance: Users,
  shopping: ShoppingBag,
  // Closest available: open-armed person figure (no tumble/jump icon).
  gymnastics: Accessibility,
  tennis: TennisBall,
  baseball: Baseball,
  basketball: Basketball,
  football: Football,
  // Closest available: lotus / meditation (no seated person in Lucide/Lab).
  yoga: FlowerLotus,
  hiking: Footprints,
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
  if (item.type === 'activity') return ACTIVITY_ICONS[item.subtype || ''] || Binoculars
  return TYPE_ICONS[item.type]
}

export { TYPE_ICONS }
