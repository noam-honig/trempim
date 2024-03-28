import {
  Allow,
  BackendMethod,
  Controller,
  ControllerBase,
  Fields,
  remult,
  repo,
  UserInfo,
  Validators,
} from 'remult'
import { terms } from '../terms'
import { Roles } from './roles'
import { User } from './user'
import {
  setSessionUser,
  setSessionUserBasedOnUserRow,
} from '../../server/server-session'
import { sendSms } from '../../server/send-sms'
import { OnlyAllowIsraeliPhones, PhoneField } from '../events/phone'
import { getSite, getTitle } from './sites'
import { TaskStatusChanges } from '../events/TaskStatusChanges'

const otp = '123456'
@Controller('signIn')
export class SignInController extends ControllerBase {
  @PhoneField({
    caption: 'מספר טלפון נייד',
    validate: [Validators.required, OnlyAllowIsraeliPhones],
    inputType: 'tel',
  })
  phone = ''
  @Fields.string({
    caption: 'קוד שהתקבל בהודעת SMS',
    inputType: 'numeric',
  })
  otp = ''

  @Fields.boolean()
  askForOtp = false
  @Fields.boolean()
  askForName = false

  @Fields.string({ caption: 'שם ושם משפחה בבקשה' })
  name = ''

  @BackendMethod({ allowed: true })
  /**
   * This sign mechanism represents a simplistic sign in management utility with the following behaviors
   * 1. The first user that signs in, is created as a user and is determined as admin.
   * 2. When a user that has no password signs in, that password that they've signed in with is set as the users password
   */
  async signIn() {
    let u = await this.findUserByPhone()
    if (!u) {
      if ((await repo(User).count()) === 0) {
        //first ever user is the admin
        u = await repo(User).insert({
          name: '',
          phone: this.phone,
          admin: true,
        })
      }
    }
    var d = new Date()
    d.setMinutes(d.getMinutes() + 5)
    const otp = generateRandomSixDigitNumber()

    await sendSms(
      this.phone,
      `הקוד לכניסה ל${getTitle()} הוא: ` + otp,
      true
    ).then((x) => console.log(`sent (code: ${otp}) ${x}`))
    otps.set(this.phone, { otp: otp, expire: d })
    this.askForOtp = true
    if (u && !u.name) this.askForName = true
    if (await setUserToSelfSignInIfAllowed()) {
      if (!(await repo(User).count({ phone: this.phone })))
        this.askForName = true
    }
  }
  private async findUserByPhone() {
    const result = await repo(User).find({
      where: {
        phone: this.phone,
        deleted: false,
        $and: [getSite().signInFilter()],
      },
    })
    if (result.length == 0) return undefined
    if (result.length == 1) return result[0]
    let orgUser = result.find((x) => x.org === getSite().org)
    if (orgUser) return orgUser
    return result[0]
  }

  @BackendMethod({ allowed: true })
  async signInWithOtp(): Promise<UserInfo | undefined> {
    const otp = getOtp(this.phone)
    if (!otp) {
      this.askForOtp = false
      throw Error('פג תוקף הקוד, נסה שנית')
    }
    if (otp != this.otp?.trim()) throw Error('קוד לא תקין')
    let user = await this.findUserByPhone()

    if (!user) {
      if (await setUserToSelfSignInIfAllowed()) {
        if (!this.name) {
          this.askForName = true
          return undefined
        }
        user = await repo(User).insert({ phone: this.phone, name: this.name })
      }
    } else if (!user.name) {
      if (!this.name) {
        this.askForName = true
        return undefined
      }
      user.name = this.name
      await user.save()
    }

    if (!user) throw Error(UNKNOWN_USER)
    try {
      return await setSessionUserBasedOnUserRow(user)
    } finally {
      await repo(TaskStatusChanges).insert({
        what: 'לוגין',
      })
    }
  }

  @BackendMethod({ allowed: Allow.authenticated })
  static async signOut() {
    await repo(TaskStatusChanges).insert({
      what: 'התנתקות',
    })
    setSessionUser(undefined!, true)
  }
  @BackendMethod({ allowed: true })
  static async currentUser() {
    await repo(TaskStatusChanges).insert({
      what: 'טעינת אתר',
    })
    return remult.user
  }
  @BackendMethod({ allowed: Roles.manageDrivers })
  static async getOtpFor(phone: string) {
    const otp = getOtp(phone)
    const user = await repo(User).findFirst({ phone: phone, deleted: false })
    if (!user || !user.canBeUpdatedByDriverManager())
      return 'אינך רשאי לבצע פעולה זו עבור משתמש זה'
    if (!otp)
      return 'אין קוד עבור משתמש זה, אנא הנחו אותו להקליד את מספר הטלפון שלו ולבקש שנית'
    return 'הקוד הוא ' + otp
  }
}
async function setUserToSelfSignInIfAllowed() {
  const user = await repo(User).findFirst({
    phone: '0500000001',
    deleted: false,
  })
  if (user) {
    remult.user = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      showAllOrgs: user.showAllOrgs,
      orgs: [{ org: getSite().org, userId: user.id }],
    }
    return true
  }
  return false
}

function generateRandomSixDigitNumber() {
  // Generate a random number between 100,000 (inclusive) and 1,000,000 (exclusive)
  const min = 100000
  const max = 1000000
  const randomNumber = Math.floor(Math.random() * (max - min)) + min
  return randomNumber.toString()
}

const otps = new Map<string, { otp: string; expire: Date }>()
export const DEFAULT_NAME = 'עוזרים לצה״ל במה שאפשר'
function getOtp(phone: string) {
  const otp = otps.get(phone)
  if (!otp || otp.expire < new Date()) return undefined
  return otp.otp
}

export const UNKNOWN_USER = 'מספר טלפון לא מוכר'
