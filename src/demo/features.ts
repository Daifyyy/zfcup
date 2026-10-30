// Funkce platformy pro úvodní stránku: dlaždice + obsah ukázky (DemoModal).
import {
  GitBranch, MonitorPlay, Radio, Share2, type LucideIcon,
} from 'lucide-react'

export type DemoKey = 'live' | 'tv' | 'share' | 'formats'

export interface Feature {
  key: DemoKey
  icon: LucideIcon
  title: string
  text: string
  /** Body v ukázce */
  points: string[]
}

export const FEATURES: Feature[] = [
  {
    key: 'live', icon: Radio, title: 'Živé výsledky',
    text: 'Výsledky, tabulky a střelci se aktualizují okamžitě na všech zařízeních.',
    points: ['Pořadatel zapíše skóre — divákům se změní během vteřiny', 'Tabulka, pořadí a postupová pásma se přepočítají samy', 'Detail zápasu: střelci, asistence, karty, rozhodčí'],
  },
  {
    key: 'tv', icon: MonitorPlay, title: 'TV tabule a kiosk',
    text: 'Broadcast obrazovka pro projektor v hale s hodinami, QR kódem a partnery.',
    points: ['Tabulky, zápasy i pavouk na jedné obrazovce', 'Ostrá na Full HD i 4K, písmo se přizpůsobí počtu týmů', 'QR kód pro diváky a lišta partnerů'],
  },
  {
    key: 'share', icon: Share2, title: 'Grafiky na sociální sítě',
    text: 'Jedním klikem výsledek, tabulka, program a výsledky dne, hráč zápasu, tým turnaje nebo vítěz jako hotový obrázek pro Instagram a Facebook.',
    points: ['Čtverec pro příspěvek i výška pro story', 'Tým turnaje se skládá sám podle výkonů', 'Logo turnaje a partnerů na každé grafice', 'Stáhnout nebo rovnou sdílet z mobilu'],
  },
  {
    key: 'formats', icon: GitBranch, title: 'Skupiny, liga i play-off',
    text: 'Dvanáct formátů turnaje, automatický rozpis, postup v pavouku a vyhodnocení.',
    points: ['Skupiny, liga, sezóna po kolech, vyřazovací pavouk', 'Rozpis na více hřišť i s přestávkami', 'Nasazení do play-off a postup vítězů automaticky'],
  },
]
