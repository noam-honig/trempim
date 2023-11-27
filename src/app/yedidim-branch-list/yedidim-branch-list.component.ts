import { Component, OnInit } from '@angular/core'
import { Task } from '../events/tasks'
import copy from 'copy-to-clipboard'
import { UIToolsService } from '../common/UIToolsService'
import { getRegion } from '../common/address-input/google-api-helpers'

@Component({
  selector: 'app-yedidim-branch-list',
  templateUrl: './yedidim-branch-list.component.html',
  styleUrls: ['./yedidim-branch-list.component.scss'],
})
export class YedidimBranchListComponent implements OnInit {
  constructor(private ui: UIToolsService) {}
  args!: {
    tasks: Task[]
    category?: string
  }
  regions: {
    name: string
    message: string
    districts: {
      name: string
      message: string
      branches: { name: string; message: string }[]
    }[]
  }[] = []

  copy(what: string) {
    copy(what)
    this.ui.info('הודעה הועתקה')
  }

  ngOnInit(): void {
    let regions = new Map<string, Map<string, Map<string, Task[]>>>()
    for (const t of this.args.tasks) {
      const region = getRegion(t.addressApiResult)
      let districts = regions.get(region)
      if (!districts) {
        regions.set(region, (districts = new Map()))
      }
      let district = t.addressApiResult?.district || ''
      let items = districts.get(district)
      if (!items) {
        districts.set(district, (items = new Map()))
      }
      let branch = t.addressApiResult?.branch || ''
      let x = items.get(branch)
      if (!x) {
        items.set(branch, (x = [t]))
      } else x.push(t)

      const toRegion = getRegion(t.toAddressApiResult)
      const toDistrict = t.toAddressApiResult?.district || ''
      const toBranch = t.toAddressApiResult?.branch || ''
      if (toRegion != region) {
        districts = regions.get(toRegion)
        if (!districts) {
          regions.set(toRegion, (districts = new Map()))
        }
      }
      if (toDistrict != district) {
        items = districts.get(toDistrict)
        if (!items) {
          districts.set(toDistrict, (items = new Map()))
        }
      }
      if (toBranch != branch) {
        x = items.get(toBranch)
        if (!x) {
          items.set(toBranch, (x = [t]))
        } else x.push(t)
      }
    }

    function sortByName(x: (string | undefined)[]) {
      x.sort((a, b) => (a || '').localeCompare(b || ''))
      return x
    }
    for (const r of sortByName([...regions.keys()])) {
      const districts = regions.get(r!)!
      const regionTasks: Task[] = []
      this.regions.push({ name: r || '', districts: [], message: '' })
      let region = this.regions[this.regions.length - 1]
      for (const d of sortByName([...districts.keys()])) {
        let items = districts.get(d!)!
        let branches: { name: string; message: string }[] = []

        const districtTasks: Task[] = []
        for (const x of sortByName([...items.keys()])) {
          let tasks = items.get(x!)
          let message = this.buildMessageFor(x, tasks)

          branches.push({ name: (x || '') + ' - ' + tasks?.length, message })
          if (tasks) {
            for (const t of tasks) {
              if (!regionTasks.find((x) => x.id === t.id)) regionTasks.push(t)
              if (!districtTasks.find((x) => x.id === t.id))
                districtTasks.push(t)
            }
          }
        }
        region.districts.push({
          name: (d || '') + ' - ' + districtTasks.length,
          branches,
          message: this.buildMessageFor(d, districtTasks),
        })
      }
      region.message = this.buildMessageFor(region.name, regionTasks)
      region.name += ' - ' + regionTasks.length
    }
  }

  private buildMessageFor(x: string | undefined, tasks: Task[] | undefined) {
    let message = 'קריאות פתוחות ל' + x

    if (this.args.category) {
      message += ` (${this.args.category})`
    }
    let t = new Date()
    message += ` - שעה ${t.getHours()}:${Math.min(
      t.getMinutes() / 10
    ).toFixed()}0 (${tasks?.length} קריאות): \n`
    message += tasks
      ?.map((e) => '* ' + e.getShortDescription() + '\n' + e.getLink())
      .join('\n\n')
    return message
  }
}
