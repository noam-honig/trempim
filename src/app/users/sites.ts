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
  return (title = process.env['NAME'] || DEFAULT_NAME)
}
export class Site {
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
  get canSeeUrgency() {
    return true
  }
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
  }
  remult.context.site = new Site()
  switch (site) {
    case 'bikeil':
      remult.context.site = new BikeIlSite()
      break
    case 'hahatul':
    case '!!!ORG!!!':
      remult.context.site = new Hahatul()
      break
    case 'yedidim':
    case 'ezion':
      remult.context.site = new Yedidim()
      break
  }
}

export function getSite() {
  return remult.context.site || new Site()
}
