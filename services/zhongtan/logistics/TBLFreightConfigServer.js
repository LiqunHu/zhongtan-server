const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const moment = require('moment')
const model = require('../../../app/model')
const Op = model.Op

const tb_freight_config = model.zhongtan_freight_config
const tb_container_size = model.zhongtan_container_size
const tb_freight_place = model.zhongtan_freight_place

exports.initAct = async () => {
  let returnData = {}
  let queryStr = `SELECT container_size_code, GROUP_CONCAT(container_size_name) container_size_name FROM tbl_zhongtan_container_size WHERE state = 1 GROUP BY container_size_code ORDER BY container_size_code`
  let replacements = []
  returnData['CONTAINER_SIZE'] = await model.simpleSelect(queryStr, replacements)
  returnData['FREIGHT_PLACE'] = await tb_freight_place.findAll({
    attributes: ['freight_place_code', 'freight_place_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['freight_place_code', 'ASC']]
  })
  returnData['BUSINESS_TYPE'] = GLBConfig.BUSINESS_TYPE
  queryStr = `SELECT vendor_id, vendor_code, vendor_name FROM tbl_common_vendor WHERE state = ? ORDER BY vendor_code`
  replacements = [GLBConfig.ENABLE]
  returnData['COMMON_VENDOR'] = await model.simpleSelect(queryStr, replacements)
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select fc.*, cv.vendor_code, cv.vendor_name from tbl_zhongtan_freight_config fc left join tbl_common_vendor cv on fc.freight_config_vendor = cv.vendor_id where fc.state = '1'`
  let replacements = []
  if(doc.search_data) {
    if (doc.search_data.freight_config_vendor) {
      queryStr += ' and fc.freight_config_vendor = ?'
      replacements.push(doc.search_data.freight_config_vendor)
    }
  }
  queryStr += ' order by fc.freight_config_enabled_date desc, cv.vendor_code'
  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = result.data

  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)
  let freight_config_enabled_date = ''
  if(doc.freight_config_enabled_date) {
    freight_config_enabled_date = moment(doc.freight_config_enabled_date, 'YYYY-MM-DD').local().format('YYYY-MM-DD')
  }
  for(let c of doc.freight_config_size_type) {
    if(doc.freight_config_business_type === 'I') {
      for(let d of doc.freight_config_pod) {
        await tb_freight_config.create({
          freight_config_vendor: doc.freight_config_vendor,
          freight_config_business_type: doc.freight_config_business_type,
          freight_config_cargo_type: doc.freight_config_cargo_type,
          freight_config_pol: doc.freight_config_pol[0],
          freight_config_pod: d,
          freight_config_carrier: doc.freight_config_carrier,
          freight_config_size_type: c,
          freight_config_amount: doc.freight_config_amount,
          freight_config_advance: doc.freight_config_advance,
          freight_config_advance_amount: doc.freight_config_advance_amount,
          freight_config_enabled_date: freight_config_enabled_date
        })
      }
    }else {
      for(let l of doc.freight_config_pol) {
        await tb_freight_config.create({
          freight_config_vendor: doc.freight_config_vendor,
          freight_config_business_type: doc.freight_config_business_type,
          freight_config_cargo_type: doc.freight_config_cargo_type,
          freight_config_pol: l,
          freight_config_pod: doc.freight_config_pod[0],
          freight_config_carrier: doc.freight_config_carrier,
          freight_config_size_type: c,
          freight_config_amount: doc.freight_config_amount,
          freight_config_advance: doc.freight_config_advance,
          freight_config_advance_amount: doc.freight_config_advance_amount,
          freight_config_enabled_date: freight_config_enabled_date
        })
      }
    }
  }
  return common.success()
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let obj = await tb_freight_config.findOne({
    where: {
      freight_config_id: doc.old.freight_config_id,
      state: GLBConfig.ENABLE
    }
  })
  if(obj) {
    let freight_config_enabled_date = ''
    if(doc.new.freight_config_enabled_date) {
      freight_config_enabled_date = moment(doc.new.freight_config_enabled_date, 'YYYY-MM-DD').local().format('YYYY-MM-DD')
    }
    obj.freight_config_cargo_type = doc.new.freight_config_cargo_type
    if(doc.new.freight_config_business_type === 'I') {
      obj.freight_config_pod = doc.new.freight_config_pod_update
    } else {
      obj.freight_config_pol = doc.new.freight_config_pol_update
    }
    obj.freight_config_carrier = doc.new.freight_config_carrier
    obj.freight_config_size_type = doc.new.freight_config_size_type_update
    obj.freight_config_amount = doc.new.freight_config_amount
    obj.freight_config_advance = doc.new.freight_config_advance
    obj.freight_config_advance_amount = doc.new.freight_config_advance_amount
    obj.overdue_charge_enabled_date = freight_config_enabled_date
    await obj.save()
    return common.success()
  } else {
    return common.error('equipment_02')
  }
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let obj = await tb_freight_config.findOne({
    where: {
      freight_config_id: doc.freight_config_id,
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
          if(moment(enabled_date, 'DD/MM/YYYY').isAfter(moment(d))) {
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
