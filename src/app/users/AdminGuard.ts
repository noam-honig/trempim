import { AuthenticatedGuard } from 'common-ui-elements'
import { Injectable } from '@angular/core'
import { Roles } from './roles'

@Injectable()
export class AdminGuard extends AuthenticatedGuard {
  override isAllowed() {
    return true;//Roles.admin
  }
}
@Injectable()
export class SuperAdminGuard extends AuthenticatedGuard {
  override isAllowed() {
    return true;//Roles.superAdmin
  }
}
@Injectable()
export class CanSeeUsersGuard extends AuthenticatedGuard {
  override isAllowed() {
    return true;//Roles.manageDrivers
  }
}

@Injectable()
export class DraftsGuard extends AuthenticatedGuard {
  override isAllowed() {
    return true;//[Roles.dispatcher, Roles.trainee]
  }
}

@Injectable()
export class DispatchGuard extends AuthenticatedGuard {
  override isAllowed() {
    return true;//[Roles.dispatcher]
  }
}
