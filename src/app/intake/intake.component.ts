import { Component, OnInit } from '@angular/core'
import { Title } from '@angular/platform-browser'
import { repo } from 'remult'
import { Task } from '../events/tasks'
import {
  DataAreaSettings,
  GridSettings,
} from '../common-ui-elements/interfaces'
import { InputImageComponent } from '../common/input-image/input-image.component'
import { getSite, getTitle } from '../users/sites'
import { UITools } from '../common/UITools'
import { UIToolsService } from '../common/UIToolsService'

@Component({
  selector: 'app-intake',
  templateUrl: './intake.component.html',
  styleUrls: ['./intake.component.scss'],
})
export class IntakeComponent implements OnInit {
  constructor(private documentTitle: Title, private ui: UIToolsService) {}
  title = document.title
  getLogo() {
    return '/' + getSite().urlPrefix + '/assets/logo.png'
  }
  r = repo(Task).create()
  area = new DataAreaSettings({
    fields: () => {
      let e = this.r.$
      return [
        {
          field: e.category!,
          visible: () => !getSite().onlyAskForSecondAddress,
        },
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
        e.description,
        [e.eventDate, e.startTime, e.relevantHours],
        ...(getSite().useFillerInfo
          ? [[e.requesterPhone1, e.requesterPhone1Description]]
          : []),
        [e.phone1, e.phone1Description].map((y) => ({
          field: y,
          visible: () => !getSite().onlyAskForSecondAddress,
        })),
        [e.phone2, e.phone2Description].map((y) => ({
          field: y,
          visible: () => !getSite().onlyAskForSecondAddress,
        })),
        [e.toPhone1, e.tpPhone1Description],
        [e.toPhone2, e.tpPhone2Description],
        e.internalComments,
        e.imageId,
      ]
    },
  })
  ngOnInit(): void {
    this.ui.report('קישור לטופס הוספה', '')
    this.documentTitle.setTitle(getTitle() + ' בקשה')
  }
  result = ''
  async send() {
    await this.r._.save()
    this.result = 'הבקשה נקלטה ומספרה: ' + this.r.externalId
  }
}
