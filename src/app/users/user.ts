import {
  IdEntity,
  Entity,
  Validators,
  isBackend,
  Allow,
  Fields,
  remult,
} from 'remult'
import { Roles } from './roles'
import { terms } from '../terms'
import { PhoneField } from '../events/phone'
import { UITools } from '../common/UITools'
import { DataControl } from '../common-ui-elements/interfaces'

@Entity<User>('Users', {
  allowApiRead: Allow.authenticated,
  allowApiUpdate: Allow.authenticated,
  allowApiDelete: false,
  allowApiInsert: Roles.admin,
  apiPrefilter: () =>
    !remult.isAllowed(Roles.admin) ? { id: [remult.user?.id!] } : {},
  saving: async (user) => {
    if (isBackend()) {
      if (user._.isNew()) {
        user.createDate = new Date()
      }
    }
  },
})
export class User extends IdEntity {
  @DataControl({ width: '110px' })
  @Fields.string({
    validate: [Validators.required],
    caption: terms.username,
  })
  name = ''

  @DataControl({ width: '110px' })
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

  @Fields.createdAt()
  createDate = new Date()

  @Fields.string({ allowApiUpdate: false, includeInApi: Roles.admin })
  createUserId = remult.user?.id || 'no user'

  @Fields.boolean({
    allowApiUpdate: Roles.admin,
    caption: terms.admin,
  })
  admin = false
  @Fields.boolean({
    allowApiUpdate: Roles.admin,
    caption: 'מוקדן',
  })
  dispatcher = false
  @Fields.boolean({
    allowApiUpdate: Roles.admin,
    caption: 'מתלמד',
  })
  trainee = false

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
      ],
      ok: async () => {
        await v.save()
        onOk?.()
      },
    })
  }
}
