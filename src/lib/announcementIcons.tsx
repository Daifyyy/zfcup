// Ikony oznámení: ukládá se klíč (announcements.icon), dřívější emoji se převádějí při zobrazení.
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle, Beer, Bell, CalendarDays, Camera, Car, CheckCircle2, CircleParking, ClipboardList, Clock, Coffee,
  CupSoda, DoorOpen, FileText, Footprints, Hand, Handshake, Info, Key, Landmark, Lightbulb, Map, MapPin, Medal,
  Megaphone, Mic, Music, PartyPopper, Pin, Pizza, Search, Shield, Smile, Sun, CloudRain, Swords, Target, ThumbsUp,
  Ticket, Timer, Trophy, Users, Utensils, XCircle, Zap,
} from 'lucide-react'

export interface AnnouncementIconDef { key: string; label: string; Icon: LucideIcon }

/** Nabídka v adminu (pořadí = skupiny: obecné, sport, čas a místo, občerstvení, ostatní). */
export const ANNOUNCEMENT_ICONS: AnnouncementIconDef[] = [
  { key: 'megaphone', label: 'Oznámení', Icon: Megaphone },
  { key: 'pin', label: 'Připnuto', Icon: Pin },
  { key: 'info', label: 'Informace', Icon: Info },
  { key: 'bell', label: 'Upozornění', Icon: Bell },
  { key: 'alert', label: 'Pozor', Icon: AlertTriangle },
  { key: 'check', label: 'Hotovo', Icon: CheckCircle2 },
  { key: 'cancel', label: 'Zrušeno', Icon: XCircle },
  { key: 'lightbulb', label: 'Tip', Icon: Lightbulb },
  { key: 'clipboard', label: 'Pokyny', Icon: ClipboardList },
  { key: 'note', label: 'Poznámka', Icon: FileText },
  { key: 'trophy', label: 'Trofej', Icon: Trophy },
  { key: 'medal', label: 'Medaile', Icon: Medal },
  { key: 'target', label: 'Cíl', Icon: Target },
  { key: 'swords', label: 'Souboj', Icon: Swords },
  { key: 'run', label: 'Pohyb', Icon: Footprints },
  { key: 'users', label: 'Týmy', Icon: Users },
  { key: 'clock', label: 'Čas', Icon: Clock },
  { key: 'timer', label: 'Odpočet', Icon: Timer },
  { key: 'calendar', label: 'Termín', Icon: CalendarDays },
  { key: 'location', label: 'Místo', Icon: MapPin },
  { key: 'map', label: 'Mapa', Icon: Map },
  { key: 'car', label: 'Doprava', Icon: Car },
  { key: 'parking', label: 'Parkování', Icon: CircleParking },
  { key: 'door', label: 'Vstup', Icon: DoorOpen },
  { key: 'key', label: 'Šatny / klíče', Icon: Key },
  { key: 'ticket', label: 'Vstupenky', Icon: Ticket },
  { key: 'food', label: 'Jídlo', Icon: Utensils },
  { key: 'pizza', label: 'Pizza', Icon: Pizza },
  { key: 'drink', label: 'Pití', Icon: CupSoda },
  { key: 'coffee', label: 'Káva', Icon: Coffee },
  { key: 'beer', label: 'Pivo', Icon: Beer },
  { key: 'party', label: 'Oslava', Icon: PartyPopper },
  { key: 'music', label: 'Hudba', Icon: Music },
  { key: 'mic', label: 'Moderátor', Icon: Mic },
  { key: 'camera', label: 'Foto', Icon: Camera },
  { key: 'thumbs', label: 'Díky', Icon: ThumbsUp },
  { key: 'handshake', label: 'Fair play', Icon: Handshake },
  { key: 'hand', label: 'Pozdrav', Icon: Hand },
  { key: 'smile', label: 'Úsměv', Icon: Smile },
  { key: 'energy', label: 'Energie', Icon: Zap },
  { key: 'sun', label: 'Slunečno', Icon: Sun },
  { key: 'rain', label: 'Déšť', Icon: CloudRain },
  { key: 'venue', label: 'Areál', Icon: Landmark },
  { key: 'shield', label: 'Bezpečnost', Icon: Shield },
]

export const DEFAULT_ANNOUNCEMENT_ICON = 'megaphone'

/** Dřívější emoji → klíč ikony. */
const EMOJI_TO_KEY: Record<string, string> = {
  '📌': 'pin', '⚽': 'target', '🏆': 'trophy', '🥇': 'medal', '🥈': 'medal', '🥉': 'medal', '🏅': 'medal',
  '⚔️': 'swords', '⚔': 'swords', '🎯': 'target', '🏃': 'run',
  '📢': 'megaphone', '🔔': 'bell', '⚠️': 'alert', '⚠': 'alert', '✅': 'check', '❌': 'cancel', '❗': 'alert',
  '💡': 'lightbulb', '📋': 'clipboard', '📝': 'note', '🔍': 'info',
  '⏰': 'clock', '⏱️': 'timer', '⏱': 'timer', '📅': 'calendar', '🗓️': 'calendar', '🗓': 'calendar', '🚗': 'car',
  '🅿️': 'parking', '🅿': 'parking', '🚪': 'door', '📍': 'location', '🗺️': 'map', '🗺': 'map', '🔑': 'key',
  '🍕': 'pizza', '🍺': 'beer', '🥤': 'drink', '☕': 'coffee', '🎉': 'party', '🎊': 'party', '🎶': 'music', '🎤': 'mic',
  '👏': 'thumbs', '🙌': 'thumbs', '💪': 'energy', '🤝': 'handshake', '👋': 'hand', '😄': 'smile',
  '🌤️': 'sun', '🌤': 'sun', '🌧️': 'rain', '🌧': 'rain', '☀️': 'sun', '☀': 'sun', '🏟️': 'venue', '🏟': 'venue',
  '📸': 'camera', '🛡️': 'shield', '🛡': 'shield',
}

const BY_KEY: Record<string, AnnouncementIconDef> = Object.fromEntries(ANNOUNCEMENT_ICONS.map(d => [d.key, d]))

/** Klíč ikony z uložené hodnoty (klíč i staré emoji); neznámé/prázdné → výchozí. */
export function announcementIconKey(stored: string | null | undefined): string {
  const v = (stored ?? '').trim()
  if (BY_KEY[v]) return v
  return EMOJI_TO_KEY[v] ?? DEFAULT_ANNOUNCEMENT_ICON
}

export function announcementIcon(stored: string | null | undefined): AnnouncementIconDef {
  return BY_KEY[announcementIconKey(stored)]
}
