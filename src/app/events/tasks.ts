import {
  IdEntity,
  Entity,
  Allow,
  EntityRef,
  FieldMetadata,
  Validators,
  ValueConverters,
  remult,
  ValueListFieldType,
  Fields,
  Field,
  Relations,
  dbNamesOf,
  SqlDatabase,
  repo,
  Remult,
  BackendMethod,
} from 'remult'
import {
  DataControl,
  DataControlInfo,
  DataControlSettings,
  GridSettings,
  RowButton,
} from '../common-ui-elements/interfaces'

import moment from 'moment'
import { Roles } from '../users/roles'
import { UITools } from '../common/UITools'
import { GeocodeResult } from '../common/address-input/google-api-helpers'
import { PhoneField, TaskContactInfo, formatPhone } from './phone'
import { User } from '../users/user'

@ValueListFieldType({
  caption: 'סטטוס',
  defaultValue: () => taskStatus.active,
})
export class taskStatus {
  static active = new taskStatus(0, 'פתוח לרישום')

  static assigned = new taskStatus(1, 'שוייך לנהג')
  static completed = new taskStatus(11, 'הושלם')
  static notRelevant = new taskStatus(21, 'כבר לא רלוונטי')
  static otherProblem = new taskStatus(22, 'בעיה אחרת')

  constructor(public id: number, public caption: string) {}
}

@ValueListFieldType({
  caption: 'קטגוריה',
  getValues: () => [
    Category.delivery,

    new Category('שינוע ציוד'),
    new Category('שינוע במשאית'),
    new Category('אחר'),
  ],
})
export class Category {
  static delivery = new Category('שינוע אנשים', 'שינוע')
  constructor(
    public caption: string,
    public id: string | undefined = undefined
  ) {
    if (!id) this.id = caption
  }
}
@Entity<Task>('tasks', {
  allowApiCrud: Roles.dispatcher,
  allowApiRead: Allow.authenticated,
  allowApiDelete: false,
  saving: (task) => {
    if (task.$.taskStatus.valueChanged()) task.statusChangeDate = new Date()
  },

  apiPrefilter: () => {
    if (remult.isAllowed(Roles.dispatcher)) return {}
    return Task.filterActiveTasks()
  },
})
export class Task extends IdEntity {
  static filterActiveTasks() {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return {
      $or: [
        {
          taskStatus: taskStatus.active,
          eventDate: { $lte: d },
        },
        { driverId: remult.user!.id!, statusChangeDate: { $lte: d } },
      ],
    }
  }

  @Fields.string<Task>({
    caption: 'כותרת',
    validate: (s, c) => Validators.required(s, c),
  })
  title = ''

  @Field(() => taskStatus, { allowApiUpdate: false })
  taskStatus: taskStatus = taskStatus.active
  @Fields.date({ allowApiUpdate: false, caption: 'סטטוס עדכון אחרון' })
  statusChangeDate = new Date()
  @Fields.string({
    caption: 'הערות',
    customInput: (x) => x.textarea(),
  })
  description = ''
  @Field(() => Category)
  category? = Category.delivery
  @Fields.dateOnly<Task>({
    caption: 'תאריך',
    validate: (s, c) => {
      if (!c.value || c.value.getFullYear() < 2018) c.error = 'תאריך שגוי'
    },
  })
  eventDate: Date = new Date()
  @Fields.string({ inputType: 'time', caption: 'שעה' })
  @DataControl({ width: '110' })
  startTime = '08:00'

  @Fields.integer({ caption: 'כמה שעות זה רלוונטי' })
  relevantHours = 12

  @Fields.json<GeocodeResult>()
  addressApiResult: GeocodeResult | null = null
  @Fields.string({
    caption: 'מיקום מוצא',
    customInput: (c) =>
      c.inputAddress(
        (result, event: Task) =>
          (event.addressApiResult = result.autoCompleteResult)
      ),
  })
  address = ''

  @Fields.json<GeocodeResult>()
  toAddressApiResult: GeocodeResult | null = null
  @Fields.string({
    caption: 'מיקום יעד',
    customInput: (c) =>
      c.inputAddress(
        (result, event: Task) =>
          (event.toAddressApiResult = result.autoCompleteResult)
      ),
  })
  toAddress = ''

  @PhoneField<Task>({ caption: 'טלפון מוצא', includeInApi: Roles.dispatcher })
  phone1 = ''
  @Fields.string({ caption: 'איש קשר מוצא', includeInApi: Roles.dispatcher })
  phone1Description = ''
  @PhoneField({ caption: 'טלפון ליעד', includeInApi: Roles.dispatcher })
  toPhone1 = ''
  @Fields.string({ caption: 'איש קשר ליעד', includeInApi: Roles.dispatcher })
  tpPhone1Description = ''

  @Fields.createdAt()
  createdAt = new Date()
  @Fields.string({ includeInApi: Roles.dispatcher, allowApiUpdate: false })
  createUserId = remult.user?.id!

  @Fields.string({ allowApiUpdate: false, caption: 'נהג' })
  driverId = ''
  @Relations.toOne<Task, User>(() => User, 'driverId')
  driver?: User
  @Fields.string({ allowApiUpdate: false })
  statusNotes = ''

  @BackendMethod({ allowed: Allow.authenticated })
  async assignToMe() {
    this.driverId = remult.user?.id!
    this.taskStatus = taskStatus.assigned
    await this.insertStatusChange('שוייך לנהג')
    await this.save()
    return this.getContactInfo()
  }
  private async insertStatusChange(what: string, notes?: string) {
    await repo(TaskStatusChanges).insert({
      taskId: this.id,
      what,
      eventStatus: this.taskStatus,
      notes,
      driverId: this.driverId,
    })
  }

  @BackendMethod({ allowed: Allow.authenticated })
  async cancelAssignment(notes: string) {
    if (this.driverId != remult.user?.id!)
      throw new Error('נסיעה זו לא משוייכת לך')
    this.driverId = ''
    this.taskStatus = taskStatus.active
    await this.insertStatusChange('נהג ביטל שיוך', notes)
    await this.save()
  }
  @BackendMethod({ allowed: Allow.authenticated })
  async noLongerRelevant(notes: string) {
    if (this.driverId != remult.user?.id!)
      throw new Error('נסיעה זו לא משוייכת לך')
    this.taskStatus = taskStatus.notRelevant
    await this.insertStatusChange(this.taskStatus.caption, notes)
    await this.save()
  }
  @BackendMethod({ allowed: Allow.authenticated })
  async otherProblem(notes: string) {
    if (this.driverId != remult.user?.id!)
      throw new Error('נסיעה זו לא משוייכת לך')
    this.taskStatus = taskStatus.otherProblem
    await this.insertStatusChange(this.taskStatus.caption, notes)
    await this.save()
  }
  @BackendMethod({ allowed: Allow.authenticated })
  async completed(notes: string) {
    if (this.driverId != remult.user?.id!)
      throw new Error('נסיעה זו לא משוייכת לך')
    this.taskStatus = taskStatus.completed
    await this.insertStatusChange(this.taskStatus.caption, notes)
    await this.save()
  }
  @BackendMethod({ allowed: Allow.authenticated })
  async statusClickedByMistake() {
    if (this.driverId != remult.user?.id! || remult.isAllowed(Roles.dispatcher))
      throw new Error('נסיעה זו לא משוייכת לך')
    this.taskStatus = taskStatus.assigned
    await this.insertStatusChange('עדכון סטטוס נלחץ בטעות')
    await this.save()
  }
  @BackendMethod({ allowed: Allow.authenticated })
  async getContactInfo(): Promise<TaskContactInfo | undefined> {
    if (Roles.dispatcher || this.driverId == remult.user?.id!)
      return {
        origin: {
          phone: this.phone1,
          formattedPhone: formatPhone(this.phone1),
          name: this.phone1Description,
        },
        target: {
          phone: this.toPhone1,
          formattedPhone: formatPhone(this.toPhone1),
          name: this.tpPhone1Description,
        },
      }
    return undefined
  }
  openEditDialog(ui: UITools, saved?: VoidFunction) {
    const e = this.$
    ui.areaDialog({
      title: 'פרטי משימה',
      fields: [
        e.category!,
        e.title,
        e.address,
        e.toAddress,
        e.description,
        e.eventDate,
        e.startTime,
        e.relevantHours,
        e.phone1,
        e.phone1Description,
        e.toPhone1,
        e.tpPhone1Description,
      ],
      ok: () => this.save().then(() => saved && saved()),
      cancel: () => {
        this._.undoChanges()
      },
      buttons: [],
    })
  }

  static rowButtons(
    ui: UITools,
    args?: {
      taskAdded?: (t: Task) => void
      taskSaved?: (t: Task) => void
    }
  ): RowButton<Task>[] {
    return [
      {
        name: 'ערוך משימה',
        click: async (e) => {
          e.openEditDialog(ui, () => args?.taskSaved?.(e))
        },
      },
      {
        name: 'היסטוריה',
        click: async (e) => {
          ui.gridDialog({
            settings: new GridSettings(repo(TaskStatusChanges), {
              where: {
                taskId: e.id,
              },
              include: {
                createUser: true,
                driver: true,
              },
              columnSettings: (x) => [
                { field: x.what, width: '130' },
                { field: x.driverId, getValue: (x) => x.driver?.name },
                x.notes,
                { field: x.createdAt, width: '220px' },
                { field: x.createUserId, getValue: (x) => x.createUser?.name },
                x.eventStatus,
              ],
            }),
            title: 'היסטורית נסיעה',
          })
        },
      },
      {
        name: 'שכפול משימה',
        click: async (oldE) => {
          const e = remult.repo(Task).create(oldE)
          e.eventDate = new Date()
          e.eventDate.setDate(e.eventDate.getDate() + 1)
          ui.areaDialog({
            title: 'שכפול משימה',
            fields: [e.$.eventDate],
            ok: async () => {
              await e.save()
              args?.taskAdded?.(e)
            },
          })
        },
      },
    ]
  }
}
export function mapFieldMetadataToFieldRef(
  e: EntityRef<any>,
  x: DataControlInfo<any>
) {
  let y = x as DataControlSettings<any, any>
  if (y.getValue) {
    return y
  }
  if (y.field) {
    return { ...y, field: e.fields.find(y.field as FieldMetadata) }
  }
  return e.fields.find(y as FieldMetadata)
}
export const day = 86400000

export function eventDisplayDate(
  e: Task,
  group = false,
  today: Date | undefined = undefined
) {
  if (e.eventDate) {
    let edd = e.eventDate
    if (!today) today = new Date()
    today = ValueConverters.DateOnly.fromJson!(
      ValueConverters.DateOnly.toJson!(new Date())
    )
    let todayJson = ValueConverters.DateOnly.toJson!(today)
    let t = today.valueOf()
    let d = edd.valueOf()
    if (d > t - day) {
      if (d < t + day)
        return `היום` + ' (' + moment(d).locale('he').format('DD/MM') + ')'
      if (d < t + day * 2)
        return 'מחר' + ' (' + moment(d).locale('he').format('DD/MM') + ')'
      if (group) {
        let endOfWeek = t - today.getDay() * day + day * 7
        if (d < endOfWeek) return 'השבוע'
        if (d < endOfWeek + day * 7) return 'שבוע הבא'
        if (edd.getFullYear() == today.getFullYear())
          return edd.toLocaleString('he', { month: 'long' })

        if (group)
          return edd.toLocaleString('he', { month: 'long', year: '2-digit' })
      }
    }
    if (group) return 'עבר'

    return moment(d).locale('he').format('DD/MM (dddd)')
  }
  if (group) return 'gcr'
  return ''
}

@Entity<TaskStatusChanges>('taskStatusChanges', {
  allowApiCrud: false,
  allowApiRead: Roles.dispatcher,
  defaultOrderBy: {
    createdAt: 'desc',
  },
})
export class TaskStatusChanges extends IdEntity {
  @Fields.string()
  taskId = ''
  @Fields.string({ caption: 'פעולה' })
  what = ''
  @Field(() => taskStatus)
  eventStatus!: taskStatus

  @Fields.string({ caption: 'הערות' })
  notes = ''
  @Fields.string({ caption: 'נהג' })
  driverId = ''
  @Relations.toOne<TaskStatusChanges, User>(() => User, 'driverId')
  driver?: User
  @Fields.string({ caption: 'בוצע ע"י' })
  createUserId = remult.user?.id!
  @Relations.toOne<TaskStatusChanges, User>(() => User, 'createUserId')
  createUser?: User
  @Fields.createdAt({ caption: 'מתי' })
  createdAt = new Date()
}
