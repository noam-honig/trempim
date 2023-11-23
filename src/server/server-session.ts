import { Entity, Field, Fields, UserInfo, remult, repo } from 'remult'
import type { Request } from 'express'
import type from 'cookie-session' //needed for build - do not remove
import { User } from '../app/users/user'
import { Site, getSite, getSiteByOrg } from '../app/users/sites'
import { Roles } from '../app/users/roles'

declare module 'remult' {
  export interface RemultContext {
    session: CookieSessionInterfaces.CookieSessionObject
    sessionOptions: CookieSessionInterfaces.CookieSessionOptions
    sessionId: string
    origin: string
    site: Site
    availableTaskIds: string[]
    disableOrgFiltering?: boolean
  }
}

export async function initRequestUser(req: Request) {
  remult.context.session = req.session!
  remult.context.sessionOptions = req.sessionOptions
  if (!req.session!['sessionID']) {
    req.session!['sessionID'] = (
      await repo(Session).insert({ headers: req.headers, ip: req.ip })
    ).id
  }
  remult.context.sessionId = req.session!['sessionID']

  remult.context.availableTaskIds =
    req.session!['availableTaskIds'] || (req.session!['availableTaskIds'] = [])
  const sessionUser = req.session!['user']
  if (!sessionUser || !sessionUser.id) return
  const user = await repo(User).findFirst({
    id: sessionUser!.id,
    deleted: false,
  })
  await setSessionUserBasedOnUserRow(user)
}

export function setSessionUser(user: UserInfo, remember?: boolean): UserInfo {
  const current = remult.context.session['user']
  if (JSON.stringify(user) != JSON.stringify(current))
    remult.context.session['user'] = user
  if (remember) {
    remult.context.sessionOptions.maxAge = 365 * 24 * 60 * 60 * 1000 //remember for a year
  }
  remult.user = user
  return user
}

export async function setSessionUserBasedOnUserRow(
  user: User,
  remember?: boolean
) {
  if (!user) {
    return setSessionUser(undefined!, true)
  }
  const roles: string[] = []
  if (user.org === getSite().org) {
    if (user.admin) {
      roles.push(Roles.admin)
      roles.push(Roles.dispatcher)
      roles.push(Roles.trainee)
      roles.push(Roles.manageDrivers)
    } else if (user.dispatcher) {
      roles.push(Roles.dispatcher)
      roles.push(Roles.trainee)
    } else if (user.trainee) roles.push(Roles.trainee)
    if (user.manageDrivers) roles.push(Roles.manageDrivers)
  }
  if (
    (getSite().urlPrefix === 'dshinua' || getSite().urlPrefix === 'test1') &&
    user.admin &&
    ['0507330590', '0523307014'].includes(user.phone)
  )
    roles.push(Roles.superAdmin)
  remult.context.disableOrgFiltering = true
  try {
    const userInstances = await repo(User).find({
      where: {
        phone: user.phone,
        deleted: false,
      },
    })
    let orgs: UserInfo['orgs'] = []
    for (const u of userInstances) {
      orgs.push(
        ...getSiteByOrg(u.org)
          .getVisibleOrgs()
          .map((x) => ({ org: x.org, userId: u.id }))
      )
    }
    return setSessionUser(
      {
        id: user.id,
        name: user.name,
        phone: user.phone,
        roles,
        allowedCategories: user.allowedCategories,
        orgs,

        showAllOrgs: user.showAllOrgs,
      },
      remember
    )
  } finally {
    remult.context.disableOrgFiltering = false
  }
}

@Entity('session', { allowApiCrud: false })
export class Session {
  @Fields.cuid()
  id = ''
  @Fields.createdAt()
  createdAt = new Date()
  @Fields.string()
  ip = ''
  @Fields.json()
  headers: any
}
