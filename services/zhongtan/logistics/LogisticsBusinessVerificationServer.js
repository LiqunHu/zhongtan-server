const moment = require('moment')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')

const tb_verificatione = model.zhongtan_logistics_verification
const tb_verification_freight = model.zhongtan_logistics_verification_freight
const tb_shipment_list = model.zhongtan_logistics_shipment_list

exports.initAct = async () => {
  let returnData = {
    FREIGHT_STATE: GLBConfig.LOGISTICS_FREIGHT_STATE_BUSINESS
  }
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `select v.*, CONCAT(cv.vendor_code, '/', cv.vendor_name) AS vendor, c.user_name from tbl_zhongtan_logistics_verification v 
                LEFT JOIN tbl_common_vendor cv ON v.logistics_verification_vendor = cv.vendor_id 
                LEFT JOIN tbl_common_user c ON v.logistics_verification_create_user = c.user_id
                WHERE v.state = ?`
  let replacements = [GLBConfig.ENABLE]
  if (doc.verification_state) {
    queryStr += ' AND v.logistics_verification_state = ?'
    replacements.push(doc.verification_state)
  }
  
  if (doc.start_date && doc.end_date) {
    queryStr += ' and v.created_at >= ? and v.created_at < ? '
    replacements.push(doc.start_date)
    replacements.push(moment(doc.end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
  }

  if (doc.bl) {
    queryStr += ` AND EXISTS (SELECT 1 FROM tbl_zhongtan_logistics_verification_freight f 
                  LEFT JOIN tbl_zhongtan_logistics_shipment_list s ON f.shipment_list_id = s.shipment_list_id AND s.state = 1 
                  WHERE f.state = 1 AND f.logistics_verification_id = v.logistics_verification_id AND s.shipment_list_bill_no LIKE ?) `
    replacements.push('%' + doc.bl + '%')
  }
  
  queryStr = queryStr + " order by v.logistics_verification_id desc"
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  let rows = []
  if(result.data) {
    for(let d of result.data) {
      let dd = JSON.parse(JSON.stringify(d))
      dd.created_at = moment(d.created_at).format('YYYY-MM-DD HH:mm:ss')
      rows.push(dd)
    }
  }
  returnData.rows = rows
  return common.success(returnData)
}

exports.approveAct = async req => {
  let doc = common.docValidate(req),
    user = req.user, curDate = new Date()
  let ver = await tb_verificatione.findOne({
    where: {
      logistics_verification_id: doc.logistics_verification_id,
      state: GLBConfig.ENABLE
    }
  })
  if(ver) {
    ver.logistics_verification_state = 'PM'
    ver.logistics_verification_business_user = user.user_id
    ver.logistics_verification_business_time = curDate
    await ver.save()

    let vfs = await tb_verification_freight.findAll({
      where: {
        logistics_verification_id: ver.logistics_verification_id,
        state: GLBConfig.ENABLE
      }
    })
    if(vfs) {
      for(let v of vfs) {
        v.logistics_freight_state = 'PM'
        await v.save()
      }
    }
  }
  return common.success()
}

exports.declineAct = async req => {
  let doc = common.docValidate(req),
    user = req.user, curDate = new Date()
  let ver = await tb_verificatione.findOne({
    where: {
      logistics_verification_id: doc.logistics_verification_id,
      state: GLBConfig.ENABLE
    }
  })
  if(ver) {
    ver.logistics_verification_state = 'BD'
    ver.logistics_verification_business_user = user.user_id
    ver.logistics_verification_business_time = curDate
    await ver.save()

    let vfs = await tb_verification_freight.findAll({
      where: {
        logistics_verification_id: ver.logistics_verification_id,
        state: GLBConfig.ENABLE
      }
    })
    if(vfs) {
      for(let v of vfs) {
        v.logistics_freight_state = 'BD'
        await v.save()
        let sp = await tb_shipment_list.findOne({
          where: {
            shipment_list_id: v.shipment_list_id,
            state: GLBConfig.ENABLE
          }
        })
        if(sp) {
          if(ver.logistics_verification_api_name === 'PAYMENT ADVANCE') {
            sp.shipment_list_payment_status = '1'
          } else if(ver.logistics_verification_api_name === 'PAYMENT BALANCE') {
            sp.shipment_list_payment_status = '3'
          }
          await sp.save()
        }
      }
    }
  }
  return common.success()
}

exports.verificationDetailAct = async req => {
  let doc = common.docValidate(req)
  let ver = await tb_verificatione.findOne({
    where: {
      logistics_verification_id: doc.logistics_verification_id,
      state: GLBConfig.ENABLE
    }
  })
  let returnData = []
  if(ver) {
    // 托单审核
    if(ver.logistics_verification_api_name === 'PAYMENT ADVANCE' || ver.logistics_verification_api_name === 'PAYMENT BALANCE') {
      let queryStr = `SELECT sl.*, CONCAT(cv.vendor_code, '/', cv.vendor_name) AS vendor FROM tbl_zhongtan_logistics_verification_freight vf 
                      LEFT JOIN tbl_zhongtan_logistics_shipment_list sl ON vf.shipment_list_id = sl.shipment_list_id 
                      LEFT JOIN tbl_common_vendor cv ON sl.shipment_list_vendor = cv.vendor_id WHERE vf.state = 1 AND vf.logistics_verification_id = ?`
      let replacements = [doc.logistics_verification_id]
      returnData = await model.simpleSelect(queryStr, replacements)
    }
  }
  return common.success(returnData)
}