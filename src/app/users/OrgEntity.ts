import { Entity, Fields, IdEntity, remult } from 'remult'
import { getBackendSite, getSite } from './sites'
import { DataControl } from '../common-ui-elements/interfaces'
import { Roles } from './roles'

@Entity<OrgEntity>(undefined!, {
  backendPrefilter: () => ({ org: getSite().visibleOrgs }),
})
export class OrgEntity extends IdEntity {
  @DataControl({
    visible: () => getSite().visibleOrgs.length > 1,
    valueList: () =>
      getSite().visibleOrgs.map((x) => ({
        id: x,
        caption: getBackendSite(x).title,
      })),
  })
  @Fields.string<OrgEntity>({
    allowApiUpdate: false,
    caption: 'ארגון',
    displayValue: (x) => getBackendSite(x.org).title,
  })
  org = getSite().org
}

export function sameOrgAdmin(e: OrgEntity) {
  return remult.isAllowed(Roles.admin) && e.org == getSite().org
}
export function readonlyForNonAdminOfSameOrg(e: OrgEntity) {
  return !sameOrgAdmin(e)
}
