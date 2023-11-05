import { Component, OnInit } from '@angular/core'
import { Task } from '../events/tasks'
import copy from 'copy-to-clipboard'
import { UIToolsService } from '../common/UIToolsService'

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
  districts: { name: string; branches: { name: string; message: string }[] }[] =
    []

  copy(what: string) {
    copy(what)
    this.ui.info('הודעה הועתקה')
  }

  ngOnInit(): void {
    let districts = new Map<
      string | undefined,
      Map<string | undefined, Task[]>
    >()
    for (const t of this.args.tasks) {
      let items = districts.get(t.addressApiResult?.district)
      if (!items) {
        districts.set(t.addressApiResult?.district, (items = new Map()))
      }

      let x = items.get(t.addressApiResult?.branch)
      if (!x) {
        items.set(t.addressApiResult?.branch, (x = [t]))
      } else x.push(t)
    }

    function sortByName(x: (string | undefined)[]) {
      x.sort((a, b) => (a || '').localeCompare(b || ''))
      return x
    }
    for (const d of sortByName([...districts.keys()])) {
      let items = districts.get(d)!
      let branches: { name: string; message: string }[] = []
      this.districts.push({ name: d || '', branches })
      for (const x of sortByName([...items.keys()])) {
        let tasks = items.get(x)
        let message = 'קריאות פתוחות לסניף ' + x

        if (this.args.category) {
          message += ` (${this.args.category})`
        }
        let t = new Date()
        message += ` - שעה ${t.getHours()}:${(
          t.getMinutes() / 10
        ).toFixed()}0 (${tasks?.length} קריאות): \n`
        message += tasks
          ?.map((e) => '* ' + e.getShortDescription() + '\n' + e.getLink())
          .join('\n\n')

        branches.push({ name: (x || '') + ' - ' + tasks?.length, message })
      }
    }
  }
}
