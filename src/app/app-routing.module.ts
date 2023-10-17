import { CommonUIElementsModule } from 'common-ui-elements'
import { NgModule, ErrorHandler } from '@angular/core'
import { Routes, RouterModule } from '@angular/router'
import { UsersComponent } from './users/users.component'
import { AdminGuard, DraftsGuard } from './users/AdminGuard'
import { ShowDialogOnErrorErrorHandler } from './common/UIToolsService'
import { terms } from './terms'
import { OrgEventsComponent } from './events/org-events.component'
import { NoamTestComponent } from './noam-test/noam-test.component'
import { DraftOverviewComponent } from './draft-overview/draft-overview.component'

const defaultRoute = 'נסיעות'
const routes: Routes = [
  { path: defaultRoute, component: OrgEventsComponent },
  {
    path: 'טיוטות',
    component: DraftOverviewComponent,
    canActivate: [DraftsGuard],
  },
  {
    path: terms.userAccounts,
    component: UsersComponent,
    canActivate: [AdminGuard],
  },
  { path: 'noam-test/:1', component: NoamTestComponent },
  { path: '**', redirectTo: '/' + defaultRoute, pathMatch: 'full' },
]

@NgModule({
  imports: [RouterModule.forRoot(routes), CommonUIElementsModule],
  providers: [
    AdminGuard,
    DraftsGuard,
    { provide: ErrorHandler, useClass: ShowDialogOnErrorErrorHandler },
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
