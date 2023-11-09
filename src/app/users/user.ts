import {
  IdEntity,
  Entity,
  Validators,
  isBackend,
  Allow,
  Fields,
  remult,
  BackendMethod,
} from 'remult'
import { Roles } from './roles'
import { terms } from '../terms'
import {
  OnlyAllowIsraeliPhones,
  PhoneField,
  fixPhoneInput,
  isPhoneValidForIsrael,
} from '../events/phone'
import { UITools } from '../common/UITools'
import { DataControl } from '../common-ui-elements/interfaces'
import { CreatedAtField } from '../events/date-utils'
import { sendSms } from '../../server/send-sms'
import { getSite, getTitle } from './sites'
import { GeocodeResult } from '../common/address-input/google-api-helpers'
import { recordChanges } from '../common/change-log/change-log'
import { OrgEntity, readonlyForNonAdminOfSameOrg } from './OrgEntity'

@Entity<User>('Users', {
  allowApiRead: Allow.authenticated,
  allowApiUpdate: (user) => {
    if (user?.org != getSite().org) return false
    if (!user) return false
    if (user.canBeUpdatedByDriverManager()) return true
    return false
  },
  allowApiDelete: false,
  allowApiInsert: Roles.manageDrivers,
  defaultOrderBy: {
    name: 'asc',
  },
  apiPrefilter: () =>
    !remult.isAllowed([Roles.dispatcher, Roles.manageDrivers])
      ? { id: [remult.user?.id!] }
      : {},
  saving: async (user) => {
    if (isBackend()) {
      if (user._.isNew()) {
        user.createDate = new Date()
      }
      await recordChanges(user)
    }
  },
})
export class User extends OrgEntity {
  canBeUpdatedByDriverManager() {
    if (!remult.user) return false
    if (this.id === remult.user.id) return true
    if (remult.isAllowed(Roles.admin)) return true

    return (
      remult.isAllowed(Roles.manageDrivers) &&
      !this.admin &&
      !this.dispatcher &&
      !this.trainee
    )
  }

  @DataControl<User>({
    width: '140px',
    readonly: (e) => !e?._.apiUpdateAllowed,
  })
  @Fields.string({
    // validate: [Validators.required],
    caption: terms.username,
  })
  name = ''

  @DataControl({ width: '130px', readonly: (e) => !e?._.apiUpdateAllowed })
  @PhoneField({
    validate: [
      Validators.required,
      Validators.uniqueOnBackend,
      OnlyAllowIsraeliPhones,
    ],
    inputType: 'tel',
  })
  phone = ''
  @DataControl({ readonly: (e) => !e?._.apiUpdateAllowed })
  @Fields.string({
    caption: 'הערות מנהלים',
    includeInApi: Roles.admin,
    customInput: (x) => x.textarea(),
  })
  adminNotes = ''

  @CreatedAtField({ caption: 'תאריך יצירה' })
  createDate = new Date()

  @Fields.string({ allowApiUpdate: false, includeInApi: Roles.admin })
  createUserId = remult.user?.id || 'no user'
  @DataControl({
    width: '130px',
    readonly: readonlyForNonAdminOfSameOrg,
  })
  @Fields.boolean({
    allowApiUpdate: Roles.admin,
    caption: terms.admin,
  })
  admin = false
  @DataControl({
    width: '130px',
    readonly: readonlyForNonAdminOfSameOrg,
  })
  @Fields.boolean({
    allowApiUpdate: Roles.admin,
    caption: 'אחמ"ש מוקד',
  })
  dispatcher = false
  @DataControl({
    width: '130px',
    readonly: readonlyForNonAdminOfSameOrg,
  })
  @Fields.boolean({
    allowApiUpdate: Roles.admin,
    caption: 'מוקדן חרבות',
  })
  trainee = false
  @DataControl({
    width: '130px',
    readonly: readonlyForNonAdminOfSameOrg,
  })
  @Fields.boolean({
    allowApiUpdate: Roles.admin,
    caption: 'מנהל נהגים',
  })
  manageDrivers = false
  @DataControl({ width: '130px', readonly: (e) => !e?._.apiUpdateAllowed })
  @Fields.boolean({ caption: 'לא פעיל', allowApiUpdate: Roles.manageDrivers })
  deleted = false
  @Fields.date()
  lastUpdateView = new Date()

  @Fields.json<GeocodeResult>({ includeInApi: Roles.dispatcher })
  addressApiResult: GeocodeResult | null = null
  @Fields.string<User>({
    includeInApi: Roles.dispatcher,
    caption: 'מיקום מוצא',
    customInput: (c) =>
      c.inputAddress(
        (result, event: User) =>
          (event.addressApiResult = result.autoCompleteResult)
      ),
  })
  address = ''

  @Fields.json<User, string[]>({
    allowNull: true,
    caption: 'קטגוריות',
    dbName: 'okCategories',
    clickWithUI: (ui, user, fieldRef) => {
      ui.multiSelectValueDialog({
        values: getSite().categories,
        onSelect: (selected) => {
          user.allowedCategories = selected
        },
        selected: user.allowedCategories,
        getCaption: (x) => x,
        title: 'קטגוריות מורשות',
      })
    },
    valueConverter: {
      fromInput: (val) => val?.split(',').map((x) => x.trim()),
      toInput: (val) => val?.join(', '),
      fieldTypeInDb: 'json',
    },
  })
  allowedCategories: string[] = []

  editDialog(ui: UITools, onOk?: () => void) {
    const v = this
    ui.areaDialog({
      title: 'פרטי מתנדב',
      fields: [
        v.$.name,
        v.$.phone,
        v.$.allowedCategories,
        v.$.dispatcher,
        v.$.trainee,
        v.$.manageDrivers,
        v.$.admin,
        v.$.adminNotes,
        v.$.address,
        v.$.deleted,
      ],
      ok: async () => {
        await v.save()
        onOk?.()
      },
    })
  }
  @BackendMethod({ allowed: Roles.admin })
  async sendInviteSmsToUser(origin: string) {
    await sendSms(this.phone, this.buildInviteText(origin))
  }
  @BackendMethod({ allowed: Roles.admin })
  static async importFromExcel(users: Pick<User, 'name' | 'phone'>[]) {
    let count = 0
    for (const u of users) {
      let phone = fixPhoneInput(u.phone)
      const user = await remult.repo(User).findFirst({ phone })
      if (user) {
        if (!user.name && u.name) {
          user.name = u.name
          await user.save()
        }
      } else {
        if (isPhoneValidForIsrael(phone)) {
          count++
          await remult.repo(User).insert({ name: u.name, phone })
        }
      }
    }
    return `נוספו ${count} משתמשים`
  }

  buildInviteText(origin: string): string {
    return `שלום ${this.name},
כדי להכנס למערכת השינועים של ${getTitle()} אנא הכנס לקישור הבא:
${origin}`
  }
}
