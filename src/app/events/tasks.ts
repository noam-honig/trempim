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
  EntityFilter,
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
import { PhoneField, TaskContactInfo, formatPhone, phoneConfig } from './phone'
import { User } from '../users/user'
import { Locks } from './locks'

@ValueListFieldType({
  caption: 'סטטוס',
  defaultValue: () => taskStatus.active,
})
export class taskStatus {
  static active = new taskStatus(0, 'פתוח לרישום')

  static assigned = new taskStatus(1, '🚘 שוייך לנהג')
  static completed = new taskStatus(11, '✅ הושלם')
  static notRelevant = new taskStatus(21, '👎 כבר לא רלוונטי')
  static otherProblem = new taskStatus(22, '🛑 בעיה אחרת')

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
  static delivery = new Category('שינוע חיילים', 'שינוע')
  constructor(
    public caption: string,
    public id: string | undefined = undefined
  ) {
    if (!id) this.id = caption
  }
}
@Entity<Task>('tasks', {
  allowApiInsert: [Roles.dispatcher, Roles.trainee],
  allowApiUpdate: (t) => {
    if (t!.draft) return remult.isAllowed([Roles.trainee, Roles.dispatcher])
    return remult.isAllowed(Roles.dispatcher)
  },
  allowApiRead: Allow.authenticated,
  allowApiDelete: false,
  saving: async (task) => {
    if (!remult.isAllowed(Roles.dispatcher) && task.isNew()) task.draft = true
    if (task.$.taskStatus.valueChanged()) task.statusChangeDate = new Date()
    if (task.isNew() && !task.externalId)
      task.externalId = (
        await SqlDatabase.getDb().execute("select nextval('task_seq')")
      ).rows[0].nextval
    if (
      task.$.eventDate.valueChanged() ||
      task.$.startTime.valueChanged() ||
      task.$.relevantHours.valueChanged()
    ) {
      task.validUntil = calcValidUntil(
        task.eventDate,
        task.startTime,
        task.relevantHours
      )
    }
  },
  validation: (task) => {
    if (phoneConfig.disableValidation) return
    if (!task.addressApiResult?.results) task.$.address.error = 'כתובת לא נמצאה'
    if (!task.toAddressApiResult?.results)
      task.$.toAddress.error = 'כתובת לא נמצאה'
  },
  //@ts-ignore
  apiPrefilter: () => {
    if (remult.isAllowed(Roles.dispatcher)) return {}
    if (remult.isAllowed(Roles.trainee))
      return {
        $or: [
          {
            draft: true,
            createUser: remult.user!.id,
          },
          Task.filterActiveTasks(),
        ],
      }

    // {
    //   $or: [
    //     { draft: true, createUser: remult.user!.id },
    //     Task.filterActiveTasks,
    //   ],
    // }
    return Task.filterActiveTasks()
  },
})
export class Task extends IdEntity {
  static filterActiveTasks(): EntityFilter<Task> {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return {
      draft: false,
      $or: [
        {
          taskStatus: taskStatus.active,
        },
        {
          driverId: remult.user!.id!,
          taskStatus: taskStatus.assigned,
        },
        { driverId: remult.user!.id!, statusChangeDate: { $gte: d } },
      ],
    }
  }

  @Fields.string<Task>({
    caption: 'מה משנעים',
    validate: (s, c) => Validators.required(s, c),
  })
  title = ''

  @Field(() => taskStatus, { allowApiUpdate: false })
  taskStatus: taskStatus = taskStatus.active
  @DataControl({ width: '240' })
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
  @DataControl({ width: '240' })
  @Fields.date({ caption: 'בתוקף עד', allowApiUpdate: false })
  validUntil = new Date()

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

  @PhoneField<Task>({
    caption: 'טלפון מוצא',
    includeInApi: [Roles.trainee, Roles.dispatcher],
    //validate: Validators.required,
  })
  phone1 = ''
  @Fields.string({
    caption: 'איש קשר מוצא',
    includeInApi: [Roles.trainee, Roles.dispatcher],
  })
  phone1Description = ''
  @PhoneField({
    caption: 'טלפון ליעד',
    includeInApi: [Roles.trainee, Roles.dispatcher],
  })
  toPhone1 = ''
  @Fields.string({
    caption: 'איש קשר ליעד',
    includeInApi: [Roles.trainee, Roles.dispatcher],
  })
  tpPhone1Description = ''

  @Fields.createdAt()
  createdAt = new Date()
  @Fields.string<Task>({
    includeInApi: Roles.dispatcher,
    allowApiUpdate: false,
    caption: 'משתמש מוסיף',
    displayValue: (u) => u.createUser?.name || '',
  })
  createUserId = remult.user?.id!
  @Relations.toOne<Task, User>(() => User, 'createUserId')
  createUser?: User

  @Fields.string({
    allowApiUpdate: false,
    caption: 'נהג',
    displayValue: (u) => u.createUser?.name || '',
  })
  driverId = ''
  @Relations.toOne<Task, User>(() => User, 'driverId')
  driver?: User
  @Fields.string({ allowApiUpdate: false })
  statusNotes = ''
  @Fields.string({ caption: 'מזהה נסיעה' })
  externalId = ''
  @Fields.boolean({ caption: 'טיוטה', allowApiUpdate: [Roles.dispatcher] })
  draft = false

  @BackendMethod({ allowed: Allow.authenticated })
  async assignToMe() {
    if (
      (await repo(Task).count({
        driverId: remult.user!.id!,
        taskStatus: taskStatus.assigned,
      })) >= 5
    )
      throw Error('ניתן להרשם במקביל לעד 5 נסיעות')
    const assignedChangeType = 'שוייך לנהג'
    if (
      (await repo(TaskStatusChanges).count({
        driverId: remult.user!.id!,
        what: assignedChangeType,
        createdAt: {
          $gt: new Date(new Date().getTime() - 1000 * 60 * 60),
        },
      })) >= 7
    ) {
      throw Error('ניתן להרשם לעד 7 נסיעות בשעה')
    }
    await this._.reload()
    if (this.driverId) throw Error('מתנדב אחר כבר לקח משימה זו')
    this.driverId = remult.user!.id!
    this.taskStatus = taskStatus.assigned
    await this.insertStatusChange(assignedChangeType)
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
    this.statusNotes = notes
    await this.insertStatusChange('נהג ביטל שיוך', notes)
    await this.save()
  }
  @BackendMethod({ allowed: Allow.authenticated })
  async noLongerRelevant(notes: string) {
    if (!notes) throw Error('אנא הזן הערות, שנדע מה קרה')
    if (
      this.driverId != remult.user?.id! &&
      !(
        !this.driverId &&
        remult.isAllowed(Roles.dispatcher) &&
        this.taskStatus === taskStatus.active
      )
    )
      throw new Error('נסיעה זו לא משוייכת לך')
    this.taskStatus = taskStatus.notRelevant
    this.statusNotes = notes
    await this.insertStatusChange(this.taskStatus.caption, notes)
    await this.save()
  }
  @BackendMethod({ allowed: Roles.dispatcher })
  async returnToDriver() {
    if (!this.driverId) throw Error('לא נמצא נהג')
    this.taskStatus = taskStatus.assigned
    await this.insertStatusChange('מוקדן החזיר לנהג', 'על ידי מוקדן')
    await this.save()
  }
  @BackendMethod({ allowed: Roles.dispatcher })
  async returnToActive() {
    this.driverId = ''
    this.taskStatus = taskStatus.active
    await this.insertStatusChange('מוקדן החזיר לפעיל', 'על ידי מוקדן')
    await this.save()
  }
  @BackendMethod({ allowed: Allow.authenticated })
  async otherProblem(notes: string) {
    if (!notes) throw Error('אנא הזן הערות, שנדע מה קרה')
    if (this.driverId != remult.user?.id!)
      throw new Error('נסיעה זו לא משוייכת לך')
    this.taskStatus = taskStatus.otherProblem
    this.statusNotes = notes
    await this.insertStatusChange(this.taskStatus.caption, notes)
    await this.save()
  }
  @BackendMethod({ allowed: Allow.authenticated })
  async completed(notes: string) {
    if (this.driverId != remult.user?.id!)
      throw new Error('נסיעה זו לא משוייכת לך')
    this.taskStatus = taskStatus.completed
    this.statusNotes = notes
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

  async openEditDialog(ui: UITools, saved?: VoidFunction) {
    const doLocks = !this.isNew()
    if (doLocks)
      try {
        await Locks.lock(this.id, false)
      } catch (err: any) {
        if (remult.isAllowed(Roles.admin)) {
          if (await ui.yesNoQuestion(err.message + ', לפתוח בכל זאת?')) {
            await Locks.lock(this.id, true)
          } else return
        } else {
          ui.error(err.message)
          return
        }
      }

    const e = this.$
    ui.areaDialog({
      title: 'פרטי נסיעה',
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
        e.draft,
        e.externalId,
      ],
      ok: () =>
        this.save().then(() => {
          saved?.()
          if (doLocks) Locks.unlock(this.id)
        }),
      cancel: () => {
        this._.undoChanges()
        if (doLocks) Locks.unlock(this.id)
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
        name: 'ערוך נסיעה',
        icon: 'edit',
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
                { field: x.createdAt, width: '240px' },
                { field: x.createUserId, getValue: (x) => x.createUser?.name },
                x.eventStatus,
              ],
            }),
            title: 'היסטורית נסיעה',
          })
        },
      },
      {
        name: 'סמן כלא רלוונטי',
        icon: 'thumb_down',
        visible: (e) =>
          [taskStatus.active, taskStatus.assigned].includes(e.taskStatus),
        click: async (e) => {
          if (e.taskStatus === taskStatus.active)
            await e.noLongerRelevant('על ידי מוקדן')
        },
      },
      {
        name: 'החזר לנהג',
        icon: 'badge',
        visible: (e) =>
          ![taskStatus.active, taskStatus.assigned].includes(e.taskStatus) &&
          e.driverId !== '',

        click: async (e) => {
          await e.returnToDriver()
        },
      },
      {
        name: 'החזר לפתוח לרישום',
        icon: 'check_circle',

        visible: (e) => ![taskStatus.active].includes(e.taskStatus),
        click: async (e) => {
          await e.returnToActive()
        },
      },
      {
        name: 'שכפול נסיעה',
        click: async (oldE) => {
          const e = remult.repo(Task).create(oldE)
          e.eventDate = new Date()
          e.eventDate.setDate(e.eventDate.getDate() + 1)
          ui.areaDialog({
            title: 'שכפול נסיעה',
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
export function calcValidUntil(
  date: Date,
  startTime: string,
  validUntil: number
) {
  const hours = +startTime.substring(0, 2)
  const minutes = +startTime.substring(3, 5)
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours + validUntil,
    minutes
  )
}
