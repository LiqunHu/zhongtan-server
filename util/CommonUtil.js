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
const puppeteerBrowser = require('../../util/PuppeteerBrowser')

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
  const browser = await puppeteerBrowser.getBrowser()
  const page = await browser.newPage()
  await page.setContent(html)
  let filePath = path.join(process.cwd(), config.fileSys.filesDir, uuid.v4().replace(/-/g, '') + '.pdf')
  await page.pdf({ path: filePath, format: 'A4', landscape: true })
  await page.close()
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
  } else if (strInput === 'WITZDL018') {
    return 'ETC CARGO'
  } else if (strInput === 'WITZDL020') {
    return 'HESU'
  } else if (strInput === 'WITZDL022') {
    return 'AFICD'
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

const fs2Edi = async (renderData) => {
  // INSERT INTO `seqmysql` (`seqname`, `currentValue`, `increment`, `max`) VALUES ('ediInterchangeIDSeq', '1', '1', '99999');
  // INSERT INTO `seqmysql` (`seqname`, `currentValue`, `increment`, `max`) VALUES ('ediMessageIDSeq', '1', '1', '999999');
  // ALTER TABLE tbl_zhongtan_invoice_vessel ADD `invoice_vessel_call_sign` varchar(20) DEFAULT NULL COMMENT '呼号';
  // ALTER TABLE tbl_zhongtan_invoice_masterbl ADD invoice_masterbi_do_delivery_order_no VARCHAR (20) COMMENT 'delivery_order_no';
  // ALTER TABLE tbl_zhongtan_invoice_masterbl ADD invoice_masterbi_do_edi_state VARCHAR (5) COMMENT 'EDI status';
  // ALTER TABLE tbl_zhongtan_invoice_masterbl ADD invoice_masterbi_do_edi_create_time datetime COMMENT 'EDI create at';
  // ALTER TABLE tbl_zhongtan_invoice_masterbl ADD invoice_masterbi_do_edi_update_time datetime COMMENT 'EDI update_at';
  // ALTER TABLE tbl_zhongtan_invoice_masterbl ADD invoice_masterbi_do_edi_cancel_time datetime COMMENT 'EDI cancel_at';

  let data = JSON.parse(JSON.stringify(renderData))
  
  if (!data) {
    data = {}
  }
  let ediLines = 0
  // line 1
  // let interchangeTime = curMoment.format('YYMMDD:HHmm')
  let ediTxt = 'UNB+UNOA:2+' + data.senderID + '+TICTS+' + data.interchangeTime + '+' + data.interchangeID + '\'\r\n'
  ediLines++
  // line 2
  ediTxt += 'UNH+' + data.messageID + '+COREOR:D:00B:UN:SMDG20\'\r\n'
  ediLines++
  // line 3
  // messageFunction an..3
  // 1 – Cancellation
  // 5 – Replace 
  // 9 – Original
  ediTxt += 'BGM+129+' + data.interchangeID + '+' + data.messageFunction + '\'\r\n'
  ediLines++
  // line 4
  // CCYYMMDDHHMM
  ediTxt += 'DTM+137:' + data.documentDateTime + ':203\'\r\n'
  ediLines++
  // line 5
  ediTxt += 'RFF+RE:' + data.deliveryOrderNumber + '\'\r\n'
  ediLines++
  // line 6
  ediTxt += 'RFF+BM:' + data.billOfLadingNo +'\'\r\n'
  ediLines++
  // line 7
  // CCYYMMDD
  ediTxt += 'DTM+36:' + data.expiryDate + ':102\'\r\n'
  ediLines++
  // line 8
  // Effective date/time CCYYMMDD
  ediTxt += 'DTM+7:' + data.effectiveDate + ':102\'\r\n'
  ediLines++
  // line 9
  ediTxt += 'TDT+20+' +data.voyageNo + '+1++' + data.carrierID+ ':172:20+++' + data.vesselCallsign + ':146:11:' +data.vesselName + '\'\r\n'
  ediLines++
  // line 10
  ediTxt += 'RFF+VON:' + data.voyageNo  + '\'\r\n'
  ediLines++
  // line 11
  ediTxt += 'LOC+7+' + data.deliveryPlace.trim() + ':139:6\'\r\n'
  ediLines++
  // line 12
  ediTxt += 'LOC+8+' + data.portFinalDestination.trim() + ':139:6\'\r\n'
  ediLines++
  // line 13
  ediTxt += 'LOC+76+' + data.portOfLoading.trim() + ':139:6\'\r\n'
  ediLines++
  // line 14
  // estimatedArrivalDate ETA
  ediTxt += 'DTM+132:' + data.eta + ':102\'\r\n'
  ediLines++
  // line 15
  ediTxt += 'NAD+MS+' + data.messageSender + ':172:20\'\r\n'
  ediLines++
  // line 16
  ediTxt += 'NAD+CF+' + data.consignee + ':ZZZ:ZZZ\'\r\n'
  ediLines++
  // line 17
  // TIN
  ediTxt += 'NAD+FW+' + data.tin + ':160:ZZZ\'\r\n'
  ediLines++
  // container info group 2 lines
  // equipmentStatus 3-Import 2-Export
  if(data.containers) {
    let seq = 1
    for (let c of data.containers) {
      ediTxt += 'EQD+CN+' + c.containerNumber + '+' + c.containerTypeISOcode + ':102:5++' + c.equipmentStatus + '+5\'\r\n'
      ediLines++
      ediTxt += 'RFF+SQ:' + seq +'\'\r\n'
      ediLines++
      seq++
    }
    ediTxt += 'CNT+16:' + data.containers.length + '\'\r\n'
    ediLines++
  }
  // line ..
  // numberOfMessageSegment
  ediTxt += 'UNT+' + ediLines + '+' + data.messageID + '\'\r\n'
  // line ..
  ediTxt += 'UNZ+1+' + data.interchangeID + '\'\r\n'
  logger.error(ediTxt)
  let filePath = path.join(process.cwd(), config.fileSys.filesDir, data.ediName)
  logger.error(filePath)
  fs.writeFile(filePath, ediTxt, function(err) {
    if (err) {
        throw err
    }
  })
  // let fileInfo = await fileUtil.fileSaveMongoByLocalPath(filePath, bucket, config.fileSys.bucket[bucket].baseUrl)
  return filePath
}

const glbConfigId2Text = (glbDict, id) => {
  if(glbDict) {
    for(let g of glbDict) {
      if(g.id === id) {
        return g.text
      }
    }
  }
  return id
}

const glbConfigId2Attr = (glbDict, id, attr) => {
  if(glbDict) {
    for(let g of glbDict) {
      if(g.id === id) {
        if(attr) {
          return g[attr]
        } else {
          g.text
        }
      }
    }
  }
  return id
}

const fileSaveMongo = async (localPath, bucket) => {
  let fileInfo = await fileUtil.fileSaveMongoByLocalPath(localPath, bucket, config.fileSys.bucket[bucket].baseUrl)
  return fileInfo
}

const checkInvoiceState = bl => {
  if(bl.invoice_masterbi_vessel_type && bl.invoice_masterbi_vessel_type === 'Bulk') {
    if(bl.invoice_masterbi_cargo_type === 'TR' && bl.invoice_masterbi_freight === 'PREPAID') {
      return true
    } else if(bl.invoice_masterbi_fee_release_date) {
      return true
    }
  } else {
    if(bl.invoice_masterbi_cargo_type === 'IM' && bl.invoice_masterbi_freight === 'PREPAID') {
      // deposit， invoice fee two fee two incoice
      if(bl.invoice_masterbi_deposit_release_date && bl.invoice_masterbi_fee_release_date) {
        return true
      }
    } else if(bl.invoice_masterbi_cargo_type === 'IM' && bl.invoice_masterbi_freight === 'COLLECT') {
      // deposit， Ocean, Invoice three fee two invoice
      if(bl.invoice_masterbi_deposit_release_date && bl.invoice_masterbi_fee_release_date) {
        return true
      }
    } else if(bl.invoice_masterbi_cargo_type === 'TR' && bl.invoice_masterbi_freight === 'PREPAID') {
      // at least deposit
      if(bl.invoice_masterbi_deposit_release_date) {
        return true
      }
    } else if(bl.invoice_masterbi_cargo_type === 'TR' && bl.invoice_masterbi_freight === 'COLLECT') {
      // at least deposit， Ocean 
      if(bl.invoice_masterbi_deposit_release_date && bl.invoice_masterbi_fee_release_date) {
        return true
      }
    }
  }
  return false
}

const checkDoState = bl => {
  if(bl.invoice_masterbi_vessel_type && bl.invoice_masterbi_vessel_type === 'Bulk') {
    if(bl.invoice_masterbi_cargo_type === 'TR' && bl.invoice_masterbi_freight === 'PREPAID') {
      return true
    } else if(bl.invoice_masterbi_invoice_receipt_date) {
      return true
    }
  } else {
    if(bl.invoice_masterbi_cargo_type === 'IM' && bl.invoice_masterbi_freight === 'PREPAID') {
      // deposit， invoice fee two fee two incoice
      if(bl.invoice_masterbi_deposit_receipt_date && bl.invoice_masterbi_invoice_receipt_date) {
        return true
      }
    } else if(bl.invoice_masterbi_cargo_type === 'IM' && bl.invoice_masterbi_freight === 'COLLECT') {
      // deposit， Ocean, Invoice three fee two invoice
      if(bl.invoice_masterbi_deposit_receipt_date && bl.invoice_masterbi_invoice_receipt_date) {
        return true
      }
    } else if(bl.invoice_masterbi_cargo_type === 'TR' && bl.invoice_masterbi_freight === 'PREPAID') {
      // at least deposit
      if(bl.invoice_masterbi_deposit_receipt_date) {
        return true
      }
    } else if(bl.invoice_masterbi_cargo_type === 'TR' && bl.invoice_masterbi_freight === 'COLLECT') {
      // at least deposit， Ocean 
      if(bl.invoice_masterbi_deposit_receipt_date && bl.invoice_masterbi_invoice_receipt_date) {
        return true
      }
    }
  }
  return false
}

const isNumber = value => {
  var n = Number(value)
  if (!isNaN(n)){
    return true
  }
  return false
}

async function ejs2Html(templateFile, renderData) {
  let data = JSON.parse(JSON.stringify(renderData))
  if (!data) {
    data = {}
  }
  data.basedir = path.join(__dirname, '../htmlTemplate')
  let ejsFile = fs.readFileSync(path.join(__dirname, '../htmlTemplate/' + templateFile), 'utf8')
  let html = ejs.render(ejsFile, { ejsData: data })
  return html
}

const fileterN = value => {
  let p = /[^0-9.]/gi
  if(value) {
    return value.replace(p, '')
  }
  return value
}

const fileterLN = value => {
  let p = /[^0-9a-zA-Z]/gi
  if(value) {
    return value.replace(p, '')
  }
  return value
}

// 过滤保留英文数字
const fileterLNB = value => {
  let p = /[^0-9a-zA-Z\s]/gi
  if(value) {
    return value.replace(p, '')
  }
  return value
}

// 只保留一个空格
const fileterB = value => {
  let p = /\s+/g
  if(value) {
    return value.replace(p, ' ')
  }
  return value
}

// 判断字符串数组aa是否包含bb
const isContain = (aa, bb) => {
  if(!(aa instanceof Array) || !(bb instanceof Array) || ((aa.length < bb.length))) {
		return false
	}
	for(let b of bb) {
    let has = false
    for(let a of aa) {
      if(b == a) {
        has = true
        break
      }
    }
    if(!has) {
      return false
    }
  }
	return true
}

const valueFilter = (str, regex) => {
  let reg = eval(regex)
  let sr = reg.exec(str)
  if(sr && sr.length > 1) {
    return sr[1]
  }
  return ''
}

const jsonTrim = async (json) => {
  let retJson = []
  if(json) {
    for(let v of json) {
      let rj = {}
      for(let k in v) {
        let tk = k.trim()
        let tv = v[k]
        if(typeof(str)=='string') {
          tv = v[k].trim()
        }
        rj[tk] = tv
      }
      retJson.push(rj)
    }
  }
  return retJson
}

const depot2Edi = async (renderData) => {
  let data = JSON.parse(JSON.stringify(renderData))
  if (!data) {
    data = {}
  }
  // line 1
  let ediTxt = 'BL+' + data.bl + '\'\r\n'
  // line 2
  ediTxt += 'SON+' + data.doNumber + '+' + data.doDate + ':0000\'\r\n'
  // line 3
  if(data.containers) {
    for (let c of data.containers) {
      ediTxt += 'CNT+ ' + c.containerNumber + '+' + c.containerTypeISOcode + '+' + data.doValid + ':0000\'\r\n'
    }
  }
  let filePath = path.join(process.cwd(), config.fileSys.filesDir, data.ediName)
  fs.writeFile(filePath, ediTxt, function(err) {
    if (err) {
        throw err
    }
  })
  return filePath
}

const groupingJson = async(arr, key) => {
  var map = {}, dest = []
  for(var i = 0; i < arr.length; i++){
      var ai = arr[i]
      if(!map[ai[key]]){
          dest.push({
              id: ai[key],
              data: [ai]
          })
          map[ai[key]] = ai
      }else{
        for(var j = 0; j < dest.length; j++){
          var dj = dest[j]
          if(dj.id == ai[key]){
              dj.data.push(ai)
              break
          }
        }
      }
  }
  return dest
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
  getDelivery: getDelivery,
  fs2Edi: fs2Edi,
  glbConfigId2Text: glbConfigId2Text,
  fileSaveMongo: fileSaveMongo,
  glbConfigId2Attr: glbConfigId2Attr,
  checkInvoiceState: checkInvoiceState,
  checkDoState: checkDoState,
  isNumber: isNumber,
  ejs2Html: ejs2Html,
  fileterN: fileterN,
  fileterLN: fileterLN,
  fileterLNB: fileterLNB,
  fileterB: fileterB,
  isContain: isContain,
  valueFilter: valueFilter,
  jsonTrim: jsonTrim,
  depot2Edi: depot2Edi,
  groupingJson: groupingJson
}
