import { Component, OnInit } from '@angular/core'
import { Blacklist } from './blacklist'

import { UIToolsService } from '../common/UIToolsService'
import { GridSettings } from 'common-ui-elements/interfaces'
import { EntityFilter, remult, repo } from 'remult'
import { BusyService } from '../common-ui-elements'
import { User } from '../users/user'
import { fixPhoneInput, isPhoneValidForIsrael } from '../events/phone'

@Component({
  selector: 'app-blacklist',
  templateUrl: './blacklist.component.html',
  styleUrls: ['./blacklist.component.css'],
})
export class BlacklistComponent implements OnInit {
  constructor(private ui: UIToolsService, private busyService: BusyService) {}

  searchString = ''
  doSearch() {
    this.blacklist.page = 1
    this.busyService.donotWait(() => this.blacklist.reloadData())
  }

  blacklist: GridSettings<Blacklist> = new GridSettings<Blacklist>(remult.repo(Blacklist), {
    allowDelete: false,
    allowInsert: false,
    allowUpdate: true,
    columnOrderStateKey: 'users',
    where: () => {
      const result: EntityFilter<Blacklist> = {}
      if (this.searchString) {
        let or: EntityFilter<User>[] = [
          { name: { $contains: this.searchString } },
        ]
        const searchDigits = fixPhoneInput(this.searchString)
        if (searchDigits) or.push({ phone: { $contains: searchDigits } })
        result.$or = or
      }
      return result
    },

    orderBy: { name: 'asc' },

    rowsInPage: 50,

    columnSettings: (blacklist) => [
      blacklist.name,
      blacklist.phone,
      blacklist.addedBy,
      blacklist.incidentDate,
      blacklist.adminNotes,
      blacklist.createDate,
    ],
    rowButtons: [
      {
        name: 'פרטים',
        click: async (e) => e.editDialog(this.ui),
      },
      {
        name: 'הסר',
        click: async (e) => Blacklist.delete(e.id),
      },
    ],
    confirmDelete: async (h) => {
      return await this.ui.confirmDelete(h.name)
    },
  })

  async addToBlacklist() {
    const v = repo(Blacklist).create()
    const digits = fixPhoneInput(this.searchString)
    if (isPhoneValidForIsrael(digits)) v.phone = digits
    else if (digits != this.searchString) v.name = this.searchString
    v.editDialog(this.ui, async () => {
      this.blacklist.addNewRowToGrid(v)
    })
  }
  ngOnInit() {}
}
