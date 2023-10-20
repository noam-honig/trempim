import { remult } from 'remult'
import { DEFAULT_NAME } from './SignInController'
import { Category } from '../events/tasks'

export function getTitle() {
  if (typeof localStorage !== 'undefined') return document.title
  return process.env['NAME'] || DEFAULT_NAME
}
export class Site {
  bikeCategoryCaption?: string
  defaultCategory = Category.delivery
  truckCategoryCaption?: string
  categories?: Category[]
}

export class BikeIlSite extends Site {
  override bikeCategoryCaption = 'שינוע באופנוע'
  override defaultCategory = Category.bike
  override truckCategoryCaption? = 'שינוע מסחרי או נגרר'
  override categories = [Category.bike, Category.truck, Category.other]
}

export function initSite(site?: string) {
  if (!site && typeof document !== 'undefined') {
    //@ts-ignore
    site = document.site
  }
  remult.context.site = new Site()
  if (site === 'bikeil') {
    remult.context.site = new BikeIlSite()
  }
}

export function getSite() {
  return remult.context.site || new Site()
}
