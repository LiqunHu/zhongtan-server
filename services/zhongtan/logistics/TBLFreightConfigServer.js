const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const moment = require('moment')
const model = require('../../../app/model')

const tb_freight_config = model.zhongtan_freight_config
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
  returnData['FREIGHT_TYPE'] = GLBConfig.LOGISTICS_FREIGHT_TYPE
  queryStr = `SELECT vendor_id, vendor_code, vendor_name FROM tbl_common_vendor WHERE state = ? ORDER BY vendor_name`
  replacements = [GLBConfig.ENABLE]
  returnData['COMMON_VENDOR'] = await model.simpleSelect(queryStr, replacements)
  queryStr = `SELECT user_id, user_name FROM tbl_common_user WHERE state = '1' AND user_type = ? ORDER BY user_name`
  replacements = [GLBConfig.TYPE_CUSTOMER]
  returnData['COMMON_CUSTOMER'] = await model.simpleSelect(queryStr, replacements)
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `select fc.*, CASE fc.freight_config_Type
                  WHEN 'R' THEN
                    (SELECT user_name FROM tbl_common_user WHERE user_id = fc.freight_config_vendor)
                  ELSE
                    (SELECT vendor_name FROM tbl_common_vendor WHERE vendor_id = fc.freight_config_vendor)
                  END vendor_user
                  from tbl_zhongtan_freight_config fc WHERE state = 1`
  let replacements = []
  if(doc.search_data) {
    if (doc.search_data.freight_config_Type) {
      queryStr += ' and fc.freight_config_Type = ?'
      replacements.push(doc.search_data.freight_config_Type)
      if (doc.search_data.freight_config_Type === 'P' && doc.search_data.freight_config_vendor) {
        queryStr += ' and fc.freight_config_vendor = ?'
        replacements.push(doc.search_data.freight_config_vendor)
      }
      if (doc.search_data.freight_config_Type === 'R' && doc.search_data.freight_config_customer) {
        queryStr += ' and fc.freight_config_vendor = ?'
        replacements.push(doc.search_data.freight_config_customer)
      }
    } else {
      if (doc.search_data.freight_config_vendor && doc.search_data.freight_config_customer){
        queryStr += ' and (fc.freight_config_vendor = ? or fc.freight_config_vendor = ?)'
        replacements.push(doc.search_data.freight_config_vendor)
        replacements.push(doc.search_data.freight_config_customer)
      } else {
        if (doc.search_data.freight_config_vendor) {
          queryStr += ' and fc.freight_config_vendor = ?'
          replacements.push(doc.search_data.freight_config_vendor)
        }
        if (doc.search_data.freight_config_customer) {
          queryStr += ' and fc.freight_config_vendor = ?'
          replacements.push(doc.search_data.freight_config_customer)
        }
      }
    }
    if (doc.search_data.freight_config_business_type) {
      queryStr += ' and fc.freight_config_business_type = ?'
      replacements.push(doc.search_data.freight_config_business_type)
    }
    if (doc.search_data.freight_config_cargo_type) {
      queryStr += ' and fc.freight_config_cargo_type = ?'
      replacements.push(doc.search_data.freight_config_cargo_type)
    }
    if (doc.search_data.freight_config_pol) {
      queryStr += ' and fc.freight_config_pol = ?'
      replacements.push(doc.search_data.freight_config_pol)
    }
    if (doc.search_data.freight_config_pod) {
      queryStr += ' and fc.freight_config_pod = ?'
      replacements.push(doc.search_data.freight_config_pod)
    }
    if (doc.search_data.freight_config_carrier) {
      queryStr += ' and fc.freight_config_carrier = ?'
      replacements.push(doc.search_data.freight_config_carrier)
    }
    if (doc.search_data.freight_config_size_type) {
      queryStr += ' and fc.freight_config_size_type = ?'
      replacements.push(doc.search_data.freight_config_size_type)
    }
    if (doc.search_data.freight_config_enabled_date) {
      queryStr += ' and fc.freight_config_enabled_date = ?'
      replacements.push(doc.search_data.freight_config_enabled_date)
    }
  }
  queryStr += ' order by fc.freight_config_enabled_date desc'
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
        let exist = await tb_freight_config.findOne({
          where: {
            freight_config_Type: doc.freight_config_Type,
            freight_config_vendor: doc.freight_config_vendor,
            freight_config_business_type: doc.freight_config_business_type,
            freight_config_cargo_type: doc.freight_config_cargo_type,
            freight_config_pol: doc.freight_config_pol[0],
            freight_config_pod: d,
            freight_config_carrier: doc.freight_config_carrier,
            freight_config_size_type: c,
            freight_config_enabled_date: freight_config_enabled_date
          }
        })
        if(!exist) {
          await tb_freight_config.create({
            freight_config_Type: doc.freight_config_Type,
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
      }
    }else {
      for(let l of doc.freight_config_pol) {
        let exist = await tb_freight_config.findOne({
          where: {
            freight_config_Type: doc.freight_config_Type,
            freight_config_vendor: doc.freight_config_vendor,
            freight_config_business_type: doc.freight_config_business_type,
            freight_config_cargo_type: doc.freight_config_cargo_type,
            freight_config_pol: l,
            freight_config_pod: doc.freight_config_pod[0],
            freight_config_carrier: doc.freight_config_carrier,
            freight_config_size_type: c,
            freight_config_enabled_date: freight_config_enabled_date,
            
          }
        })
        if(!exist) {
          await tb_freight_config.create({
            freight_config_Type: doc.freight_config_Type,
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
    obj.freight_config_enabled_date = freight_config_enabled_date
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
 * 
 * @param {*} vendor 供应商
 * @param {*} business_type 进出口
 * @param {*} cargo_type 货物类型
 * @param {*} freight_pol 起运点
 * @param {*} feight_pod 目的地
 * @param {*} carrier 代理
 * @param {*} container 箱型尺寸
 * @param {*} transport_date 运输日期
 */
exports.countShipmentFreight = async (vendor, business_type, cargo_type, freight_pol, feight_pod, carrier, container, transport_date, freight_Type = 'P') => {
  let queryStr = `select * from tbl_zhongtan_freight_config where state = ? AND freight_config_Type = ? AND freight_config_vendor = ? AND freight_config_business_type = ? 
      AND freight_config_cargo_type = ? AND freight_config_pol = ? AND freight_config_pod = ? AND freight_config_carrier = ? 
      AND freight_config_size_type = ? AND freight_config_enabled_date <= ? order by freight_config_enabled_date desc, freight_config_id desc limit 1`
  let replacements = [GLBConfig.ENABLE, freight_Type, vendor, business_type, cargo_type, freight_pol, feight_pod, carrier, container, transport_date]
  let result = await model.simpleSelect(queryStr, replacements)
  if(result && result.length === 1) {
    return result[0]
  } 
  return null
}