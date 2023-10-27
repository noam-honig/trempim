import { ValueListFieldType } from 'remult'

@ValueListFieldType({
  caption: 'סטטוס',
  defaultValue: () => taskStatus.active,
})
export class taskStatus {
  static draft = new taskStatus(-10, '📝 טיוטא')
  static relevanceCheck = new taskStatus(-5, '❔ בדיקת רלוונטיות')
  static active = new taskStatus(0, ' פתוח לרישום')
  static assigned = new taskStatus(1, '🚘 שוייך לנהג')

  static driverPickedUp = new taskStatus(4, '🚗 איסוף בוצע')

  static completed = new taskStatus(11, '✅ הושלם')
  static notRelevant = new taskStatus(21, '👎 כבר לא רלוונטי')
  static otherProblem = new taskStatus(22, '🛑 בעיה אחרת')

  constructor(public id: number, public caption: string) {}
}
