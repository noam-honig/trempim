import { Component, OnInit } from '@angular/core'
import { Title } from '@angular/platform-browser'
import { Fields, FieldsRef, remult, repo } from 'remult'
import { Task } from '../events/tasks'
import {
  DataAreaSettings,
  GridSettings,
} from '../common-ui-elements/interfaces'
import { InputImageComponent } from '../common/input-image/input-image.component'
import { getSite, getTitle } from '../users/sites'
import { UITools } from '../common/UITools'
import { UIToolsService } from '../common/UIToolsService'
import copy from 'copy-to-clipboard'
import { Router } from '@angular/router'

@Component({
  selector: 'app-intake',
  templateUrl: './intake.component.html',
  styleUrls: ['./intake.component.scss'],
})
export class IntakeComponent implements OnInit {
  constructor(
    private documentTitle: Title,
    private ui: UIToolsService,
    private router: Router
  ) {}
  title = document.title
  getLogo() {
    return '/' + getSite().urlPrefix + '/assets/logo.png'
  }
  getSite() {
    return getSite()
  }
  r = repo(Task).create()
  area = new DataAreaSettings({
    fields: () => {
      let e = this.r.$
      return [
        { field: e.title, caption: getSite().taskTitleCaption },
      ]
    },
  })
  getAddressInstructions() {
    return getSite().addressInstructions
  }
  area2 = new DataAreaSettings({
    fields: () => {
      let e = this.r.$
      return [
        {
          field: e.address,
          caption: getSite().fromAddressName || e.address.metadata.caption,
          visible: () => !getSite().onlyAskForSecondAddress,
        },
        {
          field: e.toAddress,
          caption: getSite().toAddressName || e.toAddress.metadata.caption,
        },
        [e.eventDate, e.startTime, e.relevantHours],
        ...(getSite().useFillerInfo
          ? [[e.requesterPhone1, e.requesterPhone1Description]]
          : []),
        [e.phone1, e.phone1Description].map((y) => ({
          field: y,
          readonly: true,
          visible: () => !getSite().onlyAskForSecondAddress,
        })),
        e.description,
        e.imageId,
      ]
    },
  })
  ngOnInit(): void {
    if (isDev()) {
      let x: any = localStorage.getItem('previous')
      if (x != null) {
        x = JSON.parse(x)
        getFields(this.r.$).forEach((f) => {
          let val = x![f.metadata.key]
          if (val) {
            f.value = f.metadata.valueConverter.fromJson(val)
          }
        })
      }
    }
    this.ui.report('קישור לטופס הוספה', '')
    Task.intakeUserId().then((x) => {
      if (!x) {
        this.ui.error('הוספת נסיעה על ידי משתמשים לא מורשים חסומה')
        this.router.navigate(['/'])
      }
    })
    this.documentTitle.setTitle(getTitle() + ' בקשה')
  }
  allowShare() {
    return getSite().allowShareLink
  }
  async createAndCopyWhatsappLink() {
    await Task.makePublicVisible(this.r.id)
    copy(
      this.r.getShortDescription() +
        '\nלחצו על הקישור לפרטים נוספים \n' +
        remult.context.origin +
        '/p/' +
        this.r.id
    )
    this.ui.info('הקישור הועתק ללוח, ניתן לשלוח בקבוצה')
  }
  result = ''
  async send() {
    if (isDev())
      localStorage.setItem(
        'previous',
        JSON.stringify(
          getFields(this.r.$).reduce((prev, f) => {
            prev[f.metadata.key] = f.metadata.valueConverter.toJson(
              f.value as any
            )
            return prev
          }, {} as any)
        )
      )
    await this.r._.save()
    this.result = 'הבקשה נקלטה ומספרה: ' + this.r.externalId
  }
}

function getFields(f: FieldsRef<Task>) {
  return [
    f.title,
    f.address,
    f.addressApiResult,
    f.toAddress,
    f.toAddressApiResult,
    f.phone1,
    f.requesterPhone1,
  ]
}

function isDev() {
  return document.location.host.includes('localhost')
}
