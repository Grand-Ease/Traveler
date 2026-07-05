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
  Music,
  ShoppingBag,
  Dumbbell,
  Volleyball,
  Trophy,
  Goal,
  Medal,
  PersonStanding,
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

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  activity: Compass,
  meeting: Users,
  driving: Car,
  art: Palette,
  sightseeing: Binoculars,
  beach: Umbrella,
  entertainment: Clapperboard,
  dance: Music,
  shopping: ShoppingBag,
  gymnastics: Dumbbell,
  tennis: Volleyball,
  baseball: Trophy,
  basketball: Goal,
  football: Medal,
  yoga: PersonStanding,
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
