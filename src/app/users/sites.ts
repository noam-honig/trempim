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
  constructor(public urlPrefix: string) {}
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
  get canSeeUrgency() {
    return true
  }
  onlyCities = false
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
export class WarC extends Site {
  override showCopyLink? = true
  override allowAnyVolunteerToAdd = true
  override useFillerInfo = true
  override bikeCategoryCaption = 'שינוע באופנוע'
  override defaultCategory = Category.bike
  override categories = [Category.bike, Category.other]
}
export class WarB extends Site {
  override showCopyLink? = true
  override allowAnyVolunteerToAdd = true

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
    case 'test1':
      remult.context.site = new Hahatul(site)
      break
    case 'vdri':
      remult.context.site = new vdri(site)
      break
    case 'yedidim':
    case 'ezion':
      remult.context.site = new Yedidim(site)
      break
    case 'warc':
      remult.context.site = new WarC(site)
      break
    case 'warb':
      remult.context.site = new WarB(site)
      break
  }
}

export function getSite() {
  return remult.context.site || new Site('')
}

export const backendSites = [
  { urlPrefix: 'dshinua', dbSchema: 'dshinua', title: 'שינוע - הדגמה' },
  { urlPrefix: 'test1', dbSchema: 'bikeil', title: 'פיתוח' },
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
  { urlPrefix: 'warc', dbSchema: 'warc', title: 'נהגים מתנדבים' },
  { urlPrefix: 'warb', dbSchema: 'warb', title: 'אופנועים מתנדבים' },
]
export function getBackendSite(schema?: string) {
  if (!schema) schema = getSite().urlPrefix
  const result = backendSites.find((x) => x.urlPrefix === schema)
  return result!
}

export function getSiteFromPath(req: { path: string }) {
  return req.path.split('/')[1]
}
