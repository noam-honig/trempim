import { IdEntity, remult, Fields, Entity } from 'remult'
import { getCurrentUserId } from '../users/user'

@Entity(undefined!, { allowApiCrud: false, dbName: 'images' })
export class TaskImage extends IdEntity {
  @Fields.string()
  image = ''
  @Fields.createdAt()
  createdAt = new Date()
  @Fields.string()
  createUser = getCurrentUserId()
}
