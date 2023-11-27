import { Component, OnInit } from '@angular/core'
import { Fields, getFields, remult } from 'remult'
import { Task } from '../events/tasks'
import { DialogRef } from '@angular/cdk/dialog'
import { UITools } from '../common/UITools'
import { UIToolsService } from '../common/UIToolsService'
import { getSite, getTitle } from '../users/sites'
import { Roles } from '../users/roles'
import { sendWhatsappToPhone } from '../events/phone'

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
    onSave?: VoidFunction
  }
  whatWentWrong = 0

  @Fields.string({ customInput: (x) => x.textarea(), caption: 'הערות' })
  notes = ''

  showNotRelevant() {
    return (
      getSite().driverCanMarkAsNonRelevant || remult.isAllowed(Roles.dispatcher)
    )
  }

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
          case 23:
            this.args.task.otherProblem('לא עונים ' + this.notes)
            break
        }
      } else {
        const result = await this.args.task.completed(this.notes)
        if (result) {
          if (result.rides == 1) {
            if (
              await this.ui.yesNoQuestion(
                `כל הכבוד, השלמת את הנסיעה הראשונה שלך עם "${
                  getSite().title
                }", רוצה לשתף בווטסאפ?`
              )
            ) {
              sendWhatsappToPhone(
                '',
                `השלמתי את הנסיעה הראשונה שלי עם ${getSite().title}`
              )
              this.ui.report('שיתוף ביצוע נסיעה', '', this.args.task.id)
            }
          } else if (
            await this.ui.yesNoQuestion(
              `כל הכבוד, השלמת ${result.rides} נסיעות עם "${
                getSite().title
              }", סה"כ ${result.km.toFixed()} ק"מ - רוצה לשתף בווטסאפ?`
            )
          ) {
            sendWhatsappToPhone(
              '',
              `השלמתי ${result.rides} נסיעות עם ${getTitle()}, סה"כ ${
                result.km
              } ק"מ`
            )
            this.ui.report('שיתוף ביצוע נסיעה', '', this.args.task.id)
          }
        }
      }
      this.dialogRef.close()
      this.args.onSave?.()
    } catch (err: any) {
      this.ui.error(err)
    }
  }
}
