import express, { Response } from 'express'
import sslRedirect from 'heroku-ssl-redirect'
import helmet from 'helmet'
import compression from 'compression'
import { api, schema } from './api'
import session from 'cookie-session'
import fs from 'fs'
import { getTitle } from 'src/app/users/sites'
import { remult, repo } from 'remult'
import { Task, TaskImage, taskStatus } from '../app/events/tasks'

async function startup() {
  const app = express()
  app.use(sslRedirect())
  app.use(
    session({
      secret:
        process.env['NODE_ENV'] === 'production'
          ? process.env['SESSION_SECRET']
          : 'my secret1',
    })
  )
  app.use(compression())
  //app.use(helmet({ contentSecurityPolicy: false }))

  app.use(api)

  app.get('/', (req, res) => sendIndex(res))
  app.get('/index.html', (req, res) => sendIndex(res))
  app.get('/assets/logo.png', (req, res) => sendSchemaSpecificFile('logo', res))
  app.get('/assets/favicon.png', (req, res) =>
    sendSchemaSpecificFile('favicon', res)
  )
  app.get('/images/:id', api.withRemult, async (req, res) => {
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

  app.get('/t/:id', api.withRemult, async (req, res) => {
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
  app.use(express.static('dist/angular-starter-project'))
  app.use('/*', async (req, res) => {
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
    let theFile = fileWithPath + '-' + schema + '.png'
    if (fs.existsSync(theFile)) res.sendFile(theFile, { root: process.cwd() })
    else res.sendFile(fileWithPath + '.png', { root: process.cwd() })
  }

  function sendIndex(
    res: Response,
    args?: { image: string; description: string }
  ) {
    let result = fs
      .readFileSync(process.cwd() + '/dist/angular-starter-project/index.html')
      .toString()
      .replace(/!!!NAME!!!/g, getTitle())
      .replace(/!!!ORG!!!/g, schema)
    if (args?.image) {
      result = result.replace(/\/assets\/logo.png/g, '/images/' + args.image)
    }
    let info = args?.description || getTitle()
    result = result.replace(/!!!INFO!!!/g, info)
    res.send(result)
  }
}
startup()
