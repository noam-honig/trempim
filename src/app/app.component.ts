import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { Router, Route, ActivatedRoute } from '@angular/router'
import { MatSidenav } from '@angular/material/sidenav'

import { UIToolsService } from './common/UIToolsService'
import { BusyService, openDialog, RouteHelperService } from 'common-ui-elements'
import { User } from './users/user'
import { DataAreaDialogComponent } from './common/data-area-dialog/data-area-dialog.component'
import { terms } from './terms'
import { SignInController } from './users/SignInController'
import { remult, repo } from 'remult'
import { DataAreaSettings } from './common-ui-elements/interfaces'
import copy from 'copy-to-clipboard'
import { getSite, getTitle } from './users/sites'
import { Roles } from './users/roles'
import { updateChannel } from './events/UpdatesChannel'
import { UpdatesService } from './updates/updates.component'
import { Task } from './events/tasks'
import { taskStatus } from './events/taskStatus'

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  constructor(
    public router: Router,
    public activeRoute: ActivatedRoute,
    private routeHelper: RouteHelperService,
    public uiService: UIToolsService,
    public updates: UpdatesService,
    private busy: BusyService
  ) {}

  unSub = () => {}
  ngOnDestroy(): void {
    this.unSub()
  }
  getLogo() {
    return '/' + getSite().urlPrefix + '/assets/logo.png'
  }
  drafts = 0
  relevanceCheck = 0
  problems = 0
  updateSubscription() {
    this.unSub()
    this.unSub = () => {}

    if (remult.isAllowed(Roles.dispatcher)) {
      this.updateStats()
      updateChannel
        .subscribe((message) => {
          if (getSite().showInfoSnackbarFor(message))
            this.uiService.info(message.message)
          this.updateStats()
        })
        .then((u) => (this.unSub = u))
    }
  }
  async updateStats() {
    this.busy.donotWait(async () => {
      ;[this.drafts, this.relevanceCheck, this.problems] = await Promise.all([
        repo(Task).count({ taskStatus: taskStatus.draft }),
        repo(Task).count({ taskStatus: taskStatus.relevanceCheck }),
        repo(Task).count({ taskStatus: taskStatus.otherProblem }),
        this.updates.updateWaitingUpdates(),
      ])
    })
  }
  terms = terms
  remult = remult

  signIn = new SignInController()
  area = new DataAreaSettings({
    fields: () => [
      { field: this.signIn.$.phone, visible: () => !this.signIn.askForOtp },
      {
        field: this.signIn.$.otp,
        visible: () => this.signIn.askForOtp,
        cssClass: 'otp',
      },
      { field: this.signIn.$.name, visible: () => this.signIn.askForName },
      { field: this.signIn.$.rememberOnThisDevice },
    ],
  })
  async doSignIn() {
    if (!this.signIn.askForOtp) await this.signIn.signIn()
    else {
      remult.user = await this.signIn.signInWithOtp()
      this.updateSubscription()
      if (!remult.user) {
        this.signIn.$.name.error = 'אנא הזן שם'
      }
    }
  }

  ngOnInit(): void {
    this.updateSubscription()
  }
  isDispatcher() {
    return remult.isAllowed(Roles.dispatcher)
  }
  isTrainee() {
    return remult.isAllowed(Roles.trainee)
  }
  showAddTrip() {
    return (
      remult.isAllowed(Roles.trainee) ||
      getSite().allowAnyVolunteerToAdd ||
      this.showCopyLink()
    )
  }

  async signOut() {
    await SignInController.signOut()
    remult.user = undefined
    location.reload()
    this.router.navigate(['/'])
  }

  async updateInfo() {
    let user = await remult.repo(User).findId(remult.user!.id)
    openDialog(
      DataAreaDialogComponent,
      (i) =>
        (i.args = {
          title: terms.updateInfo,
          fields: [user.$.name],
          ok: async () => {
            await user._.save()
          },
        })
    )
  }

  routeName(route: Route) {
    let name = route.path
    if (route.data && route.data['name']) name = route.data['name']
    return name
    return ''
  }

  currentTitle() {
    if (this.activeRoute!.snapshot && this.activeRoute!.firstChild)
      if (this.activeRoute.snapshot.firstChild!.data!['name']) {
        return this.activeRoute.snapshot.firstChild!.data['name']
      } else {
        if (this.activeRoute.firstChild.routeConfig)
          return this.activeRoute.firstChild.routeConfig.path
      }
    return 'angular-starter-project'
  }
  doesNotRequireLogin() {
    return this.activeRoute?.snapshot?.firstChild?.data?.['noLogin']
  }
  title = document.title

  shouldDisplayRoute(route: Route) {
    if (
      !(
        this.routeName(route) &&
        (route.path || '').indexOf(':') < 0 &&
        (route.path || '').indexOf('**') < 0 &&
        !route.data?.['hide']
      )
    )
      return false
    return this.routeHelper.canNavigateToRoute(route)
  }
  //@ts-ignore ignoring this to match angular 7 and 8
  @ViewChild('sidenav') sidenav: MatSidenav
  routeClicked() {
    if (this.uiService.isScreenSmall()) this.sidenav.close()
  }
  copyAddLink() {
    copy(remult.context.origin + '/intake')
    this.uiService.info('הקישור הועתק')
  }
  showCopyLink() {
    return getSite().showCopyLink
  }
}

//[ ] - add select driver for my trips
