import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core'
import { Router, Route, ActivatedRoute } from '@angular/router'
import { MatSidenav } from '@angular/material/sidenav'

import { UIToolsService } from './common/UIToolsService'
import { BusyService, openDialog, RouteHelperService } from 'common-ui-elements'
import { User } from './users/user'
import { DataAreaDialogComponent } from './common/data-area-dialog/data-area-dialog.component'
import { terms } from './terms'
import { SignInController, UNKNOWN_USER } from './users/SignInController'
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
      updateChannel(getSite().org)
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
        repo(Task).count({ taskStatus: taskStatus.draft, org: getSite().org }),
        repo(Task).count({
          taskStatus: taskStatus.relevanceCheck,
          org: getSite().org,
        }),
        repo(Task).count({
          taskStatus: taskStatus.otherProblem,
          $and: [getSite().tasksFilter()],
        }),
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
        visible: () => this.signIn.askForOtp && false,
        cssClass: 'otp',
      },
      { field: this.signIn.$.name, visible: () => this.signIn.askForName },
    ],
  })
  async doSignIn() {
    if (!this.signIn.askForOtp) {
      await this.signIn.signIn()
    } else {
      try {
        remult.user = await this.signIn.signInWithOtp()
        this.updateSubscription()
        if (!remult.user) {
          this.signIn.$.name.error = 'אנא הזן שם'
        }
      } catch (err: any) {
        if (err.message === UNKNOWN_USER) {
          const link = getSite().registerVolunteerLink

          if (link) {
            const message = `טלפון ${
              this.signIn.$.phone.displayValue
            } אינו רשום למערכת, האם תרצה להירשם ל${getTitle()}?`
            this.uiService.report(message, '')
            if (await this.uiService.yesNoQuestion(message)) {
              this.uiService.report('מעבר לטופס הרשמה חיצוני', '')
              window.open(link)
            }
          } else {
            await this.uiService.error(
              `טלפון ${
                this.signIn.$.phone.displayValue
              } אינו רשום למערכת. אנא צור קשר עם ${getTitle()} בכדי להצטרף?`
            )
          }
        } else throw err
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
  showTrips() {
    return (
      remult.authenticated()
    )
  }
  showAddTrip() {
    return (
      remult.isAllowed(Roles.trainee) ||
      getSite().allowAnyVolunteerToAdd ||
      this.showCopyLink()
    )
  }

  showDriverTrips() {
    return (
      getSite().allowDriveTasks &&
      !remult.authenticated()
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
          fields: [user.$.name, user.$.showAllOrgs],
          ok: async () => {
            let reload = user.$.showAllOrgs.valueChanged()
            await user._.save()
            if (reload) location.reload()
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
  introText = getSite().getIntroText()
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
    return remult.authenticated() && getSite().showCopyLink
  }
  showSideMenu() {
    return remult.authenticated()
  }
  showTutorial() {
    return remult.authenticated()
  }
}
