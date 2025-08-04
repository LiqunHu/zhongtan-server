const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const moment = require('moment')
const model = require('../../../app/model')
const Op = model.Op

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
  returnData['BUSINESS_TYPE'] = GLBConfig.BUSINESS_TYPE
  returnData['EXPORT_CARGO_TYPE'] = GLBConfig.MNR_CARGO_TYPE
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_overdue_charge_rule where state = '1'`
  let replacements = []

  if(doc.search_data) {
    if (doc.search_data.overdue_charge_business_type) {
      queryStr += ' and overdue_charge_business_type = ?'
      replacements.push(doc.search_data.overdue_charge_business_type)
    }
    if (doc.search_data.enabled_date) {
      queryStr += ' and overdue_charge_enabled_date = ?'
      replacements.push(doc.search_data.enabled_date)
    }
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
  let business_type = doc.overdue_charge_business_type
  let discharge_ports = doc.overdue_charge_discharge_port_multiple
  let container_sizes = doc.overdue_charge_container_size_multiple
  let overdue_charge_enabled_date = ''
  if(doc.overdue_charge_enabled_date) {
    overdue_charge_enabled_date = moment(doc.overdue_charge_enabled_date, 'YYYY-MM-DD').local().format('YYYY-MM-DD')
  }
  if(business_type === 'I') {
    // 进口滞期费用规则
    for (let d of discharge_ports) {
      for(let c of container_sizes) {
        let queryStr = `select * from tbl_zhongtan_overdue_charge_rule where state = '1' and overdue_charge_business_type = 'I' and
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
          overdue_charge_business_type: 'I',
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
  } else {
    // 出口滞期费用规则
    for(let c of container_sizes) {
      let queryStr = `select * from tbl_zhongtan_overdue_charge_rule where state = '1' and overdue_charge_business_type = 'E' and
        overdue_charge_cargo_type = ? and overdue_charge_carrier = ? and overdue_charge_container_size = ? 
        and ((overdue_charge_min_day <= ? and overdue_charge_max_day >= ?) and (overdue_charge_min_day <= ? and overdue_charge_max_day >= ?)) and overdue_charge_enabled_date = ? `
      let replacements = [
        doc.overdue_charge_cargo_type,
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
    for(let c of container_sizes) {
      await tb_overdue_charge_rule.create({
        overdue_charge_business_type: 'E',
        overdue_charge_cargo_type: doc.overdue_charge_cargo_type,
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
    if(obj.overdue_charge_business_type === 'I') {
      let queryStr = `select * from tbl_zhongtan_overdue_charge_rule where overdue_charge_rule_id != ? and state = '1' and overdue_charge_business_type = 'I' and 
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
      obj.overdue_charge_discharge_port = doc.new.overdue_charge_discharge_port
    } else {
      let queryStr = `select * from tbl_zhongtan_overdue_charge_rule where overdue_charge_rule_id != ? and state = '1' and overdue_charge_business_type = 'E' and 
        overdue_charge_cargo_type = ? and overdue_charge_carrier = ? and overdue_charge_container_size = ? and ((overdue_charge_min_day <= ? and overdue_charge_max_day >= ?) or (overdue_charge_min_day <= ? and overdue_charge_max_day >= ?)) and overdue_charge_enabled_date = ?`
      let replacements = [
        doc.old.overdue_charge_rule_id,
        doc.new.overdue_charge_cargo_type,
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
    }
    obj.overdue_charge_cargo_type = doc.new.overdue_charge_cargo_type
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


exports.recalculateAct = async req => {
  try{
    let queryStr = `SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination, c.invoice_masterbi_carrier, d.user_name AS invoice_masterbi_deposit_party
    from tbl_zhongtan_invoice_containers a LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' 
    LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = '1' AND c.invoice_vessel_id = a.invoice_vessel_id 
    LEFT JOIN tbl_common_user d ON c.invoice_masterbi_customer_id = d.user_id
    WHERE a.state = '1' AND a.invoice_containers_edi_discharge_date IS NOT NULL 
    AND a.invoice_containers_actually_return_date IS NOT NULL 
    AND a.invoice_containers_empty_return_invoice_date IS NULL 
    AND a.invoice_containers_empty_return_receipt_date IS NULL AND a.invoice_containers_actually_return_overdue_days > 0  `
    let replacements = []
    let rows = await model.simpleSelect(queryStr, replacements)
    for(let d of rows) {
      let free_days = 0
      if(d.invoice_containers_empty_return_overdue_free_days) {
        free_days = d.invoice_containers_empty_return_overdue_free_days
      } else if(d.invoice_masterbi_cargo_type && d.invoice_masterbi_destination && d.invoice_masterbi_carrier){
        free_days = await this.queryContainerFreeDays(d.invoice_masterbi_cargo_type, d.invoice_masterbi_destination.substring(0, 2), d.invoice_masterbi_carrier, d.invoice_containers_size, d.invoice_vessel_ata)
      }
      if(free_days > 0) {
        let discharge_date = d.invoice_vessel_ata
        if(d.invoice_containers_edi_discharge_date) {
          discharge_date = d.invoice_containers_edi_discharge_date
        }
        let return_date = moment().format('DD/MM/YYYY')
        if(d.invoice_containers_actually_return_date) {
          return_date = d.invoice_containers_actually_return_date
        }
        if(d.invoice_masterbi_cargo_type && d.invoice_masterbi_destination && d.invoice_masterbi_carrier) {
          let cal_result = await this.demurrageCalculation(free_days, discharge_date, return_date, d.invoice_masterbi_cargo_type, d.invoice_masterbi_destination.substring(0, 2), d.invoice_masterbi_carrier, d.invoice_containers_size, d.invoice_vessel_ata)
          if(cal_result.diff_days !== -1) {
            let overdue_con = await tb_container.findOne({'where': {'invoice_containers_id': d.invoice_containers_id}})
            if(overdue_con) {
              // 已还箱未开票的判断重新计算后超期费是否一致,不一致则更新
              if(d.invoice_containers_edi_discharge_date 
                  && d.invoice_containers_actually_return_date 
                  && !d.invoice_containers_empty_return_invoice_date
                  && !d.invoice_containers_empty_return_receipt_date) {
                    if(String(cal_result.overdue_amount) !== String(overdue_con.invoice_containers_actually_return_overdue_amount)) {
                      overdue_con.invoice_containers_recalculate_before = overdue_con.invoice_containers_actually_return_overdue_amount
                      overdue_con.invoice_containers_actually_return_overdue_amount = cal_result.overdue_amount
                      overdue_con.invoice_containers_empty_return_overdue_amount = cal_result.overdue_amount
                      await overdue_con.save()
                    }
              }
            }
          } 
        }
      }
    }
  } finally {
    // continue regardless of error
  }
}

/**
 * 查询箱超期费规则
 * @param {*} cargo_type 
 * @param {*} discharge_port 
 * @param {*} carrier 
 * @param {*} container_type 
 * @param {*} enabled_date 
 */
exports.queryDemurrageRules = async (cargo_type, discharge_port, carrier, container_type, enabled_date, business_type = 'I') => {
  // if(!business_type) {
  //   business_type = 'I'
  // }
  let con_size_type = await tb_container_size.findOne({
    attributes: ['container_size_code', 'container_size_name'],
    where: {
      state : GLBConfig.ENABLE,
      [Op.or]: [{ container_size_code: container_type }, { container_size_name: container_type }]
    }
  })
  if(con_size_type) {
    let type = con_size_type.container_size_code
    let queryStr = ''
    let replacements = []
    if(business_type === 'I') {
      queryStr = `SELECT * FROM tbl_zhongtan_overdue_charge_rule WHERE state = ? AND overdue_charge_cargo_type = ? 
                      AND overdue_charge_discharge_port = ? AND overdue_charge_carrier = ? AND overdue_charge_container_size = ? AND overdue_charge_business_type = ? ORDER BY overdue_charge_enabled_date DESC, overdue_charge_min_day DESC `
      replacements = [GLBConfig.ENABLE, cargo_type, discharge_port, carrier, type, business_type]
    } else {
      queryStr = `SELECT * FROM tbl_zhongtan_overdue_charge_rule WHERE state = ? AND overdue_charge_cargo_type = ? 
      AND overdue_charge_carrier = ? AND overdue_charge_container_size = ? AND overdue_charge_business_type = ? ORDER BY overdue_charge_enabled_date DESC, overdue_charge_min_day DESC `
      replacements = [GLBConfig.ENABLE, cargo_type, carrier, type, business_type]
    }
    let allChargeRules = await model.simpleSelect(queryStr, replacements)
    if(allChargeRules) {
      let enabledDates = []
      for(let a of allChargeRules) {
        if(a.overdue_charge_enabled_date && enabledDates.indexOf(a.overdue_charge_enabled_date) < 0) {
          enabledDates.push(a.overdue_charge_enabled_date)
        }
      }
      let baseEnabledDate = ''
      if(enabled_date && enabledDates.length > 0) {
        for(let d of enabledDates) {
          if(moment(enabled_date, 'DD/MM/YYYY').isSameOrAfter(moment(d))) {
            baseEnabledDate = d
            break
          }
        }
      }
      let retChargeRules = []
      if(baseEnabledDate) {
        for(let a of allChargeRules) {
          if(a.overdue_charge_enabled_date && moment(baseEnabledDate).isSame(moment(a.overdue_charge_enabled_date))) {
            retChargeRules.push(a)
          }
        }
      } else {
        for(let a of allChargeRules) {
          if(!a.overdue_charge_enabled_date) {
            retChargeRules.push(a)
          }
        }
      }
      return retChargeRules
    }
  }
  return []
}
/**
 * 查询免用箱期
 * @param {*} cargo_type 
 * @param {*} discharge_port 
 * @param {*} carrier 
 * @param {*} container_type 
 * @param {*} enabled_date 
 */
exports.queryContainerFreeDays = async (cargo_type, discharge_port, carrier, container_type, enabled_date, business_type) => {
  let chargeRules = await this.queryDemurrageRules(cargo_type, discharge_port, carrier, container_type, enabled_date, business_type)
  if(chargeRules && chargeRules.length  > 0) {
    return chargeRules[chargeRules.length - 1].overdue_charge_max_day
  }
  return 0
}

/**
 * 计算箱超期费
 * @param {*} free_days 
 * @param {*} discharge_date 
 * @param {*} return_date 
 * @param {*} cargo_type 
 * @param {*} discharge_port 
 * @param {*} carrier 
 * @param {*} container_type 
 * @param {*} enabled_date 
 */
exports.demurrageCalculation = async (free_days, discharge_date, return_date, cargo_type, discharge_port, carrier, container_type, enabled_date, business_type = 'I') => {
  if(free_days) {
    free_days = parseInt(free_days)
  }
  // if(!business_type) {
  //   business_type = 'I'
  // }
  let chargeRules = await this.queryDemurrageRules(cargo_type, discharge_port, carrier, container_type, enabled_date, business_type)
  if(chargeRules && chargeRules.length  > 0) {
    let diff = moment(return_date, 'DD/MM/YYYY').diff(moment(discharge_date, 'DD/MM/YYYY'), 'days') + 1 // Calendar day Cover First Day
    let overdueAmount = 0
    let freeMaxDay = 0
    if(free_days == 0) {
      for(let c of chargeRules) {
        let charge = parseInt(c.overdue_charge_amount)
        if(charge === 0) {
          freeMaxDay = parseInt(c.overdue_charge_max_day)
        }
      }
    } else {
      freeMaxDay = free_days
    }
    if(diff <= freeMaxDay) {
      return {
        diff_days: diff,
        overdue_days: 0,
        overdue_amount: 0
      }
    } else {
      for(let c of chargeRules) {
        let charge = parseInt(c.overdue_charge_amount)
        let min = parseInt(c.overdue_charge_min_day)
        if(c.overdue_charge_max_day) {
          let max = parseInt(c.overdue_charge_max_day)
          if(freeMaxDay > max) {
            continue
          } else {
            if(freeMaxDay >= min && freeMaxDay <= max) {
              min = freeMaxDay + 1
            }
            if(diff > max) {
              overdueAmount = overdueAmount + charge * (max - min + 1)
            } else if((diff >= min)){
              overdueAmount = overdueAmount + charge * (diff - min + 1)
            }
          }
        } else {
          if(freeMaxDay >= min) {
            min = freeMaxDay + 1
          } 
          if(diff >= min) {
            overdueAmount = overdueAmount + charge * (diff - min + 1)
          }
        }
      }
      return {
        diff_days: diff,
        overdue_days: diff - freeMaxDay,
        overdue_amount: overdueAmount
      }
    }
  }
  return {
    diff_days: -1,
    overdue_days: 0,
    overdue_amount: 0
  }
}