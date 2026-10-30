import { useEffect, type ReactNode } from 'react'
import { ChevronLeft, Scale, TriangleAlert } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { LEGAL_DOCS, LEGAL_EFFECTIVE_DATE, OPERATOR, SUBPROCESSORS, missingOperatorFields, type LegalDoc } from '../../lib/legal'
import { Tabs } from '../ui/Tabs'
import SiteFooter, { goToLegal } from '../layout/SiteFooter'

interface Props {
  doc: LegalDoc
  onHome: () => void
}

/** Vyplněná hodnota, nebo zvýrazněné „[doplnit: …]“. */
function F({ v, label }: { v: string; label: string }) {
  return v.trim() ? <>{v}</> : <mark className="legal-missing">[doplnit: {label}]</mark>
}

function L({ to, children }: { to: LegalDoc; children: ReactNode }) {
  return <a href={`/pravni/${to}`} onClick={e => goToLegal(to, e)}>{children}</a>
}

function effectiveDate(): string {
  const [y, m, d] = LEGAL_EFFECTIVE_DATE.split('-').map(Number)
  return `${d}. ${m}. ${y}`
}

function OperatorIdentity() {
  return (
    <>
      <F v={OPERATOR.name} label="jméno / název" />, IČO <F v={OPERATOR.ico} label="IČO" />,
      se sídlem <F v={OPERATOR.address} label="adresa" />, e-mail <F v={OPERATOR.email} label="e-mail" />
    </>
  )
}

export default function LegalPage({ doc, onHome }: Props) {
  const meta = LEGAL_DOCS.find(d => d.id === doc) ?? LEGAL_DOCS[0]
  const missing = missingOperatorFields()

  useEffect(() => {
    document.title = `${meta.title} · ${BRAND.name}`
  }, [meta.title])

  return (
    <div className="lp">
      <header className="hdr">
        <div className="hdr__top">
          <div className="hdr__inner">
            <button type="button" onClick={onHome} className="hdr-back"><ChevronLeft size={18} /><span className="hide-mobile">{BRAND.name}</span></button>
            <div className="hdr__crest"><Scale size={22} /></div>
            <div className="hdr__title">
              <h1 className="hdr__name">{meta.title}</h1>
              <div className="hdr__meta">Platné od {effectiveDate()}</div>
            </div>
          </div>
        </div>
        <div className="hdr__nav">
          <div className="hdr__inner">
            <Tabs variant="chrome" value={doc} onChange={d => goToLegal(d)} ariaLabel="Právní dokumenty"
              items={LEGAL_DOCS.map(d => ({ value: d.id, label: d.short }))} />
          </div>
        </div>
      </header>

      <main className="lp-wrap cp-main">
        {missing.length > 0 && (
          <div className="legal-warn" role="note">
            <TriangleAlert size={18} />
            <span>Údaje o provozovateli nejsou kompletní (chybí: {missing.join(', ')}). Doplňte je v souboru <code>src/lib/legal.ts</code>.</span>
          </div>
        )}
        <article className="legal">
          {doc === 'podminky' && <Terms />}
          {doc === 'ochrana-osobnich-udaju' && <Privacy />}
          {doc === 'cookies' && <Cookies />}
          {doc === 'provozovatel' && <Operator />}
        </article>
      </main>

      <SiteFooter />
    </div>
  )
}

// ── Podmínky používání ─────────────────────────────────────────────────────────

function Terms() {
  return (
    <>
      <h2>1. Úvodní ustanovení</h2>
      <p>
        Tyto podmínky upravují používání webové platformy {BRAND.name} (dále jen „platforma“), kterou provozuje{' '}
        <OperatorIdentity /> (dále jen „provozovatel“).
      </p>
      <p>Platformu používají:</p>
      <ul>
        <li><strong>návštěvníci</strong> — prohlížejí veřejné stránky turnajů, soutěží a klubů bez přihlášení,</li>
        <li><strong>tipéři</strong> — účastní se tipovačky turnaje, pokud ji organizátor zapne,</li>
        <li><strong>organizátoři</strong> — s přihlášením zakládají a spravují turnaje, týmy, výsledky a další obsah.</li>
      </ul>

      <h2>2. Účet organizátora</h2>
      <p>
        Účet organizátora zřizuje provozovatel na základě dohody s organizátorem. Organizátor je povinen chránit své
        přihlašovací údaje a odpovídá za veškerou činnost provedenou pod svým účtem. Podezření na zneužití účtu
        oznámí bez odkladu provozovateli.
      </p>
      <p>Cena a platební podmínky se řídí individuální dohodou mezi organizátorem a provozovatelem.</p>

      <h2>3. Obsah vložený organizátorem</h2>
      <p>
        Organizátor odpovídá za veškerý obsah, který do platformy vloží (názvy, texty, jména a fotografie hráčů,
        loga týmů a partnerů, obrázky, videa, výsledky). Prohlašuje, že k tomuto obsahu má potřebná práva a že jeho
        zveřejnění neporušuje práva třetích osob ani právní předpisy. Provozovatel je oprávněn odstranit nebo
        znepřístupnit obsah, který je zjevně protiprávní nebo porušuje tyto podmínky.
      </p>

      <h2>4. Autorská práva a licence</h2>
      <p>
        Platforma — zejména zdrojový kód, grafický design, uživatelské rozhraní, texty, šablony, sdílecí grafiky a
        struktura databáze — je autorským dílem a databází provozovatele chráněnou zákonem č. 121/2000 Sb.,
        autorský zákon. Název a logo platformy jsou označením provozovatele.
      </p>
      <p>
        Organizátor získává po dobu trvání účtu nevýhradní, nepřevoditelnou licenci užívat platformu ke správě a
        prezentaci vlastních turnajů. Bez předchozího písemného souhlasu provozovatele je zakázáno zejména:
      </p>
      <ul>
        <li>platformu nebo její části kopírovat, rozmnožovat, upravovat či z nich vytvářet odvozená díla,</li>
        <li>dekompilovat, zpětně analyzovat nebo obcházet technická opatření platformy,</li>
        <li>automatizovaně vytěžovat data nad rámec běžného prohlížení (scraping) nebo nadměrně zatěžovat servery,</li>
        <li>poskytovat přístup k účtu třetím osobám nebo platformu přeprodávat,</li>
        <li>využít platformu k vytvoření konkurenční služby.</li>
      </ul>
      <p>
        Obsah vložený organizátorem zůstává jeho. Organizátor uděluje provozovateli bezúplatnou nevýhradní licenci
        tento obsah zobrazovat a zpracovávat v rozsahu nutném pro provoz platformy (včetně TV tabule, tiskového
        bulletinu, sdílecích grafik a náhledů odkazů), a to po dobu, kdy je obsah v platformě uložen. Jako referenci
        může provozovatel turnaj uvést jen se souhlasem organizátora.
      </p>

      <h2>5. Osobní údaje a zpracovatelská smlouva</h2>
      <p>
        Pro údaje o hráčích, členech týmů, rozhodčích, tipérech a kontaktech pro média, které organizátor do
        platformy vloží nebo které se v jeho turnaji shromáždí, je organizátor <strong>správcem</strong> a provozovatel
        <strong> zpracovatelem</strong> ve smyslu nařízení (EU) 2016/679 (GDPR). Tento článek je smlouvou o zpracování
        osobních údajů podle čl. 28 GDPR.
      </p>
      <ul>
        <li><strong>Předmět a doba:</strong> uložení, zobrazení a zveřejnění údajů v rámci platformy po dobu, kdy je organizátor platformu používá.</li>
        <li><strong>Povaha a účel:</strong> organizace sportovního turnaje a zveřejnění rozpisu, výsledků, tabulek, statistik a tipovačky.</li>
        <li><strong>Typy údajů:</strong> jméno a příjmení, číslo dresu, role v týmu, fotografie, sportovní statistiky, příslušnost k týmu; u tipérů jméno, PIN a tipy; u kontaktu pro média jméno, e-mail a telefon.</li>
        <li><strong>Kategorie subjektů:</strong> hráči a členové týmů, rozhodčí, tipéři, kontaktní osoby organizátora.</li>
      </ul>
      <p>Provozovatel se zavazuje:</p>
      <ul>
        <li>zpracovávat údaje jen na doložené pokyny organizátora — za ně se považuje obsah a nastavení, které organizátor v platformě zadá,</li>
        <li>zajistit mlčenlivost osob, které mají k údajům přístup,</li>
        <li>přijmout vhodná technická a organizační opatření podle čl. 32 GDPR (šifrované spojení, oddělení dat organizátorů přístupovými pravidly v databázi, hesla organizátorů uložená jako otisk),</li>
        <li>zapojit další zpracovatele jen ty uvedené v <L to="ochrana-osobnich-udaju">Zásadách ochrany osobních údajů</L>; o zamýšlené změně informuje organizátora předem a organizátor proti ní může vznést námitku,</li>
        <li>poskytnout organizátorovi součinnost při vyřizování žádostí subjektů údajů a při plnění povinností podle čl. 32 až 36 GDPR,</li>
        <li>bez zbytečného odkladu oznámit organizátorovi zjištěné porušení zabezpečení osobních údajů,</li>
        <li>po skončení spolupráce údaje vymazat; organizátor si je předtím může stáhnout (Administrace → Nastavení → Export dat turnaje),</li>
        <li>poskytnout informace potřebné k doložení plnění těchto povinností a umožnit audit v přiměřeném rozsahu.</li>
      </ul>
      <p>
        Organizátor odpovídá za to, že má ke zpracování a zveřejnění údajů právní základ, že subjekty údajů
        (zejména hráče) o zpracování informoval a že u fotografií hráčů má jejich souhlas — u nezletilých souhlas
        zákonného zástupce.
      </p>

      <h2>6. Tipovačka</h2>
      <p>
        Tipovačka je nesázková zábavní soutěž bez vkladu, nejde o hazardní hru. Pravidla bodování jsou uvedena přímo
        v tipovačce. Za případné ceny pro tipéry odpovídá organizátor turnaje.
      </p>

      <h2>7. Dostupnost a odpovědnost</h2>
      <p>
        Provozovatel usiluje o nepřetržitou dostupnost platformy, nezaručuje ji však — zejména při údržbě nebo
        výpadku poskytovatelů hostingu. Platforma se poskytuje v aktuálním stavu. Organizátorovi doporučujeme
        průběžně si data exportovat.
      </p>
      <p>
        Vůči organizátorům, kteří jsou podnikateli, je odpovědnost provozovatele za škodu omezena částkou, kterou
        organizátor provozovateli zaplatil za posledních 12 měsíců. Omezení se nevztahuje na škodu způsobenou úmyslně
        nebo z hrubé nedbalosti ani na újmu na zdraví. Práva spotřebitelů ze zákona zůstávají nedotčena.
      </p>

      <h2>8. Ukončení</h2>
      <p>
        Organizátor může používání platformy kdykoli ukončit. Provozovatel může účet zrušit při podstatném porušení
        těchto podmínek. Po ukončení provozovatel data organizátora vymaže; před tím mu umožní je exportovat.
      </p>

      <h2>9. Změny podmínek</h2>
      <p>
        Provozovatel může podmínky měnit. Organizátory o změně informuje nejméně 14 dní předem e-mailem nebo v
        aplikaci. Pokud organizátor se změnou nesouhlasí, může spolupráci ukončit; dalším používáním platformy
        vyjadřuje se změnou souhlas.
      </p>

      <h2>10. Závěrečná ustanovení</h2>
      <p>
        Tyto podmínky se řídí právem České republiky, zejména zákonem č. 89/2012 Sb., občanský zákoník. Spory
        rozhodují obecné soudy České republiky. Spotřebitel se může obrátit na subjekt mimosoudního řešení sporů,
        kterým je Česká obchodní inspekce (<a href="https://www.coi.cz" target="_blank" rel="noopener noreferrer">www.coi.cz</a>).
      </p>
      <p className="legal-meta">Tyto podmínky jsou účinné od {effectiveDate()}.</p>
    </>
  )
}

// ── Zásady ochrany osobních údajů ─────────────────────────────────────────────

function Privacy() {
  return (
    <>
      <h2>1. Kdo údaje zpracovává</h2>
      <p>Provozovatelem platformy {BRAND.name} je <OperatorIdentity />.</p>
      <p>Podle toho, o jaké údaje jde, vystupuje provozovatel ve dvou rolích:</p>
      <ul>
        <li>
          <strong>Správce</strong> — pro údaje organizátorů (přihlašovací účty), komunikaci s provozovatelem a
          technické záznamy o provozu.
        </li>
        <li>
          <strong>Zpracovatel</strong> — pro údaje, které do turnaje vloží organizátor (hráči, členové týmů,
          rozhodčí, kontakty pro média) nebo které se v turnaji shromáždí (tipéři). Jejich správcem je
          <strong> organizátor daného turnaje</strong>. Žádosti týkající se těchto údajů směřujte nejprve na
          organizátora; pokud se obrátíte na nás, žádost mu předáme a pomůžeme s jejím vyřízením.
        </li>
      </ul>

      <h2>2. Jaké údaje, proč a jak dlouho</h2>
      <div className="legal-table-wrap">
        <table className="legal-table legal-table--data">
          <thead>
            <tr><th>Komu patří</th><th>Údaje</th><th>Účel a právní základ</th><th>Doba uchování</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Organizátoři</td>
              <td>e-mail, heslo (uložené jako otisk), turnaje a jejich nastavení</td>
              <td>poskytování platformy — plnění smlouvy (čl. 6 odst. 1 písm. b GDPR)</td>
              <td>po dobu trvání účtu; po jeho zrušení výmaz do 30 dnů, ze záloh nejpozději do 90 dnů</td>
            </tr>
            <tr>
              <td>Kdokoli, kdo nás kontaktuje</td>
              <td>jméno, e-mail, obsah zprávy</td>
              <td>vyřízení dotazu — oprávněný zájem (čl. 6 odst. 1 písm. f)</td>
              <td>po dobu vyřízení a poté nejvýše 3 roky</td>
            </tr>
            <tr>
              <td>Hráči a členové týmů</td>
              <td>jméno a příjmení, číslo dresu, role, tým, sportovní statistiky (góly, asistence, karty, tresty), volitelně fotografie</td>
              <td>organizace turnaje a zveřejnění výsledků a statistik — určuje organizátor (obvykle oprávněný zájem); fotografie jen se souhlasem (čl. 6 odst. 1 písm. a)</td>
              <td>dokud organizátor turnaj nebo hráče nesmaže; výsledky soutěže může organizátor uchovávat jako archiv ročníků</td>
            </tr>
            <tr>
              <td>Rozhodčí</td>
              <td>jméno, přiřazení k zápasům</td>
              <td>organizace turnaje — určuje organizátor</td>
              <td>dokud je organizátor nesmaže</td>
            </tr>
            <tr>
              <td>Kontakt pro média</td>
              <td>jméno, e-mail, telefon</td>
              <td>komunikace s novináři — určuje organizátor</td>
              <td>dokud je organizátor nesmaže</td>
            </tr>
            <tr>
              <td>Tipéři</td>
              <td>jméno a příjmení, PIN, tipy a body</td>
              <td>účast v tipovačce — určuje organizátor; jméno a body se zobrazují v žebříčku</td>
              <td>dokud organizátor turnaj nebo tipéra nesmaže</td>
            </tr>
            <tr>
              <td>Návštěvníci</td>
              <td>technické záznamy poskytovatelů hostingu (IP adresa, čas, typ prohlížeče)</td>
              <td>bezpečnost a provoz — oprávněný zájem</td>
              <td>krátkodobě podle pravidel poskytovatelů</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        <strong>Veřejné zobrazení:</strong> rozpis, výsledky, tabulky, soupisky, statistiky a žebříček tipovačky jsou
        smyslem platformy a jsou veřejně dostupné komukoli s odkazem na turnaj.
      </p>
      <p>
        Nepoužíváme analytické ani reklamní nástroje, neprofilujeme návštěvníky a údaje neprodáváme. K automatizovanému
        rozhodování s právními účinky nedochází (bodování tipovačky je jen výpočet podle zveřejněných pravidel).
      </p>

      <h2>3. Kdo další má k údajům přístup</h2>
      <p>Pro provoz platformy využíváme tyto zpracovatele:</p>
      <ul>
        {SUBPROCESSORS.map(s => <li key={s.name}><strong>{s.name}</strong> — {s.role} ({s.country})</li>)}
      </ul>
      <p>
        Pokud dochází k předání údajů mimo Evropský hospodářský prostor, děje se tak na základě rozhodnutí
        o odpovídající ochraně (EU-U.S. Data Privacy Framework) nebo standardních smluvních doložek schválených
        Evropskou komisí.
      </p>

      <h2>4. Zabezpečení</h2>
      <p>
        Spojení s platformou je šifrované (HTTPS). Každý organizátor může měnit jen své turnaje — vynucují to
        přístupová pravidla přímo v databázi. Hesla organizátorů se ukládají jen jako otisk. Písma i ostatní
        prostředky aplikace se načítají z našeho serveru, bez předávání IP adres třetím stranám.
      </p>

      <h2>5. Děti</h2>
      <p>
        Turnajů se mohou účastnit i nezletilí hráči. Za právní základ zpracování jejich údajů a za souhlas zákonného
        zástupce (zejména s fotografií) odpovídá organizátor. Souhlas se zpracováním v souvislosti se službami
        informační společnosti může v ČR sám udělit člověk starší 15 let.
      </p>

      <h2>6. Vaše práva</h2>
      <p>Máte právo:</p>
      <ul>
        <li>na přístup ke svým údajům a jejich kopii,</li>
        <li>na opravu nepřesných údajů,</li>
        <li>na výmaz („být zapomenut“) a na omezení zpracování,</li>
        <li>na přenositelnost údajů,</li>
        <li>vznést námitku proti zpracování založenému na oprávněném zájmu,</li>
        <li>kdykoli odvolat souhlas (např. s fotografií), aniž by to ovlivnilo zákonnost dřívějšího zpracování,</li>
        <li>podat stížnost u Úřadu pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Praha 7, <a href="https://uoou.gov.cz" target="_blank" rel="noopener noreferrer">uoou.gov.cz</a>.</li>
      </ul>
      <p>
        Žádosti posílejte na e-mail <F v={OPERATOR.email} label="e-mail" /> (u údajů z turnaje přednostně organizátorovi).
        Odpovíme nejpozději do jednoho měsíce.
      </p>

      <h2>7. Úložiště v prohlížeči</h2>
      <p>Používáme jen technicky nezbytné úložiště — podrobnosti v <L to="cookies">Informacích o cookies</L>.</p>

      <h2>8. Změny</h2>
      <p>Tyto zásady můžeme aktualizovat; aktuální znění je vždy na této stránce.</p>
      <p className="legal-meta">Účinné od {effectiveDate()}.</p>
    </>
  )
}

// ── Cookies ───────────────────────────────────────────────────────────────────

function Cookies() {
  return (
    <>
      <h2>Stručně</h2>
      <p>
        {BRAND.name} <strong>nepoužívá analytické, reklamní ani sledovací cookies</strong>. Ukládáme jen to, co je
        nezbytné pro funkci, o kterou jste sami požádali (přihlášení). Proto nezobrazujeme lištu se souhlasem —
        podle § 89 odst. 3 zákona č. 127/2005 Sb., o elektronických komunikacích, se souhlas u technicky nezbytného
        ukládání nevyžaduje.
      </p>

      <h2>Co ukládáme do vašeho prohlížeče</h2>
      <div className="legal-table-wrap">
        <table className="legal-table legal-table--cookies">
          <thead>
            <tr><th>Název</th><th>Typ</th><th>K čemu slouží</th><th>Jak dlouho</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>sb-…-auth-token</code></td>
              <td>místní úložiště (localStorage)</td>
              <td>udržuje přihlášení organizátora do administrace</td>
              <td>do odhlášení</td>
            </tr>
            <tr>
              <td><code>turnajnik_tipster_id</code></td>
              <td>místní úložiště (localStorage)</td>
              <td>pamatuje si přihlášeného tipéra na tomto zařízení</td>
              <td>do odhlášení z tipovačky</td>
            </tr>
            <tr>
              <td><code>turnajnik_access_codes</code></td>
              <td>místní úložiště (localStorage)</td>
              <td>pamatuje si přístupové kódy soukromých turnajů, které jste zadali</td>
              <td>do smazání dat webu (nejvýše 20 kódů)</td>
            </tr>
            <tr>
              <td><code>turnajnik_og_…</code></td>
              <td>místní úložiště (localStorage)</td>
              <td>jen u organizátora: pamatuje si, pro jakou podobu turnaje už byl vytvořen náhled odkazu, aby se zbytečně nevytvářel znovu</td>
              <td>do smazání dat webu</td>
            </tr>
            <tr>
              <td><code>turnajnik_chunk_reload</code></td>
              <td>úložiště relace (sessionStorage)</td>
              <td>po nasazení nové verze aplikace zabrání opakovanému obnovování stránky</td>
              <td>do zavření karty</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>Návštěvník, který se nepřihlašuje a nezadává přístupový kód, nemá v prohlížeči uloženo nic.</p>

      <h2>Obsah třetích stran</h2>
      <p>
        <strong>Videa YouTube</strong>, která organizátor vloží do oznámení, přehráváme v režimu rozšířené ochrany
        soukromí (<code>youtube-nocookie.com</code>). YouTube může po spuštění videa ukládat údaje do vašeho zařízení;
        řídí se přitom zásadami společnosti Google.
      </p>
      <p><strong>Písma</strong> načítáme z našeho serveru, nikoli ze služby Google Fonts.</p>

      <h2>Jak údaje smazat</h2>
      <p>
        Uložené údaje odstraníte odhlášením nebo v nastavení prohlížeče (Smazat údaje o prohlížení → Soubory cookie a
        data webů). Více o zpracování údajů najdete v <L to="ochrana-osobnich-udaju">Zásadách ochrany osobních údajů</L>.
      </p>
      <p className="legal-meta">Účinné od {effectiveDate()}.</p>
    </>
  )
}

// ── Provozovatel ──────────────────────────────────────────────────────────────

function Operator() {
  const rows: [string, ReactNode][] = [
    ['Provozovatel', <F v={OPERATOR.name} label="jméno / název" />],
    ['IČO', <F v={OPERATOR.ico} label="IČO" />],
    ...(OPERATOR.dic.trim() ? [['DIČ', OPERATOR.dic] as [string, ReactNode]] : []),
    ['Sídlo', <F v={OPERATOR.address} label="adresa" />],
    ['Zápis', <F v={OPERATOR.registry} label="zápis v rejstříku" />],
    ['E-mail', OPERATOR.email.trim() ? <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a> : <F v="" label="e-mail" />],
    ...(OPERATOR.phone.trim() ? [['Telefon', OPERATOR.phone] as [string, ReactNode]] : []),
  ]
  return (
    <>
      <h2>Provozovatel platformy {BRAND.name}</h2>
      <dl className="legal-dl">
        {rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      <p>
        Za obsah jednotlivých turnajů (texty, soupisky, fotografie, loga partnerů) odpovídá jejich organizátor.
        Protiprávní obsah nám prosím nahlaste na uvedený e-mail.
      </p>
      <p>
        Platforma {BRAND.name} je autorským dílem provozovatele. Její kopírování nebo napodobování bez souhlasu
        není dovoleno — podrobnosti v <L to="podminky">Podmínkách používání</L>.
      </p>
    </>
  )
}
