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
        let exist = await tb_freight_config.findOne({
          where: {
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
            freight_config_enabled_date: freight_config_enabled_date,
            freight_config_amount_receivable: doc.freight_config_amount_receivable,
          })
        }
      }
    }else {
      for(let l of doc.freight_config_pol) {
        let exist = await tb_freight_config.findOne({
          where: {
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
            freight_config_enabled_date: freight_config_enabled_date,
            freight_config_amount_receivable: doc.freight_config_amount_receivable,
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
    obj.freight_config_amount_receivable = doc.new.freight_config_amount_receivable
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