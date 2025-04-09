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
const empty_stock_srv = require('../services/zhongtan/equipment/EmptyStockManagementServer')
const cal_demurrage_srv = require('../services/zhongtan/equipment/ExportDemurrageCalculationServer')
const freight_srv = require('../services/zhongtan/logistics/ShipmentListServer')
const customer_srv = require('../services/zhongtan/configuration/CustomerServer')

const logger = require('../app/logger').createLogger(__filename)

const tb_invoice_containers = model.zhongtan_invoice_containers
const tb_vessel = model.zhongtan_invoice_vessel
const tb_bl = model.zhongtan_invoice_masterbl
const tb_export_containers = model.zhongtan_export_container
const tb_shipment_list = model.zhongtan_logistics_shipment_list
const tb_export_proforma_containers = model.zhongtan_export_proforma_container
const tb_email = model.zhongtan_edi_mail


const imap = new Imap(config.sysEdiMailConfig)
const readEdiMail = async (ediDepots) => {

  logger.error("开始读取EDI邮件吧:" + config.sysEdiMailConfig)

  let mailData = await readNewMail()
  if(mailData && mailData.length > 0) {
    logger.error("我读到EDI邮件了: " + mailData.length)
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
                    ediStr = ediStr.replace(/\r\n/g, '')
                    parserData.attachmentContent = ediStr
                    logger.error("我读到EDI邮件: " + JSON.stringify(parserData))
                    await parserMailAttachment(ediDepots, parserData)
                  }
                })
              }
            })
          })
        })
      })
    }
  } else {
    logger.error("我没有读到EDI邮件了")
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
    eidLoop: for(let e of ediDepots) {
      if(e.edi_depot_sender_email) 
      {
        let senderEmails = e.edi_depot_sender_email.split(';')
        if(senderEmails && senderEmails.length > 0) 
        {
          for(let se of senderEmails) {
            if(se.indexOf(parserData.from) >= 0 || parserData.from.indexOf(se) >= 0){
              edi = JSON.parse(JSON.stringify(e))
              break eidLoop
            }
          }
        }
      }
    }
  }
  if(edi) {
    let ediStr = parserData.attachmentContent
    logger.error("EDI邮件解析内容: " + ediStr)
    if(edi.edi_depot_is_wharf === GLBConfig.ENABLE) {
      logger.error("码头EDI邮件解析内容: " + ediStr)
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
            let next = ii + 1
            let item = datas.slice(indexs[ii], indexs[next]).join('`')
            ediContainers.push(item)
            if(next >= indexs.length - 1) {
              let lastItem = datas.slice(indexs[next]).join('`')
              ediContainers.push(lastItem)
            }
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

            let carrier_regex = edi.edi_depot_carrier_regex
            if(carrier_regex) {
              let carrier_regexs = carrier_regex.split(';')
              if(carrier_regexs && carrier_regexs.length > 0) {
                for(let cr of carrier_regexs) {
                  if(cr) {
                    let regCAR = eval(cr)
                    let car = regCAR.exec(ediStr)
                    if(car && car.length > 1) {
                      carrier = car[1]
                    }
                  }
                }
              }
            }
            
            if(edi.edi_depot_bl_regex) {
              // 卸船，有提单信息
              let bl_regex = edi.edi_depot_bl_regex
              if(bl_regex) {
                let bl_regexs = bl_regex.split(';')
                if(bl_regexs && bl_regexs.length > 0) {
                  for(let br of bl_regexs) {
                    let regBl = eval(br)
                    let bl = regBl.exec(e)
                    if(bl && bl.length > 1) {
                      billNo = bl[1]
                    }
                  }
                }
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
              logger.error("EDI邮件解析成功: " + JSON.stringify(ediData))
              await updateContainerEdi(ediData)
              await updateContainerEmptyStock(ediData)
              await updateShipmentList(ediData)
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
            } catch(eee) {
              logger.error("EDI邮件解析失败: " + eee)
            } finally {
              //
            }
          }
        }
      }
    } else {
      logger.error("堆场EDI邮件解析内容: " + ediStr)
      let gate = ''
      let regGate = eval(edi.edi_depot_gate_in_out_regex)
      let gt = regGate.exec(ediStr)
      if(gt && gt.length > 1) {
        gate = gt[1]
      }
      let datas = ediStr.split('\'')
      let indexs = []
      for(let i = 0; i < datas.length; i++) {
        if(datas[i].indexOf('TDT+20') >= 0 || datas[i].indexOf('TDT+1') >= 0) {
          indexs.push(i)
        } 
      }
      logger.error("堆场EDI邮件解析内容--indexs: " + indexs)
      if(indexs && indexs.length > 0) {
        let ediContainers = []
        if(indexs.length === 1) {
          let item = datas.slice(indexs[0]).join('`')
          ediContainers.push(item)
        } else {
          for(let ii = 0; ii < indexs.length - 1; ii++) {
            let next = ii + 1
            let item = datas.slice(indexs[ii], indexs[next]).join('`')
            ediContainers.push(item)
            if(next >= indexs.length - 1) {
              let lastItem = datas.slice(indexs[next]).join('`')
              ediContainers.push(lastItem)
            }
          }
        }
        if(ediContainers && ediContainers.length > 0) {
          for(let e of ediContainers) {
            let containerNo = ''
            let returnDate = ''
            let carrier = ''
            let billNo = ''
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
            let carrier_regex = edi.edi_depot_carrier_regex
            if(carrier_regex) {
              let carrier_regexs = carrier_regex.split(';')
              if(carrier_regexs && carrier_regexs.length > 0) {
                for(let cr of carrier_regexs) {
                  if(cr) {
                    let regCAR = eval(cr)
                    let car = regCAR.exec(ediStr)
                    if(car && car.length > 1) {
                      carrier = car[1]
                    }
                  }
                }
              }
            }
            if(edi.edi_depot_bl_regex) {
              // 卸船，有提单信息
              let bl_regex = edi.edi_depot_bl_regex
              if(bl_regex) {
                let bl_regexs = bl_regex.split(';')
                if(bl_regexs && bl_regexs.length > 0) {
                  for(let br of bl_regexs) {
                    let regBl = eval(br)
                    let bl = regBl.exec(e)
                    if(bl && bl.length > 1) {
                      billNo = bl[1]
                    }
                  }
                }
              }
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
              logger.error("EDI邮件解析成功: " + JSON.stringify(ediData))
              await updateContainerEdi(ediData)
              await updateContainerEmptyStock(ediData)
              await updateShipmentList(ediData)
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
            } catch(eee) {
              logger.error("EDI邮件解析失败: " + eee)
            } finally {
              //
            }
          }
        }
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
      if(ediData.billNo) {
        if(common.isNumber(ediData.billNo)) {
          if(ediData.carrier && 'COSCO'.indexOf(ediData.carrier) >= 0) {
            billNo = 'COSU' + ediData.billNo
          } else {
            billNo = 'OOLU' + ediData.billNo
          }
        } else {
          billNo = ediData.billNo
        }
      }
      let excon = ''
      let proexcon = ''
      if(billNo && (billNo.indexOf('COSU') >= 0 || billNo.indexOf('OOLU') >= 0 ) && ediData.containerNo) {
        // 舱单
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
        // 托单
        proexcon = await tb_export_proforma_containers.findOne({
          where: {
            state : GLBConfig.ENABLE,
            export_container_bl: billNo,
            export_container_no: ediData.containerNo
          },
          order: [['export_container_id', 'DESC']]
        }) 
      } else if(ediData.containerNo) {
        let queryStr = `select * from tbl_zhongtan_export_container where state = '1' and export_container_no = ? and created_at > ? order by export_container_id DESC limit 1`
        let replacements = [ediData.containerNo, moment().subtract(3, 'months').format('YYYY-MM-DD HH:mm:ss')]
        let loadingCon = await model.simpleSelect(queryStr, replacements)
        if(loadingCon && loadingCon.length > 0) {
          excon = await tb_export_containers.findOne({
            where: {
              state : GLBConfig.ENABLE,
              export_container_id: loadingCon[0].export_container_id
            }
          })  
        }

        queryStr = `select * from tbl_zhongtan_export_proforma_container where state = '1' and export_container_no = ? and created_at > ? order by export_container_id DESC limit 1`
        replacements = [ediData.containerNo, moment().subtract(3, 'months').format('YYYY-MM-DD HH:mm:ss')]
        let loadingCon2 = await model.simpleSelect(queryStr, replacements)
        if(loadingCon2 && loadingCon2.length > 0) {
          proexcon = await tb_export_proforma_containers.findOne({
            where: {
              state : GLBConfig.ENABLE,
              export_container_id: loadingCon2[0].export_container_id
            }
          })  
        }
      }
      if(excon) {
        if(ediType === '34') {
          excon.export_container_edi_wharf_gate_in_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('DD/MM/YYYY')
        } else {
          excon.export_container_edi_loading_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('DD/MM/YYYY')
        }
        await excon.save()
      }
      // 更新托单
      if(proexcon) {
        if(ediType === '34') {
          proexcon.export_container_edi_wharf_gate_in_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('DD/MM/YYYY')
        } else {
          proexcon.export_container_edi_loading_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('DD/MM/YYYY')
        }
        await proexcon.save()
        await cal_demurrage_srv.calculationDemurrage2Shipment(proexcon.export_vessel_id, proexcon.export_container_bl, proexcon.export_container_no, '')
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
        if(incon.invoice_containers_edi_read && incon.invoice_containers_edi_read !== '0') {
          // 已经读取过EDI文件并且场站一致
          incon.invoice_containers_edi_read = (parseInt(incon.invoice_containers_edi_read) + 1) + ''
        } else {
          incon.invoice_containers_depot_name = ediData.depot
          incon.invoice_containers_actually_return_edi_depot_name = ediData.depot
          incon.invoice_containers_actually_return_edi_date = ediData.ediDate
          incon.invoice_containers_actually_return_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('DD/MM/YYYY')
          incon.invoice_containers_edi_read = '1'

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
          let vessel = await tb_vessel.findOne({
            where: {
              invoice_vessel_id: incon.invoice_vessel_id
            }
          })
          let discharge_date = vessel.invoice_vessel_ata
          if(incon.invoice_containers_edi_discharge_date) {
            discharge_date = incon.invoice_containers_edi_discharge_date
          }

          let free_days = 0
          if(incon.invoice_containers_empty_return_overdue_free_days) {
            free_days = parseInt(incon.invoice_containers_empty_return_overdue_free_days)
          } else {
            free_days = await cal_config_srv.queryContainerFreeDays(bl.invoice_masterbi_cargo_type, discharge_port, charge_carrier, incon.invoice_containers_size, discharge_date)
          }
          let cal_result = await cal_config_srv.demurrageCalculation(free_days, discharge_date, incon.invoice_containers_actually_return_date, bl.invoice_masterbi_cargo_type, discharge_port, charge_carrier, incon.invoice_containers_size, vessel.invoice_vessel_ata)
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
        }
        await incon.save()
        await customer_srv.importDemurrageCheck(incon.invoice_containers_customer_id)
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
            if(!excon.export_container_edi_depot_gate_out_date) {
              excon.export_container_get_depot_name = ediData.depot
              excon.export_container_no = ediData.containerNo
              excon.export_container_edi_depot_gate_out_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('DD/MM/YYYY')
              await excon.save()
            }
          } else {
            // 根据提单号没有查到对应的出口舱单，不处理
          }

          let proexcon = await tb_export_proforma_containers.findOne({
            where: {
              state : GLBConfig.ENABLE,
              export_container_bl: billNo,
              export_container_no: ediData.containerNo
            },
            order: [['export_container_id', 'DESC']]
          }) 
          if(proexcon) {
            if(!proexcon.export_container_edi_depot_gate_out_date) {
              proexcon.export_container_get_depot_name = ediData.depot
              proexcon.export_container_no = ediData.containerNo
              proexcon.export_container_edi_depot_gate_out_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('DD/MM/YYYY')
              await proexcon.save()
              await cal_demurrage_srv.calculationDemurrage2Shipment(proexcon.export_vessel_id, proexcon.export_container_bl, proexcon.export_container_no, '')
            }
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
            if(!excon.export_container_edi_depot_gate_out_date) {
              excon.export_container_get_depot_name = ediData.depot
              excon.export_container_edi_depot_gate_out_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('DD/MM/YYYY')
              await excon.save()
            }
          }

          queryStr = `select * from tbl_zhongtan_export_proforma_container where state = '1' and export_container_no = ? and created_at > ? order by export_container_id DESC limit 1`
          replacements = [ediData.containerNo, moment().subtract(1, 'months').format('YYYY-MM-DD HH:mm:ss')]
          let outCon2 = await model.simpleSelect(queryStr, replacements)
          if(outCon2 && outCon2.length > 0) {
            let proexcon = await tb_export_proforma_containers.findOne({
              where: {
                state : GLBConfig.ENABLE,
                export_container_id: outCon2[0].export_container_id
              }
            })  
            if(!proexcon.export_container_edi_depot_gate_out_date) {
              proexcon.export_container_get_depot_name = ediData.depot
              proexcon.export_container_edi_depot_gate_out_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('DD/MM/YYYY')
              await proexcon.save()
              await cal_demurrage_srv.calculationDemurrage2Shipment(proexcon.export_vessel_id, proexcon.export_container_bl, proexcon.export_container_no, '')
            }
          }
        }
      }
    }
  }
}

const updateContainerEmptyStock = async (ediData) => {
  // 更新箱EDI信息
  let isWharf = ediData.isWharf
  let ediType = ediData.ediType
  // 类别 34: 进场, 36: 出场, 44: 卸船, 46：装船
  let esc = {
    container_no: ediData.containerNo,
    container_owner: ediData.carrier,
    depot_name: ediData.depot,
    bill_no: ediData.billNo
  }
  if(isWharf && isWharf === GLBConfig.ENABLE) {
    // 34: 进场, 36: 出场, 44: 卸船, 46：装船
    if(ediType === '34') {
      esc.gate_in_terminal_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('YYYY-MM-DD')
    } else if(ediType === '36') {
      esc.gate_out_terminal_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('YYYY-MM-DD')
    } else if(ediType === '44') {
      esc.discharge_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('YYYY-MM-DD')
    } else if(ediType === '46') {
      esc.loading_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('YYYY-MM-DD')
    } 
  } else {
    // 更新Empty Stock 34: 进场, 36: 出场, 44: 卸船, 46：装船
    if(ediType === '34') {
      esc.gate_in_depot_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('YYYY-MM-DD')
    } else if(ediType === '36') {
      esc.gate_out_depot_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('YYYY-MM-DD')
    }
  }
  await empty_stock_srv.uploadEmptyStockContainer(esc)
}

const updateShipmentList = async (ediData) => {
  let sl
  if(ediData.billNo) {
    sl = await tb_shipment_list.findOne({
      where: {
        shipment_list_bill_no: ediData.billNo,
        shipment_list_container_no: ediData.containerNo,
        state: GLBConfig.ENABLE
      }
    })
  } else {
    sl = await tb_shipment_list.findOne({
      where: {
        shipment_list_container_no: ediData.containerNo,
        state: GLBConfig.ENABLE
      },
      order: [['shipment_list_id', 'DESC']]
    })
  }
  if(sl) {
    // COSCO 进场日期， OOLU 装船日期
    let isWharf = ediData.isWharf
    let ediType = ediData.ediType
    if(isWharf && isWharf === GLBConfig.ENABLE) {
      // 34: 进场, 36: 出场, 44: 卸船, 46：装船
      if(ediType === '34') {
        if(sl.shipment_list_cntr_owner === 'COS' && !sl.shipment_list_loading_date) {
          sl.shipment_list_loading_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('YYYY-MM-DD')
        }
      } else if(ediType === '44') {
        if(!sl.shipment_list_discharge_date) {
          sl.shipment_list_discharge_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('YYYY-MM-DD')
        }
      } else if(ediType === '46') {
        if(sl.shipment_list_cntr_owner === 'OOL' && !sl.shipment_list_loading_date) {
          sl.shipment_list_loading_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('YYYY-MM-DD')
        }
      } 
    } else {
      // 34: 进场, 36: 出场
      if(ediType === '34') {
        if(!sl.shipment_list_empty_return_date) {
          sl.shipment_list_empty_return_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('YYYY-MM-DD')
        }
      } else if(ediType === '36') {
        if(!sl.shipment_list_depot_gate_out_date) {
          sl.shipment_list_depot_gate_out_date = moment(ediData.ediDate.substring(0, 8), 'YYYYMMDD').format('YYYY-MM-DD')
        }
      }
    }
    await sl.save()
    await freight_srv.updateShipmentFreight(sl.shipment_list_id)
  }
}

module.exports = {
  readEdiMail: readEdiMail
}