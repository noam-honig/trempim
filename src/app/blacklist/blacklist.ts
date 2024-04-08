import {
  IdEntity,
  Entity,
  Validators,
  isBackend,
  Allow,
  Fields,
  remult,
} from 'remult'
import {
  OnlyAllowIsraeliPhones,
  PhoneField,
} from '../events/phone'
import { UITools } from '../common/UITools'
import { DataControl } from '../common-ui-elements/interfaces'
import { CreatedAtField, DateField } from '../events/date-utils'
import { recordChanges } from '../common/change-log/change-log'
import { Roles } from '../users/roles'
@Entity<Blacklist>('Blacklist', {
  allowApiRead: Allow.authenticated,
  allowApiUpdate: (banned) => {
    return remult.isAllowed(Roles.admin)

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
  saving: async (row) => {
    if (isBackend()) {
      if (row._.isNew()) {
        row.createDate = new Date()
      }
      await recordChanges(row)
    }
  },
})
export class Blacklist extends IdEntity {
  @DataControl<Blacklist>({
    width: '140px',
  })
  @Fields.string({
    caption: 'שם החסום',
    includeInApi: Roles.admin,
  })
  name = ''

  @DataControl({ width: '130px' })
  @PhoneField({
    validate: [
      Validators.required,
      Validators.uniqueOnBackend,
      OnlyAllowIsraeliPhones,
    ],
    inputType: 'tel',
    includeInApi: Roles.admin,
  })
  phone = ''

  @DataControl({ readonly: (e) => !e?._.apiUpdateAllowed })
  @Fields.string({
    caption: 'האדמין המטפל',
    includeInApi: Roles.admin,
  })
  addedBy = ''

  @DateField({ caption: 'צאריך האירוע המכונן' })
  incidentDate = new Date()

  @DataControl({ readonly: (e) => !e?._.apiUpdateAllowed })
  @Fields.string({
    caption: 'תאור אירוע קצר',
    includeInApi: Roles.admin,
    customInput: (x) => x.textarea(),
  })
  adminNotes = ''

  @CreatedAtField({
    caption: 'תאריך יצירה',
    includeInApi: Roles.admin,
  })
  createDate = new Date()

  editDialog(ui: UITools, onOk?: () => void) {
    const v = this
    ui.areaDialog({
      title: 'פרטי מתנדב',
      fields: [
        v.$.name,
        v.$.phone,
        v.$.addedBy,
        v.$.incidentDate,
        v.$.adminNotes,
      ],
      ok: async () => {
        await v.save()
        onOk?.()
      },
    })
  }

}
