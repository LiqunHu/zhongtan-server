const _ = require('lodash')
const path = require('path')
const fs = require('fs')
const Joi = require('joi')
const fileUtil = require('server-utils').fileUtil
const moment = require('moment')

const config = require('../app/config')
const Error = require('./Error')
const logger = require('../app/logger').createLogger(__filename)

// common response
const docValidate = req => {
  let doc = req.body
  return doc
}

const reqTrans = (req, callFile) => {
  let method = req.params.method
  let doc = req.body
  let validatorFile = callFile.substring(0, callFile.length - 3) + '.validator.js'
  if (fs.existsSync(validatorFile)) {
    let validator = require(validatorFile)
    if (validator.apiList[method]) {
      let reqJoiSchema = validator.apiList[method].JoiSchema
      if (reqJoiSchema.body) {
        let result = Joi.validate(doc, reqJoiSchema.body)
        if (result.error) {
          throw result.error
        }
      }
    }
  }

  return method
}

// common response
const success = data => {
  if (data) {
    return data
  } else {
    return {}
  }
}

const error = errcode => {
  if (_.isString(errcode)) {
    return errcode
  } else {
    return 'common_02'
  }
}

const sendData = (res, data) => {
  if (_.isString(data)) {
    if ('WebSocket' in res || 'rabbitmq' in res) {
      res.errno = data
      if (data in Error) {
        res.msg = Error[data]
      } else {
        res.msg = '错误未配置'
      }
    } else {
      let sendData
      if (data in Error) {
        sendData = {
          errno: data,
          msg: Error[data]
        }
      } else {
        sendData = {
          errno: data,
          msg: '错误未配置'
        }
      }
      res.status(700).send(sendData)
    }
  } else {
    if ('WebSocket' in res || 'rabbitmq' in res) {
      res.info = data
    } else {
      res.send({
        errno: '0',
        msg: 'ok',
        info: data
      })
    }
  }
}

const sendFault = (res, msg) => {
  let sendData = {}
  logger.error(msg.stack)

  if ('WebSocket' in res || 'rabbitmq' in res) {
    res.errno = -1
    res.msg = msg.stack
  } else {
    if (process.env.NODE_ENV === 'test') {
      sendData = {
        errno: -1,
        msg: msg.stack
      }
    } else {
      sendData = {
        errno: -1,
        msg: 'Internal Error'
      }
    }
    res.status(500).send(sendData)
  }
}

const generateRandomAlphaNum = len => {
  let charSet = '0123456789'
  let randomString = ''
  for (let i = 0; i < len; i++) {
    let randomPoz = Math.floor(Math.random() * charSet.length)
    randomString += charSet.substring(randomPoz, randomPoz + 1)
  }
  return randomString
}

const getApiName = path => {
  if (path) {
    let patha = path.split('/')
    let func = patha[patha.length - 1].toUpperCase()
    return func
  } else {
    return ''
  }
}

const generateNonceString = length => {
  let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let maxPos = chars.length
  let noceStr = ''
  for (let i = 0; i < (length || 32); i++) {
    noceStr += chars.charAt(Math.floor(Math.random() * maxPos))
  }
  return noceStr
}

const getUploadTempPath = uploadurl => {
  let fileName = path.basename(uploadurl)
  return path.join(__dirname, '../' + config.uploadOptions.uploadDir + '/' + fileName)
}

const fileSave = async (req, bucket) => {
  if (config.fileSys.type === 'local') {
    let relPath = 'upload/' + moment().format('YYYY/MM/DD/')
    let svPath = path.join(process.cwd(), config.fileSys.filesDir, relPath)
    let fileInfo = await fileUtil.fileSaveLocal(req, svPath, config.fileSys.urlBaseu + relPath)
    return fileInfo
  } else if (config.fileSys.type === 'qiniu') {
    if (config.fileSys.bucket[bucket]) {
      let fileInfo = await fileUtil.fileSaveQiniu(req, config.fileSys.filesDir, bucket, config.fileSys.bucket[bucket].domain)
      return fileInfo
    } else {
      throw new Error('bucket do not exist')
    }
  } else if (config.fileSys.type === 'mongo') {
    if (config.fileSys.bucket[bucket]) {
      let fileInfo = await fileUtil.fileSaveMongo(req, config.fileSys.filesDir, bucket, config.fileSys.bucket[bucket].baseUrl)
      return fileInfo
    } else {
      throw new Error('bucket do not exist')
    }
  }
}

module.exports = {
  docValidate: docValidate,
  reqTrans: reqTrans,
  sendData: sendData,
  sendFault: sendFault,
  success: success,
  error: error,
  getUploadTempPath: getUploadTempPath,
  generateRandomAlphaNum: generateRandomAlphaNum,
  getApiName: getApiName,
  generateNonceString: generateNonceString,
  fileSave: fileSave
}
