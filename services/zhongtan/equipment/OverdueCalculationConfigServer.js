const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const moment = require('moment')
const model = require('../../../app/model')

const tb_overdue_charge_rule = model.zhongtan_overdue_charge_rule
const tb_container_size = model.zhongtan_container_size
const tb_discharge_port = model.zhongtan_discharge_port

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

  let queryStr = `select * from tbl_zhongtan_overdue_charge_rule where state = '1'`
  let replacements = []

  if(doc.search_data) {
    if (doc.search_data.overdue_charge_cargo_type) {
      queryStr += ' and overdue_charge_cargo_type = ?'
      replacements.push(doc.search_data.overdue_charge_cargo_type)
    }
    if (doc.search_data.overdue_charge_discharge_port) {
      queryStr += ' and overdue_charge_discharge_port = ?'
      replacements.push(doc.search_data.overdue_charge_discharge_port)
    }
    if (doc.search_data.overdue_charge_carrier) {
      queryStr += ' and overdue_charge_carrier = ?'
      replacements.push(doc.search_data.overdue_charge_carrier)
    }
    if (doc.search_data.overdue_charge_container_size) {
      queryStr += ' and overdue_charge_container_size = ?'
      replacements.push(doc.search_data.overdue_charge_container_size)
    }
  }
  queryStr += ' order by overdue_charge_cargo_type, overdue_charge_discharge_port, overdue_charge_carrier, overdue_charge_container_size, overdue_charge_min_day'
  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = result.data

  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)

  let discharge_ports = doc.overdue_charge_discharge_port_multiple
  let container_sizes = doc.overdue_charge_container_size_multiple
  let overdue_charge_enabled_date = ''
  if(doc.overdue_charge_enabled_date) {
    overdue_charge_enabled_date = moment(doc.overdue_charge_enabled_date, 'YYYY-MM-DD').local().format('YYYY-MM-DD')
  }
  for (let d of discharge_ports) {
    for(let c of container_sizes) {
      let queryStr = `select * from tbl_zhongtan_overdue_charge_rule where state = '1' and 
        overdue_charge_cargo_type = ? and overdue_charge_discharge_port = ? and overdue_charge_carrier = ? and overdue_charge_container_size = ? 
        and ((overdue_charge_min_day <= ? and overdue_charge_max_day >= ?) and (overdue_charge_min_day <= ? and overdue_charge_max_day >= ?)) and overdue_charge_enabled_date = ? `
      let replacements = [
        doc.overdue_charge_cargo_type,
        d,
        doc.overdue_charge_carrier,
        c,
        doc.overdue_charge_min_day,
        doc.overdue_charge_min_day,
        doc.overdue_charge_max_day,
        doc.overdue_charge_max_day,
        overdue_charge_enabled_date
      ]
      let rules = await model.simpleSelect(queryStr, replacements)
      if(rules && rules.length > 0) {
        return common.error('equipment_01')
      }
    }
  }
  
  for (let d of discharge_ports) {
    for(let c of container_sizes) {
      await tb_overdue_charge_rule.create({
        overdue_charge_cargo_type: doc.overdue_charge_cargo_type,
        overdue_charge_discharge_port: d,
        overdue_charge_carrier: doc.overdue_charge_carrier,
        overdue_charge_container_size: c,
        overdue_charge_min_day: doc.overdue_charge_min_day,
        overdue_charge_max_day: doc.overdue_charge_max_day,
        overdue_charge_amount: doc.overdue_charge_amount,
        overdue_charge_currency: doc.overdue_charge_currency,
        overdue_charge_enabled_date: overdue_charge_enabled_date
      })
    }
  }
  return common.success()
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)

  let obj = await tb_overdue_charge_rule.findOne({
    where: {
      overdue_charge_rule_id: doc.old.overdue_charge_rule_id,
      state: GLBConfig.ENABLE
    }
  })

  if(obj) {
    let overdue_charge_enabled_date = ''
    if(doc.new.overdue_charge_enabled_date) {
      overdue_charge_enabled_date = moment(doc.new.overdue_charge_enabled_date, 'YYYY-MM-DD').local().format('YYYY-MM-DD')
    }
    let queryStr = `select * from tbl_zhongtan_overdue_charge_rule where overdue_charge_rule_id != ? and state = '1' and 
        overdue_charge_cargo_type = ? and overdue_charge_discharge_port = ? and overdue_charge_carrier = ? and overdue_charge_container_size = ? and ((overdue_charge_min_day <= ? and overdue_charge_max_day >= ?) or (overdue_charge_min_day <= ? and overdue_charge_max_day >= ?)) and overdue_charge_enabled_date = ?`
    let replacements = [
      doc.old.overdue_charge_rule_id,
      doc.new.overdue_charge_cargo_type,
      doc.new.overdue_charge_discharge_port,
      doc.new.overdue_charge_carrier,
      doc.new.overdue_charge_container_size,
      doc.new.overdue_charge_min_day,
      doc.new.overdue_charge_min_day,
      doc.new.overdue_charge_max_day,
      doc.new.overdue_charge_max_day,
      overdue_charge_enabled_date
    ]
    let rules = await model.simpleSelect(queryStr, replacements)
    if(rules && rules.length > 0) {
      return common.error('equipment_01')
    }

    obj.overdue_charge_cargo_type = doc.new.overdue_charge_cargo_type
    obj.overdue_charge_discharge_port = doc.new.overdue_charge_discharge_port
    obj.overdue_charge_carrier = doc.new.overdue_charge_carrier
    obj.overdue_charge_container_size = doc.new.overdue_charge_container_size
    obj.overdue_charge_min_day = doc.new.overdue_charge_min_day
    obj.overdue_charge_max_day = doc.new.overdue_charge_max_day
    obj.overdue_charge_amount = doc.new.overdue_charge_amount
    obj.overdue_charge_currency = doc.new.overdue_charge_currency
    obj.overdue_charge_enabled_date = overdue_charge_enabled_date
    await obj.save()
    return common.success()
  } else {
    return common.error('equipment_02')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let obj = await tb_overdue_charge_rule.findOne({
    where: {
      overdue_charge_rule_id: doc.overdue_charge_rule_id,
      state: GLBConfig.ENABLE
    }
  })
  if (obj) {
    obj.state = GLBConfig.DISABLE
    await obj.save()
    return common.success()
  } else {
    return common.error('equipment_02')
  }
}
