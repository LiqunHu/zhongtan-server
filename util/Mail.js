const nodemailer = require('nodemailer')
const moment = require('moment')
const path = require('path')
const fs = require('fs')
const Imap = require('imap')
const MailParser = require('mailparser').MailParser
const config = require('../app/config')
const model = require('../app/model')
const GLBConfig = require('../util/GLBConfig')
const cal_config_srv = require('../services/zhongtan/equipment/OverdueCalculationConfigServer')

const tb_invoice_containers = model.zhongtan_invoice_containers
const tb_vessel = model.zhongtan_invoice_vessel
const tb_bl = model.zhongtan_invoice_masterbl

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
const readEdiMail = (ediDepots) => {
  if(ediDepots && ediDepots.length > 0) {
    imap.once('ready', function() {
      if(imap.state != 'authenticated') {
        imap.connect()
      }
      imap.openBox('INBOX', false, function(err) {
        if (err) {
          imap.end()
          return
        }
        if(ediDepots && ediDepots.length > 0) {
          imap.search(['NEW'], function(err, results) {
            if (err) {
              imap.end()
              return
            }
            if(!results || !results.length){
              imap.end()
              return
            }
            imap.setFlags(results, ['\\Seen'], function(err) {
              if (err) {
                imap.end()
                return
              }
            })
            let f = imap.fetch(results, { bodies: ''})
            if(f) {
              f.on('message', function(msg) {
                let mailparser = new MailParser()
                msg.on('body', function(stream) {
                  stream.pipe(mailparser)
                  mailparser.on("headers", function(headers) {
                    let from = headers.get('from').text
                    if(from) {
                      let edi = ''
                      for(let e of ediDepots) {
                        if(e && e.edi_depot_sender_email) {
                          let ems = e.edi_depot_sender_email.split(';')
                          if(ems.indexOf(from) >= 0) {
                            edi = e
                            break
                          }
                        }
                      }

                      // 附件下载处理
                      if(edi && edi.edi_depot_sender_email && edi.edi_depot_cnt_regex 
                        && edi.edi_depot_dmt_regex && edi.edi_depot_dmt_format && edi.edi_depot_gate_in_out_regex) {
                        mailparser.on("data", function(data) {
                          if (data.type === 'attachment') {
                            //附件
                            let filePath = path.join(process.cwd(), config.fileSys.filesDir, data.filename)
                            let writeStream = fs.createWriteStream(filePath)
                            data.content.pipe(writeStream)
                            data.release()
                            writeStream.on('finish', async () => {
                              if(fs.existsSync(filePath)) {
                                let ediStr = fs.readFileSync(filePath, 'utf8')
                                if(ediStr) {
                                  let gate = ''
                                  let containerNo = ''
                                  let returnDate = ''
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
      
                                  if(containerNo) {
                                    let container = await tb_invoice_containers.findOne({
                                      where: {
                                        state : GLBConfig.ENABLE,
                                        invoice_containers_no: containerNo
                                      },
                                      order: [['invoice_containers_id', 'DESC']]
                                    })
                                    if(container && returnDate) {
                                      container.invoice_containers_depot_name = edi.edi_depot_name
                                      if(gate === '34') {
                                        // GATE IN
                                        container.invoice_containers_actually_return_edi_date = returnDate
                                        container.invoice_containers_actually_return_date = moment(returnDate.substring(0, 8), edi.edi_depot_dmt_format).format('DD/MM/YYYY')
      
                                        let vessel = await tb_vessel.findOne({
                                          where: {
                                            invoice_vessel_id: container.invoice_vessel_id
                                          }
                                        })
      
                                        let bl = await tb_bl.findOne({
                                          where: {
                                            invoice_vessel_id: container.invoice_vessel_id,
                                            invoice_masterbi_bl: container.invoice_containers_bl
                                          }
                                        })
      
                                        let discharge_port = bl.invoice_masterbi_destination.substring(0, 2)
                                        let charge_carrier = 'COSCO'
                                        if(container.invoice_containers_bl.indexOf('COS') >= 0) {
                                          charge_carrier  = 'COSCO'
                                        } else if(container.invoice_containers_bl.indexOf('OOLU') >= 0) {
                                          charge_carrier  = 'OOCL'
                                        }
                                        let free_days = await cal_config_srv.queryContainerFreeDays(bl.invoice_masterbi_cargo_type, discharge_port, charge_carrier, container.invoice_containers_size, vessel.invoice_vessel_ata)
                                        let cal_result = await cal_config_srv.demurrageCalculation(free_days, vessel.invoice_vessel_ata, container.invoice_containers_actually_return_date, bl.invoice_masterbi_cargo_type, discharge_port, charge_carrier, container.invoice_containers_size, vessel.invoice_vessel_ata)
                                        if(cal_result.diff_days !== -1) {
                                          container.invoice_containers_actually_return_overdue_days = cal_result.overdue_days
                                          container.invoice_containers_actually_return_overdue_amount = cal_result.overdue_amount
                                        } 
                                      } else if(gate === '36') {
                                        // GATE OUT  
                                        container.invoice_containers_actually_gate_out_edi_date = returnDate
                                        container.invoice_containers_actually_gate_out_date = moment(returnDate.substring(0, 8), edi.edi_depot_dmt_format).format('DD/MM/YYYY')
                                      }

                                      if(container.invoice_containers_actually_gate_out_date && container.invoice_containers_actually_return_date) {
                                        container.invoice_containers_storing_days = moment(container.invoice_containers_actually_gate_out_date, 'DD/MM/YYYY').diff(moment(container.invoice_containers_actually_return_date, 'DD/MM/YYYY'))
                                      }
                                    }
                                    await container.save()
                                  }
                                }
                              }
                            })
                          }
                        })
                      }
                    }
                  })
                })
              })
              f.once('error', function() {
                imap.end()
                return
              })
              f.once('end', function() {
                imap.end()
              })
            }
          })
          
        }
      })
    })
    imap.on('error', function() {
      imap.end()
    })
    imap.once('end', function() {})
    imap.connect()
  }
}

module.exports = {
  sendMail: sendMail,
  sendEdiMail: sendEdiMail,
  readEdiMail: readEdiMail
}
