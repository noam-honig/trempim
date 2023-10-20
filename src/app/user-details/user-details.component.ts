import { Component, Input, OnInit } from '@angular/core'
import { User } from '../users/user'
import { repo } from 'remult'
import { sendWhatsappToPhone } from '../events/phone'
import { WantsToCloseDialog } from '../common-ui-elements'
import { UIToolsService } from '../common/UIToolsService'

@Component({
  selector: 'app-user-details',
  templateUrl: './user-details.component.html',
  styleUrls: ['./user-details.component.scss'],
})
export class UserDetailsComponent implements OnInit, WantsToCloseDialog {
  constructor(private ui: UIToolsService) {}
  closeDialog!: VoidFunction

  @Input()
  args!: {
    userId?: string
    user?: User
    title: string
  }
  sendWhatsapp() {
    sendWhatsappToPhone(this.args.user!.phone, 'שלום ' + this.args.user!.name)
  }
  async ngOnInit() {
    if (!this.args.user) {
      this.args.user = await repo(User).findId(this.args.userId!)
      if (!this.args.user) {
        this.ui.error('משתמש לא נמצא: ' + this.args.userId)
        this.closeDialog?.()
      }
    }
  }
}
//[ ] - send sms on add user (Or at least ask to)
