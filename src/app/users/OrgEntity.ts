import { Entity, Fields, IdEntity, remult } from 'remult'
import { getBackendSite, getSite, getSiteByOrg } from './sites'
import { DataControl } from '../common-ui-elements/interfaces'
import { Roles } from './roles'

@Entity<OrgEntity>(undefined!, {
  backendPrefilter: () => ({
    org: remult.context.disableOrgFiltering
      ? undefined
      : getSite()
          .getVisibleOrgs()
          .map((x) => x.org),
  }),
})
export class OrgEntity extends IdEntity {
  @DataControl({
    visible: () => getSite().getVisibleOrgs.length > 1,
    valueList: () =>
      getSite()
        .getVisibleOrgs()
        .map((x) => ({
          id: x.org,
          caption: x.title,
        })),
  })
  @Fields.string<OrgEntity>({
    allowApiUpdate: false,
    caption: 'ארגון',
    displayValue: (x) => getSiteByOrg(x.org)?.title,
  })
  org = getSite().org
}

export function sameOrgAdmin(e: OrgEntity) {
  return remult.isAllowed(Roles.admin) && e.org == getSite().org
}
export function readonlyForNonAdminOfSameOrg(e: OrgEntity) {
  return !sameOrgAdmin(e)
}
