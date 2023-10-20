export async function sendSms(phone: string, message: string): Promise<any> {
  if (process.env['disable_sms']) {
    console.log({ phone, message })
    return
  }
  const fetch = await import('node-fetch')
  const FormData = await import('form-data')
  let un = process.env['SMS_UN']
  let pw = process.env['SMS_PW']
  let accid = process.env['SMS_ACCID']
  const inforuToken = process.env['INFORU_SMS_TOKEN']
  let useGlobalSms = !inforuToken
  var from = 'Hagai'
  if (!accid && !inforuToken) return 'חשבון SMS לא הוגדר'
  phone = phone.replace(/\D/g, '')

  var t = new Date()
  var date =
    t.getFullYear() +
    '/' +
    (t.getMonth() + 1) +
    '/' +
    t.getDate() +
    ' ' +
    t.getHours() +
    ':' +
    t.getMinutes() +
    ':' +
    t.getSeconds()

  const send = async () => {
    try {
      {
        if (useGlobalSms) {
          message = message
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')

          let data =
            '<?xml version="1.0" encoding="utf-8"?>' +
            '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">' +
            '<soap12:Body>' +
            '<sendSmsToRecipients xmlns="apiItnewsletter">' +
            '<un>' +
            un +
            '</un>' +
            '<pw>' +
            pw +
            '</pw>' +
            '<accid>' +
            accid +
            '</accid>' +
            '<sysPW>' +
            'itnewslettrSMS' +
            '</sysPW>' +
            '<t>' +
            date +
            '</t>' +
            '<txtUserCellular>' +
            from +
            '</txtUserCellular>' +
            '<destination>' +
            phone +
            '</destination>' +
            '<txtSMSmessage>' +
            message +
            '</txtSMSmessage>' +
            '<dteToDeliver></dteToDeliver>' +
            '<txtAddInf>jsnodetest</txtAddInf>' +
            '</sendSmsToRecipients>' +
            '</soap12:Body>' +
            '</soap12:Envelope>'
          let h = new fetch.Headers()
          h.append('Content-Type', 'text/xml; charset=utf-8')
          h.append('SOAPAction', 'apiItnewsletter/sendSmsToRecipients')
          let r = await fetch.default(
            'https://sapi.itnewsletter.co.il/webservices/webservicesms.asmx',
            {
              method: 'POST',
              headers: h,
              body: data,
            }
          )

          let res = await r.text()
          let orig = res
          let t = '<sendSmsToRecipientsResult>'
          let i = res.indexOf(t)
          if (i >= 0) {
            res = res.substring(i + t.length)
            res = res.substring(0, res.indexOf('<'))
          }
          console.log('sms response: - ' + res)
          return res
        } else {
          const data = `
<Inforu>
<User>
<Username>${process.env['INFORU_SMS_USER']}</Username>
<ApiToken>${inforuToken}</ApiToken>
</User>
<Content Type="sms">
<Message>${message}</Message>
</Content>
<Recipients>
<PhoneNumber>${phone}</PhoneNumber>
</Recipients>
<Settings>
<Sender>${from}</Sender>
</Settings>
</Inforu>`
          let h = new fetch.Headers()
          var formData = new FormData.default()

          formData.append('InforuXML', data)

          let r = await fetch.default(
            'https://api.inforu.co.il/SendMessageXml.ashx',
            {
              method: 'POST',

              headers: formData.getHeaders(),

              body: formData,
            }
          )

          let res = await r.text()
          let orig = res
          let t = '<sendSmsToRecipientsResult>'
          let i = res.indexOf(t)
          if (i >= 0) {
            res = res.substring(i + t.length)
            res = res.substring(0, res.indexOf('<'))
          }
          console.log('sms response:' + res)
          return res
        }
      }
    } catch (err: any) {
      console.error('sms error ', err)
      return err
    }
  }
  console.log('before send')
  let apiResponse = await send()
  console.log('after send')

  if (apiResponse && typeof apiResponse !== 'string')
    apiResponse = JSON.stringify(apiResponse)
  console.log({ apiResponse })
  return apiResponse
}
