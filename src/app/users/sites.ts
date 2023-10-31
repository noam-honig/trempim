import { remult } from 'remult'
import { DEFAULT_NAME } from './SignInController'
import { Category } from '../events/Category'
import { Roles } from './roles'
import { taskStatus } from '../events/taskStatus'
import { UpdateMessage } from '../events/UpdatesChannel'
import { DriverCanceledAssign } from '../events/tasks'

let title = ''
export function getTitle() {
  if (title) return title
  if (typeof localStorage !== 'undefined') return (title = document.title)
  return getBackendSite()!.title
}
export class Site {
  getIntroText() {
    return `ברוכים הבאים לאפליקציית השינועים של ${getTitle()}.

כאן תוכלו למצוא את השינועים הכי נוחים והכי קרובים אליכם, ולסייע באופן
משמעותי למאמץ המשותף של כולנו
`
  }
  constructor(public urlPrefix: string) {}
  secondAddressRequired = true
  countUpdates = true
  useFillerInfo = false
  allowAnyVolunteerToAdd? = false
  sendSmsOnNewDraft = false
  showInfoSnackbarFor(message: UpdateMessage) {
    return true
  }
  bikeCategoryCaption?: string
  defaultCategory = Category.delivery
  truckCategoryCaption?: string
  categories?: Category[]
  showCopyLink?: boolean
  imageIsMandatory?: boolean
  showTwoContacts = true
  fromAddressName?: string
  toAddressName?: string
  addressInstructions?: string
  driverCanMarkAsNonRelevant = true
  get canSeeUrgency() {
    return true
  }
  onlyCities = false
  syncWithMonday = false
}

export class BikeIlSite extends Site {
  override bikeCategoryCaption = 'שינוע באופנוע'
  override defaultCategory = Category.bike
  override truckCategoryCaption? = 'שינוע מסחרי או נגרר'
  override categories = [Category.bike, Category.truck, Category.other]
  override showCopyLink? = true
  override imageIsMandatory? = true
  override useFillerInfo = true
  override allowAnyVolunteerToAdd = true
  override sendSmsOnNewDraft = true
}

export class Hahatul extends Site {
  override showCopyLink? = true
  override allowAnyVolunteerToAdd = true
  override sendSmsOnNewDraft = true
  override useFillerInfo = true
}
export class WarRoomCars extends Site {
  override showCopyLink? = true
  override allowAnyVolunteerToAdd = true
  override useFillerInfo = true
  override driverCanMarkAsNonRelevant = false
  override defaultCategory = Category.equipment
  override syncWithMonday = true
}

export class Showers extends Site {
  static shower = new Category('מקלחות ניידות')
  override secondAddressRequired = false
  override defaultCategory = Showers.shower
  override categories = [
    Showers.shower,
    new Category('רכב גורר עד 3.5 טון'),
    new Category('רכב גורר מעל 3.5 טון'),
  ]
}
export class WarRoomBikes extends Site {
  override showCopyLink? = true
  override allowAnyVolunteerToAdd = true
  override defaultCategory = Category.bike
  override bikeCategoryCaption = 'שינוע באופנוע'
  override categories = [Category.bike, Category.other]
  override useFillerInfo = true
}
export class vdri extends Site {
  override showCopyLink? = true
  override allowAnyVolunteerToAdd = true
  override showTwoContacts = false
  override fromAddressName = 'ישוב מוצא'
  override toAddressName = 'ישוב יעד'
  override addressInstructions? =
    'אין למלא כתובות מדויקות או בסיסים, יש לרשום רק את העיר.'
  override onlyCities = true
}
export class Yedidim extends Site {
  override countUpdates = false
  override get canSeeUrgency() {
    return remult.isAllowed(Roles.admin)
  }
  override getIntroText(): string {
    return `ברוכים הבאים למערכת השינועים של ידידים!

כאן תוכלו להתעדכן באירועי שינוע ולסייע בהסעת חיילים לבסיסים, בשינוע ציוד לחיילים או בשינועים שונים הנדרשים לכוחות העורף.

המענה שלכם יסייע באופן משמעותי למאמץ המלחמתי כעוגן האזרחי של ישראל.

במידה ונתקלתם בבעיה בהתחברות למערכת יש לפנות למנהל הסניף, או להתקשר למוקד הכוננים במספר [077-600-1230](tel:077-600-1230) שלוחה 1.

צאו לעשות חסדים!`
  }
  override showInfoSnackbarFor(message: UpdateMessage): boolean {
    if (message.userId === remult.user?.id) return false
    if ([DriverCanceledAssign].includes(message.action)) return true
    if (
      [taskStatus.draft, taskStatus.otherProblem]
        .map((x) => x.id)
        .includes(message.status)
    )
      return true
    return false
  }
}

export function initSite(site?: string) {
  if (!site && typeof document !== 'undefined') {
    //@ts-ignore
    site = document.site
    if (site === '!!!ORG!!!') {
      //@ts-ignore
      site = document.location.pathname.split('/')[1]
    }
  }
  remult.context.site = new Site(site!)
  switch (site) {
    case 'bikeil':
      remult.context.site = new BikeIlSite(site)
      break
    case 'hahatul':
    case 'dshinua':
    case 'ngim':
    case 'mgln':
      remult.context.site = new Hahatul(site)
      break
    case 'vdri':
      remult.context.site = new vdri(site)
      break
    case 'yedidim':
    case 'ezion':
    case 'y':
    case 'test1':
      remult.context.site = new Yedidim(site)
      break
    case 'wrc':
      remult.context.site = new WarRoomCars(site)
      break
    case 'wrb':
      remult.context.site = new WarRoomBikes(site)
      break
    case 'showers':
      remult.context.site = new Showers(site)
      break
  }
}

export function getSite() {
  return remult.context.site || new Site('')
}

export const backendSites = [
  { urlPrefix: 'dshinua', dbSchema: 'dshinua', title: 'שינוע - הדגמה' },
  { urlPrefix: 'test1', dbSchema: 'yedidim', title: 'פיתוח' },
  {
    urlPrefix: 'hahatul',
    dbSchema: 'hahatul',
    title: 'עמותת החתול – בוגרי 669',
  },
  { urlPrefix: 'lev1', dbSchema: 'lev1', title: 'לב אחד שינועים' },
  { urlPrefix: 'bikeil', dbSchema: 'bikeil', title: 'חמל אופנועים' },
  { urlPrefix: 'vdri', dbSchema: 'vdri', title: 'חמ"ל נהגים מתנדבים ארצי' },
  { urlPrefix: 'y', dbSchema: 'ezion', title: 'ידידים' },
  { urlPrefix: 'ezion', dbSchema: 'ezion', title: 'ידידים' },
  { urlPrefix: 'brdls', dbSchema: 'brdls', title: 'ברדלס' },
  { urlPrefix: 'ngim', dbSchema: 'ngim', title: 'חמל נהגים' },
  { urlPrefix: 'mgln', dbSchema: 'mgln', title: 'ידידי מגלן' },
  { urlPrefix: 'wrc', dbSchema: 'wrc', title: 'נהגים מתנדבים' },
  { urlPrefix: 'wrb', dbSchema: 'wrb', title: 'אופנועים מתנדבים' },
  { urlPrefix: 'showers', dbSchema: 'showers', title: 'מקלחות ניידות לשטח' },
]
export function getBackendSite(schema?: string) {
  if (!schema) schema = getSite().urlPrefix
  const result = backendSites.find((x) => x.urlPrefix === schema)
  return result!
}

export function getSiteFromPath(req: { path: string }) {
  return req.path.split('/')[1]
}
