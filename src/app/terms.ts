import { Validators } from 'remult'

export const terms = {
  username: 'שם משתמש',
  signIn: 'כניסה',
  confirmPassword: 'אשר סיסמה',
  signUp: 'הרשמה',
  doesNotMatchPassword: 'סיסמאות לא תואמות',
  password: 'סיסמה',
  updateInfo: 'עדכון פרטים',
  changePassword: 'שנה סיסמה',
  hello: 'שלום',
  invalidOperation: 'פעולה לא חוקית',
  admin: 'מנהל',
  yes: 'כן',
  no: 'לא',
  ok: 'אישור',
  areYouSureYouWouldLikeToDelete: 'אנא אשר פעולת מחיקה',
  cancel: 'ביטול',
  home: 'בית',
  userAccounts: 'משתמשים',
  invalidSignIn: 'פרטי כניסה לא תקינים',
  signOut: 'התנתק',
  resetPassword: 'איפוס סיסמה',
  passwordDeletedSuccessful: 'סיסמה אופסה',
  passwordDeleteConfirmOf: 'בטוח לאפס את הסיסמה של ',
  rememberOnThisDevice: 'זכור אותי במכשיר זה?',
  RTL: true,
}

Validators.required.defaultMessage = 'ערך חסר'
Validators.unique.defaultMessage = 'קיים כבר ערך זהה'
