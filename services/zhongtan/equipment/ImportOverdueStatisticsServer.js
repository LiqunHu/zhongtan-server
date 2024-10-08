const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const opSrv = require('../../common/system/OperationPasswordServer')
const cal_config_srv = require('../equipment/OverdueCalculationConfigServer')
const tb_container_size = model.zhongtan_container_size

exports.initAct = async () => {
  let returnData = {}
  returnData['CONTAINER_SIZE'] = await tb_container_size.findAll({
    attributes: ['container_size_code', 'container_size_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['container_size_code', 'ASC']]
  })
  returnData['UPLOAD_STATE'] = GLBConfig.UPLOAD_STATE
  returnData['FREE_DAYS_RANGE'] = [
    '1-10',
    '11-60',
    '61-90',
    '91-150',
    '151-',
  ]
  let queryStr = `SELECT invoice_vessel_id, CONCAT(invoice_vessel_name, '/', invoice_vessel_voyage) AS vessel_info FROM tbl_zhongtan_invoice_vessel WHERE state = 1 ORDER BY invoice_vessel_name, invoice_vessel_voyage`
  let replacements = []
  returnData['VESSEL'] = await model.simpleSelect(queryStr, replacements)
  queryStr = `SELECT user_id, user_name FROM tbl_common_user WHERE state = 1 AND user_type = '${GLBConfig.TYPE_CUSTOMER}' ORDER BY user_name`
  replacements = []
  returnData['CUSTOMER'] = await model.simpleSelect(queryStr, replacements)
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = ` SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination, c.invoice_masterbi_carrier, c.invoice_masterbi_consignee_name, d.user_name as invoice_masterbi_demurrage_party, e.user_name AS invoice_masterbi_deposit_party 
  from tbl_zhongtan_invoice_containers a LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' 
  LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = '1' AND c.invoice_vessel_id = a.invoice_vessel_id 
  LEFT JOIN tbl_common_user d ON a.invoice_containers_customer_id = d.user_id 
  LEFT JOIN tbl_common_user e ON c.invoice_masterbi_customer_id = e.user_id 
  WHERE a.state = '1' `
  let replacements = []
  if(doc.search_data) {
    if (doc.search_data.ata_date && doc.search_data.ata_date.length > 1 && doc.search_data.ata_date[0] && doc.search_data.ata_date[1]) {
      queryStr += ' and STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y") >= ? and STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y") < ? '
      replacements.push(doc.search_data.ata_date[0])
      replacements.push(moment(doc.search_data.ata_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.return_date && doc.search_data.return_date.length > 1 && doc.search_data.return_date[0] && doc.search_data.return_date[1]) {
      queryStr += ' and STR_TO_DATE(a.invoice_containers_actually_return_date, "%d/%m/%Y") >= ? and STR_TO_DATE(a.invoice_containers_actually_return_date, "%d/%m/%Y") < ? '
      replacements.push(doc.search_data.return_date[0])
      replacements.push(moment(doc.search_data.return_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.invoice_containers_bl) {
      queryStr += ' and a.invoice_containers_bl like ? '
      replacements.push('%' + doc.search_data.invoice_containers_bl + '%')
    }
    if (doc.search_data.invoice_containers_no) {
      queryStr += ' and a.invoice_containers_no like ? '
      replacements.push('%' + doc.search_data.invoice_containers_no + '%')
    }
    if (doc.search_data.vessel_id) {
      queryStr += ' and a.invoice_vessel_id = ? '
      replacements.push(doc.search_data.vessel_id)
    }
    if (doc.search_data.customer_id) {
      queryStr += ' and (a.invoice_containers_customer_id = ? or c.invoice_masterbi_customer_id = ? ) '
      replacements.push(doc.search_data.customer_id)
      replacements.push(doc.search_data.customer_id)
    }
    if (doc.search_data.free_days_range) {
      let ranges = doc.search_data.free_days_range.split('-')
      if(ranges) {
        if(ranges[0]) {
          queryStr += ' and a.invoice_containers_current_overdue_days+0 >= ?'
          replacements.push(ranges[0])
        }
        if(ranges[1]) {
          queryStr += ' and a.invoice_containers_current_overdue_days+0 <= ?'
          replacements.push(ranges[1])
        }
      }
    }
    if (doc.search_data.is_paid) {
      doc.search_data.is_overdue = '1'
      // 查询是否支付时只判断超期的
      if(doc.search_data.is_paid === '1') {
        queryStr += ` and (a.invoice_containers_empty_return_invoice_date is not null and a.invoice_containers_empty_return_receipt_date is not null ) `
      } else {
        queryStr += ` and a.invoice_containers_type != 'S' and (a.invoice_containers_empty_return_invoice_date is null or a.invoice_containers_empty_return_receipt_date is null or a.invoice_containers_actually_return_date IS NULL or (IFNULL(a.invoice_containers_empty_return_overdue_amount,0) > (IFNULL(a.invoice_containers_empty_return_overdue_amount_receipt,0) + IFNULL(a.invoice_containers_empty_return_overdue_deduction,0))))  `
      }
    }

    if (doc.search_data.is_overdue) {
      if(doc.search_data.is_overdue === '1') {
        queryStr += ` AND CASE WHEN a.invoice_containers_empty_return_overdue_free_days IS NOT NULL AND a.invoice_containers_empty_return_overdue_free_days != '' THEN TIMESTAMPDIFF(DAY, STR_TO_DATE(IFNULL(a.invoice_containers_edi_discharge_date, b.invoice_vessel_ata), "%d/%m/%Y"), STR_TO_DATE(IFNULL(a.invoice_containers_empty_return_date, DATE_FORMAT(NOW(), '%d/%m/%Y')), "%d/%m/%Y"))+1 > a.invoice_containers_empty_return_overdue_free_days+0 ELSE TIMESTAMPDIFF(DAY, STR_TO_DATE(IFNULL(a.invoice_containers_edi_discharge_date, b.invoice_vessel_ata), "%d/%m/%Y"), STR_TO_DATE(IFNULL(a.invoice_containers_empty_return_date, DATE_FORMAT(NOW(), '%d/%m/%Y')), "%d/%m/%Y"))+1 > (SELECT overdue_charge_max_day
          FROM tbl_zhongtan_overdue_charge_rule
          WHERE overdue_charge_business_type = 'I' and overdue_charge_cargo_type = c.invoice_masterbi_cargo_type
          AND overdue_charge_discharge_port = SUBSTR(c.invoice_masterbi_destination, 1, 2)
          AND overdue_charge_carrier = c.invoice_masterbi_carrier
          AND overdue_charge_container_size = a.invoice_containers_size
          AND (
          overdue_charge_amount = 0
          OR overdue_charge_amount IS NULL
          OR overdue_charge_amount = ''
          )
          AND ((overdue_charge_enabled_date IS NOT NULL AND STR_TO_DATE(overdue_charge_enabled_date, '%Y-%m-%d') <= STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y")) OR (overdue_charge_enabled_date IS NULL)) ORDER BY overdue_charge_enabled_date DESC LIMIT 1) END  `
      } else {
        queryStr += ` AND CASE WHEN a.invoice_containers_empty_return_overdue_free_days IS NOT NULL AND a.invoice_containers_empty_return_overdue_free_days != '' THEN TIMESTAMPDIFF(DAY, STR_TO_DATE(IFNULL(a.invoice_containers_edi_discharge_date, b.invoice_vessel_ata), "%d/%m/%Y"), STR_TO_DATE(IFNULL(a.invoice_containers_empty_return_date, DATE_FORMAT(NOW(), '%d/%m/%Y')), "%d/%m/%Y"))+1 <= a.invoice_containers_empty_return_overdue_free_days+0 ELSE TIMESTAMPDIFF(DAY, STR_TO_DATE(IFNULL(a.invoice_containers_edi_discharge_date, b.invoice_vessel_ata), "%d/%m/%Y"), STR_TO_DATE(IFNULL(a.invoice_containers_empty_return_date, DATE_FORMAT(NOW(), '%d/%m/%Y')), "%d/%m/%Y"))+1 <= (SELECT overdue_charge_max_day
          FROM tbl_zhongtan_overdue_charge_rule
          WHERE overdue_charge_business_type = 'I' and overdue_charge_cargo_type = c.invoice_masterbi_cargo_type
          AND overdue_charge_discharge_port = SUBSTR(c.invoice_masterbi_destination, 1, 2)
          AND overdue_charge_carrier = c.invoice_masterbi_carrier
          AND overdue_charge_container_size = a.invoice_containers_size
          AND (
          overdue_charge_amount = 0
          OR overdue_charge_amount IS NULL
          OR overdue_charge_amount = ''
          )
          AND ((overdue_charge_enabled_date IS NOT NULL AND STR_TO_DATE(overdue_charge_enabled_date, '%Y-%m-%d') <= STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y")) OR (overdue_charge_enabled_date IS NULL)) ORDER BY overdue_charge_enabled_date DESC LIMIT 1) END  `
      }
    }

    if (doc.search_data.is_invoice) {
      if(doc.search_data.is_invoice === '1') {
        queryStr += ` and (a.invoice_containers_empty_return_invoice_date is not null or a.invoice_containers_empty_return_receipt_date is not null ) `
      } else {
        queryStr += ` and (a.invoice_containers_empty_return_invoice_date is null and a.invoice_containers_empty_return_receipt_date is null )  `
      }
    }
    if (doc.search_data.invoice_no) {
      queryStr += ` and a.invoice_containers_id IN (SELECT overdue_invoice_containers_invoice_containers_id FROM tbl_zhongtan_overdue_invoice_containers ic LEFT JOIN tbl_zhongtan_uploadfile uf ON ic.overdue_invoice_containers_invoice_uploadfile_id = uf.uploadfile_id WHERE ic.state = 1 AND uf.state = 1 AND uf.api_name = 'OVERDUE-INVOICE' AND uf.uploadfile_invoice_no LIKE ?) `
      replacements.push('%' + doc.search_data.invoice_no + '%')
    }
    if (doc.search_data.receipt_no) {
      queryStr += ` and a.invoice_containers_id IN (SELECT overdue_invoice_containers_invoice_containers_id FROM tbl_zhongtan_overdue_invoice_containers ic LEFT JOIN tbl_zhongtan_uploadfile uf ON ic.overdue_invoice_containers_invoice_uploadfile_id = uf.uploadfile_id WHERE ic.state = 1 AND uf.state = 1 AND uf.api_name = 'OVERDUE-INVOICE' AND uf.uploadfile_receipt_no LIKE ?) `
      replacements.push('%' + doc.search_data.receipt_no + '%')
    }
    if (doc.search_data.consignee) {
      queryStr += ` and c.invoice_masterbi_consignee_name = ?`
      replacements.push(doc.search_data.consignee)
    }
    if (doc.search_data.sizeType) {
      queryStr += ` and a.invoice_containers_size = ?`
      replacements.push(doc.search_data.sizeType)
    }
  }
  queryStr = queryStr + ' ORDER BY b.invoice_vessel_id DESC, a.invoice_containers_bl, a.invoice_containers_no'
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  if(result.data) {
    for(let d of result.data) {
      if(d.invoice_containers_empty_return_overdue_free_days) {
        d.invoice_containers_free_days = d.invoice_containers_empty_return_overdue_free_days
      } else {
        d.invoice_containers_free_days = await cal_config_srv.queryContainerFreeDays(d.invoice_masterbi_cargo_type, d.invoice_masterbi_destination.substring(0, 2), d.invoice_masterbi_carrier, d.invoice_containers_size, d.invoice_vessel_ata)
      }
    }
  }
  returnData.rows = result.data
  return common.success(returnData)
}


exports.exportDataAct = async(req, res) => {
  let doc = common.docValidate(req)
  let queryStr = ` SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination, c.invoice_masterbi_carrier, c.invoice_masterbi_consignee_name, d.user_name as invoice_masterbi_demurrage_party, e.user_name AS invoice_masterbi_deposit_party 
  from tbl_zhongtan_invoice_containers a LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' 
  LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = '1' AND c.invoice_vessel_id = a.invoice_vessel_id 
  LEFT JOIN tbl_common_user d ON a.invoice_containers_customer_id = d.user_id 
  LEFT JOIN tbl_common_user e ON c.invoice_masterbi_customer_id = e.user_id 
  WHERE a.state = '1' `
  let replacements = []
  if(doc.search_data) {
    if (doc.search_data.ata_date && doc.search_data.ata_date.length > 1 && doc.search_data.ata_date[0] && doc.search_data.ata_date[1]) {
      queryStr += ' and STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y") >= ? and STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y") < ? '
      replacements.push(doc.search_data.ata_date[0])
      replacements.push(moment(doc.search_data.ata_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.return_date && doc.search_data.return_date.length > 1 && doc.search_data.return_date[0] && doc.search_data.return_date[1]) {
      queryStr += ' and STR_TO_DATE(a.invoice_containers_actually_return_date, "%d/%m/%Y") >= ? and STR_TO_DATE(a.invoice_containers_actually_return_date, "%d/%m/%Y") < ? '
      replacements.push(doc.search_data.return_date[0])
      replacements.push(moment(doc.search_data.return_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.invoice_containers_bl) {
      queryStr += ' and a.invoice_containers_bl like ? '
      replacements.push('%' + doc.search_data.invoice_containers_bl + '%')
    }
    if (doc.search_data.invoice_containers_no) {
      queryStr += ' and a.invoice_containers_no like ? '
      replacements.push('%' + doc.search_data.invoice_containers_no + '%')
    }
    if (doc.search_data.vessel_id) {
      queryStr += ' and a.invoice_vessel_id = ? '
      replacements.push(doc.search_data.vessel_id)
    }
    if (doc.search_data.customer_id) {
      queryStr += ' and (a.invoice_containers_customer_id = ? or c.invoice_masterbi_customer_id = ? ) '
      replacements.push(doc.search_data.customer_id)
      replacements.push(doc.search_data.customer_id)
    }
    if (doc.search_data.free_days_range) {
      let ranges = doc.search_data.free_days_range.split('-')
      if(ranges) {
        if(ranges[0]) {
          queryStr += ' and a.invoice_containers_current_overdue_days+0 >= ?'
          replacements.push(ranges[0])
        }
        if(ranges[1]) {
          queryStr += ' and a.invoice_containers_current_overdue_days+0 <= ?'
          replacements.push(ranges[1])
        }
      }
    }
    if (doc.search_data.is_paid) {
      doc.search_data.is_overdue = '1'
      // 查询是否支付时只判断超期的
      if(doc.search_data.is_paid === '1') {
        queryStr += ` and (a.invoice_containers_empty_return_invoice_date is not null and a.invoice_containers_empty_return_receipt_date is not null ) `
      } else {
        queryStr += ` and a.invoice_containers_type != 'S' and (a.invoice_containers_empty_return_invoice_date is null or a.invoice_containers_empty_return_receipt_date is null or a.invoice_containers_actually_return_date IS NULL or (IFNULL(a.invoice_containers_empty_return_overdue_amount,0) > (IFNULL(a.invoice_containers_empty_return_overdue_amount_receipt,0) + IFNULL(a.invoice_containers_empty_return_overdue_deduction,0))))  `
      }
    }
    if (doc.search_data.is_overdue) {
      if(doc.search_data.is_overdue === '1') {
        queryStr += ` AND CASE WHEN a.invoice_containers_empty_return_overdue_free_days IS NOT NULL AND a.invoice_containers_empty_return_overdue_free_days != '' THEN TIMESTAMPDIFF(DAY, STR_TO_DATE(IFNULL(a.invoice_containers_edi_discharge_date, b.invoice_vessel_ata), "%d/%m/%Y"), STR_TO_DATE(IFNULL(a.invoice_containers_empty_return_date, DATE_FORMAT(NOW(), '%d/%m/%Y')), "%d/%m/%Y")) + 1 > a.invoice_containers_empty_return_overdue_free_days+0 ELSE TIMESTAMPDIFF(DAY, STR_TO_DATE(IFNULL(a.invoice_containers_edi_discharge_date, b.invoice_vessel_ata), "%d/%m/%Y"), STR_TO_DATE(IFNULL(a.invoice_containers_empty_return_date, DATE_FORMAT(NOW(), '%d/%m/%Y')), "%d/%m/%Y")) + 1 > (SELECT overdue_charge_max_day
          FROM tbl_zhongtan_overdue_charge_rule
          WHERE overdue_charge_business_type = 'I' and overdue_charge_cargo_type = c.invoice_masterbi_cargo_type
          AND overdue_charge_discharge_port = SUBSTR(c.invoice_masterbi_destination, 1, 2)
          AND overdue_charge_carrier = c.invoice_masterbi_carrier
          AND overdue_charge_container_size = a.invoice_containers_size
          AND (
          overdue_charge_amount = 0
          OR overdue_charge_amount IS NULL
          OR overdue_charge_amount = ''
          )
          AND ((overdue_charge_enabled_date IS NOT NULL AND STR_TO_DATE(overdue_charge_enabled_date, '%Y-%m-%d') <= STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y")) OR (overdue_charge_enabled_date IS NULL)) ORDER BY overdue_charge_enabled_date DESC LIMIT 1) END  `
      } else {
        queryStr += ` AND CASE WHEN a.invoice_containers_empty_return_overdue_free_days IS NOT NULL AND a.invoice_containers_empty_return_overdue_free_days != '' THEN TIMESTAMPDIFF(DAY, STR_TO_DATE(IFNULL(a.invoice_containers_edi_discharge_date, b.invoice_vessel_ata), "%d/%m/%Y"), STR_TO_DATE(IFNULL(a.invoice_containers_empty_return_date, DATE_FORMAT(NOW(), '%d/%m/%Y')), "%d/%m/%Y")) + 1 <= a.invoice_containers_empty_return_overdue_free_days+0 ELSE TIMESTAMPDIFF(DAY, STR_TO_DATE(IFNULL(a.invoice_containers_edi_discharge_date, b.invoice_vessel_ata), "%d/%m/%Y"), STR_TO_DATE(IFNULL(a.invoice_containers_empty_return_date, DATE_FORMAT(NOW(), '%d/%m/%Y')), "%d/%m/%Y")) + 1 <= (SELECT overdue_charge_max_day
          FROM tbl_zhongtan_overdue_charge_rule
          WHERE overdue_charge_business_type = 'I' and overdue_charge_cargo_type = c.invoice_masterbi_cargo_type
          AND overdue_charge_discharge_port = SUBSTR(c.invoice_masterbi_destination, 1, 2)
          AND overdue_charge_carrier = c.invoice_masterbi_carrier
          AND overdue_charge_container_size = a.invoice_containers_size
          AND (
          overdue_charge_amount = 0
          OR overdue_charge_amount IS NULL
          OR overdue_charge_amount = ''
          )
          AND ((overdue_charge_enabled_date IS NOT NULL AND STR_TO_DATE(overdue_charge_enabled_date, '%Y-%m-%d') <= STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y")) OR (overdue_charge_enabled_date IS NULL)) ORDER BY overdue_charge_enabled_date DESC LIMIT 1) END  `
      }
    }
    if (doc.search_data.is_invoice) {
      if(doc.search_data.is_invoice === '1') {
        queryStr += ` and (a.invoice_containers_empty_return_invoice_date is not null or a.invoice_containers_empty_return_receipt_date is not null ) `
      } else {
        queryStr += ` and (a.invoice_containers_empty_return_invoice_date is null and a.invoice_containers_empty_return_receipt_date is null )  `
      }
    }
    if (doc.search_data.invoice_no) {
      queryStr += ` and a.invoice_containers_id IN (SELECT overdue_invoice_containers_invoice_containers_id FROM tbl_zhongtan_overdue_invoice_containers ic LEFT JOIN tbl_zhongtan_uploadfile uf ON ic.overdue_invoice_containers_invoice_uploadfile_id = uf.uploadfile_id WHERE ic.state = 1 AND uf.state = 1 AND uf.api_name = 'OVERDUE-INVOICE' AND uf.uploadfile_invoice_no LIKE ?) `
      replacements.push('%' + doc.search_data.invoice_no + '%')
    }
    if (doc.search_data.receipt_no) {
      queryStr += ` and a.invoice_containers_id IN (SELECT overdue_invoice_containers_invoice_containers_id FROM tbl_zhongtan_overdue_invoice_containers ic LEFT JOIN tbl_zhongtan_uploadfile uf ON ic.overdue_invoice_containers_invoice_uploadfile_id = uf.uploadfile_id WHERE ic.state = 1 AND uf.state = 1 AND uf.api_name = 'OVERDUE-INVOICE' AND uf.uploadfile_receipt_no LIKE ?) `
      replacements.push('%' + doc.search_data.receipt_no + '%')
    }
    if (doc.search_data.consignee) {
      queryStr += ` and c.invoice_masterbi_consignee_name = ?`
      replacements.push(doc.search_data.consignee)
    }
    if (doc.search_data.sizeType) {
      queryStr += ` and a.invoice_containers_size = ?`
      replacements.push(doc.search_data.sizeType)
    }
  }
  queryStr = queryStr + ' ORDER BY b.invoice_vessel_id DESC, a.invoice_containers_bl, a.invoice_containers_no'
  let result = await model.simpleSelect(queryStr, replacements)
  let renderData = []
  let calFreeDays = []
  for (let r of result) {
    if(r.invoice_masterbi_destination) {
      let cal = true
      for(let c of calFreeDays) {
        if(c.invoice_masterbi_cargo_type === r.invoice_masterbi_cargo_type 
          && c.invoice_masterbi_destination === r.invoice_masterbi_destination
          && c.invoice_masterbi_carrier === r.invoice_masterbi_carrier
          && c.invoice_containers_size === r.invoice_containers_size
          && c.invoice_vessel_ata === r.invoice_vessel_ata && c.cal_free_days) {
            cal = false
            break
        }
      }
      if(cal) {
        let free_days = await cal_config_srv.queryContainerFreeDays(r.invoice_masterbi_cargo_type, r.invoice_masterbi_destination.substring(0, 2), r.invoice_masterbi_carrier, r.invoice_containers_size, r.invoice_vessel_ata)
        if(free_days) {
          calFreeDays.push({
            invoice_masterbi_cargo_type: r.invoice_masterbi_cargo_type,
            invoice_masterbi_destination: r.invoice_masterbi_destination,
            invoice_masterbi_carrier: r.invoice_masterbi_carrier,
            invoice_containers_size: r.invoice_containers_size,
            invoice_vessel_ata: r.invoice_vessel_ata,
            cal_free_days: free_days
          })
        }
      }
    }
  }
  for (let r of result) {
    if(r.invoice_containers_empty_return_overdue_free_days) {
      r.invoice_containers_free_days = r.invoice_containers_empty_return_overdue_free_days
    } else {
      for(let c of calFreeDays) {
        if(c.invoice_masterbi_cargo_type === r.invoice_masterbi_cargo_type 
          && c.invoice_masterbi_destination === r.invoice_masterbi_destination
          && c.invoice_masterbi_carrier === r.invoice_masterbi_carrier
          && c.invoice_containers_size === r.invoice_containers_size
          && c.invoice_vessel_ata === r.invoice_vessel_ata && c.cal_free_days) {
            r.invoice_containers_free_days = c.cal_free_days
            break
        }
      }
    }
    r.discharge_date = r.invoice_vessel_ata
    if(r.invoice_containers_edi_discharge_date) {
      r.discharge_date = r.invoice_containers_edi_discharge_date
    }
    if(r.discharge_date) {
      r.discharge_date = moment(r.discharge_date, 'DD/MM/YYYY').format('YYYY-MM-DD')
    }
    if(r.invoice_containers_actually_return_date) {
      r.invoice_containers_actually_return_date = moment(r.invoice_containers_actually_return_date, 'DD/MM/YYYY').format('YYYY-MM-DD')
    }
    if(r.invoice_containers_type === 'S') {
      r.invoice_masterbi_demurrage_party = 'SOC'
    } else if(r.invoice_containers_auction === '1') {
      r.invoice_masterbi_demurrage_party = 'AUCTIONED'
    }
    renderData.push(r)
  }

  let filepath = await common.ejs2xlsx('OverdueTemplate.xlsx', renderData)

  res.sendFile(filepath)
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

exports.getConsigneeAct = async req => {
  let doc = common.docValidate(req)
  let retData = {}
  if(doc.query) {
    let queryStr = `SELECT invoice_masterbi_consignee_name as name FROM tbl_zhongtan_invoice_masterbl WHERE state = 1 and invoice_masterbi_consignee_name like ? GROUP BY invoice_masterbi_consignee_name LIMIT 10`
    let replacements = ['%' + doc.query + '%']
    let consignees = await model.simpleSelect(queryStr, replacements)
    retData.consignees = JSON.parse(JSON.stringify(consignees))
  }
  return common.success(retData)
}
