import { ValueListFieldType } from 'remult'

@ValueListFieldType({ caption: 'דחיפות' })
export class Urgency {
  static normal = new Urgency(0, 'רגילה')
  static low = new Urgency(-10, 'נמוכה')
  static medium = new Urgency(10, 'בינונית')
  static high = new Urgency(20, 'גבוהה')
  static critical = new Urgency(30, 'קריטית')
  constructor(public id: number, public caption: string) {}
}
