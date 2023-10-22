import { IdEntity, remult, Fields, Entity } from 'remult'

@Entity(undefined!, { allowApiCrud: false, dbName: 'images' })
export class TaskImage extends IdEntity {
  @Fields.string()
  image = ''
  @Fields.createdAt()
  createdAt = new Date()
  @Fields.string()
  createUser = remult.user?.id
}
