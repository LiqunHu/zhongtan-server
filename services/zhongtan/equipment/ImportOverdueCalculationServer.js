const moment = require('moment')
const numberToText = require('number2text')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')

const tb_user = model.common_user
const tb_vessel = model.zhongtan_invoice_vessel
const tb_bl = model.zhongtan_invoice_masterbl
const tb_overdue_charge_rule = model.zhongtan_overdue_charge_rule
const tb_container_size = model.zhongtan_container_size
const tb_discharge_port = model.zhongtan_discharge_port
const tb_container = model.zhongtan_invoice_containers
const tb_invoice_container = model.zhongtan_overdue_invoice_containers
const tb_uploadfile = model.zhongtan_uploadfile


exports.initAct = async () => {
  let returnData = {}
  returnData['CONTAINER_SIZE'] = await tb_container_size.findAll({
    attributes: ['container_size_code', 'container_size_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['container_size_code', 'ASC']]
  })
  returnData['DISCHARGE_PORT'] = await tb_discharge_port.findAll({
    attributes: ['discharge_port_code', 'discharge_port_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['discharge_port_code', 'ASC']]
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
          WHERE a.uploadfile_index1 = ? AND a.api_name IN('OVERDUE-INVOICE', 'OVERDUE-RECEIPT') ORDER BY a.uploadfile_id DESC`
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
            release_user: f.user_name
          })
        }
      }
    }
  }
  returnData.rows = result.data

  return common.success(returnData)
}

exports.calculationAct = async req => {
  let doc = common.docValidate(req)
  let discharge_port = doc.invoice_masterbi_destination.substring(0, 2)
  let charge_carrier = 'COSCO'
  if(doc.invoice_containers_bl.indexOf('COS') >= 0) {
    charge_carrier  = 'COSCO'
  } else if(doc.invoice_containers_bl.indexOf('OOLU') >= 0) {
    charge_carrier  = 'OOCL'
  }
  let chargeRules = await tb_overdue_charge_rule.findAll({
    where: {
      state: GLBConfig.ENABLE,
      overdue_charge_cargo_type: doc.invoice_masterbi_cargo_type,
      overdue_charge_discharge_port: discharge_port,
      overdue_charge_carrier: charge_carrier,
      overdue_charge_container_size: doc.invoice_containers_size
    },
    order: [['overdue_charge_min_day', 'DESC']]
  })
  if(chargeRules && chargeRules.length  > 0) {
    let diff = moment(doc.return_date, 'DD/MM/YYYY').diff(moment(doc.invoice_vessel_ata, 'DD/MM/YYYY'), 'days') + 1 // Calendar day Cover First Day
    let overdueAmount = 0
    let freeMaxDay = 0
    for(let c of chargeRules) {
      let charge = parseInt(c.overdue_charge_amount)
      let min = parseInt(c.overdue_charge_min_day)
      let max = parseInt(c.overdue_charge_max_day)
      if(diff >= min) {
        if(c.overdue_charge_max_day) {
          if(diff > max) {
            overdueAmount = overdueAmount + charge * (max - min + 1)
          } else {
            overdueAmount = overdueAmount + charge * (diff - min + 1)
          }
        } else {
          overdueAmount = overdueAmount + charge * (diff - min + 1)
        }
        if(charge === 0) {
          if(max > freeMaxDay) {
            freeMaxDay = max
          }
        }
      }
    }
    let returnData = {
      diff_days: diff > freeMaxDay ? diff - freeMaxDay : 0,
      overdue_amount: overdueAmount
    }
    return common.success(returnData)
  } else {
    return common.error('equipment_02')
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
    con.invoice_containers_empty_return_date = moment(doc.invoice_containers_empty_return_date, 'DD/MM/YYYY').format('DD/MM/YYYY')
    con.invoice_containers_empty_return_overdue_amount = doc.invoice_containers_empty_return_overdue_amount
    con.invoice_containers_empty_return_overdue_days = doc.invoice_containers_empty_return_overdue_days
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
    let search_text = '%' + doc.search_text + '%'
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
  let selection = doc.selection
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
    renderData.invoiceNo = await seq.genEquipmentInvoiceSeq()
    renderData.vesselName = vessel.invoice_vessel_name
    renderData.voyageNumber = vessel.invoice_vessel_voyage
    renderData.voyageAtaDate = vessel.invoice_vessel_ata
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
      con.invoice_containers_customer_id = customer.user_id
      con.invoice_containers_empty_return_invoice_date = curDate
      con.save()
      let conSize = await tb_container_size.findOne({
        where: {
          container_size_code: con.invoice_containers_size
        }
      })
      renderData.containers.push({
        'containerNo': con.invoice_containers_no,
        'sizeType': conSize ? conSize.container_size_name : con.invoice_containers_size,
        'returnDate': con.invoice_containers_empty_return_date,
        'overdusDays': con.invoice_containers_empty_return_overdue_days,
        'demurrage': formatCurrency(con.invoice_containers_empty_return_overdue_amount),
      })
      demurrageTotal += parseFloat(con.invoice_containers_empty_return_overdue_amount)
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
      uploadfile_customer_id: customer.user_id
    })
    
    for(let s of selection) {
      await tb_invoice_container.create({
        overdue_invoice_containers_invoice_uploadfile_id: invoice_file.uploadfile_id,
        overdue_invoice_containers_invoice_masterbi_id: s.invoice_masterbi_id,
        overdue_invoice_containers_invoice_containers_id: s.invoice_containers_id,
        overdue_invoice_containers_return_date: s.invoice_containers_empty_return_date,
        overdue_invoice_containers_overdue_days: s.invoice_containers_empty_return_overdue_days,
        overdue_invoice_containers_overdue_amount: s.invoice_containers_empty_return_overdue_amount
      })
    }
    return common.success()
  } else {
    return common.error('equipment_03')
  }
}

exports.checkPasswordAct = async req => {
  let doc = common.docValidate(req)
  if(!doc.check_password) {
    return common.error('auth_18')
  } else {
    let adminUser = await tb_user.findOne({
      where: {
        user_username: 'admin'
      }
    })
    if(adminUser) {
      if(adminUser.user_password !== doc.check_password) {
        return common.error('auth_24')
      }
    } else {
      return common.error('auth_18')
    }
  }
  return common.success()
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
    con.save()
  }
  return common.success()
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