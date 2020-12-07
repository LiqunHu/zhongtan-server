const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const opSrv = require('../../common/system/OperationPasswordServer')

const tb_vessel = model.zhongtan_export_vessel
const tb_bl = model.zhongtan_export_masterbl
const tb_shipment_fee = model.zhongtan_export_shipment_fee
const tb_fee_data = model.zhongtan_export_fee_data

exports.initAct = async () => {
  let returnData = {
    FEE_TYPE: GLBConfig.EXPORT_FEE_TYPE,
    FEE_STATUS: GLBConfig.EXPORT_FEE_STATUS,
    FEE_CURRENCY: GLBConfig.RECEIPT_CURRENCY
  }
  let queryStr = `SELECT user_id, TRIM(user_name) AS user_name FROM tbl_common_user WHERE state = '1' AND user_type = ? ORDER BY user_name`
  let replacements = [GLBConfig.TYPE_CUSTOMER]
  let customers = await model.simpleSelect(queryStr, replacements)
  returnData.CUSTOMER = customers

  queryStr = `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_receivable = ? AND fee_data_receivable_fixed = ? GROUP BY fee_data_code ORDER BY fee_data_id`
  replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, GLBConfig.ENABLE]
  let fixed_receivable_fee = await model.simpleSelect(queryStr, replacements)
  returnData.FIXED_RECEIVABLE_FEE = fixed_receivable_fee
  
  queryStr = `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_receivable = ? AND fee_data_receivable_fixed = ? GROUP BY fee_data_code ORDER BY fee_data_id`
  replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, GLBConfig.DISABLE]
  let other_receivable_fee = await model.simpleSelect(queryStr, replacements)
  returnData.OTHER_RECEIVABLE_FEE = other_receivable_fee
  
  queryStr = `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_payable = ? AND fee_data_payable_fixed = ? GROUP BY fee_data_code ORDER BY fee_data_id`
  replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, GLBConfig.ENABLE]
  let fixed_payable_fee = await model.simpleSelect(queryStr, replacements)
  returnData.FIXED_PAYABLE_FEE = fixed_payable_fee

  queryStr = `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_payable = ? AND fee_data_payable_fixed = ? GROUP BY fee_data_code ORDER BY fee_data_id`
  replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, GLBConfig.DISABLE]
  let other_payable_fee = await model.simpleSelect(queryStr, replacements)
  returnData.OTHER_PAYABLE_FEE = other_payable_fee

  return common.success(returnData)
}

exports.searchBookingDataAct = async req => {
  let doc = common.docValidate(req)
  let queryStr =  `SELECT * FROM tbl_zhongtan_export_masterbl WHERE state = ? `
  let replacements = [GLBConfig.ENABLE]
  if(doc.bookingNo) {
    queryStr = queryStr + ` AND export_masterbl_bl IN (?)`
    let p = /[^0-9a-zA-Z,]/gi
    let bookingNos = doc.bookingNo.replace(p, '').split(',')
    replacements.push(bookingNos)
  }
  queryStr = queryStr + ` ORDER BY export_vessel_id DESC, export_masterbl_bl`
  let bookings =  await model.simpleSelect(queryStr, replacements)
  let returnData = []
  if(bookings && bookings.length > 0) {
    for(let b of bookings) {
      let r = {}
      r.export_masterbl_id = b.export_masterbl_id
      r.booking_no = b.export_masterbl_bl
      let shipmentFees = await tb_shipment_fee.findAll({
        where: {
          export_masterbl_id: b.export_masterbl_id,
          state: GLBConfig.ENABLE
        }
      })
      if(shipmentFees && shipmentFees.length > 0) {
        let bs = true
        for(let s of shipmentFees) {
          if(s.shipment_fee_status === 'SA' || s.shipment_fee_status === 'SU' || s.shipment_fee_status === 'DE' || s.shipment_fee_status === 'UN') {
            bs = false
            break
          }
        }
        r.booking_status = bs
      } else {
        r.booking_status = false
      }
      returnData.push(r)
    }
  }
  return common.success(returnData)
}

exports.getBookingShipmentAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let bl = await tb_bl.findOne({
    where: {
      export_masterbl_id: doc.export_masterbl_id
    }
  })
  if(bl) {
    returnData = JSON.parse(JSON.stringify(bl))
    let ves = await tb_vessel.findOne({
      where: {
        export_vessel_id: bl.export_vessel_id
      }
    })
    if(ves) {
      returnData.vessel = JSON.parse(JSON.stringify(ves))
    } else {
      returnData.vessel = {}
    }
    let queryStr =  `SELECT CONCAT(COUNT(export_container_size_type), ' x ', export_container_size_type) AS size_type 
                  FROM tbl_zhongtan_export_container WHERE export_vessel_id = ? AND export_container_bl = ? AND state = ? GROUP BY export_container_size_type ORDER BY export_container_size_type `
    let replacements = [bl.export_vessel_id, bl.export_masterbl_bl, GLBConfig.ENABLE]
    let sts =  await model.simpleSelect(queryStr, replacements)
    if(sts) {
      let st = []
      for(let s of sts) {
        st.push(s.size_type)
      }
      returnData.size_type = st.join(';')
    }

    queryStr = `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_receivable = ? AND fee_data_receivable_fixed = ? GROUP BY fee_data_code ORDER BY fee_data_id`
    replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, GLBConfig.ENABLE]
    let fixed_receivable_fee = await model.simpleSelect(queryStr, replacements)
    
    queryStr = `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_payable = ? AND fee_data_payable_fixed = ? GROUP BY fee_data_code ORDER BY fee_data_id`
    replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, GLBConfig.ENABLE]
    let fixed_payable_fee = await model.simpleSelect(queryStr, replacements)

    queryStr = `SELECT * FROM tbl_zhongtan_export_shipment_fee WHERE state = ? AND shipment_fee_type = ? ORDER BY shipment_fee_id`
    replacements = [GLBConfig.ENABLE, 'R']
    let shipment_receivable = await model.simpleSelect(queryStr, replacements)
    if(shipment_receivable && shipment_receivable.length > 0) {
      for(let fr of fixed_receivable_fee) {
        let exist = false
        for(let r of shipment_receivable) {
          if(fr.fee_data_code === r.fee_data_code) {
            exist = true
            break
          }
        }
        if(!exist) {
          let fee_data = await calculationShipmentFee(fr.fee_data_code, 'R', bl.export_vessel_id, bl.export_masterbl_bl)
          shipment_receivable.unshift({
            shipment_fee_id: '',
            fee_data_code: fr.fee_data_code,
            shipment_fee_type: 'R',
            shipment_fee_party: '',
            shipment_fee_status: 'NE',
            fee_data_fixed: GLBConfig.ENABLE,
            shipment_fee_fixed_amount: GLBConfig.ENABLE,
            shipment_fee_amount: fee_data.fee_amount,
            shipment_fee_currency: fee_data.fee_currency
          })
        }
      }
    } else {
      shipment_receivable = []
      for(let fr of fixed_receivable_fee) {
        let fee_data = await calculationShipmentFee(fr.fee_data_code, 'R', bl.export_vessel_id, bl.export_masterbl_bl)
        shipment_receivable.unshift({
          shipment_fee_id: '',
          fee_data_code: fr.fee_data_code,
          shipment_fee_type: 'R',
          shipment_fee_party: '',
          shipment_fee_status: 'NE',
          fee_data_fixed: GLBConfig.ENABLE,
          shipment_fee_fixed_amount: GLBConfig.ENABLE,
          shipment_fee_amount: fee_data.fee_amount,
          shipment_fee_currency: fee_data.fee_currency
        })
      }
    }
    returnData.shipment_receivable = shipment_receivable
    queryStr = `SELECT * FROM tbl_zhongtan_export_shipment_fee WHERE state = ? AND shipment_fee_type = ? ORDER BY shipment_fee_id`
    replacements = [GLBConfig.ENABLE, 'P']
    let shipment_payable = await model.simpleSelect(queryStr, replacements)
    if(shipment_payable && shipment_payable.length > 0) {
      for(let fp of fixed_payable_fee) {
        let exist = false
        for(let p of shipment_payable) {
          if(fp.fee_data_code === p.fee_data_code) {
            exist = true
            break
          }
        }
        if(!exist) {
          let fee_data = await calculationShipmentFee(fp.fee_data_code, 'P', bl.export_vessel_id, bl.export_masterbl_bl)
          shipment_payable.unshift({
            shipment_fee_id: '',
            fee_data_code: fp.fee_data_code,
            shipment_fee_type: 'P',
            shipment_fee_party: '',
            shipment_fee_status: 'NE',
            fee_data_fixed: GLBConfig.ENABLE ,
            shipment_fee_fixed_amount: GLBConfig.ENABLE,
            shipment_fee_amount: fee_data.fee_amount,
            shipment_fee_currency: fee_data.fee_currency
          })
        }
      }
    } else {
      shipment_payable = []
      for(let fp of fixed_payable_fee) {
        let fee_data = await calculationShipmentFee(fp.fee_data_code, 'P', bl.export_vessel_id, bl.export_masterbl_bl)
        shipment_payable.unshift({
          shipment_fee_id: '',
          fee_data_code: fp.fee_data_code,
          shipment_fee_type: 'P',
          shipment_fee_party: '',
          shipment_fee_status: 'NE',
          fee_data_fixed: GLBConfig.ENABLE ,
          shipment_fee_fixed_amount: GLBConfig.ENABLE,
          shipment_fee_amount: fee_data.fee_amount,
          shipment_fee_currency: fee_data.fee_currency
        })
      }
    }
    returnData.shipment_payable = shipment_payable
  }
  return common.success(returnData)
}

exports.getShipmentFeeAmountAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let bl = await tb_bl.findOne({
    where: {
      export_masterbl_id: doc.export_masterbl_id
    }
  })
  if(bl) {
    returnData = await calculationShipmentFee(doc.fee_data_code, doc.shipment_fee_type, bl.export_vessel_id, bl.export_masterbl_bl)
  }
  return common.success(returnData)
}

exports.saveShipmentAct = async req => {
  let doc = common.docValidate(req),
  user = req.user

  let export_masterbl_id = doc.export_masterbl_id
  let shipment_receivable = doc.shipment_receivable
  let shipment_payable = doc.shipment_payable
  let saveStatus = ['NE', 'SA', 'DE', 'UN']
  let exist_ids = []
  // remove
  if(shipment_receivable && shipment_receivable.length > 0) {
    for(let r of shipment_receivable) {
      if(r.shipment_fee_id) {
        exist_ids.push(r.shipment_fee_id)
      }
    }
  }
  if(shipment_payable && shipment_payable.length > 0) {
    for(let r of shipment_payable) {
      if(r.shipment_fee_id) {
        exist_ids.push(r.shipment_fee_id)
      }
    }
  }
  if(exist_ids && exist_ids.length > 0) {
    let queryStr = `SELECT shipment_fee_id FROM tbl_zhongtan_export_shipment_fee WHERE state = ? AND shipment_fee_id NOT IN (?)`
    let replacements = [GLBConfig.ENABLE, exist_ids]
    let rms = await model.simpleSelect(queryStr, replacements)
    if(rms && rms.length > 0) {
      for(let r of rms) {
        let rm = await tb_shipment_fee.findOne({
          where: {
            shipment_fee_id: r.shipment_fee_id,
            state: GLBConfig.ENABLE
          }
        })
        if(rm) {
          rm.state = GLBConfig.DISABLE
          await rm.save()
        }
      }
    }
  }

  if(shipment_receivable && shipment_receivable.length > 0) {
    for(let r of shipment_receivable) {
      if(r.fee_data_code && common.isNumber(r.shipment_fee_amount) && parseInt(r.shipment_fee_amount) !== 0){
        let sm = ''
        if(r.shipment_fee_id) {
          sm = await tb_shipment_fee.findOne({
            where: {
              shipment_fee_id: r.shipment_fee_id,
              state: GLBConfig.ENABLE
            }
          })
        }
        if(sm) {
          if(sm.shipment_fee_type === 'R' && saveStatus.indexOf(sm.shipment_fee_status) >= 0) {
            sm.fee_data_code = r.fee_data_code
            sm.fee_data_fixed = r.fee_data_fixed
            sm.shipment_fee_party = r.shipment_fee_party
            sm.shipment_fee_fixed_amount = r.shipment_fee_fixed_amount
            sm.shipment_fee_amount = r.shipment_fee_amount
            sm.shipment_fee_currency = r.shipment_fee_currency
            if(sm.shipment_fee_status === 'NE') {
              sm.shipment_fee_status = 'SA'
            }
            sm.shipment_fee_save_by = user.user_id
            sm.shipment_fee_save_at = new Date()
            await sm.save()
          }
        } else {
          await tb_shipment_fee.create({
            export_masterbl_id: export_masterbl_id,
            fee_data_code: r.fee_data_code,
            fee_data_fixed: r.fee_data_fixed,
            shipment_fee_type: 'R',
            shipment_fee_party: r.shipment_fee_party,
            shipment_fee_fixed_amount: r.shipment_fee_fixed_amount,
            shipment_fee_amount: r.shipment_fee_amount,
            shipment_fee_currency: r.shipment_fee_currency,
            shipment_fee_status: 'SA',
            shipment_fee_save_by: user.user_id,
            shipment_fee_save_at: new Date()
          })
        }
      }
    }
  }

  if(shipment_payable && shipment_payable.length > 0) {
    for(let r of shipment_payable) {
      if(r.fee_data_code && common.isNumber(r.shipment_fee_amount) && parseInt(r.shipment_fee_amount) !== 0){
        let sm = ''
        if(r.shipment_fee_id) {
          sm = await tb_shipment_fee.findOne({
            where: {
              shipment_fee_id: r.shipment_fee_id,
              state: GLBConfig.ENABLE
            }
          })
        }
        if(sm) {
          if(sm.shipment_fee_type === 'P' && saveStatus.indexOf(sm.shipment_fee_status) >= 0) {
            sm.fee_data_code = r.fee_data_code
            sm.fee_data_fixed = r.fee_data_fixed
            sm.shipment_fee_party = r.shipment_fee_party
            sm.shipment_fee_fixed_amount = r.shipment_fee_fixed_amount
            sm.shipment_fee_amount = r.shipment_fee_amount
            sm.shipment_fee_currency = r.shipment_fee_currency
            if(sm.shipment_fee_status === 'NE') {
              sm.shipment_fee_status = 'SA'
            }
            sm.shipment_fee_save_by = user.user_id
            sm.shipment_fee_save_at = new Date()
            await sm.save()
          }
        } else {
          await tb_shipment_fee.create({
            export_masterbl_id: export_masterbl_id,
            fee_data_code: r.fee_data_code,
            fee_data_fixed: r.fee_data_fixed,
            shipment_fee_type: 'P',
            shipment_fee_party: r.shipment_fee_party,
            shipment_fee_fixed_amount: r.shipment_fee_fixed_amount,
            shipment_fee_amount: r.shipment_fee_amount,
            shipment_fee_currency: r.shipment_fee_currency,
            shipment_fee_status: 'SA',
            shipment_fee_save_by: user.user_id,
            shipment_fee_save_at: new Date()
          })
        }
      }
    }
  }
  return common.success()
}

exports.checkPasswordAct = async req => {
  let doc = common.docValidate(req)
  let check = await opSrv.checkPassword(doc.page, doc.action, doc.checkPassword)
  if(check) {
    return common.success()
  } else {
    return common.error('auth_24')
  }
}

const calculationShipmentFee = async function(fee_data_code, shipment_fee_type, export_vessel_id, export_masterbl_bl) {
  let returnData = {}
  let queryStr =  ''
  let replacements = []
  if(shipment_fee_type === 'R') {
    // 应收
    queryStr = `SELECT * FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_code = ? AND fee_data_receivable = ? LIMIT 1`
    replacements = [GLBConfig.ENABLE, fee_data_code, GLBConfig.ENABLE]
  } else {
    // 应付
    queryStr = `SELECT * FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_code = ? AND fee_data_payable = ? LIMIT 1`
    replacements = [GLBConfig.ENABLE, fee_data_code, GLBConfig.ENABLE]
  }
  let fee_data = await model.simpleSelect(queryStr, replacements)
  if(fee_data && fee_data.length > 0) {
    let fee_data_type = fee_data[0].fee_data_type
    if(fee_data_type === 'BL') {
      if(shipment_fee_type === 'R') {
        returnData = {
          fee_amount: fee_data[0].fee_data_receivable_amount,
          fee_currency: fee_data[0].fee_data_receivable_amount_currency
        }
      } else {
        returnData = {
          fee_amount: fee_data[0].fee_data_payable_amount,
          fee_currency: fee_data[0].fee_data_payable_amount_currency
        }
      }
    } else {
      queryStr =  `SELECT COUNT(export_container_size_type) AS size_type_count, export_container_size_type AS size_type 
                  FROM tbl_zhongtan_export_container WHERE export_vessel_id = ? AND export_container_bl = ? AND state = ? GROUP BY export_container_size_type`
      replacements = [export_vessel_id, export_masterbl_bl, GLBConfig.ENABLE]
      let sts =  await model.simpleSelect(queryStr, replacements)
      let fee_amount = 0
      let fee_currency = ''
      if(sts) {
        for(let s of sts) {
          if(shipment_fee_type === 'R') {
            let con_fee_data = await tb_fee_data.findOne({
              where: {
                fee_data_code: fee_data_code,
                fee_data_container_size: s.size_type,
                fee_data_receivable: GLBConfig.ENABLE,
                state: GLBConfig.ENABLE
              }
            })
            if(con_fee_data) {
              if(con_fee_data.fee_data_receivable_amount){
                fee_amount = fee_amount + parseInt(con_fee_data.fee_data_receivable_amount) * s.size_type_count
              }
              fee_currency = con_fee_data.fee_data_receivable_amount_currency
            }
          } else {
            let con_fee_data = await tb_fee_data.findOne({
              where: {
                fee_data_code: fee_data_code,
                fee_data_container_size: s.size_type,
                fee_data_payable: GLBConfig.ENABLE,
                state: GLBConfig.ENABLE
              }
            })
            if(con_fee_data) {
              if(con_fee_data.fee_data_payable_amount) {
                fee_amount = fee_amount + parseInt(con_fee_data.fee_data_payable_amount) * s.size_type_count
              }
              fee_currency = con_fee_data.fee_data_payable_amount_currency
            }
          }
        }
      }
      returnData = {
        fee_amount: fee_amount,
        fee_currency: fee_currency
      }
    }
  }else {
    returnData = {
      fee_amount: '',
      fee_currency: 'USD'
    }
  }
  if(returnData.fee_amount && returnData.fee_amount > 0) {
    returnData.fee_amount_fixed = GLBConfig.ENABLE
  } else {
    returnData.fee_amount = ''
    returnData.fee_amount_fixed = GLBConfig.DISABLE
  }
  return returnData
}

