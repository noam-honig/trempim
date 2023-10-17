import { Component, OnInit } from '@angular/core'
import { Fields, getFields } from 'remult'
import { Task } from '../events/tasks'
import { DialogRef } from '@angular/cdk/dialog'
import { UITools } from '../common/UITools'
import { UIToolsService } from '../common/UIToolsService'

@Component({
  selector: 'app-update-status',
  templateUrl: './update-status.component.html',
  styleUrls: ['./update-status.component.scss'],
})
export class UpdateStatusComponent implements OnInit {
  constructor(private dialogRef: DialogRef<any>, private ui: UIToolsService) {}

  args!: {
    showFailStatus: boolean
    task: Task
  }
  whatWentWrong = 0

  @Fields.string({ customInput: (x) => x.textarea(), caption: 'הערות' })
  notes = ''

  get $() {
    return getFields(this)
  }
  ngOnInit(): void {}
  async save() {
    try {
      if (this.args.showFailStatus) {
        switch (this.whatWentWrong) {
          case 0:
            await this.args.task.cancelAssignment(this.notes)
            break
          case 21:
            await this.args.task.noLongerRelevant(this.notes)
            break
          case 22:
            await this.args.task.otherProblem(this.notes)
            break
        }
      } else {
        await this.args.task.completed(this.notes)
      }
      this.dialogRef.close()
    } catch (err: any) {
      this.ui.error(err)
    }
  }
}
