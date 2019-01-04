const log4js = require('log4js')
const express = require('express')
const path = require('path')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const app = express()
const cors = require('cors')
const authority = require('server-utils').authority

const systemTrace = require('./systemtrace')
const model = require('./model')
const config = require('./config')
const FileSRV = require('../services/FileSRV')
const routers = require('../routes')

app.use(cors())

app.use(express.static(path.join(__dirname, '../public')))
app.use('/temp', express.static(path.join(__dirname, '../../public/temp')))
app.use('/files', express.static(path.join(__dirname, '../../public/files')))
app.get('/filesys/:bucket/:filetag', FileSRV.FileResource)
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

authority.initMiddleware(model, config)
app.use('/api', authority.AuthMiddleware, systemTrace)

//处理webpack服务请求
app.get('/__webpack_hmr', function(req, res) {
  res.send('')
})

app.get('/', (req, res) => {
  res.redirect('index.html')
})

//test
app.use('/api/test', routers.test)

//common
app.use('/api/common', routers.common)

//auth
app.use('/api/auth', routers.auth)

//zhongtan
app.use('/api/zhongtan', routers.zhongtan)

module.exports = app
