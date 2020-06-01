const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')

const tb_overdue_charge_rule = model.zhongtan_overdue_charge_rule
const tb_container_size = model.zhongtan_container_size
const tb_discharge_port = model.zhongtan_discharge_port
const tb_container = model.zhongtan_invoice_containers

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
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination from tbl_zhongtan_invoice_containers a LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = 1 WHERE a.state = '1'`
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
    for(let c of chargeRules) {
      let charge = parseInt(c.overdue_charge_amount)
      let min = parseInt(c.overdue_charge_min_day)
      if(diff >= min) {
        if(c.overdue_charge_max_day) {
          let max = parseInt(c.overdue_charge_max_day)
          if(diff > max) {
            overdueAmount = overdueAmount + charge * (max - min + 1)
          } else {
            overdueAmount = overdueAmount + charge * (diff - min + 1)
          }
        } else {
          overdueAmount = overdueAmount + charge * (diff - min + 1)
        }
      }
    }
    let returnData = {
      diff_days: diff,
      overdue_amount: overdueAmount
    }
    return common.success(returnData)
  } else {
    return common.error('equipment_02')
  }
}

exports.ladenReleaseSaveAct = async req => {
  let doc = common.docValidate(req)
  let con = await tb_container.findOne({
    where: {
      invoice_containers_id: doc.invoice_containers_id
    }
  })
  if(con) {
    con.invoice_containers_laden_release_date = moment(doc.invoice_containers_laden_release_date).add(1, 'days').format('DD/MM/YYYY')
    con.invoice_containers_laden_release_overdue_amount = doc.invoice_containers_laden_release_overdue_amount
    con.invoice_containers_laden_release_overdue_days = doc.invoice_containers_laden_release_overdue_days
    await con.save()
    return common.success()
  } else {
    return common.error('equipment_03')
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
    con.invoice_containers_empty_return_date = moment(doc.invoice_containers_empty_return_date).add(1, 'days').format('DD/MM/YYYY')
    con.invoice_containers_empty_return_overdue_amount = doc.invoice_containers_empty_return_overdue_amount
    con.invoice_containers_empty_return_overdue_days = doc.invoice_containers_empty_return_overdue_days
    await con.save()
    return common.success()
  } else {
    return common.error('equipment_03')
  }
}
