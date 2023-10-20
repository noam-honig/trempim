import { Component, OnInit } from '@angular/core'
import { repo } from 'remult'
import { Task } from '../events/tasks'
import {
  DataAreaSettings,
  GridSettings,
} from '../common-ui-elements/interfaces'

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
        e.externalId,
      ]
    },
  })
  ngOnInit(): void {}
  result = ''
  async send() {
    await this.r._.save()
    this.result = 'הבקשה נקלטה ומספרה: ' + this.r.externalId
  }

  private async loadFiles(files: any) {
    for (let index = 0; index < files.length; index++) {
      const file = files[index]
      let f: File = file
      await new Promise((res) => {
        var fileReader = new FileReader()

        fileReader.onload = async (e: any) => {
          var img = new Image()

          var canvas = document.createElement('canvas')
          if (true) {
            img.onload = async () => {
              var ctx = canvas.getContext('2d')!
              ctx.drawImage(img, 0, 0)

              var MAX_WIDTH = 800
              var MAX_HEIGHT = 600
              var width = img.width
              var height = img.height

              if (width > height) {
                if (width > MAX_WIDTH) {
                  height *= MAX_WIDTH / width
                  width = MAX_WIDTH
                }
              } else {
                if (height > MAX_HEIGHT) {
                  width *= MAX_HEIGHT / height
                  height = MAX_HEIGHT
                }
              }
              canvas.width = width
              canvas.height = height
              var ctx = canvas.getContext('2d')!
              ctx.drawImage(img, 0, 0, width, height)

              var dataurl = canvas.toDataURL('image/png')
              this.r.imageId = dataurl
            }
            img.src = e.target.result.toString()
          }
          //   this.image.image.value = e.target.result.toString();
          //   this.image.fileName.value = f.name;
          res({})
        }
        fileReader.readAsDataURL(f)
      })
    }
  }

  onFileInput(e: any) {
    this.loadFiles(e.target.files)
  }
}
