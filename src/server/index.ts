import express, { Response } from 'express'
import sslRedirect from 'heroku-ssl-redirect'
import helmet from 'helmet'
import compression from 'compression'
import { api } from './api'
import session from 'cookie-session'
import fs from 'fs'
import {
  getBackendSite,
  getSite,
  getSiteFromPath,
  getTitle,
} from '../app/users/sites'
import { SqlDatabase, remult, repo } from 'remult'
import { Task } from '../app/events/tasks'
import { TaskImage } from 'src/app/events/TaskImage'
import { taskStatus } from 'src/app/events/taskStatus'
import { updateReceivedFromMonday } from './monday-work'
import {
  GetDistanceBetween,
  getLocation,
  updateGeocodeResult,
} from '../app/common/address-input/google-api-helpers'
import { upsertShadagTrip } from './shadag-work'

SqlDatabase.LogToConsole = false
const production = process.env['NODE_ENV'] === 'production'
async function startup() {
  const app = express()
  app.use(sslRedirect())

  app.use(compression())
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'", 'maps.googleapis.com'], //https://securityheaders.com/
          'connect-src': ["'self'", '*.googleapis.com'], //https://securityheaders.com/
          'script-src-attr': ["'self'", "'unsafe-inline'"], //https://securityheaders.com/
          'img-src': [
            //https://securityheaders.com/
            "'self'", //https://securityheaders.com/
            'data:', //https://securityheaders.com/
            'maps.gstatic.com', //https://securityheaders.com/
            'maps.google.com', //https://securityheaders.com/
            '*.googleapis.com', //https://securityheaders.com/
            '*.ggpht.com', //https://securityheaders.com/
          ],
        },
      },
    })
  )
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(self)') //https://securityheaders.com/
    next()
  })

  app.use((req, res, next) => {
    const sp = req.path.split('/')
    if (
      sp.length < 2 ||
      sp[1] == '' ||
      sp[1] == 'api' ||
      req.path.startsWith('/t/')
    ) {
      let redirect = 'y'
      if (req.hostname.includes('dshinua')) redirect = 'dshinua'
      res.redirect('/' + redirect + req.path)
      return
    }
    express.static('dist/angular-starter-project')(req, res, () => {
      const siteUrl = getSiteFromPath(req)
      if (
        !getBackendSite(siteUrl) &&
        ((sp[1] != 'assets' && sp.length > 2) || sp.length == 2)
      ) {
        res.status(404).send('Not found: ' + siteUrl)
        return
      }

      /*
[14:32, 11/8/2023] Yoni Rapoport: שאני מבין את הבעיה
[14:32, 11/8/2023] Yoni Rapoport: אם אתה מצפה לקוקי ברקווסט הראשון ל INDEX.HTML זה בעיה בגלל ה SAMESITE
[14:33, 11/8/2023] Noam Honig: זה לא המצב, יש לי קריאת API לקבל את הUSER הנוכי
[14:34, 11/8/2023] Yoni Rapoport: אולי המידלוור רץ גם ברקווסט של הקבצים הסטטיים ועושה משהו אם הוא לא מוצא את הקוקי?
[14:36, 11/8/2023] Noam Honig: אתה אומר בעצם שיכול להיות שהקבצים הסטטים רצים לפני, לא מוצאים את הCOOKIE ועושים SET COOKIE  - ואז זה מנקה את הCOOKIE עם הUSER?
[14:36, 11/8/2023] Yoni Rapoport: מצד שני אם זו היתה הבעיה זה היה קורה גם באייפון...
[14:36, 11/8/2023] Yoni Rapoport: זו השערה...
[14:36, 11/8/2023] Noam Honig: לא מופרח
[14:36, 11/8/2023] Yoni Rapoport: אני די בטוח שברקווסט הראשון שמגיע מהלחיצה על הלינק הקוקי לא אמור להיות בגלל הגדרת ה SAMESITE
[14:37, 11/8/2023] Yoni Rapoport: סוג של הגנה מפני CSRF
[14:37, 11/8/2023] Noam Honig: זה גם אומר שנוכל לשחזר את זה די בקלות
[14:37, 11/8/2023] Yoni Rapoport: כן שווה לבדוק
*/

      session({
        path: '/' + siteUrl,

        // sameSite: !production ? false : 'strict', commented out because it prevented remembering of user on device //https://securityheaders.com/
        // httpOnly: production,  commented out because it prevented remembering of user on device //https://securityheaders.com/
        // secure: production, commented out because it prevented remembering of user on device //https://securityheaders.com/
        secret: production ? process.env['SESSION_SECRET'] : 'my secret1',
      })(req, res, next)
    })
  })
  app.enable('trust proxy') //https://securityheaders.com/

  app.use(api)
  app.use(api.withRemult)
  app.post('/*/monday', express.json(), async (req, res) => {
    if (getSite().syncWithMonday) {
      await updateReceivedFromMonday(req.body)
      res.send(req.body)
    } else {
      res.status(500).json('Monday sync is disabled')
    }
  })
  app.post('/*/api/shadag', express.json(), async (req, res) => {
    if (getSite().syncWithShadag) {
      console.log(req.body)
      await upsertShadagTrip(req.body)
      res.send(req.body)
    } else {
      res.status(500).json('Shadag sync is disabled')
    }
  })
  app.get('/*/assets/logo.png', (req, res) =>
    sendSchemaSpecificFile('logo', res)
  )
  app.get('/*/assets/favicon.png', (req, res) =>
    sendSchemaSpecificFile('favicon', res)
  )

  let status = new Map<string, string>()
  app.get('/*/api/updateRegions', async (req, res) => {
    let site = getSiteFromPath(req)
    if (!status.get(site)) {
      try {
        let count = 0
        status.set(site, 'Started')
        res.send('working on it')
        for await (const task of await repo(Task).query()) {
          task.__disableValidation = true
          await updateGeocodeResult(task.addressApiResult)
          await updateGeocodeResult(task.toAddressApiResult)
          task.distance = parseFloat(
            GetDistanceBetween(
              getLocation(task.addressApiResult),
              getLocation(task.toAddressApiResult)
            ).toFixed(1)
          )
          await task.save()
          count++
          status.set(site, 'updated ' + count + ' tasks')
        }
        status.set(site, 'Done:  ' + count + ' tasks')
      } catch (err: any) {
        status.set(site, 'Error: ' + err.message)
      }
    } else {
      res.send(status.get(site))
    }
  })

  app.get('/*/images/:id', async (req, res) => {
    try {
      const image = await remult
        .repo(TaskImage)
        .findFirst({ id: [req.params?.['id']] })
      if (!image) {
        res.status(404).send('Not found')
        return
      }
      const base64Image = image.image
      if (base64Image) {
        const imageFormat = base64Image.split(';')[0].split('/')[1]
        const imageBuffer = Buffer.from(base64Image.split(',')[1], 'base64')

        res.set('Content-Type', `image/${imageFormat}`)
        res.send(imageBuffer)
      } else {
        res.status(404).send('Image not found')
      }
    } catch (err: any) {
      res.status(500).send(err.message)
    }
  })

  app.get('/*/p/:id', async (req, res) => {
    try {
      const id = req.params?.['id']
      if (id) {
        const t = await repo(Task).findFirst({
          id,
          taskStatus: { $ne: [taskStatus.completed, taskStatus.notRelevant] },
          publicVisible: true,
        })
        if (t) {
          sendIndex(res, {
            image: t.imageId,
            description: ' ', // don't want anything
            title: t.category,
          })
          return
        }
      }
      sendIndex(res)
    } catch (err: any) {
      res.status(500).send(err.message)
    }
  })
  app.get('/*/t/:id', async (req, res) => {
    try {
      const id = req.params?.['id']
      if (id) {
        const t = await repo(Task).findFirst({
          id,
          taskStatus: taskStatus.active,
        })
        if (t) {
          sendIndex(res, {
            image: t.imageId,
            description: t.getShortDescription(),
          })
          return
        }
      }
      sendIndex(res)
    } catch (err: any) {
      res.status(500).send(err.message)
    }
  })
  app.get('/*/s/:id', async (req, res) => {
    try {
      const id = req.params?.['id']
      if (id) {
        const t = await repo(Task).findFirst({
          editLink: id,
        })
        if (t) {
          sendIndex(res, {
            image: t.imageId,
            description: t.getShortDescription(),
          })
          return
        }
      }
      sendIndex(res)
    } catch (err: any) {
      res.status(500).send(err.message)
    }
  })

  app.get('/*/', (req, res) => sendIndex(res))
  app.get('/*/index.html', (req, res) => sendIndex(res))
  app.use('/*/*', async (req, res) => {
    req.session
    if (req.headers.accept?.includes('json')) {
      console.log(req)
      res.status(404).json('missing route: ' + req.originalUrl)
      return
    }
    try {
      sendIndex(res)
    } catch (err) {
      res.sendStatus(500)
    }
  })
  let port = process.env['PORT'] || 3002
  app.listen(port)

  function sendSchemaSpecificFile(file: string, res: Response) {
    const fileWithPath = 'src/assets/' + file
    let theFile = fileWithPath + '-' + getSite().urlPrefix + '.png'
    if (fs.existsSync(theFile)) res.sendFile(theFile, { root: process.cwd() })
    else res.sendFile(fileWithPath + '.png', { root: process.cwd() })
  }

  function sendIndex(
    res: Response,
    args?: { image: string; description: string; title?: string }
  ) {
    const url = remult.context.origin
    let title = (args?.title || getBackendSite().title).replace(/"/g, '&quot;')
    //if (title.length < 30) title += ' - אפליקציית שינועים'
    let result = fs
      .readFileSync(process.cwd() + '/dist/angular-starter-project/index.html')
      .toString()
      .replace(/!!!NAME!!!/g, title)
      .replace(/!!!ORG!!!/g, getBackendSite()!.urlPrefix)
      .replace(/\/assets\/favicon.png/g, url + '/assets/favicon.png')
      .replace(/\/assets\/logo.png/g, url + '/assets/logo.png')
    if (args?.description)
      if (args?.image) {
        result = result.replace(/\/assets\/logo.png/g, '/images/' + args.image)
      } else result = result.replace(/\/assets\/logo.png/g, '')
    let info = args?.description || getSite().defaultLinkDescription || title
    info = info.replace(/"/g, '&quot;')
    result = result.replace(/!!!INFO!!!/g, info)
    res.send(result)
  }
}
startup()
