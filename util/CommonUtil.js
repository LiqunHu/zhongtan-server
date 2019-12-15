const _ = require('lodash')
const uuid = require('uuid')
const path = require('path')
const fs = require('fs')
const Joi = require('joi')
const ejs = require('ejs')
const fileUtil = require('server-utils').fileUtil
const moment = require('moment')
const ejsExcel = require('ejsexcel')
const JSZip = require('jszip')
const Docxtemplater = require('docxtemplater')
const puppeteer = require('puppeteer')

const config = require('../app/config')
const Error = require('./Error')
const logger = require('../app/logger').createLogger(__filename)

Date.prototype.Format = function(fmt) {
  //author: meizz
  var o = {
    'M+': this.getMonth() + 1, //月份
    'd+': this.getDate(), //日
    'h+': this.getHours(), //小时
    'm+': this.getMinutes(), //分
    's+': this.getSeconds(), //秒
    'q+': Math.floor((this.getMonth() + 3) / 3), //季度
    S: this.getMilliseconds() //毫秒
  }
  if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + '').substr(4 - RegExp.$1.length))
  for (var k in o)
    if (new RegExp('(' + k + ')').test(fmt)) fmt = fmt.replace(RegExp.$1, RegExp.$1.length == 1 ? o[k] : ('00' + o[k]).substr(('' + o[k]).length))
  return fmt
}

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
    let func = patha[patha.length - 2].toUpperCase()
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
      let tempDir = path.join(process.cwd(), config.fileSys.filesDir)
      let fileInfo = await fileUtil.fileSaveQiniu(req, tempDir, bucket, config.fileSys.bucket[bucket].domain)
      return fileInfo
    } else {
      throw new Error('bucket do not exist')
    }
  } else if (config.fileSys.type === 'mongo') {
    if (config.fileSys.bucket[bucket]) {
      let tempDir = path.join(process.cwd(), config.fileSys.filesDir)
      let fileInfo = await fileUtil.fileSaveMongo(req, tempDir, bucket, config.fileSys.bucket[bucket].baseUrl)
      return fileInfo
    } else {
      throw new Error('bucket do not exist')
    }
  }
}
const fileSaveTemp = async req => {
  let tempDir = path.join(process.cwd(), config.fileSys.filesDir)
  let fileInfo = await fileUtil.fileSaveLocal(req, tempDir, config.fileSys.tempUrl)
  return fileInfo
}

function str2Money(str) {
  let money = parseFloat(str)
  return Math.round(money * 100)
}

function money2Str(money) {
  return (money / 100).toFixed(2)
}

async function ejs2Pdf(templateFile, renderData, bucket) {
  let data = JSON.parse(JSON.stringify(renderData))
  if (!data) {
    data = {}
  }

  data.basedir = path.join(__dirname, '../printTemplate')
  let ejsFile = fs.readFileSync(path.join(__dirname, '../printTemplate/' + templateFile), 'utf8')
  let html = ejs.render(ejsFile, { ejsData: data })
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.setContent(html)
  let filePath = path.join(process.cwd(), config.fileSys.filesDir, uuid.v4().replace(/-/g, '') + '.pdf')
  await page.pdf({ path: filePath, format: 'A4', landscape: true })
  await browser.close()
  let fileInfo = await fileUtil.fileSaveMongoByLocalPath(filePath, bucket, config.fileSys.bucket[bucket].baseUrl)
  return fileInfo
}

const ejs2xlsx = async (templateFile, renderData, bucket) => {
  let templateBuf = fs.readFileSync(path.join(process.cwd(), './excelTemplate/', templateFile))
  let exlBuf = await ejsExcel.renderExcel(templateBuf, renderData)
  let filePath = path.join(process.cwd(), config.fileSys.filesDir, uuid.v4().replace(/-/g, '') + '.xlsx')
  fs.writeFileSync(filePath, exlBuf)
  if (bucket) {
    let fileInfo = await fileUtil.fileSaveMongoByLocalPath(filePath, bucket, config.fileSys.bucket[bucket].baseUrl)
    return fileInfo
  } else {
    return filePath
  }
}

const ejs2Word = async (templateFile, renderData, res) => {
  let content = fs.readFileSync(path.join(__dirname, '../docxTemplate/' + templateFile), 'binary')
  let zip = new JSZip(content)
  let doc = new Docxtemplater()
  doc.loadZip(zip)
  doc.setData(renderData)
  doc.render()
  let buf = doc.getZip().generate({ type: 'nodebuffer' })
  res.type('docx')
  res.set({
    'Content-Disposition': 'attachment; filename=111.docx'
  })
  res.send(buf)
}

const getContainerISO = (cType, cSize) => {
  if (cType === 'AA' && cSize === 'BB') {
    return 'aaa'
  } else {
    return 'aaa'
  }
}

const getContainerCBM = size => {
  if (size === '20GP') {
    return '9.577'
  } else {
    return ''
  }
}

const getContainerTare = size => {
  if (size === '40HQ') {
    return '4.0'
  } else if (size === '45G1') {
    return '4.0'
  } else {
    return ''
  }
}

const df = strInput => {
  return strInput ? strInput._text : ''
}

const getDelivery = strInput => {
  if (strInput === 'WITZDL008') {
    return 'KICD'
  } else if (strInput === 'WITZDL012') {
    return 'AFICD'
  } else if (strInput === 'WITZDL018') {
    return 'ETC CARGO'
  } else if (strInput === 'WITZDL020') {
    return 'HESU'
  } else if (strInput === 'WITZW025') {
    return 'GALCO'
  } else if (strInput === 'WITZDL028') {
    return 'AZAM ICD'
  } else if (strInput === 'WITZDL029') {
    return 'MAS HOLDING'
  } else if (strInput === 'WITZDL030') {
    return 'TRANS AFRICAN LOGISTICS'
  } else if (strInput === 'WITZDL031') {
    return 'SILVER INTERTRADE LTD'
  } else if (strInput === 'WITZDL032') {
    return 'AMI TANZANIA LTD'
  } else if (strInput === 'WITZDL033') {
    return 'TRH'
  } else if (strInput === 'WITZDL034') {
    return 'PMM'
  } else if (strInput === 'WITZDL035') {
    return 'DICD'
  } else if (strInput === 'WITZDL036') {
    return 'EAST COST LIQUIDS'
  } else if (strInput === 'WITZDL037') {
    return 'TANZANIA LIQUIDS '
  } else if (strInput === 'WITZDL038') {
    return 'VOT TANZANIA LTD'
  } else if (strInput === 'WITZDL039') {
    return 'MOFED TANZANIA'
  } else if (strInput === 'WITZDL040') {
    return 'AL-HUSHOOM INVESTMENT'
  } else if (strInput === 'WITZDL041') {
    return 'FARION TRADING LTD'
  } else if (strInput === 'WITZDL042') {
    return 'MCC LTD'
  } else if (strInput === 'WITZDL098') {
    return 'JEFAG'
  } else if (strInput === 'WITZDL099') {
    return 'UBONGO (TICTS)'
  } else if (strInput === 'WTTZDL001') {
    return 'TPA TERMINAL'
  } else if (strInput === 'WTTZDL002') {
    return 'TICTS TERMINAL'
  } else {
    return strInput
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
  fileSave: fileSave,
  fileSaveTemp: fileSaveTemp,
  str2Money: str2Money,
  money2Str: money2Str,
  ejs2Pdf: ejs2Pdf,
  ejs2xlsx: ejs2xlsx,
  ejs2Word: ejs2Word,
  getContainerISO: getContainerISO,
  getContainerCBM: getContainerCBM,
  df: df,
  getContainerTare: getContainerTare,
  getDelivery: getDelivery
}
