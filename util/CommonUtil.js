const _ = require('lodash')
const uuid = require('uuid')
const path = require('path')
const fs = require('fs')
const ejs = require('ejs')
const wkhtmltopdf = require('wkhtmltopdf')
const wkhtmltoimage = require('wkhtmltoimage')
const ejsExcel = require('ejsexcel')
const format = require('util').format
const Joi = require('joi')
const WebSocket = require('ws')

const config = require('../config')
const Error = require('./Error')
const logger = require('./Logger').createLogger('CommonUtil.js')

// String trim
String.prototype.trim = function() {
  //return this.replace(/[(^\s+)(\s+$)]/g,"");//會把字符串中間的空白符也去掉
  //return this.replace(/^\s+|\s+$/g,""); //
  return this.replace(/^\s+/g, '').replace(/\s+$/g, '')
}

// common response
function docValidate(req) {
  let doc = req.body
  if (req.JoiSchema) {
    let result = Joi.validate(doc, req.JoiSchema)
    if (result.error === null) {
      return doc
    } else {
      throw result.error
    }
  } else {
    return doc
  }
  // for (let idx in doc) {
  //   //不使用过滤
  //   if (typeof doc[idx] == 'string') {
  //     doc[idx] = doc[idx].trim()
  //   }
  // }
}

function reqTrans(req, callFile) {
  let method = req.params.method
  let validatorFile = callFile.substring(0, callFile.length - 3) + '.validator.js'
  if (fs.existsSync(validatorFile)) {
    let validator = require(validatorFile)
    if (validator.apiList[method]) {
      let reqJoiSchema = validator.apiList[method].JoiSchema
      if (reqJoiSchema.body) {
        req.JoiSchema = reqJoiSchema.body
      }
    }
  }

  return method
}

// common response
function sendData(res, data) {
  let datares = arguments[1] ? arguments[1] : {}
  let sendData = {
    errno: 0,
    msg: 'ok',
    info: datares
  }
  res.send(sendData)
}

function sendError(res, errno, msg = '错误未配置') {
  let errnores = arguments[1] ? arguments[1] : -1
  let msgres = arguments[2] ? arguments[2] : 'error'
  let sendData
  if (errnores in Error) {
    sendData = {
      errno: errnores,
      msg: Error[errnores]
    }
  } else {
    sendData = {
      errno: errnores,
      msg: msg
    }
  }
  res.status(700).send(sendData)
}

function sendFault(res, msg) {
  let msgres = arguments[1] ? arguments[1] : 'Internal Error'
  let sendData = {}
  logger.error(msg)
  if (process.env.NODE_ENV === 'test') {
    sendData = {
      errno: -1,
      msg: msgres.message
    }
  } else {
    sendData = {
      errno: -1,
      msg: 'Internal Error'
    }
  }
  res.status(500).send(sendData)
}

// function fileMove(url, mode) {
//   return new Promise(async function (resolve, reject) {
//     if (url) {
//       let fileName = path.basename(url)
//       let relPath = ''
//       let today = new Date()
//       if (mode == 'avatar') {
//         relPath = 'avatar/' + today.getFullYear() + '/' + today.getMonth() + '/' + today.getDate() + '/'
//       } else if (mode == 'upload') {
//         relPath = 'upload/' + today.getFullYear() + '/' + today.getMonth() + '/' + today.getDate() + '/'
//       } else {
//         reject('mode error');
//       }

//       let svPath = path.join(__dirname, '../' + config.filesDir + '/' + relPath);

//       if (!fs.existsSync(svPath)) {
//         mkdirssync(svPath)
//       }

//       let tempfile = path.join(__dirname, '../' + config.uploadOptions.uploadDir + '/' + fileName);
//       if (config.mongoFileFlag) {
//         let connectStr = ''
//         if (config.mongo.auth) {
//           connectStr = format(config.mongo.connect,
//             config.mongo.auth.username, config.mongo.auth.password);
//         } else {
//           connectStr = config.mongo.connect
//         }
//         mongodb.MongoClient.connect(connectStr, async function (err, db) {
//           if (err) reject(err)
//           try {
//             // Our file ID
//             let fileId = new mongodb.ObjectID();
//             let mongoName = fileId + path.extname(fileName)
//             let gridStore = new mongodb.GridStore(db, fileId, mongoName, 'w', {
//               content_type: mime.lookup(fileName)
//             })
//             let gs = await gridStore.open()
//             let fileData = fs.readFileSync(tempfile);
//             await gs.write(fileData)
//             await gs.close()
//             fs.unlinkSync(tempfile)
//             db.close()
//             resolve(config.fileUrlBase + mongoName)
//           } catch (error) {
//             db.close()
//             reject(error);
//           }
//         });
//       } else {
//         fs.renameSync(tempfile, path.join(svPath, fileName))
//         resolve(config.fileUrlBase + relPath + fileName);
//       }
//     } else {
//       reject('url error');
//     }
//   })
// }

// function fileGet(url) {
//   return new Promise(async function (resolve, reject) {
//     if (url) {
//       let connectStr = ''
//       if (config.mongo.auth) {
//         connectStr = format(config.mongo.connect,
//           config.mongo.auth.username, config.mongo.auth.password);
//       } else {
//         connectStr = config.mongo.connect
//       }
//       mongodb.MongoClient.connect(connectStr, async function (err, db) {
//         if (err) reject(err)
//         try {
//           let fileName = path.basename(url)
//           let gridStore = new mongodb.GridStore(db, fileName, 'r')
//           gridStore.open(function (err, gs) {
//             if (err) {
//               reject(err);
//             }
//             gridStore.seek(0, function () {
//               gridStore.read(function (err, data) {
//                 if (err) {
//                   reject(err);
//                 }
//                 db.close();
//                 resolve(data)
//               });
//             })
//           })
//         } catch (error) {
//           db.close()
//           reject(error);
//         }
//       });
//     } else {
//       reject('url error');
//     }
//   })
// }

// function fileRemove(url) {
//   return new Promise(async function (resolve, reject) {
//     if (url) {
//       if (config.mongoFileFlag) {
//         let connectStr = ''
//         if (config.mongo.auth) {
//           connectStr = format(config.mongo.connect,
//             config.mongo.auth.username, config.mongo.auth.password);
//         } else {
//           connectStr = config.mongo.connect
//         }
//         mongodb.MongoClient.connect(connectStr, async function (err, db) {
//           if (err) reject(err)
//           try {
//             let fileName = path.basename(url)
//             // Our file ID
//             mongodb.GridStore.unlink(db, fileName, function (err) {
//               if (err) reject(err)
//               db.close()
//               resolve('ok')
//             })
//           } catch (error) {
//             db.close()
//             reject(error);
//           }
//         });
//       } else {
//         resolve(config.fileUrlBase + relPath + fileName);
//       }
//     } else {
//       reject('url error');
//     }
//   })
// }

function generateRandomAlphaNum(len) {
  let charSet = '0123456789'
  let randomString = ''
  for (let i = 0; i < len; i++) {
    let randomPoz = Math.floor(Math.random() * charSet.length)
    randomString += charSet.substring(randomPoz, randomPoz + 1)
  }
  return randomString
}

function getApiName(path) {
  if (path) {
    let patha = path.split('/')
    let func = patha[patha.length - 2].toUpperCase()
    return func
  } else {
    return ''
  }
}

function buildXML(json) {
  let builder = new xml2js.Builder()
  return builder.buildObject(json)
}

function parseXML(xml) {
  return new Promise(function(resolve, reject) {
    let parser = new xml2js.Parser({
      trim: true,
      explicitArray: false,
      explicitRoot: false
    })
    parser.parseString(xml, function(err, result) {
      if (err) reject(err)
      resolve(result)
    })
  })
}

function generateNonceString(length) {
  let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let maxPos = chars.length
  let noceStr = ''
  for (let i = 0; i < (length || 32); i++) {
    noceStr += chars.charAt(Math.floor(Math.random() * maxPos))
  }
  return noceStr
}

function getUploadTempPath(uploadurl) {
  let fileName = path.basename(uploadurl)
  return path.join(__dirname, '../' + config.uploadOptions.uploadDir + '/' + fileName)
}

function getUUIDByTime(offset) {
  let uuidStand = uuid.v1()
  let uuidArr = uuidStand.split('-')
  let uuidResult = ''

  for (let i = 0; i < uuidArr.length; i++) {
    uuidResult += uuidArr[i]
  }
  return uuidResult.substring(0, offset)
}

function ejs2File(templateFile, renderData, options, outputType, res) {
  return new Promise(function(resolve, reject) {
    try {
      let data = JSON.parse(JSON.stringify(renderData))
      if (!data) {
        data = {}
      }

      let zoom = 1,
        pageSize = 'A4',
        orientation = 'Portrait',
        tempName = uuid.v4().replace(/-/g, '')

      if (options) {
        if (options.zoom) {
          zoom = options.zoom
        }
        if (options.pageSize) {
          pageSize = options.pageSize
        }
        if (options.orientation) {
          orientation = options.orientation
        }
        if (options.name) {
          tempName = options.name
        }
      }

      data.basedir = path.join(__dirname, '../printTemplate')
      let ejsFile = fs.readFileSync(path.join(__dirname, '../printTemplate/' + templateFile), 'utf8')
      let html = ejs.render(ejsFile, data)

      if (options.htmlFlag || outputType === 'htmlurl') {
        let htmlData = data
        fs.writeFileSync(path.join(__dirname, '../', config.tempDir, tempName + '.html'), html)
      }

      if (outputType === 'htmlurl') {
        resolve(config.tmpUrlBase + tempName + '.html')
      } else if (outputType === 'html') {
        res.type('html')
        res.send(html)
      } else if (outputType === 'image') {
        let outSteam = wkhtmltoimage.generate(html, {})
        if (res) {
          res.type('jpg')
          res.set({
            'Content-Disposition': 'attachment; filename=' + tempName + '.jpg'
          })
          outSteam.pipe(res)
          resolve()
        } else {
          let tempFile = tempName + '.jpg'
          outSteam.pipe(fs.createWriteStream(path.join(__dirname, '../', config.tempDir, tempFile)))
          outSteam.on('end', function() {
            resolve(config.tmpUrlBase + tempFile)
          })
        }
      } else if (outputType === 'pdf') {
        let outSteam = wkhtmltopdf(html, {
          zoom: zoom,
          pageSize: pageSize,
          orientation: orientation
        })
        if (res) {
          res.type('pdf')
          res.set({
            'Content-Disposition': 'attachment; filename=' + tempName + '.pdf'
          })
          outSteam.pipe(res)
          resolve()
        } else {
          let tempFile = tempName + '.pdf'
          outSteam.pipe(fs.createWriteStream(path.join(__dirname, '../', config.tempDir, tempFile)))
          outSteam.on('end', function() {
            resolve(config.tmpUrlBase + tempFile)
          })
        }
      } else {
        reject('outputType error')
      }
    } catch (error) {
      reject(error)
    }
  })
}

function ejs2xlsx(templateFile, renderData, res) {
  return new Promise(function(resolve, reject) {
    try {
      let templateBuf = fs.readFileSync(path.join(__dirname, '../dumpTemplate/' + templateFile))
      ejsExcel
        .renderExcel(templateBuf, renderData)
        .then(function(exlBuf) {
          let tempName = uuid.v4().replace(/-/g, '') + '.xlsx'
          if (res) {
            res.type('xlsx')
            res.set({
              'Content-Disposition': 'attachment; filename=' + tempName
            })
            res.send(exlBuf)
            resolve()
          } else {
            fs.writeFileSync(path.join(__dirname, '../', config.tempDir, tempName), exlBuf)
            resolve(config.tmpUrlBase + tempName)
          }
        })
        .catch(function(error) {
          reject(error)
        })
    } catch (error) {
      reject(error)
    }
  })
}

function getWSClients(req) {
  let authorization = req.get('authorization')
  let clients = []
  global.wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN && authorization === client.authorization) {
      clients.push(client)
    }
  })
  return clients
}

function getWSClientsByToken(token) {
  let clients = []
  global.wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN && token === client.authorization) {
      clients.push(client)
    }
  })
  return clients
}

function wsClientsSend(clents, msg) {
  for (let c of clents) {
    c.send(msg)
  }
}

function wsClientsClose(clents, msg) {
  for (let c of clents) {
    c.terminate()
  }
}

function str2Money(str) {
  let money = parseFloat(str)
  return Math.round(money * 100)
}

function Money2Str(money) {
  return (money / 100).toFixed(2)
}

module.exports = {
  docValidate: docValidate,
  reqTrans: reqTrans,
  sendData: sendData,
  sendError: sendError,
  sendFault: sendFault,
  getUploadTempPath: getUploadTempPath,
  generateRandomAlphaNum: generateRandomAlphaNum,
  getApiName: getApiName,
  buildXML: buildXML,
  parseXML: parseXML,
  generateNonceString: generateNonceString,
  getUUIDByTime: getUUIDByTime,
  ejs2File: ejs2File,
  ejs2xlsx: ejs2xlsx,
  getWSClients: getWSClients,
  wsClientsSend: wsClientsSend,
  getWSClientsByToken: getWSClientsByToken,
  wsClientsClose: wsClientsClose,
  str2Money: str2Money,
  Money2Str: Money2Str
}
