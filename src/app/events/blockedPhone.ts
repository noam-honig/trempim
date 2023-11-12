import { Entity, Fields } from 'remult'
import { getSite } from '../users/sites'

@Entity<BlockedPhone>(undefined!, {
  dbName: 'shinuim.blockedPhones',
  allowApiCrud: false,
  id: { phone: true },
})
export class BlockedPhone {
  @Fields.string()
  phone = ''
  @Fields.createdAt()
  createdAt = new Date()
  @Fields.string()
  org = getSite().org
}
