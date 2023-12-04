import { resolve } from 'node:path'
import { stat } from 'node:fs/promises'
import { App as TinyhttpApp } from '@tinyhttp/app'
import { renderToString } from 'inferno-server'
import { StaticRouter, matchPath } from 'inferno-router'

import { config } from '../config'
import { routes } from './routes'

import { App as InfernoApp } from './components'

const app = new TinyhttpApp()

// peony sends the client a JWT, but a JWT cannot be provided by the browser on its first request.
// The solution is to let the frontend server put the JWT in a cookie and give the cookie to the browser.
app.get('/auth', async (req, res) => {
  res.send('use this route for setting cookies')
})

// TODO endpoint to create sitemap

// Serve static files
// Note: in production, configure lighttpd to serve static files instead for better security and performance.
app.get('/static/*', async (req, res) => {
  return await fileResponse(req.path, res)
})

// Serve static files during development.
// Note: in production, configure lighttpd to serve static files instead.
app.get('/favicon.ico', async (req, res) => {
  const adjustedPath = `static${req.path}`
  return await fileResponse(adjustedPath, res)
})

// Every other route can be handled by inferno-router
app.get('/*', async (req, res) => {
  return await infernoServerResponse(req, res)
})

app.listen(config.PORT)

async function fileResponse (path, res) {
  const filePath = resolve(`dist${path}`)

  try {
    const stats = await stat(filePath)

    if (!stats.isFile()) {
      res.sendStatus(404)
    } else {
      res.sendFile(filePath)
    }
  } catch (err) {
    // TODO handle errors correctly
    res.sendStatus(404)
  }
}

async function infernoServerResponse (req, res) {
  try {
    let currentRoute = routes.find((route) => matchPath(req.url, route))
    if (!currentRoute) {
      currentRoute = {}
    }

    let initialData = {}
    if (currentRoute.getInitialData) {
      initialData = await (await currentRoute.getInitialData()).json()
    }

    const context = { initialData }
    const renderedApp = renderToString(
      <StaticRouter
        context={context}
        location={req.url}
      >
        <InfernoApp />
      </StaticRouter>
    )

    if (context.url) {
      return res.redirect(context.url)
    }

    const language = 'en'

    // Use initialData to manage head elements
    let title = 'Coachonko\'s Inferno Starter'
    if (initialData) {
      if (initialData.title) {
        title = initialData.title
      }
    }

    const description = 'Starter for Inferno applications'

    return res.send(`
      <!DOCTYPE html>
      <html lang="${language}">

      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="robots" content="noindex, nofollow">

        <title>${title}</title>
        <meta name="description" content="${description}">
        <link rel="stylesheet" type="text/css" href="static/bundle.css">

        <script>window.___initialData = ${JSON.stringify(initialData)};</script>
        <script src="static/client.js" defer></script>
      </head>

      <body>
        <noscript>You need to enable JavaScript to run this app.</noscript>
        <div id="root">${renderedApp}</div>
      </body>

      </html>
    `)
  } catch (err) {
    console.log(err)
  // TODO handle err
  }
}
