const nodemailer = require('nodemailer')
const moment = require('moment')
const path = require('path')
const fs = require('fs')
const Imap = require('imap')
const MailParser = require('mailparser').MailParser
const config = require('../app/config')
const model = require('../app/model')
const GLBConfig = require('../util/GLBConfig')
const common = require('../util/CommonUtil')
const cal_config_srv = require('../services/zhongtan/equipment/OverdueCalculationConfigServer')

const tb_invoice_containers = model.zhongtan_invoice_containers
const tb_vessel = model.zhongtan_invoice_vessel
const tb_bl = model.zhongtan_invoice_masterbl
const tb_export_containers = model.zhongtan_export_container
const tb_email = model.zhongtan_edi_mail

const transporter = nodemailer.createTransport(config.mailConfig)

const sendMail = async (to, subject, text, html) => {
  let info = await transporter.sendMail({
    from: config.mailConfig.sender, // sender address
    to: to, // list of receivers
    subject: subject || '', // Subject line
    text: text || '', // plain text body
    html: html || ''
  })
  return info
}

const sendEdiMail = async (from, to, cc, bcc, subject, text, html, attachments) => {
  let info = await transporter.sendMail({
    from: from, // sender address
    to: to, // list of receivers
    cc: cc || '', // list of Carbon Copy
    bcc: bcc || '', // list of Blind Carbon Copy
    subject: subject || '', // Subject line
    text: text || '', // plain text body
    html: html || '',
    attachments: attachments // html body
  })
  return info
}

const imap = new Imap(config.sysEdiMailConfig)
const readEdiMail = async (ediDepots) => {
  let mailData = await readNewMail()
  if(mailData && mailData.length > 0) {
    let f = imap.fetch(mailData, { bodies: ''})
    if(f) {
      f.on('message', function(msg) {
        let mailparser = new MailParser()
        msg.on('body', function(stream) {
          stream.pipe(mailparser)
          mailparser.on("headers", function(headers){
            let parserData = {}
            let from = headers.get('from').text
            let subject = headers.get('subject')
            let receiveTime = headers.get('date')
            let sendTime = headers.get('x-ms-exchange-crosstenant-originalarrivaltime')
            parserData.from = from
            parserData.subject = subject
            parserData.receiveTime = moment(receiveTime).format('YYYY-MM-DD HH:mm:ss')
            parserData.sendTime = moment(sendTime).format('YYYY-MM-DD HH:mm:ss')
            mailparser.on("data", function(data) {
              if (data.type === 'attachment') {
                let filePath = path.join(process.cwd(), config.fileSys.filesDir, data.filename)
                parserData.attachmentName = data.filename
                let writeStream = fs.createWriteStream(filePath)
                data.content.pipe(writeStream)
                data.release()
                writeStream.on('finish', async () => {
                  if(fs.existsSync(filePath)) {
                    let ediStr = fs.readFileSync(filePath, 'utf8')
                    parserData.attachmentContent = ediStr
                    await parserMailAttachment(ediDepots, parserData)
                  }
                })
              }
            })
          })
        })
      })
    }
  }
}

const readNewMail = async () => {
  let mailData = []
  let promise = new Promise(resolve => {
    imap.once('ready', function() {
      if(imap.state != 'authenticated') {
        imap.connect()
      }
      imap.openBox('INBOX', false, function(err) {
        if (err) {
          imap.end()
        }
        imap.search(['NEW'], function(err, results) {
          if (err) {
            imap.end()
          }
          if(results && results.length > 0) {
            imap.setFlags(results, ['\\Seen'], function(err) {
              if (err) {
                imap.end()
              }
            })
          }else {
            imap.end()
          }
          resolve(results)
        })
      })
    })
    imap.on('error', function() {
      imap.end()
    })
    imap.once('end', function() {
    })
    imap.connect()
  })
  await promise.then((data) => {
    mailData = data
  })
  return mailData
}

const parserMailAttachment = async (ediDepots, parserData) => {
  let edi = ''
  if(ediDepots && ediDepots.length > 0) {
    for(let e of ediDepots) {
      if(e.edi_depot_sender_email.indexOf(parserData.from) >= 0) {
        edi = JSON.parse(JSON.stringify(e))
        break
      }
    }
  }
  if(edi) {
    let ediStr = parserData.attachmentContent
    if(edi.edi_depot_is_wharf === GLBConfig.ENABLE) {
      // 码头邮件，包括装卸船和进出场
      let datas = ediStr.split('\'')
      let indexs = []
      for(let i = 0; i < datas.length; i++) {
        if(datas[i].indexOf('BGM+') >= 0) {
          indexs.push(i)
        } 
      }
      if(indexs) {
        let ediContainers = []
        if(indexs.length === 1) {
          let item = datas.slice(indexs[0]).join('`')
          ediContainers.push(item)
        } else {
          for(let ii = 0; ii < indexs.length - 1; ii++) {
            let item = datas.slice(indexs[ii], indexs[ii + 1]).join('`')
            ediContainers.push(item)
          }
        }
        if(ediContainers && ediContainers.length > 0) {
          for(let e of ediContainers) {
            let gate = ''
            let carrier = ''
            let billNo = ''
            let containerNo = ''
            let returnDate = ''
            let regGate = eval(edi.edi_depot_gate_in_out_regex)
            let gt = regGate.exec(e)
            if(gt && gt.length > 1) {
              gate = gt[1]
            }
            let regCAR = eval(edi.edi_depot_carrier_regex)
            let car = regCAR.exec(ediStr)
            if(car && car.length > 1) {
              carrier = car[1]
            }
            if(edi.edi_depot_bl_regex) {
              // 卸船，有提单信息
              let regBl = eval(edi.edi_depot_bl_regex)
              let bl = regBl.exec(e)
              if(bl && bl.length > 1) {
                billNo = bl[1]
              }
            }
            let regCN = eval(edi.edi_depot_cnt_regex)
            let cn = regCN.exec(e)
            if(cn && cn.length > 1) {
              containerNo = cn[1]
            }

            let regDTM = eval(edi.edi_depot_dmt_regex)
            let dtm = regDTM.exec(e)
            if(dtm && dtm.length > 1) {
              returnDate = dtm[1]
            }
            try {
              let ediData = {
                depot: edi.edi_depot_name,
                isWharf: edi.edi_depot_is_wharf,
                ediType: gate,
                carrier: carrier,
                billNo: billNo,
                containerNo: containerNo,
                ediDate: returnDate,
              }
              await updateContainerEdi(ediData)
              // 记录解析内容
              await tb_email.create({
                mail_depot_name: edi.edi_depot_name,
                mail_send_from: parserData.from,
                mail_send_time: parserData.sendTime,
                mail_receive_time: parserData.receiveTime,
                mail_send_subject: parserData.subject,
                mail_send_attachment_name: parserData.attachmentName,
                mail_send_attachment_content: parserData.attachmentContent,
                mail_edi_type: gate,
                mail_edi_bl: billNo,
                mail_edi_container_no: containerNo,
                mail_edi_time: returnDate
              })
            } finally {
              //
            }
          }
        }
      }
    } else {
      let gate = ''
      let containerNo = ''
      let returnDate = ''
      let carrier = ''
      let billNo = ''
      let regGate = eval(edi.edi_depot_gate_in_out_regex)
      let gt = regGate.exec(ediStr)
      if(gt && gt.length > 1) {
        gate = gt[1]
      }
      let regCN = eval(edi.edi_depot_cnt_regex)
      let cn = regCN.exec(ediStr)
      if(cn && cn.length > 1) {
        containerNo = cn[1]
      }

      let regDTM = eval(edi.edi_depot_dmt_regex)
      let dtm = regDTM.exec(ediStr)
      if(dtm && dtm.length > 1) {
        returnDate = dtm[1]
      }
      let regCAR = eval(edi.edi_depot_carrier_regex)
      let car = regCAR.exec(ediStr)
      if(car && car.length > 1) {
        carrier = car[1]
      }
      let regBL = eval(edi.edi_depot_bl_regex)
      let bl = regBL.exec(ediStr)
      if(bl && bl.length > 1) {
        billNo = bl[1]
      }
      try {
        let ediData = {
          depot: edi.edi_depot_name,
          isWharf: edi.edi_depot_is_wharf,
          ediType: gate,
          containerNo: containerNo,
          ediDate: returnDate,
          carrier: carrier,
          billNo: billNo
        }
        await updateContainerEdi(ediData)
        // 记录解析内容
        await tb_email.create({
          mail_depot_name: edi.edi_depot_name,
          mail_send_from: parserData.from,
          mail_send_time: parserData.sendTime,
          mail_receive_time: parserData.receiveTime,
          mail_send_subject: parserData.subject,
          mail_send_attachment_name: parserData.attachmentName,
          mail_send_attachment_content: parserData.attachmentContent,
          mail_edi_type: gate,
          mail_edi_bl: billNo,
          mail_edi_container_no: containerNo,
          mail_edi_time: returnDate
        })
      } finally {
        //
      }
    }
  }
}

const updateContainerEdi = async (ediData) => {
  // 更新箱EDI信息
  let isWharf = ediData.isWharf
  let ediType = ediData.ediType
  // 类别 34: 进场, 36: 出场, 44: 卸船, 46：装船
  if(isWharf && isWharf === GLBConfig.ENABLE) {
    // 码头 
    if(ediType === '34' || ediType === '46') {
      // 出口记录码头进场和装船时间
      let billNo = ''
      if(common.isNumber(ediData.billNo)) {
        if(ediData.carrier && 'COSCO'.indexOf(ediData.carrier) >= 0) {
          billNo = 'COSU' + ediData.billNo
        } else {
          billNo = 'OOLU' + ediData.billNo
        }
      } else {
        billNo = ediData.billNo
      }
      let excon = ''
      if(billNo && (billNo.indexOf('COSU') >= 0 || billNo.indexOf('OOLU') >= 0 ) && ediData.containerNo) {
        excon = await tb_export_containers.findOne({
          where: {
            state : GLBConfig.ENABLE,
            export_container_bl: billNo,
            export_container_no: ediData.containerNo
          },
          order: [['export_container_id', 'DESC']]
        }) 
        if(!excon) {
          let queryStr = `select * from tbl_zhongtan_export_container where state = '1' and export_container_bl = ? 
                            and (export_container_no is null or export_container_no = '') order by export_container_id limit 1`
          let replacements = [billNo]
          let outCon = await model.simpleSelect(queryStr, replacements)
          if(outCon && outCon.length > 0) {
            excon = await tb_export_containers.findOne({
              where: {
                state : GLBConfig.ENABLE,
                export_container_id: outCon[0].export_container_id
              }
            }) 
            if(excon) {
              excon.export_container_no = ediData.containerNo
            }
          }
        }
      }else if(ediData.containerNo) {
        let queryStr = `select * from tbl_zhongtan_export_container where state = '1' and export_container_no = ? and created_at > ? order by export_container_id DESC limit 1`
        let replacements = [ediData.containerNo, moment().subtract(1, 'months').format('YYYY-MM-DD HH:mm:ss')]
        let loadingCon = await model.simpleSelect(queryStr, replacements)
        if(loadingCon && loadingCon.length > 0) {
          excon = await tb_export_containers.findOne({
            where: {
              state : GLBConfig.ENABLE,
              export_container_id: loadingCon[0].export_container_id
            }
          })  
        }
      }
      if(excon) {
        if(ediType === '34') {
          excon.export_containe_edi_wharf_gate_in_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('DD/MM/YYYY')
        } else {
          excon.export_containe_edi_loading_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('DD/MM/YYYY')
        }
        await excon.save()
      }
    } else if(ediType === '36' || ediType === '44') {
      // 进口记录码头出场和卸船时间
      let incon = await tb_invoice_containers.findOne({
        where: {
          state : GLBConfig.ENABLE,
          invoice_containers_no: ediData.containerNo
        },
        order: [['invoice_containers_id', 'DESC']]
      })
      if(incon) {
        if(ediType === '36') {
          incon.invoice_containers_gate_out_terminal_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('DD/MM/YYYY')
        } else {
          incon.invoice_containers_edi_discharge_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('DD/MM/YYYY')
        }
        await incon.save()
      }
    }
  } else {
    // 堆场
    if(ediType === '34') {
      // 进口还箱进场
      let incon = await tb_invoice_containers.findOne({
        where: {
          state : GLBConfig.ENABLE,
          invoice_containers_no: ediData.containerNo
        },
        order: [['invoice_containers_id', 'DESC']]
      })
      if(incon) {
        incon.invoice_containers_depot_name = ediData.depot
        incon.invoice_containers_actually_return_edi_date = ediData.ediDate
        incon.invoice_containers_actually_return_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('DD/MM/YYYY')

        let bl = await tb_bl.findOne({
          where: {
            invoice_vessel_id: incon.invoice_vessel_id,
            invoice_masterbi_bl: incon.invoice_containers_bl,
            state : GLBConfig.ENABLE
          }
        })
        let discharge_port = bl.invoice_masterbi_destination.substring(0, 2)
        let charge_carrier = 'COSCO'
        if(incon.invoice_containers_bl.indexOf('COS') >= 0) {
          charge_carrier  = 'COSCO'
        } else if(incon.invoice_containers_bl.indexOf('OOLU') >= 0) {
          charge_carrier  = 'OOCL'
        }
        let discharge_date = incon.invoice_containers_edi_discharge_date
        if(!incon.invoice_containers_edi_discharge_date) {
          let vessel = await tb_vessel.findOne({
            where: {
              invoice_vessel_id: incon.invoice_vessel_id
            }
          })
          discharge_date = vessel.invoice_vessel_ata
        }

        let free_days = 0
        if(incon.invoice_containers_empty_return_overdue_free_days) {
          free_days = parseInt(incon.invoice_containers_empty_return_overdue_free_days)
        } else {
          free_days = await cal_config_srv.queryContainerFreeDays(bl.invoice_masterbi_cargo_type, discharge_port, charge_carrier, incon.invoice_containers_size, discharge_date)
        }
        let cal_result = await cal_config_srv.demurrageCalculation(free_days, discharge_date, incon.invoice_containers_actually_return_date, bl.invoice_masterbi_cargo_type, discharge_port, charge_carrier, incon.invoice_containers_size, discharge_date)
        if(cal_result.diff_days !== -1) {
          incon.invoice_containers_actually_return_overdue_days = cal_result.overdue_days
          incon.invoice_containers_actually_return_overdue_amount = cal_result.overdue_amount
        } 
        
        if(!incon.invoice_containers_empty_return_date) {
          // 没有计算过滞期费
          incon.invoice_containers_empty_return_date = incon.invoice_containers_actually_return_date
          incon.invoice_containers_empty_return_overdue_days = incon.invoice_containers_actually_return_overdue_days
          incon.invoice_containers_empty_return_overdue_amount = incon.invoice_containers_actually_return_overdue_amount
        }

        if(incon.invoice_containers_actually_return_date && discharge_date) {
          // 集装箱使用天数， gate in date - dischatge date
          incon.invoice_containers_detention_days = moment(incon.invoice_containers_actually_return_date, 'DD/MM/YYYY').diff(moment(discharge_date, 'DD/MM/YYYY'), 'days')
        }
        await incon.save()
      }
    } else if(ediType === '36') {
      // 出口提箱出场
      if(ediData.billNo) {
        let billNo = ''
        if(common.isNumber(ediData.billNo)) {
          if(ediData.carrier && 'COSCO'.indexOf(ediData.carrier) >= 0) {
            billNo = 'COSU' + ediData.billNo
          } else {
            billNo = 'OOLU' + ediData.billNo
          }
        } else {
          billNo = ediData.billNo
        }
        if(billNo && (billNo.indexOf('COSU') >= 0 || billNo.indexOf('OOLU') >= 0)) {
          let excon = await tb_export_containers.findOne({
            where: {
              state : GLBConfig.ENABLE,
              export_container_bl: billNo,
              export_container_no: ediData.containerNo
            },
            order: [['export_container_id', 'DESC']]
          }) 
          if(!excon) {
            let queryStr = `select * from tbl_zhongtan_export_container where state = '1' and export_container_bl = ? 
                            and (export_container_no is null or export_container_no = '') order by export_container_id limit 1`
            let replacements = [billNo]
            let outCon = await model.simpleSelect(queryStr, replacements)
            if(outCon && outCon.length > 0) {
              excon = await tb_export_containers.findOne({
                where: {
                  state : GLBConfig.ENABLE,
                  export_container_id: outCon[0].export_container_id
                }
              }) 
            }
          }
          if(excon) {
            excon.export_containe_get_depot_name = ediData.depot
            excon.export_container_no = ediData.containerNo
            excon.export_containe_edi_depot_gate_out_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('DD/MM/YYYY')
            await excon.save()
          } else {
            // 根据提单号没有查到对应的出口舱单，不处理
          }
        } else {
          // TODO没有提单号暂不处理
          let queryStr = `select * from tbl_zhongtan_export_container where state = '1' and export_container_no = ? and created_at > ? order by export_container_id DESC limit 1`
          let replacements = [ediData.containerNo, moment().subtract(1, 'months').format('YYYY-MM-DD HH:mm:ss')]
          let outCon = await model.simpleSelect(queryStr, replacements)
          if(outCon && outCon.length > 0) {
            let excon = await tb_export_containers.findOne({
              where: {
                state : GLBConfig.ENABLE,
                export_container_id: outCon[0].export_container_id
              }
            })  
            excon.export_containe_get_depot_name = ediData.depot
            excon.export_containe_edi_depot_gate_out_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('DD/MM/YYYY')
            await excon.save()
          }
        }
      }
    }
  }
}

module.exports = {
  sendMail: sendMail,
  sendEdiMail: sendEdiMail,
  readEdiMail: readEdiMail
}
