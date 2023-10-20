import express, { Response } from 'express'
import sslRedirect from 'heroku-ssl-redirect'
import helmet from 'helmet'
import compression from 'compression'
import { api, schema } from './api'
import session from 'cookie-session'
import fs from 'fs'
import { getTitle } from '../app/users/SignInController'

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
  app.get('/assets/logo.png', (req, res) => sendSchemaFile('logo', res))
  app.get('/assets/favicon.png', (req, res) => sendSchemaFile('favicon', res))
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

  function sendSchemaFile(file: string, res: Response) {
    const fileWithPath = 'src/assets/' + file
    let theFile = fileWithPath + '-' + schema + '.png'
    if (fs.existsSync(theFile)) res.sendFile(theFile, { root: process.cwd() })
    else res.sendFile(fileWithPath + '.png', { root: process.cwd() })
  }

  function sendIndex(res: Response) {
    res.send(
      fs
        .readFileSync(
          process.cwd() + '/dist/angular-starter-project/index.html'
        )
        .toString()
        .replace(/!!!NAME!!!/g, getTitle())
    )
  }
}
startup()
