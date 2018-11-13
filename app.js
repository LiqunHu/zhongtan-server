const log4js = require('log4js')
const express = require('express')
const path = require('path')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')

const config = require('./config')

let app = express()
let cors = require('cors')
let ejs = require('ejs')

let authority = require('./util/Authority')
let AuthSRV = require('./util/AuthSRV')
let FileSRV = require('./util/FileSRV')
let routers = require('./routes')

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

app.engine('.html', ejs.__express)
app.set('view engine', 'html')

app.use(cors())

app.use(express.static(path.join(__dirname, 'public')))
app.use('/temp', express.static(path.join(__dirname, '../public/temp')))
if (config.mongoFileFlag === false) {
  app.use('/files', express.static(path.join(__dirname, '../public/files')))
}
app.use(
  log4js.connectLogger(log4js.getLogger('http'), {
    level: 'auto',
    nolog: '\\.gif|\\.jpg$'
  })
)
app.use(
  bodyParser.json({
    limit: '50mb'
  })
)
app.use(
  bodyParser.urlencoded({
    extended: false
  })
)
app.use(
  bodyParser.text({
    type: 'text/*'
  })
)
app.use(bodyParser.raw())
app.use(cookieParser())
// 错误处理
// app.use((err, req, res) => {
//   res.status(err.status || 500)

//   res.writeHeader(err.status || 500, {
//     'Content-Type': 'application/json;charset=utf-8'
//   })
//   res.write(
//     JSON.stringify({
//       status: {
//         status_code: err.status,
//         status_reason: err.message
//       }
//     })
//   )
//   res.end()
// })

// error handler
app.use(function(err, req, res, next) {
  // specific for validation errors
  if (err instanceof ev.ValidationError) return res.status(err.status).json(err)

  // other type of errors, it *might* also be a Runtime Error
  // example handling
  if (process.env.NODE_ENV !== 'production') {
    return res.status(500).send({
      errno: -1,
      msg: err.stack
    })
  } else {
    return res.status(500).send({
      errno: -1,
      msg: 'Internal Error'
    })
  }
})

app.use('/api', authority.AuthMiddleware)

//处理webpack服务请求
app.get('/__webpack_hmr', function(req, res) {
  res.send('')
})

app.get('/', (req, res) => {
  res.redirect('index.html')
})

if (config.mongoFileFlag) {
  app.get('/filesys/:filetag', FileSRV.FileResource)
}

app.post('/api/auth', AuthSRV.AuthResource)
app.post('/api/signout', AuthSRV.SignOutResource)

//common
app.use('/api/common', routers.common)

//zhongtan
app.use('/api/zhongtan', routers.zhongtan)

// todo
module.exports = app
