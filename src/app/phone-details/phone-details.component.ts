import { Component, Input, OnInit } from '@angular/core'
import { formatPhone, sendWhatsappToPhone } from '../events/phone'

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
  }
  sendWhatsapp() {
    sendWhatsappToPhone(this.args.phone!, 'שלום ' + this.args.name)
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
