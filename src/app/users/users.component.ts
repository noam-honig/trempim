import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { User } from './user'

import { UIToolsService } from '../common/UIToolsService'
import { Roles } from './roles'

import { terms } from '../terms'
import { GridSettings } from 'common-ui-elements/interfaces'
import { remult, repo } from 'remult'
import { saveToExcel } from '../common-ui-elements/interfaces/src/saveGridToExcel'
import { BusyService } from '../common-ui-elements'
import { SignInController } from './SignInController'
import { sendWhatsappToPhone } from '../events/phone'
import * as xlsx from 'xlsx'

@Component({
  selector: 'app-users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css'],
})
export class UsersComponent implements OnInit {
  constructor(private ui: UIToolsService, private busyService: BusyService) {}
  isAdmin() {
    return remult.isAllowed(Roles.admin)
  }

  users: GridSettings<User> = new GridSettings<User>(remult.repo(User), {
    allowDelete: false,
    allowInsert: false,
    allowUpdate: true,
    columnOrderStateKey: 'users',

    orderBy: { name: 'asc' },
    rowsInPage: 100,

    columnSettings: (users) => [
      users.name,
      users.phone,
      users.dispatcher,
      users.trainee,
      users.admin,
      users.deleted,
    ],
    rowCssClass: (row) => (row.deleted ? 'canceled' : ''),
    gridButtons: [
      {
        name: 'יצוא לExcel',
        click: () => saveToExcel(this.users, 'users', this.busyService),
      },
      // {
      //   name: 'קליטת מתנדבים מאקסל',
      //   click: () => {
      //     this.myInput.nativeElement.click()
      //   },
      // },
    ],
    rowButtons: [
      {
        name: 'פרטים',
        click: async (e) => e.editDialog(this.ui),
      },
      {
        name: 'שלח SMS להזמנה',
        click: async (e) => {
          await e.sendInviteSmsToUser(remult.context.origin)
        },
      },
      {
        name: 'שלח Whatsapp להזמנה',
        click: async (e) => {
          sendWhatsappToPhone(e.phone, e.buildInviteText(remult.context.origin))
        },
      },
      {
        name: 'הצג קוד חד פעמי',
        click: async (e) => {
          await this.ui.error(await SignInController.getOtpFor(e.phone))
        },
      },
    ],
    confirmDelete: async (h) => {
      return await this.ui.confirmDelete(h.name)
    },
  })
  async addVolunteer() {
    const v = repo(User).create()
    v.editDialog(this.ui, async () => {
      this.users.addNewRowToGrid(v)
      if (await this.ui.yesNoQuestion('האם לשלוח הזמנה בווטסאפ למתנדב?'))
        sendWhatsappToPhone(v.phone, v.buildInviteText(remult.context.origin))
    })
  }
  @ViewChild('fileInput') myInput!: ElementRef

  async onFileInput(eventArgs: any) {
    for (const file of eventArgs.target.files) {
      let f: File = file
      await new Promise((res) => {
        var fileReader = new FileReader()

        fileReader.onload = async (e: any) => {
          // pre-process data
          var binary = ''
          var bytes = new Uint8Array(e.target.result)
          var length = bytes.byteLength
          for (var i = 0; i < length; i++) {
            binary += String.fromCharCode(bytes[i])
          }
          // call 'xlsx' to read the file
          var oFile = xlsx.read(binary, {
            type: 'binary',
            cellDates: true,
            cellStyles: true,
          })
          let sheets = oFile.SheetNames
          var dataArray = xlsx.utils.sheet_to_json(oFile.Sheets[sheets[0]], {
            header: 1,
          })

          // let processed = await ImportExcelController.importProductsFromExcel(
          //   dataArray
          // )
          // alert('loaded ' + processed + ' products')
        }
        fileReader.readAsArrayBuffer(f)
      })
      return //to import the first file only
    }
  }

  ngOnInit() {}
}
//[ ] add change log
