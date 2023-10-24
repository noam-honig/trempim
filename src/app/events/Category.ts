import { ValueListFieldType } from 'remult'
import { getSite } from '../users/sites'

@ValueListFieldType({
  caption: 'קטגוריה',
  getValues: () =>
    getSite().categories || [
      Category.delivery,

      new Category('שינוע ציוד'),
      new Category('שינוע ברכב מסחרי / נגרר'),
      Category.truck,

      Category.bike,
      new Category('שינוע רכב'),
      Category.other,
    ],
})
export class Category {
  static delivery = new Category('שינוע חיילים', 'שינוע')
  static bike = new Category(
    'מתאים גם לאופנוע',
    undefined,
    () => getSite().bikeCategoryCaption
  )
  static truck = new Category(
    'שינוע במשאית',
    undefined,
    () => getSite().truckCategoryCaption
  )

  static other = new Category('אחר')
  _caption: string
  constructor(
    caption: string,
    public id: string | undefined = undefined,
    private getCaption?: () => string | undefined
  ) {
    this._caption = caption
    if (!id) this.id = caption
  }
  get caption() {
    return this.getCaption?.() || this._caption
  }
}
