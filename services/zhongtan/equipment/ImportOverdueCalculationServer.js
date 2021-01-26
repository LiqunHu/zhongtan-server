const moment = require('moment')
const numberToText = require('number2text')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')
const mailer = require('../../../util/Mail')
const cal_config_srv = require('./OverdueCalculationConfigServer')
const opSrv = require('../../common/system/OperationPasswordServer')
const Op = model.Op

const tb_user = model.common_user
const tb_vessel = model.zhongtan_invoice_vessel
const tb_bl = model.zhongtan_invoice_masterbl
const tb_container_size = model.zhongtan_container_size
const tb_container = model.zhongtan_invoice_containers
const tb_invoice_container = model.zhongtan_overdue_invoice_containers
const tb_uploadfile = model.zhongtan_uploadfile
const tb_edi_depot = model.zhongtan_edi_depot

exports.initAct = async () => {
  let returnData = {}
  returnData['CONTAINER_SIZE'] = await tb_container_size.findAll({
    attributes: ['container_size_code', 'container_size_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['container_size_code', 'ASC']]
  })
  returnData['EDI_DEPOT'] = await tb_edi_depot.findAll({
    attributes: ['edi_depot_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['edi_depot_name', 'ASC']]
  })
  returnData['UPLOAD_STATE'] = GLBConfig.UPLOAD_STATE
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination from tbl_zhongtan_invoice_containers a LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = '1' AND c.invoice_vessel_id = a.invoice_vessel_id WHERE a.state = '1'`
  let replacements = []

  if(doc.search_data) {
    if (doc.search_data.invoice_containers_bl) {
      queryStr += ' and a.invoice_containers_bl like ? '
      replacements.push('%' + doc.search_data.invoice_containers_bl + '%')
    }
    if (doc.search_data.invoice_containers_no) {
      queryStr += ' and a.invoice_containers_no like ? '
      replacements.push('%' + doc.search_data.invoice_containers_no + '%')
    }
    if (doc.search_data.invoice_vessel_name) {
      queryStr += ' and b.invoice_vessel_name like ? '
      replacements.push('%' + doc.search_data.invoice_vessel_name + '%')
    }
  }
  queryStr += ' ORDER BY b.invoice_vessel_id DESC, a.invoice_containers_bl, a.invoice_containers_no'
  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  if(result.data) {
    for(let d of result.data) {
      if(d.invoice_containers_customer_id) {
        let customer = await tb_user.findOne({
          where: {
            user_id: d.invoice_containers_customer_id
          }
        })
        if(customer) {
          d.customerINFO = [
            {
              id: d.invoice_containers_customer_id,
              text: customer.user_name
            }
          ]
        }
      }

      d.files = []
      let queryStr = `SELECT a.*, b.user_name FROM tbl_zhongtan_uploadfile a
          left join tbl_common_user b on a.uploadfil_release_user_id = b.user_id
          WHERE a.uploadfile_index1 = ? AND a.api_name IN('OVERDUE-INVOICE', 'OVERDUE-RECEIPT') AND a.state = '1' ORDER BY a.uploadfile_id DESC`
      let replacements = [d.invoice_masterbi_id]
      let files = await model.simpleSelect(queryStr, replacements)
      if(files) {
        let fileType = 'INVOICE'
        for(let f of files) {
          if(f.api_name === 'OVERDUE-INVOICE') {
            fileType = 'INVOICE'
          } else {
            fileType = 'RECEIPT'
          }
          d.files.push({
            date: moment(f.created_at).format('YYYY-MM-DD'),
            file_id: f.uploadfile_id,
            url: f.uploadfile_url,
            state: f.uploadfile_state,
            file_type: fileType,
            demurrage: f.uploadfile_amount,
            release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
            release_user: f.user_name,
            receipt_no: f.uploadfile_receipt_no
          })
        }
      }

      if(d.invoice_masterbi_destination) {
        let discharge_port = d.invoice_masterbi_destination.substring(0, 2)
        let charge_carrier = 'COSCO'
        if(d.invoice_containers_bl.indexOf('COS') >= 0) {
          charge_carrier  = 'COSCO'
        } else if(d.invoice_containers_bl.indexOf('OOLU') >= 0) {
          charge_carrier  = 'OOCL'
        }
        // cargo_type, discharge_port, carrier, container_type, enabled_date
        d.invoice_containers_empty_return_overdue_static_free_days = await cal_config_srv.queryContainerFreeDays(d.invoice_masterbi_cargo_type, discharge_port, charge_carrier, d.invoice_containers_size, d.invoice_vessel_ata)
        if(d.invoice_containers_empty_return_overdue_free_days) {
          d.invoice_containers_empty_return_overdue_free_days = parseInt(d.invoice_containers_empty_return_overdue_free_days)
        } else {
          d.invoice_containers_empty_return_overdue_free_days = parseInt(d.invoice_containers_empty_return_overdue_static_free_days)
        }
      }
      let rcount = await tb_invoice_container.count({
        where: {
          overdue_invoice_containers_invoice_containers_id: d.invoice_containers_id,
          overdue_invoice_containers_receipt_date: {
            [Op.ne]: null
          }
        }
      })
      if(rcount > 0) {
        d.invoice_containers_empty_return_overdue_free_days_fixed = true
      } else {
        d.invoice_containers_empty_return_overdue_free_days_fixed = false
      }

      let brcount = await tb_invoice_container.count({
        where: {
          overdue_invoice_containers_invoice_masterbi_id: d.invoice_masterbi_id,
          overdue_invoice_containers_receipt_date: {
            [Op.ne]: null
          }
        }
      })
      if(brcount > 0) {
        d.invoice_containers_issuing_storing_order_status = true
      } else {
        d.invoice_containers_issuing_storing_order_status = false
      }
    }
  }
  returnData.rows = result.data

  return common.success(returnData)
}

exports.calculationAct = async req => {
  let doc = common.docValidate(req)
  let discharge_date = doc.discharge_date
  let return_date = doc.return_date
  let free_days = 0
  if(doc.invoice_containers_empty_return_overdue_free_days) {
    free_days = parseInt(doc.invoice_containers_empty_return_overdue_free_days)
  }
  let discharge_port = doc.invoice_masterbi_destination.substring(0, 2)
  let charge_carrier = 'COSCO'
  if(doc.invoice_containers_bl.indexOf('COS') >= 0) {
    charge_carrier  = 'COSCO'
  } else if(doc.invoice_containers_bl.indexOf('OOLU') >= 0) {
    charge_carrier  = 'OOCL'
  }
  let queryStr = `SELECT v.* FROM tbl_zhongtan_invoice_masterbl b LEFT JOIN tbl_zhongtan_invoice_vessel v ON b.invoice_vessel_id = v.invoice_vessel_id WHERE b.state = '1' AND b.invoice_masterbi_bl = ? ORDER BY b.invoice_masterbi_id DESC LIMIT 1`
  let replacements = []
  replacements.push(doc.invoice_containers_bl)
  let vessels = await model.simpleSelect(queryStr, replacements)
  let invoice_vessel_ata = discharge_date
  if(vessels && vessels.length > 0) {
    invoice_vessel_ata = vessels[0].invoice_vessel_ata
  }
  // free_days, discharge_date, return_date, cargo_type, discharge_port, carrier, container_type, enabled_date
  let cal_result = await cal_config_srv.demurrageCalculation(free_days, discharge_date, return_date, 
    doc.invoice_masterbi_cargo_type, discharge_port, charge_carrier, doc.invoice_containers_size, invoice_vessel_ata)
  if(cal_result.diff_days === -1) {
    return common.error('equipment_02')
  } else {
    return cal_result
  }
}

exports.emptyReturnSaveAct = async req => {
  let doc = common.docValidate(req)
  let con = await tb_container.findOne({
    where: {
      invoice_containers_id: doc.invoice_containers_id
    }
  })
  if(con) {
    let discharge_date = doc.invoice_vessel_ata
    if(doc.invoice_containers_edi_discharge_date) {
      discharge_date = doc.invoice_containers_edi_discharge_date
    }
    let return_date = doc.invoice_containers_empty_return_date
    let discharge_port = doc.invoice_masterbi_destination.substring(0, 2)
    let charge_carrier = 'COSCO'
    if(doc.invoice_containers_bl.indexOf('COS') >= 0) {
      charge_carrier  = 'COSCO'
    } else if(doc.invoice_containers_bl.indexOf('OOLU') >= 0) {
      charge_carrier  = 'OOCL'
    }
    let old_free_days = con.invoice_containers_empty_return_overdue_free_days ? con.invoice_containers_empty_return_overdue_free_days : doc.invoice_containers_empty_return_overdue_static_free_days
    if((return_date || con.invoice_containers_actually_return_date) && doc.invoice_containers_empty_return_overdue_free_days) {
      con.invoice_containers_empty_return_overdue_free_days = doc.invoice_containers_empty_return_overdue_free_days
      con.invoice_containers_edi_discharge_date = discharge_date
      // 保存计算超期费计算结果
      if(return_date) {
        con.invoice_containers_empty_return_date = moment(return_date, 'DD/MM/YYYY').format('DD/MM/YYYY')
        con.invoice_containers_empty_return_overdue_amount = doc.invoice_containers_empty_return_overdue_amount
        con.invoice_containers_empty_return_overdue_days = doc.invoice_containers_empty_return_overdue_days
        if(doc.invoice_containers_empty_return_overdue_amount && doc.invoice_containers_empty_return_overdue_days) {
          con.invoice_containers_empty_return_edit_flg = GLBConfig.ENABLE
        }
      }
      if(con.invoice_containers_actually_return_date) {
        // 以获取到实际进场时间，重新计算
        let cal_result = await cal_config_srv.demurrageCalculation(con.invoice_containers_empty_return_overdue_free_days, 
          discharge_date, con.invoice_containers_actually_return_date, doc.invoice_masterbi_cargo_type, discharge_port, charge_carrier, con.invoice_containers_size, doc.invoice_vessel_ata)
        if(cal_result.diff_days !== -1) {
          con.invoice_containers_actually_return_overdue_days = cal_result.overdue_days
          con.invoice_containers_actually_return_overdue_amount = cal_result.overdue_amount
        } 
      }
      await con.save()
    } else if(doc.invoice_containers_empty_return_overdue_free_days || doc.invoice_containers_edi_discharge_date){
      // 保存免箱期
      if(doc.invoice_containers_empty_return_overdue_free_days) {
        con.invoice_containers_empty_return_overdue_free_days = doc.invoice_containers_empty_return_overdue_free_days
      }
      // 保存卸船时间
      if(doc.invoice_containers_edi_discharge_date) {
        con.invoice_containers_edi_discharge_date = doc.invoice_containers_edi_discharge_date
      }
      await con.save()
    } 
    if(old_free_days && doc.invoice_containers_empty_return_overdue_free_days && 
      parseInt(old_free_days) !== parseInt(doc.invoice_containers_empty_return_overdue_free_days)
      && !doc.free_days_single) {
      // 修改了免箱期 同步修改其他免箱期不同的箱子
      let queryStr = `SELECT * FROM tbl_zhongtan_invoice_containers WHERE invoice_vessel_id = ? AND invoice_containers_bl = ? 
                      AND invoice_containers_id != ? AND IFNULL(invoice_containers_empty_return_overdue_free_days, '') != ?`
      let replacements = [con.invoice_vessel_id, con.invoice_containers_bl, con.invoice_containers_id, doc.invoice_containers_empty_return_overdue_free_days]
      let oCons = await model.simpleSelect(queryStr, replacements)
      if(oCons) {
        for(let c of oCons) {
          if(c.invoice_containers_empty_return_date || c.invoice_containers_actually_return_date) {
            let oc = await tb_container.findOne({
              where: {
                invoice_containers_id: c.invoice_containers_id
              }
            })
            if(oc) {
              let oc_discharge_date = doc.invoice_vessel_ata
              if(oc.invoice_containers_edi_discharge_date) {
                oc_discharge_date = oc.invoice_containers_edi_discharge_date
              }
              if(oc.invoice_containers_empty_return_date) {
                oc.invoice_containers_empty_return_overdue_free_days = doc.invoice_containers_empty_return_overdue_free_days
                let cal_result = await cal_config_srv.demurrageCalculation(oc.invoice_containers_empty_return_overdue_free_days, oc_discharge_date, oc.invoice_containers_empty_return_date, 
                  doc.invoice_masterbi_cargo_type, discharge_port, charge_carrier, oc.invoice_containers_size, doc.invoice_vessel_ata)
                if(cal_result) {
                  oc.invoice_containers_empty_return_overdue_days = cal_result.overdue_days
                  oc.invoice_containers_empty_return_overdue_amount = cal_result.overdue_amount
                  oc.invoice_containers_empty_return_edit_flg = GLBConfig.ENABLE
                }
              }
              if(oc.invoice_containers_actually_return_date) {
                let cal_result = await cal_config_srv.demurrageCalculation(oc.invoice_containers_empty_return_overdue_free_days, 
                  oc_discharge_date, oc.invoice_containers_actually_return_date, doc.invoice_masterbi_cargo_type, discharge_port, charge_carrier, oc.invoice_containers_size, oc_discharge_date)
                if(cal_result.diff_days !== -1) {
                  oc.invoice_containers_actually_return_overdue_days = cal_result.overdue_days
                  oc.invoice_containers_actually_return_overdue_amount = cal_result.overdue_amount
                } 
              }
              await oc.save()
            }
          } else {
            await tb_container.update(
                {'invoice_containers_empty_return_overdue_free_days': doc.invoice_containers_empty_return_overdue_free_days}, 
                {'where': {'invoice_containers_id': c.invoice_containers_id}}
              )
          }
        }
      }
    }
    return common.success()
  } else {
    return common.error('equipment_03')
  }
}

exports.ediCalculationSaveAct = async req => {
  let doc = common.docValidate(req)
  let con = await tb_container.findOne({
    where: {
      invoice_containers_id: doc.invoice_containers_id
    }
  })
  if(con) {
    if(doc.invoice_containers_edi_discharge_date) {
      con.invoice_containers_edi_discharge_date = doc.invoice_containers_edi_discharge_date
    }
    if(doc.invoice_containers_actually_return_date) {
      con.invoice_containers_actually_return_date = doc.invoice_containers_actually_return_date
      con.invoice_containers_actually_return_overdue_days = doc.invoice_containers_actually_return_overdue_days
      con.invoice_containers_actually_return_overdue_amount = doc.invoice_containers_actually_return_overdue_amount
    }
    await con.save()
    return common.success()
  } else {
    return common.error('equipment_03')
  }
}

exports.searchCustomerAct = async req => {
  let doc = common.docValidate(req)
  if (doc.search_text) {
    let returnData = {
      customerINFO: []
    }
    let queryStr = `select a.user_id, a.user_name from tbl_common_user a where a.state = '1' and a.user_type = '${GLBConfig.TYPE_CUSTOMER}'  
                   and (a.user_username like ? or a.user_phone like ? or a.user_name like ?) ORDER BY a.user_username`
    let replacements = []
    let search_text = doc.search_text + '%'
    replacements.push(search_text)
    replacements.push(search_text)
    replacements.push(search_text)
    let shippers = await model.simpleSelect(queryStr, replacements)
    for (let s of shippers) {
      returnData.customerINFO.push({
        id: s.user_id,
        text: s.user_name
      })
    }
    return common.success(returnData)
  } else {
    return common.success()
  }
}

exports.emptyInvoiceAct = async req => {
  let doc = common.docValidate(req), user = req.user, curDate = new Date()
  let selectAll = doc.selectAll
  let selection = []
  if(selectAll && doc.selection && doc.selection.length > 0) {
    let sel0 = doc.selection[0]
    let cons = await tb_container.findAll({
      where: {
        invoice_containers_bl: sel0.invoice_containers_bl,
        invoice_vessel_id: sel0.invoice_vessel_id,
        state: GLBConfig.ENABLE
      }
    })
    for(let c of cons) {
      if((c.invoice_containers_empty_return_receipt_date && c.invoice_containers_empty_return_overdue_amount && parseInt(c.invoice_containers_empty_return_overdue_amount) === 0) 
                || (c.invoice_containers_empty_return_date && c.invoice_containers_empty_return_overdue_amount && parseInt(c.invoice_containers_empty_return_overdue_amount) > 0)) {
        selection.push({
          ...JSON.parse(JSON.stringify(c)),
          invoice_masterbi_id: sel0.invoice_masterbi_id,
          invoice_vessel_id: sel0.invoice_vessel_id
        })
      }
    }
  } else {
    selection = doc.selection
  }
  let invoicePara = doc.invoicePara
  if(selection && selection.length > 0) {
    // 判断删除不符合条件的开票箱子
    for(let i = selection.length - 1; i>= 0; i--) {
      let sc = await tb_container.findOne({
        where: {
          invoice_containers_id: selection[i].invoice_containers_id
        }
      })
      if(sc) {
        if((sc.invoice_containers_empty_return_overdue_amount_receipt && sc.invoice_containers_actually_return_overdue_amount && (parseInt(sc.invoice_containers_empty_return_overdue_amount_receipt) === parseInt(sc.invoice_containers_actually_return_overdue_amount)))
        || (sc.invoice_containers_empty_return_overdue_amount_receipt && sc.invoice_containers_empty_return_overdue_amount && (parseInt(sc.invoice_containers_empty_return_overdue_amount_receipt) === parseInt(sc.invoice_containers_empty_return_overdue_amount)))) {
          selection.splice(i, 1)
        }
      } else {
        selection.splice(i, 1)
      }
    }
    let selContainerIds = []
    for(let s of selection) {
      selContainerIds.push(s.invoice_containers_id)
    }
    // 删除未开收据的发票，只保留当次选择的箱子，重新开票
    let queryStr = 'SELECT overdue_invoice_containers_id, overdue_invoice_containers_invoice_uploadfile_id FROM tbl_zhongtan_overdue_invoice_containers WHERE state = ? AND overdue_invoice_containers_invoice_containers_id IN (?) AND overdue_invoice_containers_receipt_date IS NULL'
    let replacements = [GLBConfig.ENABLE, selContainerIds]
    let del_invoices = await model.simpleSelect(queryStr, replacements)
    if(del_invoices) {
      for(let d of del_invoices) {
        let di = await tb_invoice_container.findOne({
          where: {
            state: GLBConfig.ENABLE,
            overdue_invoice_containers_id: d.overdue_invoice_containers_id
          }
        })
        if(di) {
          di.state = GLBConfig.DISABLE
          await di.save()
        }
        let df = await tb_uploadfile.findOne({
          where: {
            uploadfile_id: d.overdue_invoice_containers_invoice_uploadfile_id
          }
        })
        if(df) {
          df.state = GLBConfig.DISABLE
          await df.save()
        }
      }
    }
    let row0 = selection[0]
    let bl = await tb_bl.findOne({
      where: {
        invoice_masterbi_id: row0.invoice_masterbi_id
      }
    })
  
    let vessel = await tb_vessel.findOne({
      where: {
        invoice_vessel_id: row0.invoice_vessel_id
      }
    })
  
    let customer = await tb_user.findOne({
      where: {
        user_id: invoicePara.invoice_customer_id
      }
    })
  
    let commonUser = await tb_user.findOne({
      where: {
        user_id: user.user_id
      }
    })
    let renderData = {}
    renderData.customerName = customer.user_name
    renderData.customerTin = customer.user_tin
    renderData.address = customer.user_address
    renderData.destination = bl.invoice_masterbi_destination.substring(0, 2)
    if(bl.invoice_masterbi_cargo_type === 'TR' || bl.invoice_masterbi_cargo_type === 'TRANSIT') {
      renderData.cargoType = 'TRANSIT'
    } else {
      renderData.cargoType = 'LOCAL'
    }
    renderData.masterbiBl = bl.invoice_masterbi_bl
    renderData.invoiceDate = moment().format('YYYY/MM/DD')
    let invoiceNo = await seq.genEquipmentInvoiceSeq()
    renderData.invoiceNo = invoiceNo
    renderData.vesselName = vessel.invoice_vessel_name
    renderData.voyageNumber = vessel.invoice_vessel_voyage
    renderData.berthingDate = vessel.invoice_vessel_ata
    renderData.startingDate = row0.starting_date
    renderData.user_name = commonUser.user_name
    renderData.user_phone = commonUser.user_phone
    renderData.user_email = commonUser.user_email
    let demurrageTotal = 0
    renderData.containers = []
    for(let s of selection) {
      let con = await tb_container.findOne({
        where: {
          invoice_containers_id: s.invoice_containers_id
        }
      })
      let discharge_date = vessel.invoice_vessel_ata
      if(con.invoice_containers_edi_discharge_date) {
        discharge_date = con.invoice_containers_edi_discharge_date
      }
      con.invoice_containers_customer_id = customer.user_id
      con.invoice_containers_empty_return_invoice_date = curDate
      con.invoice_containers_empty_return_date_invoice = con.invoice_containers_empty_return_date
      con.invoice_containers_empty_return_overdue_days_invoice = con.invoice_containers_empty_return_overdue_days
      con.invoice_containers_empty_return_overdue_amount_invoice = con.invoice_containers_empty_return_overdue_amount
      con.invoice_containers_empty_return_edit_flg = GLBConfig.DISABLE
      await con.save()
      s.invoice_containers_size = con.invoice_containers_size
      s.invoice_containers_empty_return_date = con.invoice_containers_empty_return_date
      s.invoice_containers_empty_return_overdue_days = con.invoice_containers_empty_return_overdue_days
      s.invoice_containers_empty_return_overdue_amount = con.invoice_containers_empty_return_overdue_amount
     
      queryStr = `SELECT * FROM tbl_zhongtan_overdue_invoice_containers WHERE overdue_invoice_containers_invoice_containers_id= ? AND  overdue_invoice_containers_receipt_date IS NOT NULL AND overdue_invoice_containers_receipt_date != '' ORDER BY overdue_invoice_containers_receipt_date DESC LIMIT 1`
      replacements = [con.invoice_containers_id]
      let rcon = await model.simpleSelect(queryStr, replacements)
      if(rcon && rcon.length > 0) {
        s.starting_date = moment(rcon[0].overdue_invoice_containers_return_date, 'DD/MM/YYYY').add(1, 'days').format('DD/MM/YYYY')
        s.overdue_days = parseInt(con.invoice_containers_empty_return_overdue_days) - parseInt(rcon[0].overdue_invoice_containers_overdue_days)
        s.overdue_amount = parseFloat(con.invoice_containers_empty_return_overdue_amount) - parseFloat(rcon[0].overdue_invoice_containers_overdue_amount) 
      } else {
        s.starting_date = discharge_date
        s.overdue_days = con.invoice_containers_empty_return_overdue_days
        s.overdue_amount = con.invoice_containers_empty_return_overdue_amount
      }
      let conSize = await tb_container_size.findOne({
        where: {
          container_size_code: s.invoice_containers_size
        }
      })
      renderData.containers.push({
        'containerNo': s.invoice_containers_no,
        'sizeType': conSize ? conSize.container_size_name : s.invoice_containers_size,
        'startingDate': s.starting_date,
        'returnDate': s.invoice_containers_empty_return_date,
        'overdusDays': s.overdue_days,
        'demurrage': formatCurrency(s.overdue_amount),
      })
      demurrageTotal += parseFloat(s.overdue_amount)
    }
    renderData.demurrageTotal = formatCurrency(demurrageTotal)
    renderData.demurrageTotalStr = numberToText(demurrageTotal)
    let fileInfo = await common.ejs2Pdf('demurrage.ejs', renderData, 'zhongtan')
    let invoice_file = await tb_uploadfile.create({
      api_name: 'OVERDUE-INVOICE',
      user_id: user.user_id,
      uploadfile_index1: bl.invoice_masterbi_id,
      uploadfile_name: fileInfo.name,
      uploadfile_url: fileInfo.url,
      uploadfile_currency: 'USD',
      uploadfile_state: 'PB', // TODO state PM => PB
      uploadfile_amount: demurrageTotal,
      uploadfile_customer_id: customer.user_id,
      uploadfile_invoice_no: invoiceNo
    })
    for(let s of selection) {
      let discharge_date = vessel.invoice_vessel_ata
      if(s.invoice_containers_edi_discharge_date) {
        discharge_date = s.invoice_containers_edi_discharge_date
      }
      await tb_invoice_container.create({
        overdue_invoice_containers_invoice_uploadfile_id: invoice_file.uploadfile_id,
        overdue_invoice_containers_invoice_masterbi_id: s.invoice_masterbi_id,
        overdue_invoice_containers_invoice_containers_id: s.invoice_containers_id,
        overdue_invoice_containers_return_date: s.invoice_containers_empty_return_date,
        overdue_invoice_containers_overdue_days: s.invoice_containers_empty_return_overdue_days,
        overdue_invoice_containers_overdue_amount: s.invoice_containers_empty_return_overdue_amount,
        overdue_invoice_containers_overdue_free_days: s.invoice_containers_empty_return_overdue_free_days,
        overdue_invoice_containers_overdue_increase_days: s.overdue_days,
        overdue_invoice_containers_overdue_invoice_amount: s.overdue_amount,
        overdue_invoice_containers_overdue_discharge_date: discharge_date,
        overdue_invoice_containers_overdue_staring_date: s.starting_date
      })
    }
    return common.success()
  } else {
    return common.error('equipment_03')
  }
}

exports.emptyReInvoiceAct = async req => {
  let doc = common.docValidate(req), user = req.user, curDate = new Date()
  let selectAll = doc.selectAll
  let selection = []
  if(selectAll && doc.selection && doc.selection.length > 0) {
    let sel0 = doc.selection[0]
    let cons = await tb_container.findAll({
      where: {
        invoice_containers_bl: sel0.invoice_containers_bl,
        invoice_vessel_id: sel0.invoice_vessel_id,
        state: GLBConfig.ENABLE
      }
    })
    for(let c of cons) {
      if((c.invoice_containers_empty_return_receipt_date && c.invoice_containers_empty_return_overdue_amount && parseInt(c.invoice_containers_empty_return_overdue_amount) === 0) 
                || (c.invoice_containers_empty_return_date && c.invoice_containers_empty_return_overdue_amount && parseInt(c.invoice_containers_empty_return_overdue_amount) > 0)) {
        selection.push({
          ...JSON.parse(JSON.stringify(c)),
          invoice_masterbi_id: sel0.invoice_masterbi_id,
          invoice_vessel_id: sel0.invoice_vessel_id
        })
      }
    }
  } else {
    selection = doc.selection
  }
  let invoicePara = doc.invoicePara
  if(selection && selection.length > 0) {
    let row0 = selection[0]
    let bl = await tb_bl.findOne({
      where: {
        invoice_masterbi_id: row0.invoice_masterbi_id
      }
    })
  
    let vessel = await tb_vessel.findOne({
      where: {
        invoice_vessel_id: row0.invoice_vessel_id
      }
    })
  
    let customer = await tb_user.findOne({
      where: {
        user_id: invoicePara.invoice_customer_id
      }
    })
  
    let commonUser = await tb_user.findOne({
      where: {
        user_id: user.user_id
      }
    })
    
    let deduction = invoicePara.deduction
    let splitDeduction = 0
    if(deduction) {
      splitDeduction = Math.ceil(deduction / selection.length)
    }
    let mergeCon = {}
    for(let s of selection) {
      let con = await tb_container.findOne({
        where: {
          invoice_containers_id: s.invoice_containers_id
        }
      })
      let discharge_date = vessel.invoice_vessel_ata
      if(con.invoice_containers_edi_discharge_date) {
        discharge_date = con.invoice_containers_edi_discharge_date
      }
      con.invoice_containers_customer_id = customer.user_id
      con.invoice_containers_empty_return_invoice_date = curDate
      con.invoice_containers_empty_return_date_invoice = con.invoice_containers_empty_return_date
      con.invoice_containers_empty_return_overdue_days_invoice = con.invoice_containers_empty_return_overdue_days
      if(deduction > splitDeduction) {
        con.invoice_containers_empty_return_overdue_deduction = splitDeduction
        deduction -= splitDeduction
      } else {
        con.invoice_containers_empty_return_overdue_deduction = deduction
      }
      con.invoice_containers_empty_return_overdue_amount_invoice = con.invoice_containers_empty_return_overdue_amount - con.invoice_containers_empty_return_overdue_deduction
      con.invoice_containers_empty_return_edit_flg = GLBConfig.DISABLE
      await con.save()
      s.invoice_containers_size = con.invoice_containers_size
      s.invoice_containers_empty_return_date = con.invoice_containers_empty_return_date
      s.invoice_containers_empty_return_overdue_days = con.invoice_containers_empty_return_overdue_days
      s.invoice_containers_empty_return_overdue_amount = con.invoice_containers_empty_return_overdue_amount_invoice
      s.starting_date = discharge_date
      s.overdue_days = con.invoice_containers_empty_return_overdue_days
      s.overdue_amount = con.invoice_containers_empty_return_overdue_amount_invoice
      s.overdue_invoice_containers_overdue_deduction = con.invoice_containers_empty_return_overdue_deduction
      if(mergeCon.hasOwnProperty(s.starting_date)) {
        mergeCon[s.starting_date].push(s)
      } else {
        mergeCon[s.starting_date] = []
        mergeCon[s.starting_date].push(s)
      }
    }
    for(let key in mergeCon) {
      let row0 = mergeCon[key][0]
      let discharge_date = vessel.invoice_vessel_ata
      if(row0.invoice_containers_edi_discharge_date) {
        discharge_date = row0.invoice_containers_edi_discharge_date
      }
      let renderData = {}
      renderData.customerName = customer.user_name
      renderData.address = customer.user_address
      renderData.destination = bl.invoice_masterbi_destination.substring(0, 2)
      if(bl.invoice_masterbi_cargo_type === 'TR' || bl.invoice_masterbi_cargo_type === 'TRANSIT') {
        renderData.cargoType = 'TRANSIT'
      } else {
        renderData.cargoType = 'LOCAL'
      }
      renderData.masterbiBl = bl.invoice_masterbi_bl
      renderData.invoiceDate = moment().format('YYYY/MM/DD')
      let invoiceNo = await seq.genEquipmentInvoiceSeq()
      renderData.invoiceNo = invoiceNo
      renderData.vesselName = vessel.invoice_vessel_name
      renderData.voyageNumber = vessel.invoice_vessel_voyage
      renderData.dischargeDate = discharge_date
      renderData.startingDate = row0.starting_date
      renderData.user_name = commonUser.user_name
      renderData.user_phone = commonUser.user_phone
      renderData.user_email = commonUser.user_email
      let demurrageTotal = 0
      renderData.containers = []
      for(let s of mergeCon[key]) {
        let conSize = await tb_container_size.findOne({
          where: {
            container_size_code: s.invoice_containers_size
          }
        })
        renderData.containers.push({
          'containerNo': s.invoice_containers_no,
          'sizeType': conSize ? conSize.container_size_name : s.invoice_containers_size,
          'returnDate': s.invoice_containers_empty_return_date,
          'overdusDays': s.overdue_days,
          'demurrage': formatCurrency(s.overdue_amount),
        })
        demurrageTotal += parseFloat(s.overdue_amount)
      }
      renderData.demurrageTotal = formatCurrency(demurrageTotal)
      renderData.demurrageTotalStr = numberToText(demurrageTotal)
      let fileInfo = await common.ejs2Pdf('demurrage.ejs', renderData, 'zhongtan')
      let invoice_file = await tb_uploadfile.create({
        api_name: 'OVERDUE-INVOICE',
        user_id: user.user_id,
        uploadfile_index1: bl.invoice_masterbi_id,
        uploadfile_name: fileInfo.name,
        uploadfile_url: fileInfo.url,
        uploadfile_currency: 'USD',
        uploadfile_state: 'PB', // TODO state PM => PB
        uploadfile_amount: demurrageTotal,
        uploadfile_customer_id: customer.user_id,
        uploadfile_invoice_no: invoiceNo
      })
      
      for(let s of mergeCon[key]) {
        let discharge_date = vessel.invoice_vessel_ata
        if(s.invoice_containers_edi_discharge_date) {
          discharge_date = s.invoice_containers_edi_discharge_date
        }
        await tb_invoice_container.create({
          overdue_invoice_containers_invoice_uploadfile_id: invoice_file.uploadfile_id,
          overdue_invoice_containers_invoice_masterbi_id: s.invoice_masterbi_id,
          overdue_invoice_containers_invoice_containers_id: s.invoice_containers_id,
          overdue_invoice_containers_return_date: s.invoice_containers_empty_return_date,
          overdue_invoice_containers_overdue_days: s.invoice_containers_empty_return_overdue_days,
          overdue_invoice_containers_overdue_amount: s.invoice_containers_empty_return_overdue_amount,
          overdue_invoice_containers_overdue_free_days: s.invoice_containers_empty_return_overdue_free_days,
          overdue_invoice_containers_overdue_increase_days: s.overdue_days,
          overdue_invoice_containers_overdue_invoice_amount: s.overdue_amount,
          overdue_invoice_containers_overdue_discharge_date: discharge_date,
          overdue_invoice_containers_overdue_staring_date: s.starting_date,
          overdue_invoice_containers_overdue_deduction: s.overdue_invoice_containers_overdue_deduction
        })
      }
    }
    return common.success()
  } else {
    return common.error('equipment_03')
  }
}

exports.checkPasswordAct = async req => {
  let doc = common.docValidate(req)
  let check = await opSrv.checkPassword(doc.action, doc.checkPassword)
  if(check) {
    return common.success()
  } else {
    return common.error('auth_24')
  }
}

exports.actuallyOverdueCopyAct = async req => {
  let doc = common.docValidate(req)
  let con = await tb_container.findOne({
    where: {
      invoice_containers_id: doc.invoice_containers_id
    }
  })
  if(con) {
    con.invoice_containers_empty_return_date = con.invoice_containers_actually_return_date
    con.invoice_containers_empty_return_overdue_days = con.invoice_containers_actually_return_overdue_days
    con.invoice_containers_empty_return_overdue_amount = con.invoice_containers_actually_return_overdue_amount
    await con.save()
  }
  return common.success()
}

exports.containerInvoiceDetailAct = async req => {
  let doc = common.docValidate(req)
  let queryStr = `SELECT a.*, b.user_id, b.uploadfile_state, c.user_name FROM tbl_zhongtan_overdue_invoice_containers a LEFT JOIN tbl_zhongtan_uploadfile b ON a.overdue_invoice_containers_invoice_uploadfile_id = b.uploadfile_id LEFT JOIN tbl_common_user c ON b.user_id = c.user_id WHERE overdue_invoice_containers_invoice_containers_id = ? ORDER BY a.overdue_invoice_containers_id DESC`
  let replacements = []
  replacements.push(doc.invoice_containers_id)
  let result = await model.simpleSelect(queryStr, replacements)
  if(result) {
    for(let r of result) {
      r.invoice_created_at = moment(r.created_at).format('YYYY-MM-DD HH:mm')
      r.overdue_invoice_containers_receipt_date = r.overdue_invoice_containers_receipt_date ? moment(r.overdue_invoice_containers_receipt_date).format('YYYY-MM-DD HH:mm') : ''
    }
  }
  return common.success(result)
}

exports.issuingStoringOrderAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let selection = doc.selection
  let storingOrderPara = doc.storingOrderPara
  let receiptSelection = []
  let receiptInvocieCons = []
  if(selection && selection.length > 0) {
    for(let s of selection) {
      if(s.invoice_containers_issuing_storing_order_status) {
        receiptSelection.push(s)
        let rcon = await tb_invoice_container.findOne({
          where: {
            overdue_invoice_containers_invoice_containers_id: s.invoice_containers_id,
            overdue_invoice_containers_receipt_date: {
              [Op.ne]: null
            }
          },
          order: [['overdue_invoice_containers_overdue_days', 'DESC'], ['overdue_invoice_containers_receipt_date', 'DESC']]
        })
        if(rcon) {
          receiptInvocieCons.push(rcon)
        }
      }
    }
  }
  if(receiptSelection && receiptSelection.length > 0 && receiptInvocieCons && receiptInvocieCons.length > 0) {
    let mergeCon = {}
    for(let r of receiptInvocieCons) {
      if(mergeCon.hasOwnProperty(r.overdue_invoice_containers_return_date)) {
        mergeCon[r.overdue_invoice_containers_return_date].push(r)
      } else {
        mergeCon[r.overdue_invoice_containers_return_date] = []
        mergeCon[r.overdue_invoice_containers_return_date].push(r)
      }
    }

    let row0 = receiptSelection[0]
    let bl = await tb_bl.findOne({
      where: {
        invoice_masterbi_id: row0.invoice_masterbi_id
      }
    })
  
    let vessel = await tb_vessel.findOne({
      where: {
        invoice_vessel_id: row0.invoice_vessel_id
      }
    })
  
    let customer = await tb_user.findOne({
      where: {
        user_id: row0.invoice_containers_customer_id
      }
    })
  
    let commonUser = await tb_user.findOne({
      where: {
        user_id: user.user_id
      }
    })

    let depot = await tb_edi_depot.findOne({
      where: {
        state : GLBConfig.ENABLE,
        edi_depot_name: storingOrderPara.invoice_containers_depot_name
      }
    })
    if(depot.edi_depot_storing_order_email) {
      for(let key in mergeCon) {
        let renderData = {}
        renderData.depotName = depot.edi_depot_name
        renderData.customerName = customer.user_name
        renderData.returnDateStr = moment(key, 'DD/MM/YYYY').format('MMM DD, YYYY')
        renderData.bl = bl.invoice_masterbi_bl
        renderData.vessel = vessel.invoice_vessel_name
        renderData.voyage = vessel.invoice_vessel_voyage
        if(bl.invoice_masterbi_bl) {
          if(bl.invoice_masterbi_bl.indexOf('COS') >= 0) {
            renderData.line = 'COSCO'
          } else if(bl.invoice_masterbi_bl.indexOf('OOLU') >= 0) {
            renderData.line = 'OOCL'
          }
        }
        renderData.user_name = commonUser.user_name
        renderData.user_phone = commonUser.user_phone
        renderData.user_email = commonUser.user_email

        renderData.containers = []
        let seq = 1
        for(let s of mergeCon[key]) {
          let con = await tb_container.findOne({
            where: {
              invoice_containers_id: s.overdue_invoice_containers_invoice_containers_id
            }
          })
          let con_size_type = await tb_container_size.findOne({
            attributes: ['container_size_code', 'container_size_name'],
            where: {
              state : GLBConfig.ENABLE,
              [Op.or]: [{ container_size_code: con.invoice_containers_size }, { container_size_name: con.invoice_containers_size }]
            }
          })
          renderData.containers.push({
            seq: seq,
            containerNo: con.invoice_containers_no,
            sizeTYpe: con_size_type.container_size_name
          })
          seq++
          con.invoice_containers_depot_name = depot.edi_depot_name
          await con.save()
        }
        let html = await common.ejs2Html('StoringOrder.ejs', renderData)
        let mailSubject = customer.user_name + '/' + bl.invoice_masterbi_bl
        let mailContent = ''
        let mailHtml = html
        let attachments = []
        await mailer.sendEdiMail(GLBConfig.STORING_ORDER_EMAIL_SENDER, depot.edi_depot_storing_order_email, GLBConfig.STORING_ORDER_CARBON_COPY, GLBConfig.STORING_ORDER_BLIND_CARBON_COPY, mailSubject, mailContent, mailHtml, attachments)
      }
    }
    return common.success()
  } else {
    return common.error('equipment_03')
  }
}

exports.getInvoiceSelectionAct = async req => {
  let doc = common.docValidate(req)
  let action = doc.action
  let selectAll = doc.selectAll
  let selection = []
  if(selectAll && doc.selection && doc.selection.length > 0) {
    let sel0 = doc.selection[0]
    let cons = await tb_container.findAll({
      where: {
        invoice_containers_bl: sel0.invoice_containers_bl,
        invoice_vessel_id: sel0.invoice_vessel_id,
        state: GLBConfig.ENABLE
      }
    })
    for(let c of cons) {
      if((c.invoice_containers_empty_return_receipt_date && c.invoice_containers_empty_return_overdue_amount && parseInt(c.invoice_containers_empty_return_overdue_amount) === 0) 
                || (c.invoice_containers_empty_return_date && c.invoice_containers_empty_return_overdue_amount && parseInt(c.invoice_containers_empty_return_overdue_amount) > 0)) {
        selection.push({
          ...JSON.parse(JSON.stringify(c)),
          invoice_masterbi_id: sel0.invoice_masterbi_id,
          invoice_vessel_id: sel0.invoice_vessel_id
        })
      }
    }
  } else {
    selection = doc.selection
  }
  if(selection && selection.length > 0) {
    // 判断删除不符合条件的开票箱子
    for(let i = selection.length - 1; i>= 0; i--) {
      let sc = await tb_container.findOne({
        where: {
          invoice_containers_id: selection[i].invoice_containers_id
        }
      })
      if(sc) {
        if((sc.invoice_containers_empty_return_overdue_amount_receipt && sc.invoice_containers_actually_return_overdue_amount && (parseInt(sc.invoice_containers_empty_return_overdue_amount_receipt) === parseInt(sc.invoice_containers_actually_return_overdue_amount)))
        || (sc.invoice_containers_empty_return_overdue_amount_receipt && sc.invoice_containers_empty_return_overdue_amount && (parseInt(sc.invoice_containers_empty_return_overdue_amount_receipt) === parseInt(sc.invoice_containers_empty_return_overdue_amount)))) {
          selection.splice(i, 1)
        }
      } else {
        selection.splice(i, 1)
      }
    }
  }

  let returnData = {}
  let totalDemurrage = 0
  if(selection && selection.length > 0) {
    if(action === 'reinvoice') {
      for(let s of selection) {
        if(s.invoice_containers_empty_return_overdue_amount) {
          totalDemurrage += parseInt(s.invoice_containers_empty_return_overdue_amount)
        }
      }
    } else {
      let queryStr = ''
      let replacements = []
      for(let s of selection) {
        queryStr = `SELECT * FROM tbl_zhongtan_overdue_invoice_containers WHERE overdue_invoice_containers_invoice_containers_id= ? AND  overdue_invoice_containers_receipt_date IS NOT NULL AND overdue_invoice_containers_receipt_date != '' ORDER BY overdue_invoice_containers_overdue_days+0 DESC, overdue_invoice_containers_receipt_date DESC LIMIT 1`
        replacements = [s.invoice_containers_id]
        let rcon = await model.simpleSelect(queryStr, replacements)
        if(rcon && rcon.length > 0) {
          totalDemurrage += parseFloat(s.invoice_containers_empty_return_overdue_amount) - parseFloat(rcon[0].overdue_invoice_containers_overdue_amount) 
        } else {
          totalDemurrage += parseInt(s.invoice_containers_empty_return_overdue_amount)
        }
      }
    }
  }
  returnData.totalDemurrage = totalDemurrage
  return common.success(returnData)
}

function formatCurrency(num) {
  num = num.toString().replace(/[^\d.-]/g, '') //转成字符串并去掉其中除数字, . 和 - 之外的其它字符。
  if (isNaN(num)) num = '0' //是否非数字值
  let sign = num == (num = Math.abs(num))
  num = Math.floor(num * 100 + 0.50000000001) //下舍入
  let cents = num % 100 //求余 余数 = 被除数 - 除数 * 商
  cents = cents < 10 ? '0' + cents : cents //小于2位数就补齐
  num = Math.floor(num / 100).toString()
  for (let i = 0; i < Math.floor((num.length - (1 + i)) / 3); i++) {
    //每隔三位小数分始开隔
    //4 ==> 三位小数加一个分隔符，
    num = num.substring(0, num.length - (4 * i + 3)) + ',' + num.substring(num.length - (4 * i + 3))
  }
  return (sign ? '' : '-') + num + '.' + cents
}