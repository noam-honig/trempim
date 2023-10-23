import { UserInfo, remult, repo } from 'remult'
import type { Request } from 'express'
import type from 'cookie-session' //needed for build - do not remove
import { User } from '../app/users/user'
import { Site } from '../app/users/sites'
import { Roles } from '../app/users/roles'

declare module 'remult' {
  export interface RemultContext {
    session: CookieSessionInterfaces.CookieSessionObject
    sessionOptions: CookieSessionInterfaces.CookieSessionOptions
    site: Site
  }
}

export async function initRequest(req: Request) {
  remult.context.session = req.session!
  remult.context.sessionOptions = req.sessionOptions
  const sessionUser = req.session!['user']
  const user = await repo(User).findFirst({
    id: [sessionUser.id],
    deleted: false,
  })
  return setSessionUserBasedOnUserRow(user)
}

export function setSessionUser(user: UserInfo, remember?: boolean): UserInfo {
  const current = remult.context.session['user']
  if (JSON.stringify(user) != JSON.stringify(current))
    remult.context.session['user'] = user
  if (remember) remult.context.sessionOptions.maxAge = 365 * 24 * 60 * 60 * 1000 //remember for a year
  remult.user = user
  return user
}

export function setSessionUserBasedOnUserRow(user: User, remember?: boolean) {
  const roles: string[] = []
  if (user.admin) {
    roles.push(Roles.admin)
    roles.push(Roles.dispatcher)
    roles.push(Roles.trainee)
  } else if (user.dispatcher) {
    roles.push(Roles.dispatcher)
    roles.push(Roles.trainee)
  } else if (user.trainee) roles.push(Roles.trainee)
  return setSessionUser(
    {
      id: user.id,
      name: user.name,
      phone: user.phone,
      roles,
    },
    remember
  )
}
