import {
  mdiAccountGroup,
  mdiAirplane,
  mdiAirplaneLanding,
  mdiAirplaneTakeoff,
  mdiAlert,
  mdiBaseball,
  mdiBasketball,
  mdiBeach,
  mdiBed,
  mdiBinoculars,
  mdiCar,
  mdiChevronDown,
  mdiChevronLeft,
  mdiChevronRight,
  mdiCloudOffOutline,
  mdiCloudOutline,
  mdiClose,
  mdiCog,
  mdiCompass,
  mdiCreation,
  mdiDanceBallroom,
  mdiFerry,
  mdiFootball,
  mdiFormatListBulleted,
  mdiGymnastics,
  mdiHiking,
  mdiHome,
  mdiLogout,
  mdiMagnify,
  mdiMap,
  mdiMapMarker,
  mdiMeditation,
  mdiMovieOpen,
  mdiNavigation,
  mdiNoteText,
  mdiPalette,
  mdiPencil,
  mdiPhone,
  mdiPlus,
  mdiRefresh,
  mdiShareVariant,
  mdiShopping,
  mdiSilverwareForkKnife,
  mdiSubwayVariant,
  mdiTennis,
  mdiTrain,
  mdiTrashCanOutline,
  mdiWeatherCloudy,
  mdiWeatherFog,
  mdiWeatherLightning,
  mdiWeatherNight,
  mdiWeatherPartlyCloudy,
  mdiWeatherPouring,
  mdiWeatherRainy,
  mdiWeatherSnowy,
  mdiWeatherSunny,
} from '@mdi/js'

export interface IconProps {
  /** Edge length in px (icons are square). */
  size?: number
  className?: string
}

export interface AppIcon {
  (props: IconProps): React.ReactElement
  /** Stable name; the map uses it to tell one pin's glyph from another. */
  displayName: string
}

// Material Design Icons ship as raw 24x24 path data, so each icon is a thin
// wrapper that fills with the current text color.
function mdi(name: string, path: string): AppIcon {
  // eslint-disable-next-line react-refresh/only-export-components
  const Icon = ({ size = 24, className }: IconProps) => (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  )
  Icon.displayName = name
  return Icon
}

// ---- app chrome ----

export const AirplaneLanding = mdi('AirplaneLanding', mdiAirplaneLanding)
export const AirplaneTakeoff = mdi('AirplaneTakeoff', mdiAirplaneTakeoff)
export const Alert = mdi('Alert', mdiAlert)
export const ChevronDown = mdi('ChevronDown', mdiChevronDown)
export const ChevronLeft = mdi('ChevronLeft', mdiChevronLeft)
export const ChevronRight = mdi('ChevronRight', mdiChevronRight)
export const Cloud = mdi('Cloud', mdiCloudOutline)
export const CloudOff = mdi('CloudOff', mdiCloudOffOutline)
export const Close = mdi('Close', mdiClose)
export const Cog = mdi('Cog', mdiCog)
export const Home = mdi('Home', mdiHome)
export const ListBulleted = mdi('ListBulleted', mdiFormatListBulleted)
export const Logout = mdi('Logout', mdiLogout)
export const Magnify = mdi('Magnify', mdiMagnify)
export const MapIcon = mdi('Map', mdiMap)
export const MapMarker = mdi('MapMarker', mdiMapMarker)
export const Navigation = mdi('Navigation', mdiNavigation)
export const Pencil = mdi('Pencil', mdiPencil)
export const Phone = mdi('Phone', mdiPhone)
export const Plus = mdi('Plus', mdiPlus)
export const Refresh = mdi('Refresh', mdiRefresh)
export const Share = mdi('Share', mdiShareVariant)
export const Sparkles = mdi('Sparkles', mdiCreation)
export const TrashCan = mdi('TrashCan', mdiTrashCanOutline)

// ---- weather ----

export const WeatherCloudy = mdi('WeatherCloudy', mdiWeatherCloudy)
export const WeatherFog = mdi('WeatherFog', mdiWeatherFog)
export const WeatherLightning = mdi('WeatherLightning', mdiWeatherLightning)
export const WeatherNight = mdi('WeatherNight', mdiWeatherNight)
export const WeatherPartlyCloudy = mdi('WeatherPartlyCloudy', mdiWeatherPartlyCloudy)
export const WeatherPouring = mdi('WeatherPouring', mdiWeatherPouring)
export const WeatherRainy = mdi('WeatherRainy', mdiWeatherRainy)
export const WeatherSnowy = mdi('WeatherSnowy', mdiWeatherSnowy)
export const WeatherSunny = mdi('WeatherSunny', mdiWeatherSunny)

// ---- travel, lodging, dining, activities ----

export const AccountGroup = mdi('AccountGroup', mdiAccountGroup)
export const Airplane = mdi('Airplane', mdiAirplane)
export const Baseball = mdi('Baseball', mdiBaseball)
export const Basketball = mdi('Basketball', mdiBasketball)
export const Beach = mdi('Beach', mdiBeach)
export const Bed = mdi('Bed', mdiBed)
export const Binoculars = mdi('Binoculars', mdiBinoculars)
export const Car = mdi('Car', mdiCar)
export const Compass = mdi('Compass', mdiCompass)
export const DanceBallroom = mdi('DanceBallroom', mdiDanceBallroom)
export const Ferry = mdi('Ferry', mdiFerry)
export const Football = mdi('Football', mdiFootball)
export const ForkKnife = mdi('ForkKnife', mdiSilverwareForkKnife)
export const Gymnastics = mdi('Gymnastics', mdiGymnastics)
export const Hiking = mdi('Hiking', mdiHiking)
export const Meditation = mdi('Meditation', mdiMeditation)
export const MovieOpen = mdi('MovieOpen', mdiMovieOpen)
export const NoteText = mdi('NoteText', mdiNoteText)
export const Palette = mdi('Palette', mdiPalette)
export const Shopping = mdi('Shopping', mdiShopping)
export const Subway = mdi('Subway', mdiSubwayVariant)
export const Tennis = mdi('Tennis', mdiTennis)
export const Train = mdi('Train', mdiTrain)
