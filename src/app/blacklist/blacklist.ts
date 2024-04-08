import {
  IdEntity,
  Entity,
  Validators,
  isBackend,
  Allow,
  Fields,
  remult, BackendMethod
} from 'remult'
import {
  OnlyAllowIsraeliPhones,
  PhoneField,
} from '../events/phone'
import { UITools } from '../common/UITools'
import { DataControl } from '../common-ui-elements/interfaces'
import { CreatedAtField, DateField, formatDate } from '../events/date-utils'
import { recordChanges } from '../common/change-log/change-log'
import { Roles } from '../users/roles'
import { sendSms } from '../../server/send-sms'

@Entity<Blacklist>('Blacklist', {
  allowApiRead: Roles.admin,
  allowApiUpdate: (banned) => {
    return remult.isAllowed(Roles.admin)

  },
  allowApiDelete: Roles.admin,
  allowApiInsert: Roles.admin,
  defaultOrderBy: {
    name: 'asc',
  },
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

  @DataControl({ width: '240' })
  @Fields.dateOnly<Blacklist>({
    caption: 'תאריך האירוע המכונן',
    displayValue: (_, d) => formatDate(d),
  })
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
      title: 'ערוך',
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
