// Funkce platformy pro úvodní stránku: dlaždice + obsah ukázky (DemoModal).
import {
  GitBranch, Handshake, MonitorPlay, Newspaper, Radio, Share2, Smartphone, Target, type LucideIcon,
} from 'lucide-react'

export type DemoKey = 'live' | 'tv' | 'partners' | 'share' | 'formats' | 'tips' | 'media' | 'mobile'

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
    key: 'partners', icon: Handshake, title: 'Partneři a branding',
    text: 'Úrovně partnerů, „presented by“, vlastní barvy turnaje a loga všude, kde to má smysl.',
    points: ['Generální, hlavní a mediální partneři i dodavatelé', '„Presented by“ v hlavičce, na Přehledu i na TV', 'Barvy turnaje podle loga pořadatele nebo partnera'],
  },
  {
    key: 'share', icon: Share2, title: 'Grafiky na sociální sítě',
    text: 'Jedním klikem výsledek, tabulka nebo střelci jako hotový obrázek pro Instagram a Facebook.',
    points: ['Čtverec pro příspěvek i výška pro story', 'Logo turnaje a partnerů na každé grafice', 'Stáhnout nebo rovnou sdílet z mobilu'],
  },
  {
    key: 'formats', icon: GitBranch, title: 'Skupiny, liga i play-off',
    text: 'Dvanáct formátů turnaje, automatický rozpis, postup v pavouku a vyhodnocení.',
    points: ['Skupiny, liga, sezóna po kolech, vyřazovací pavouk', 'Rozpis na více hřišť i s přestávkami', 'Nasazení do play-off a postup vítězů automaticky'],
  },
  {
    key: 'tips', icon: Target, title: 'Tipovačka',
    text: 'Hráči a fanoušci tipují výsledky — body se počítají automaticky.',
    points: ['Tipy na zápasy i speciální tipy (vítěz, střelec)', 'Průběžné pořadí tipérů', 'Uzávěrka tipů podle začátku zápasu'],
  },
  {
    key: 'media', icon: Newspaper, title: 'Mediální servis',
    text: 'Kontakt pro novináře, loga ke stažení a výsledky v Excelu i k tisku.',
    points: ['Kontakt a poznámka pro média', 'Výsledkový servis v Excelu', 'Tisknutelný bulletin s rozpisem a tabulkami'],
  },
  {
    key: 'mobile', icon: Smartphone, title: 'Mobil na prvním místě',
    text: 'Funguje v každém prohlížeči, bez aplikace a bez registrace diváků.',
    points: ['Stačí odkaz nebo QR kód', 'Detail týmu a zápasu jedním dotykem', 'Odkaz na konkrétní zápas jde sdílet'],
  },
]
