import { Component, OnInit } from '@angular/core'
import { repo } from 'remult'
import { Task } from '../events/tasks'
import {
  DataAreaSettings,
  GridSettings,
} from '../common-ui-elements/interfaces'
import { InputImageComponent } from '../common/input-image/input-image.component'

@Component({
  selector: 'app-intake',
  templateUrl: './intake.component.html',
  styleUrls: ['./intake.component.scss'],
})
export class IntakeComponent implements OnInit {
  constructor() {}

  r = repo(Task).create()
  area = new DataAreaSettings({
    fields: () => {
      let e = this.r.$
      return [
        e.category!,
        e.title,
        e.address,
        e.toAddress,
        e.description,
        [e.eventDate, e.startTime, e.relevantHours],
        [e.phone1, e.phone1Description],
        [e.phone2, e.phone2Description],
        [e.toPhone1, e.tpPhone1Description],
        [e.toPhone2, e.tpPhone2Description],
        e.imageId,
      ]
    },
  })
  ngOnInit(): void {}
  result = ''
  async send() {
    await this.r._.save()
    this.result = 'הבקשה נקלטה ומספרה: ' + this.r.externalId
  }
}
