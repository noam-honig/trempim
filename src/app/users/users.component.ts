import { Component, ElementRef, OnInit, ViewChild } from '@angular/core'
import { User } from './user'

import { UIToolsService } from '../common/UIToolsService'
import { Roles } from './roles'

import { terms } from '../terms'
import { GridSettings } from 'common-ui-elements/interfaces'
import { EntityFilter, remult, repo } from 'remult'
import { saveToExcel } from '../common-ui-elements/interfaces/src/saveGridToExcel'
import { BusyService } from '../common-ui-elements'
import { SignInController } from './SignInController'
import {
  fixPhoneInput,
  isPhoneValidForIsrael,
  sendWhatsappToPhone,
} from '../events/phone'
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
  searchString = ''
  doSearch() {
    this.users.page = 1
    this.busyService.donotWait(() => this.users.reloadData())
  }

  users: GridSettings<User> = new GridSettings<User>(remult.repo(User), {
    allowDelete: false,
    allowInsert: false,
    allowUpdate: true,
    columnOrderStateKey: 'users',
    where: () => {
      if (!this.searchString) return {}
      let or: EntityFilter<User>[] = [
        { name: { $contains: this.searchString } },
      ]
      const searchDigits = fixPhoneInput(this.searchString)
      if (searchDigits) or.push({ phone: { $contains: searchDigits } })
      return {
        $or: or,
      }
    },

    orderBy: { name: 'asc' },

    rowsInPage: 50,

    columnSettings: (users) => [
      users.name,
      users.phone,
      users.allowedCategories,
      users.dispatcher,
      users.trainee,
      users.manageDrivers,
      users.admin,
      users.deleted,
      users.createDate,
    ],
    rowCssClass: (row) => (row.deleted ? 'canceled' : ''),
    gridButtons: [
      {
        visible: () => remult.isAllowed(Roles.admin),
        name: 'יצוא לExcel',
        click: () => saveToExcel(this.users, 'users', this.busyService),
      },
      {
        name: 'קליטת מתנדבים מאקסל',
        click: () => {
          this.myInput.nativeElement.click()
        },
      },
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
        visible: (e) => e.canBeUpdatedByDriverManager(),
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
    const digits = fixPhoneInput(this.searchString)
    if (isPhoneValidForIsrael(digits)) v.phone = digits
    else if (digits != this.searchString) v.name = this.searchString
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
          let users: Pick<User, 'phone' | 'name'>[] = []

          for (let index = 1; index < dataArray.length; index++) {
            const element = dataArray[index] as string[]
            if (element[0])
              users.push({
                name: element[2] || element[1],
                phone: element[0],
              })
          }
          if (await this.ui.yesNoQuestion(`לייבא ${users.length} משתמשים?`))
            this.ui.error(await User.importFromExcel(users))

          eventArgs.target.value = ''
        }
        fileReader.readAsArrayBuffer(f)
      })
      return //to import the first file only
    }
  }

  ngOnInit() {}
}
//[ ] add change log
