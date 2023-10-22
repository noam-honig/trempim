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
import { PhoneField } from '../events/phone'
import { UITools } from '../common/UITools'
import { DataControl } from '../common-ui-elements/interfaces'
import { CreatedAtField } from '../events/date-utils'
import { sendSms } from '../../server/send-sms'
import { getTitle } from './sites'
import { GeocodeResult } from '../common/address-input/google-api-helpers'

@Entity<User>('Users', {
  allowApiRead: Allow.authenticated,
  allowApiUpdate: Allow.authenticated,
  allowApiDelete: false,
  allowApiInsert: Roles.admin,
  defaultOrderBy: {
    name: 'asc',
  },
  apiPrefilter: () =>
    !remult.isAllowed(Roles.dispatcher) ? { id: [remult.user?.id!] } : {},
  saving: async (user) => {
    if (isBackend()) {
      if (user._.isNew()) {
        user.createDate = new Date()
      }
    }
  },
})
export class User extends IdEntity {
  @DataControl({ width: '130px' })
  @Fields.string({
    validate: [Validators.required],
    caption: terms.username,
  })
  name = ''

  @DataControl({ width: '130px' })
  @PhoneField({
    validate: [Validators.required, Validators.uniqueOnBackend],
    inputType: 'tel',
  })
  phone = ''
  @Fields.string({
    caption: 'הערות מנהלים',
    includeInApi: Roles.admin,
    customInput: (x) => x.textarea(),
  })
  adminNotes = ''

  @CreatedAtField()
  createDate = new Date()

  @Fields.string({ allowApiUpdate: false, includeInApi: Roles.admin })
  createUserId = remult.user?.id || 'no user'
  @DataControl({ width: '130px' })
  @Fields.boolean({
    allowApiUpdate: Roles.admin,
    caption: terms.admin,
  })
  admin = false
  @DataControl({ width: '130px' })
  @Fields.boolean({
    allowApiUpdate: Roles.admin,
    caption: 'אחמ"ש מוקד',
  })
  dispatcher = false
  @DataControl({ width: '130px' })
  @Fields.boolean({
    allowApiUpdate: Roles.admin,
    caption: 'מוקדן חרבות',
  })
  trainee = false
  @DataControl({ width: '130px' })
  @Fields.boolean({ caption: 'לא פעיל', allowApiUpdate: Roles.admin })
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

  editDialog(ui: UITools, onOk?: () => void) {
    const v = this
    ui.areaDialog({
      title: 'פרטי מתנדב',
      fields: [
        v.$.name,
        v.$.phone,
        v.$.dispatcher,
        v.$.trainee,
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

  buildInviteText(origin: string): string {
    return `שלום ${this.name},
כדי להכנס למערכת השינועים של ${getTitle()} אנא הכנס לקישור הבא:
${origin}`
  }
}
