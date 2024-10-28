import { Component, Input, OnInit } from '@angular/core'
import { formatPhone, sendWhatsappToPhone } from '../events/phone'
import { remult } from 'remult'
import { getTitle } from '../users/sites'

@Component({
  selector: 'app-phone-details',
  templateUrl: './phone-details.component.html',
  styleUrls: ['./phone-details.component.scss'],
})
export class PhoneDetailsComponent implements OnInit {
  constructor() {}
  @Input()
  args!: {
    phone?: string
    name?: string
    title?: string
    closeDialog?: VoidFunction
    messageContext?: string
  }
  sendWhatsapp() {
    let text;
    if (remult.authenticated()) {
      text = `שלום ${this.args.name}
זה ${remult.user?.name} מ${getTitle()}
${this.args.messageContext ? 'בקשר ל' + this.args.messageContext : ''}
`;
    }
    else {
      text = `שלום ${this.args.name}
אני מחפש הסעה במערכת מתדנבי הטרמפים.
 ${this.args.messageContext ? 'בקשר ל' + this.args.messageContext : ''}
`
    }
    sendWhatsappToPhone(
      this.args.phone!,
      text
    )
  }
  displayPhone() {
    return formatPhone(this.args.phone!)
  }
  getTitle() {
    if (this.args.title && this.args.name)
      return this.args.title + ': ' + this.args.name
    else if (this.args.title) return this.args.title
    return this.args.name
  }

  ngOnInit(): void {}
}
