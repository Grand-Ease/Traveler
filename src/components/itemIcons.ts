import type { ItineraryItem, ItemType } from '../types'
import {
  AccountGroup,
  Airplane,
  Baseball,
  Basketball,
  Beach,
  Bed,
  Binoculars,
  Car,
  Compass,
  DanceBallroom,
  Ferry,
  Football,
  ForkKnife,
  Gymnastics,
  Hiking,
  Meditation,
  MovieOpen,
  NoteText,
  Palette,
  Shopping,
  Subway,
  Tennis,
  Train,
  type AppIcon,
} from './icons'

const TRAVEL_ICONS: Record<string, AppIcon> = {
  airplane: Airplane,
  train: Train,
  car: Car,
  subway: Subway,
  ship: Ferry,
}

const ACTIVITY_ICONS: Record<string, AppIcon> = {
  activity: Compass,
  meeting: AccountGroup,
  driving: Car,
  art: Palette,
  sightseeing: Binoculars,
  beach: Beach,
  entertainment: MovieOpen,
  dance: DanceBallroom,
  shopping: Shopping,
  gymnastics: Gymnastics,
  tennis: Tennis,
  baseball: Baseball,
  basketball: Basketball,
  football: Football,
  yoga: Meditation,
  hiking: Hiking,
}

const TYPE_ICONS: Record<ItemType, AppIcon> = {
  travel: Airplane,
  lodging: Bed,
  dining: ForkKnife,
  activity: Binoculars,
  note: NoteText,
}

export function iconFor(item: Pick<ItineraryItem, 'type' | 'subtype'>): AppIcon {
  if (item.type === 'travel') return TRAVEL_ICONS[item.subtype || ''] || Airplane
  if (item.type === 'activity') return ACTIVITY_ICONS[item.subtype || ''] || Binoculars
  return TYPE_ICONS[item.type]
}

export { TYPE_ICONS }
