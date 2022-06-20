const moment = require('moment')
const numberToText = require('number2text')
const Decimal = require('decimal.js')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')
const opSrv = require('../../common/system/OperationPasswordServer')
const cal_demurrage_srv = require('../equipment/ExportDemurrageCalculationServer')

const tb_user = model.common_user
const tb_vessel = model.zhongtan_export_proforma_vessel
const tb_bl = model.zhongtan_export_proforma_masterbl
const tb_con = model.zhongtan_export_proforma_container
const tb_fee_data = model.zhongtan_export_fee_data
const tb_shipment_fee = model.zhongtan_export_shipment_fee
const tb_shipment_fee_log = model.zhongtan_export_shipment_fee_log
const tb_export_verification = model.zhongtan_export_verification
const tb_uploadfile = model.zhongtan_uploadfile

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

  queryStr = `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_receivable = ? AND (fee_data_receivable_fixed = ? OR fee_data_enabled_start_date IS NOT NULL OR fee_data_enabled_end_date IS NOT NULL) GROUP BY fee_data_code ORDER BY fee_data_id`
  replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, GLBConfig.ENABLE]
  let fixed_receivable_fee = await model.simpleSelect(queryStr, replacements)
  returnData.FIXED_RECEIVABLE_FEE = fixed_receivable_fee
  returnData.FIXED_RECEIVABLE_FEE.push({
    fee_data_code: 'RLC',
    fee_data_name: 'ROLLOVER CHARGE/SPACE LOSS'
  })
  returnData.FIXED_RECEIVABLE_FEE.push({
    fee_data_code: 'BGF',
    fee_data_name: 'BOOKING GUARANTEE FEE'
  })
  returnData.FIXED_RECEIVABLE_FEE.push({
    fee_data_code: 'EDF',
    fee_data_name: 'EXPORT DEPOSIT FEE'
  })
  
  queryStr = `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_receivable = ? AND (fee_data_receivable_fixed = ? OR (fee_data_receivable_fixed = ? AND (fee_data_receivable_amount IS NULL OR fee_data_receivable_amount = ''))) GROUP BY fee_data_code ORDER BY fee_data_id`
  replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, GLBConfig.DISABLE, GLBConfig.ENABLE]
  let other_receivable_fee = await model.simpleSelect(queryStr, replacements)
  returnData.OTHER_RECEIVABLE_FEE = other_receivable_fee
  returnData.ALL_RECEIVABLE_FEE = fixed_receivable_fee.concat(other_receivable_fee)

  queryStr = `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_payable = ? AND (fee_data_payable_fixed = ? OR fee_data_enabled_start_date IS NOT NULL OR fee_data_enabled_end_date IS NOT NULL) GROUP BY fee_data_code ORDER BY fee_data_id`
  replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, GLBConfig.ENABLE]
  let fixed_payable_fee = await model.simpleSelect(queryStr, replacements)
  returnData.FIXED_PAYABLE_FEE = fixed_payable_fee

  queryStr = `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_payable = ? AND (fee_data_payable_fixed = ? OR (fee_data_payable_fixed = ? AND (fee_data_payable_amount IS NULL OR fee_data_payable_amount = ''))) GROUP BY fee_data_code ORDER BY fee_data_id`
  replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, GLBConfig.DISABLE, GLBConfig.ENABLE]
  let other_payable_fee = await model.simpleSelect(queryStr, replacements)
  returnData.OTHER_PAYABLE_FEE = other_payable_fee
  returnData.ALL_PAYABLE_FEE = fixed_payable_fee.concat(other_payable_fee)
  return common.success(returnData)
}

exports.searchBookingDataAct = async req => {
  let doc = common.docValidate(req)
  let queryStr =  `SELECT * FROM tbl_zhongtan_export_proforma_masterbl WHERE state = ? `
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
      r.bk_cancellation_status = b.bk_cancellation_status
      let shipmentFees = await tb_shipment_fee.findAll({
        where: {
          export_masterbl_id: b.export_masterbl_id,
          state: GLBConfig.ENABLE
        }
      })
      let receivable = []
      let payable = []
      let receivableReceipt = []
      let payableAppove = []
      if(shipmentFees && shipmentFees.length > 0) {
        for(let s of shipmentFees) {
          if(s.shipment_fee_type === 'R') {
            receivable.push(s)
            if(s.shipment_fee_status === 'RE') {
              receivableReceipt.push(s)
            }
          } else if (s.shipment_fee_type === 'P') {
            payable.push(s)
            if(s.shipment_fee_status === 'AP') {
              payableAppove.push(s)
            }
          }
          
        }
      }
      let booking_status = false
      if(receivable.length === receivableReceipt.length && payable.length === payableAppove.length) {
        // 应收已全开票，应付全部审核
        booking_status = true
      }
      // 判断应收，应付是否包含所有固定费用
      if(booking_status) {
        let receivableFixedFees = []
        let payableFixedFees = []
        if(b.export_masterbl_cargo_type === 'TRANSIT') {
          queryStr =  `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_receivable = ? AND fee_data_receivable_fixed = ? AND fee_data_transit = ? GROUP BY fee_data_code `
          replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, GLBConfig.ENABLE, GLBConfig.DISABLE]
          receivableFixedFees =  await model.simpleSelect(queryStr, replacements)
          
          queryStr =  `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_payable = ? AND fee_data_payable_fixed = ? AND fee_data_transit = ? GROUP BY fee_data_code `
          replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, GLBConfig.ENABLE, GLBConfig.DISABLE]
          payableFixedFees =  await model.simpleSelect(queryStr, replacements)
        } else {
          queryStr =  `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_receivable = ? AND fee_data_receivable_fixed = ? GROUP BY fee_data_code `
          replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, GLBConfig.ENABLE]
          receivableFixedFees =  await model.simpleSelect(queryStr, replacements)

          queryStr =  `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_payable = ? AND fee_data_payable_fixed = ? GROUP BY fee_data_code `
          replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, GLBConfig.ENABLE]
          payableFixedFees =  await model.simpleSelect(queryStr, replacements)
        }

        let trfs = []
        if(receivableFixedFees) {
          for(let tr of receivableFixedFees) {
            trfs.push(tr.fee_data_code)
          }
        }
        let rrs = []
        for(let r of receivableReceipt) {
          if(r.fee_data_fixed === GLBConfig.ENABLE && r.shipment_fee_supplement === GLBConfig.DISABLE) {
            rrs.push(r.fee_data_code)
          }
        }

        let tpfs = []
        if(payableFixedFees) {
          for(let tp of payableFixedFees) {
            tpfs.push(tp.fee_data_code)
          }
        }
        let pas = []
        for(let p of payableAppove) {
          if(p.fee_data_fixed === GLBConfig.ENABLE && p.shipment_fee_supplement === GLBConfig.DISABLE) {
            pas.push(p.fee_data_code)
          }
        }
        booking_status = (trfs.sort().toString() == rrs.sort().toString()) && (tpfs.sort().toString() == pas.sort().toString())
      }
      r.booking_status = booking_status
      returnData.push(r)
    }
  }
  return common.success(returnData)
}

exports.getBookingShipmentAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let returnData = {}
  let bl = await tb_bl.findOne({
    where: {
      export_masterbl_id: doc.export_masterbl_id
    }
  })
  if(bl) {
    let cons = await tb_con.findAll({
      where: {
        export_vessel_id: bl.export_vessel_id,
        export_container_bl: bl.export_masterbl_bl,
        state: GLBConfig.ENABLE
      }
    })
    if(cons) {
      for(let c of cons) {
        await cal_demurrage_srv.calculationDemurrage2Shipment(c.export_vessel_id, c.export_container_bl, c.export_container_no, user.user_id)
      }
    }
    returnData = JSON.parse(JSON.stringify(bl))
    returnData.shipment_receivable = []
    returnData.shipment_payable = []
    let totalStatus = ['SU', 'AP', 'IN', 'RE', 'BA']
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
                  FROM tbl_zhongtan_export_proforma_container WHERE export_vessel_id = ? AND export_container_bl = ? AND state = ? GROUP BY export_container_size_type ORDER BY export_container_size_type `
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

    if(ves.export_vessel_etd) {
      queryStr = `SELECT fee_data_code, fee_data_name, fee_data_enabled_start_date, fee_data_enabled_end_date FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_receivable = ? AND (fee_data_enabled_start_date IS NOT NULL OR fee_data_enabled_end_date IS NOT NULL) GROUP BY fee_data_code ORDER BY fee_data_id `
      replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE]
      let etd_receivable_fee = await model.simpleSelect(queryStr, replacements)
      if(etd_receivable_fee) {
        for(let fee of etd_receivable_fee) {
          if(fee.fee_data_enabled_start_date && fee.fee_data_enabled_end_date) {
            if(moment(ves.export_vessel_etd, 'DD/MM/YYYY').isBetween(fee.fee_data_enabled_start_date, fee.fee_data_enabled_end_date)) {
              let exist = false
              for(let ef of fixed_receivable_fee) {
                if(fee.fee_data_code === ef.fee_data_code) {
                  exist = true
                  break
                }
              }
              if(!exist) {
                fixed_receivable_fee.push({
                  fee_data_code: fee.fee_data_code,
                  fee_data_name: fee.fee_data_name
                })
              }
            }
          } else if(fee.fee_data_enabled_start_date) {
            if(moment(ves.export_vessel_etd, 'DD/MM/YYYY').isSameOrAfter(fee.fee_data_enabled_start_date)) {
              let exist = false
              for(let ef of fixed_receivable_fee) {
                if(fee.fee_data_code === ef.fee_data_code) {
                  exist = true
                  break
                }
              }
              if(!exist) {
                fixed_receivable_fee.push({
                  fee_data_code: fee.fee_data_code,
                  fee_data_name: fee.fee_data_name
                })
              }
            }
          }
        }
      }

      queryStr = `SELECT fee_data_code, fee_data_name, fee_data_enabled_start_date, fee_data_enabled_end_date FROM tbl_zhongtan_export_fee_data WHERE state = ? AND fee_data_payable_fixed = ? AND (fee_data_enabled_start_date IS NOT NULL OR fee_data_enabled_end_date IS NOT NULL) GROUP BY fee_data_code ORDER BY fee_data_id `
      replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE]
      let etd_payable_fee = await model.simpleSelect(queryStr, replacements)
      if(etd_payable_fee) {
        for(let fee of etd_payable_fee) {
          if(fee.fee_data_enabled_start_date && fee.fee_data_enabled_end_date) {
            if(moment(ves.export_vessel_etd, 'DD/MM/YYYY').isBetween(fee.fee_data_enabled_start_date, fee.fee_data_enabled_end_date)) {
              let exist = false
              for(let ef of fixed_payable_fee) {
                if(fee.fee_data_code === ef.fee_data_code) {
                  exist = true
                  break
                }
              }
              if(!exist) {
                fixed_payable_fee.push({
                  fee_data_code: fee.fee_data_code,
                  fee_data_name: fee.fee_data_name
                })
              }
            }
          } else if(fee.fee_data_enabled_start_date) {
            if(moment(ves.export_vessel_etd, 'DD/MM/YYYY').isSameOrAfter(fee.fee_data_enabled_start_date)) {
              let exist = false
              for(let ef of fixed_payable_fee) {
                if(fee.fee_data_code === ef.fee_data_code) {
                  exist = true
                  break
                }
              }
              if(!exist) {
                fixed_payable_fee.push({
                  fee_data_code: fee.fee_data_code,
                  fee_data_name: fee.fee_data_name
                })
              }
            }
          }
        }
      }
    }

    queryStr = `SELECT f.*, u.uploadfile_url, c.user_name AS shipment_fee_submit_by_user FROM tbl_zhongtan_export_shipment_fee f 
                LEFT JOIN tbl_zhongtan_uploadfile u ON f.shipment_fee_invoice_id = u.uploadfile_id AND u.state = ? AND u.api_name = ? 
                LEFT JOIN tbl_common_user c ON f.shipment_fee_submit_by = c.user_id
                WHERE f.state = ? AND f.shipment_fee_type = ? AND f.export_masterbl_id = ? ORDER BY IFNULL(shipment_fee_invoice_no, FIELD(f.shipment_fee_status, 'NE', 'DE', 'UN', 'SA', 'SU', 'IN', 'RE', 'BA'))`
    replacements = [GLBConfig.ENABLE, 'SHIPMENT-INVOICE', GLBConfig.ENABLE, 'R', doc.export_masterbl_id]
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
          let fee_data = await calculationShipmentFee(fr.fee_data_code, 'R', bl.export_vessel_id, bl.export_masterbl_bl, bl.export_masterbl_cargo_type)
          if(fee_data.fee_amount && bl.bk_cancellation_status !== GLBConfig.ENABLE) {
            shipment_receivable.unshift({
              shipment_fee_id: '',
              fee_data_code: fr.fee_data_code,
              shipment_fee_type: 'R',
              shipment_fee_party: fee_data.shipment_fee_party ? fee_data.shipment_fee_party : bl.export_masterbl_empty_release_agent,
              shipment_fee_status: 'NE',
              fee_data_fixed: GLBConfig.ENABLE,
              shipment_fee_supplement: GLBConfig.DISABLE,
              shipment_fee_fixed_amount: fee_data.fee_amount === '$' ? GLBConfig.DISABLE : GLBConfig.ENABLE,
              shipment_fee_amount: fee_data.fee_amount === '$' ? '' : fee_data.fee_amount,
              shipment_fee_currency: fee_data.fee_currency ? fee_data.fee_currency : 'USD'
            })
          }
        }
      }
    } else {
      shipment_receivable = []
      for(let fr of fixed_receivable_fee) {
        let fee_data = await calculationShipmentFee(fr.fee_data_code, 'R', bl.export_vessel_id, bl.export_masterbl_bl, bl.export_masterbl_cargo_type)
        if(fee_data.fee_amount && bl.bk_cancellation_status !== GLBConfig.ENABLE) {
          shipment_receivable.unshift({
            shipment_fee_id: '',
            fee_data_code: fr.fee_data_code,
            shipment_fee_type: 'R',
            shipment_fee_party: fee_data.shipment_fee_party ? fee_data.shipment_fee_party : bl.export_masterbl_empty_release_agent,
            shipment_fee_status: 'NE',
            fee_data_fixed: GLBConfig.ENABLE,
            shipment_fee_supplement: GLBConfig.DISABLE,
            shipment_fee_fixed_amount: fee_data.fee_amount === '$' ? GLBConfig.DISABLE : GLBConfig.ENABLE,
            shipment_fee_amount: fee_data.fee_amount === '$' ? '' : fee_data.fee_amount,
            shipment_fee_currency: fee_data.fee_currency ? fee_data.fee_currency : 'USD'
          })
        }
      }
    }
    if(shipment_receivable && shipment_receivable.length > 0) {
      let totalReceivable = 0
      for(let sr of shipment_receivable) {
        let disabled = await setShipmentFeeDisabled(sr)
        if(sr.shipment_fee_submit_at) {
          sr.shipment_fee_submit_at = moment(sr.shipment_fee_submit_at).format('YYYY-MM-DD HH:mm:ss')
        }
        returnData.shipment_receivable.push(JSON.parse((JSON.stringify(sr) + JSON.stringify(disabled)).replace(/}{/, ',')))
        if(totalStatus.indexOf(sr.shipment_fee_status) >= 0) {
          totalReceivable = new Decimal(totalReceivable).plus(new Decimal(sr.shipment_fee_amount))
        }
      }
      returnData.totalReceivable = totalReceivable
    }
    queryStr = `SELECT f.*, c.user_name AS shipment_fee_submit_by_user FROM tbl_zhongtan_export_shipment_fee f
                LEFT JOIN tbl_common_user c ON f.shipment_fee_submit_by = c.user_id
                WHERE f.state = ? AND f.shipment_fee_type = ? AND f.export_masterbl_id = ? ORDER BY FIELD(f.shipment_fee_status, 'NE', 'DE', 'UN', 'SA', 'SU', 'IN', 'RE', 'BA')`
    replacements = [GLBConfig.ENABLE, 'P', doc.export_masterbl_id]
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
          let fee_data = await calculationShipmentFee(fp.fee_data_code, 'P', bl.export_vessel_id, bl.export_masterbl_bl, bl.export_masterbl_cargo_type)
          if(fee_data.fee_amount && bl.bk_cancellation_status !== GLBConfig.ENABLE) {
            shipment_payable.unshift({
              shipment_fee_id: '',
              fee_data_code: fp.fee_data_code,
              shipment_fee_type: 'P',
              shipment_fee_party: fee_data.shipment_fee_party ? fee_data.shipment_fee_party : '',
              shipment_fee_status: 'NE',
              fee_data_fixed: GLBConfig.ENABLE ,
              shipment_fee_supplement: GLBConfig.DISABLE,
              shipment_fee_fixed_amount: fee_data.fee_amount === '$' ?GLBConfig.DISABLE : GLBConfig.ENABLE,
              shipment_fee_amount: fee_data.fee_amount === '$' ? '' : fee_data.fee_amount,
              shipment_fee_currency: fee_data.fee_currency ? fee_data.fee_currency : 'USD'
            })
          }
        }
      }
    } else {
      shipment_payable = []
      for(let fp of fixed_payable_fee) {
        let fee_data = await calculationShipmentFee(fp.fee_data_code, 'P', bl.export_vessel_id, bl.export_masterbl_bl, bl.export_masterbl_cargo_type)
        if(fee_data.fee_amount && bl.bk_cancellation_status !== GLBConfig.ENABLE) {
          shipment_payable.unshift({
            shipment_fee_id: '',
            fee_data_code: fp.fee_data_code,
            shipment_fee_type: 'P',
            shipment_fee_party: fee_data.shipment_fee_party ? fee_data.shipment_fee_party : '',
            shipment_fee_status: 'NE',
            fee_data_fixed: GLBConfig.ENABLE ,
            shipment_fee_supplement: GLBConfig.DISABLE,
            shipment_fee_fixed_amount: fee_data.fee_amount === '$' ? GLBConfig.DISABLE : GLBConfig.ENABLE,
            shipment_fee_amount: fee_data.fee_amount === '$' ? '' : fee_data.fee_amount,
            shipment_fee_currency: fee_data.fee_currency ? fee_data.fee_currency : 'USD'
          })
        }
      }
    }
    if(shipment_payable && shipment_payable.length > 0) {
      let totalPayable = 0
      for(let sr of shipment_payable) {
        let disabled = await setShipmentFeeDisabled(sr)
        if(sr.shipment_fee_submit_at) {
          sr.shipment_fee_submit_at = moment(sr.shipment_fee_submit_at).format('YYYY-MM-DD HH:mm:ss')
        }
        returnData.shipment_payable.push(JSON.parse((JSON.stringify(sr) + JSON.stringify(disabled)).replace(/}{/, ',')))
        if(totalStatus.indexOf(sr.shipment_fee_status) >= 0) {
          totalPayable = new Decimal(totalPayable).plus(new Decimal(sr.shipment_fee_amount))
        }
      }
      returnData.totalPayable = totalPayable
    }
  }
  if(returnData.totalReceivable && returnData.totalPayable) {
    returnData.grossProfit = new Decimal(returnData.totalReceivable).sub(new Decimal(returnData.totalPayable))
  } else if(returnData.totalReceivable) {
    returnData.grossProfit = returnData.totalReceivable
  } else if(returnData.totalPayable) {
    returnData.grossProfit = -returnData.totalPayable
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
    let cal = await calculationShipmentFee(doc.fee_data_code, doc.shipment_fee_type, bl.export_vessel_id, bl.export_masterbl_bl, bl.export_masterbl_cargo_type)
    if(cal && cal.fee_amount === '$') {
      cal.fee_amount = ''
    }
    let sf = {
      shipment_fee_status: 'NE',
      fee_data_fixed: GLBConfig.DISABLED,
      shipment_fee_fixed_amount: cal.fee_amount ? '1' : '0'
    }
    let disabled = await setShipmentFeeDisabled(sf)
    returnData = JSON.parse((JSON.stringify(cal) + JSON.stringify(disabled)).replace(/}{/, ','))
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
  // let exist_ids = []
  // remove
  // if(shipment_receivable && shipment_receivable.length > 0) {
  //   for(let r of shipment_receivable) {
  //     if(r.shipment_fee_id) {
  //       exist_ids.push(r.shipment_fee_id)
  //     }
  //   }
  // }
  // if(shipment_payable && shipment_payable.length > 0) {
  //   for(let r of shipment_payable) {
  //     if(r.shipment_fee_id) {
  //       exist_ids.push(r.shipment_fee_id)
  //     }
  //   }
  // }
  // if(exist_ids && exist_ids.length > 0) {
  //   let queryStr = `SELECT shipment_fee_id FROM tbl_zhongtan_export_shipment_fee WHERE state = ? AND shipment_fee_id NOT IN (?)`
  //   let replacements = [GLBConfig.ENABLE, exist_ids]
  //   let rms = await model.simpleSelect(queryStr, replacements)
  //   if(rms && rms.length > 0) {
  //     for(let r of rms) {
  //       let rm = await tb_shipment_fee.findOne({
  //         where: {
  //           shipment_fee_id: r.shipment_fee_id,
  //           state: GLBConfig.ENABLE
  //         }
  //       })
  //       if(rm) {
  //         rm.state = GLBConfig.DISABLE
  //         await rm.save()
  //       }
  //     }
  //   }
  // }

  if(shipment_receivable && shipment_receivable.length > 0) {
    for(let r of shipment_receivable) {
      if(r.fee_data_code && r.shipment_fee_amount && common.isNumber(r.shipment_fee_amount) && new Decimal(r.shipment_fee_amount) !== 0){
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
            sm.shipment_fee_supplement = r.shipment_fee_supplement ? r.shipment_fee_supplement : '0'
            sm.shipment_fee_party = r.shipment_fee_party
            sm.shipment_fee_fixed_amount = r.shipment_fee_fixed_amount
            sm.shipment_fee_amount = r.shipment_fee_amount
            sm.shipment_fee_currency = r.shipment_fee_currency ? r.shipment_fee_currency : 'USD'
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
            shipment_fee_supplement: r.shipment_fee_supplement ? r.shipment_fee_supplement : '0',
            shipment_fee_type: 'R',
            shipment_fee_party: r.shipment_fee_party,
            shipment_fee_fixed_amount: r.shipment_fee_fixed_amount,
            shipment_fee_amount: r.shipment_fee_amount,
            shipment_fee_currency: r.shipment_fee_currency ? r.shipment_fee_currency : 'USD',
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
      if(r.fee_data_code && r.shipment_fee_amount && common.isNumber(r.shipment_fee_amount) && new Decimal(r.shipment_fee_amount) !== 0){
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
            sm.shipment_fee_supplement = r.shipment_fee_supplement ? r.shipment_fee_supplement : '0'
            sm.shipment_fee_party = r.shipment_fee_party
            sm.shipment_fee_fixed_amount = r.shipment_fee_fixed_amount
            sm.shipment_fee_amount = r.shipment_fee_amount
            sm.shipment_fee_currency = r.shipment_fee_currency ? r.shipment_fee_currency : 'USD'
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
            shipment_fee_supplement: r.shipment_fee_supplement ? r.shipment_fee_supplement : '0',
            shipment_fee_type: 'P',
            shipment_fee_party: r.shipment_fee_party,
            shipment_fee_fixed_amount: r.shipment_fee_fixed_amount,
            shipment_fee_amount: r.shipment_fee_amount,
            shipment_fee_currency: r.shipment_fee_currency ? r.shipment_fee_currency : 'USD',
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

exports.removeShipmentAct = async req => {
  let doc = common.docValidate(req)
  let queryStr = `SELECT shipment_fee_id, shipment_fee_type, fee_data_fixed, fee_data_code FROM tbl_zhongtan_export_shipment_fee WHERE state = ? AND shipment_fee_id IN (?)`
  let replacements = [GLBConfig.ENABLE, doc.remove_ids]
  let rms = await model.simpleSelect(queryStr, replacements)
  if(rms && rms.length > 0) {
    let unremoveFee = ['BLF', 'FAF', 'OFT']
    for(let r of rms) {
      if(r.shipment_fee_type === 'P' && r.fee_data_fixed === '1' && unremoveFee.indexOf(r.fee_data_code) >= 0) {
        return common.error('export_02')
      }
    }
    let removeStatus = ['NE', 'SA', 'DE', 'UN']
    for(let r of rms) {
      let rm = await tb_shipment_fee.findOne({
        where: {
          shipment_fee_id: r.shipment_fee_id,
          state: GLBConfig.ENABLE
        }
      })
      if(rm && removeStatus.indexOf(rm.shipment_fee_status) >= 0) {
        rm.state = GLBConfig.DISABLE
        rm.updated_at = new Date()
        await rm.save()

        if(rm.fee_data_code === 'BGF') {
          // booking guarantee 删除是，删除对应单子
          let pro_bl = await tb_bl.findOne({
            where: {
              export_masterbl_id: rm.export_masterbl_id,
              state: GLBConfig.ENABLE,
            }
          })
          if(pro_bl) {
            let fees = await tb_shipment_fee.findAll({
              where: {
                export_masterbl_id: rm.export_masterbl_id,
                state: GLBConfig.ENABLE
              }
            })
            if(!fees || fees.length <= 0) {
              pro_bl.state = GLBConfig.DISABLE
              await pro_bl.save()
            }
          }
        }
      }
    }
  }
  return common.success()
}

exports.submitShipmentAct = async req => {
  let doc = common.docValidate(req),
  user = req.user, curDate = new Date()
  let export_masterbl_id = doc.export_masterbl_id
  let bl = await tb_bl.findOne({
    where: {
      export_masterbl_id: doc.export_masterbl_id,
      state: GLBConfig.ENABLE,
    }
  })
  if (bl) {
    let shipment_receivable = await tb_shipment_fee.findAll({
      where: {
        state: GLBConfig.ENABLE,
        shipment_fee_type: 'R',
        export_masterbl_id: bl.export_masterbl_id
      }
    })
    let shipment_payable = await tb_shipment_fee.findAll({
      where: {
        state: GLBConfig.ENABLE,
        shipment_fee_type: 'P',
        export_masterbl_id: bl.export_masterbl_id
      }
    })
    let submitStatus = ['SA', 'SU', 'DE', 'UN']
    let submitReceivable = [], submitPayable = [], submitSplit = []
    let totalReceivable = 0, totalPayable = 0, totalSplit = 0
    if(shipment_receivable && shipment_receivable.length > 0) {
      for(let s of shipment_receivable) {
        if(s.shipment_fee_id) {
          let sm = await tb_shipment_fee.findOne({
            where: {
              shipment_fee_id: s.shipment_fee_id,
              state: GLBConfig.ENABLE
            }
          })
          if(sm.shipment_fee_type === 'R' && submitStatus.indexOf(sm.shipment_fee_status) >= 0 
              && sm.shipment_fee_party && sm.fee_data_code && sm.shipment_fee_amount && new Decimal(sm.shipment_fee_amount) !== 0) {
            let sfCustomer = await tb_user.findOne({
              where: {
                user_id: sm.shipment_fee_party
              }
            })
            if(sfCustomer && sfCustomer.export_split_shipment && sfCustomer.export_split_shipment.indexOf(sm.fee_data_code) >= 0) {
              submitSplit.push(sm)
              totalSplit = new Decimal(totalReceivable).plus(new Decimal(sm.shipment_fee_amount))
            } else {
              submitReceivable.push(sm)
              totalReceivable = new Decimal(totalReceivable).plus(new Decimal(sm.shipment_fee_amount))
            }
          }
        }
      }
    }
    if(shipment_payable && shipment_payable.length > 0) {
      for(let s of shipment_payable) {
        if(s.shipment_fee_id) {
          let sm = await tb_shipment_fee.findOne({
            where: {
              shipment_fee_id: s.shipment_fee_id,
              state: GLBConfig.ENABLE
            }
          })
          if(sm.shipment_fee_type === 'P' && submitStatus.indexOf(sm.shipment_fee_status) >= 0 
              && sm.shipment_fee_party && sm.fee_data_code && sm.shipment_fee_amount && new Decimal(sm.shipment_fee_amount) !== 0) {
                submitPayable.push(sm)
                totalPayable = new Decimal(totalPayable).plus(new Decimal(sm.shipment_fee_amount))
          }
        }
      }
    }
    // 删除未处理的审核
    let evs = await tb_export_verification.findAll({
      where: {
        export_masterbl_id: export_masterbl_id,
        export_verification_api_name: 'SHIPMENT RELEASE',
        export_verification_state: 'PM',
        state : GLBConfig.ENABLE
      }
    })
    if(evs && evs.length > 0) {
      for(let e of evs) {
        e.state = GLBConfig.DISABLE
        await e.save()
      }
    }
    if((submitReceivable && submitReceivable.length > 0) || (submitPayable && submitPayable.length > 0)) {
      // 有可提交的应收应付费用
      let verification = await tb_export_verification.create({
        export_masterbl_id: export_masterbl_id,
        export_verification_api_name: 'SHIPMENT RELEASE',
        export_verification_bl: bl.export_masterbl_bl,
        export_verification_state: 'PM',
        export_verification_create_user: user.user_id,
        export_verification_shipment_receivable: Decimal.isDecimal(totalReceivable) ? totalReceivable.toNumber() : totalReceivable,
        export_verification_shipment_payable: Decimal.isDecimal(totalPayable) ? totalPayable.toNumber() : totalPayable
      })
      for(let s of submitReceivable) {
        await tb_shipment_fee_log.create({
          shipment_fee_id: s.shipment_fee_id,
          shipment_relation_id: verification.export_verification_id,
          export_masterbl_id: export_masterbl_id,
          shipment_fee_status_pre: s.shipment_fee_status,
          shipment_fee_status: 'SU',
          shipment_fee_amount_pre: s.shipment_fee_amount,
          shipment_fee_amount: s.shipment_fee_amount,
          shipment_fee_submit_by: user.user_id,
          shipment_fee_submit_at: curDate
        })
        s.shipment_fee_status = 'SU'
        s.shipment_fee_submit_by = user.user_id
        s.shipment_fee_submit_at = curDate
        await s.save()
      }
      for(let s of submitPayable) {
        await tb_shipment_fee_log.create({
          shipment_fee_id: s.shipment_fee_id,
          shipment_relation_id: verification.export_verification_id,
          export_masterbl_id: export_masterbl_id,
          shipment_fee_status_pre: s.shipment_fee_status,
          shipment_fee_status: 'SU',
          shipment_fee_amount_pre: s.shipment_fee_amount,
          shipment_fee_amount: s.shipment_fee_amount,
          shipment_fee_submit_by: user.user_id,
          shipment_fee_submit_at: curDate
        })
        s.shipment_fee_status = 'SU'
        s.shipment_fee_submit_by = user.user_id
        s.shipment_fee_submit_at = curDate
        await s.save()
      }
    }

    if(submitSplit && submitSplit.length > 0) {
      // 有可提交的应收应付费用
      let verification = await tb_export_verification.create({
        export_masterbl_id: export_masterbl_id,
        export_verification_api_name: 'SHIPMENT RELEASE',
        export_verification_bl: bl.export_masterbl_bl,
        export_verification_state: 'PM',
        export_verification_create_user: user.user_id,
        export_verification_shipment_receivable: Decimal.isDecimal(totalSplit) ? totalSplit.toNumber() : totalSplit
      })
      for(let s of submitSplit) {
        await tb_shipment_fee_log.create({
          shipment_fee_id: s.shipment_fee_id,
          shipment_relation_id: verification.export_verification_id,
          export_masterbl_id: export_masterbl_id,
          shipment_fee_status_pre: s.shipment_fee_status,
          shipment_fee_status: 'SU',
          shipment_fee_amount_pre: s.shipment_fee_amount,
          shipment_fee_amount: s.shipment_fee_amount,
          shipment_fee_submit_by: user.user_id,
          shipment_fee_submit_at: curDate
        })
        s.shipment_fee_status = 'SU'
        s.shipment_fee_submit_by = user.user_id
        s.shipment_fee_submit_at = curDate
        await s.save()
      }
    }
  }
  return common.success()
}

exports.undoShipmentAct = async req => {
  let doc = common.docValidate(req),
  user = req.user, curDate = new Date()
  let bl = await tb_bl.findOne({
    where: {
      export_masterbl_id: doc.export_masterbl_id
    }
  })
  if (bl) {
    let shipment_receivable = doc.shipment_receivable
    let shipment_payable = doc.shipment_payable
    let undoStatus = ['SU']
    let undoReceivable = [], undoPayable = []
    if(shipment_receivable && shipment_receivable.length > 0) {
      for(let s of shipment_receivable) {
        if(s.shipment_fee_id) {
          let sm = await tb_shipment_fee.findOne({
            where: {
              shipment_fee_id: s.shipment_fee_id,
              state: GLBConfig.ENABLE
            }
          })
          if(sm.shipment_fee_type === 'R' && undoStatus.indexOf(sm.shipment_fee_status) >= 0) {
                undoReceivable.push(sm)
          }
        }
      }
    }
    if(shipment_payable && shipment_payable.length > 0) {
      for(let s of shipment_payable) {
        if(s.shipment_fee_id) {
          let sm = await tb_shipment_fee.findOne({
            where: {
              shipment_fee_id: s.shipment_fee_id,
              state: GLBConfig.ENABLE
            }
          })
          if(sm.shipment_fee_type === 'P' && undoStatus.indexOf(sm.shipment_fee_status) >= 0) {
                undoPayable.push(sm)
          }
        }
      }
    }
    let undoVerification = []
    if((undoReceivable && undoReceivable.length > 0) || (undoPayable && undoPayable.length > 0)) {
      // 有可提交的应收应付费用
      for(let s of undoReceivable) {
        let fee_log = await tb_shipment_fee_log.findOne({
          where: {
            shipment_fee_id: s.shipment_fee_id
          }
        })
        if(fee_log) {
          fee_log.shipment_fee_status_pre = fee_log.shipment_fee_status
          fee_log.shipment_fee_status = 'UN'
          fee_log.shipment_fee_undo_by = user.user_id
          fee_log.shipment_fee_undo_at = curDate
          fee_log.shipment_fee_undo_remark = doc.shipment_fee_undo_remark
          await fee_log.save()
          if(undoVerification.indexOf(fee_log.shipment_relation_id) < 0) {
            undoVerification.push(fee_log.shipment_relation_id)
          }
        }
        s.shipment_fee_status = 'UN'
        s.shipment_fee_undo_by = user.user_id
        s.shipment_fee_undo_at = curDate
        s.shipment_fee_undo_remark = doc.shipment_fee_undo_remark
        await s.save()
      }
      for(let s of undoPayable) {
        let fee_log = await tb_shipment_fee_log.findOne({
          where: {
            shipment_fee_id: s.shipment_fee_id
          }
        })
        if(fee_log) {
          fee_log.shipment_fee_status_pre = fee_log.shipment_fee_status
          fee_log.shipment_fee_status = 'UN'
          fee_log.shipment_fee_undo_by = user.user_id
          fee_log.shipment_fee_undo_at = curDate
          fee_log.shipment_fee_undo_remark = doc.shipment_fee_undo_remark
          await fee_log.save()
          if(undoVerification.indexOf(fee_log.shipment_relation_id) < 0) {
            undoVerification.push(fee_log.shipment_relation_id)
          }
        }
        s.shipment_fee_status = 'UN'
        s.shipment_fee_undo_by = user.user_id
        s.shipment_fee_undo_at = curDate
        s.shipment_fee_undo_remark = doc.shipment_fee_undo_remark
        await s.save()
      }
    }
    if(undoVerification && undoVerification.length > 0) {
      let queryStr = ''
      let replacements =[]
      for(let u of undoVerification) {
        queryStr = `select f.* from tbl_zhongtan_export_shipment_fee f left join tbl_zhongtan_export_shipment_fee_log fl on fl.shipment_fee_id = f.shipment_fee_id 
          where fl.state = '1' and f.state = '1' and f.shipment_fee_status = ? and fl.shipment_relation_id = ? `
        replacements = ['SU', u]
        let sf = await model.simpleSelect(queryStr, replacements)
        let totalReceivable = 0, totalPayable = 0 
        if(sf) {
          for(let s of sf) {
            if(s.shipment_fee_type === 'R') {
              totalReceivable = new Decimal(totalReceivable).plus(new Decimal(s.shipment_fee_amount))
            } else if(s.shipment_fee_type === 'P'){
              totalPayable = new Decimal(totalPayable).plus(new Decimal(s.shipment_fee_amount))
            }
            
          }
        }
        let ver = await tb_export_verification.findOne({
          where: {
            export_verification_id: u
          }
        })
        if(ver) {
          if(totalReceivable === 0 && totalPayable === 0) {
            ver.state = GLBConfig.DISABLE
          } else {
            ver.export_verification_shipment_receivable = Decimal.isDecimal(totalReceivable) ? totalReceivable.toNumber() : totalReceivable
            ver.export_verification_shipment_payable = Decimal.isDecimal(totalPayable) ? totalPayable.toNumber() : totalPayable
          }
          await ver.save()
        }
      }
    }
  }
  return common.success()
}

exports.invoiceShipmentAct = async req => {
  let doc = common.docValidate(req),
  user = req.user, curDate = new Date()
  let bl = await tb_bl.findOne({
    where: {
      export_masterbl_id: doc.export_masterbl_id
    }
  })
  let ves = await tb_vessel.findOne({
    where: {
      export_vessel_id: bl.export_vessel_id
    }
  })
  let commonUser = await tb_user.findOne({
    where: {
      user_id: user.user_id
    }
  })
  if(bl && ves) {
    let queryStr =  `SELECT CONCAT(COUNT(export_container_size_type), ' x ', export_container_size_type) AS size_type 
                  FROM tbl_zhongtan_export_proforma_container WHERE export_vessel_id = ? AND export_container_bl = ? AND state = ? GROUP BY export_container_size_type ORDER BY export_container_size_type `
    let replacements = [bl.export_vessel_id, bl.export_masterbl_bl, GLBConfig.ENABLE]
    let sts =  await model.simpleSelect(queryStr, replacements)
    let size_type = ''
    if(sts) {
      let st = []
      for(let s of sts) {
        st.push(s.size_type)
      }
      size_type = st.join(';')
    }
    queryStr = `SELECT fee_data_code, fee_data_name FROM tbl_zhongtan_export_fee_data GROUP BY fee_data_code`
    replacements = []
    let fds = await model.simpleSelect(queryStr, replacements) 

    let invoiceStatus = ['AP', 'IN']
    // 合并冲账
    queryStr = `SELECT shipment_fee_party, fee_data_code FROM tbl_zhongtan_export_shipment_fee WHERE state = ? AND export_masterbl_id = ? AND shipment_fee_type = 'R' AND shipment_fee_status IN (?) 
                GROUP BY shipment_fee_party, fee_data_code HAVING SUM(CAST(shipment_fee_amount as DECIMAL)) = 0`
    replacements = [GLBConfig.ENABLE, doc.export_masterbl_id, invoiceStatus]
    let balance_shipment = await model.simpleSelect(queryStr, replacements)
    if(balance_shipment && balance_shipment.length > 0) {
      for(let bs of balance_shipment) {
        let bsfs = await tb_shipment_fee.findAll({
          where: {
            state: GLBConfig.ENABLE,
            export_masterbl_id: doc.export_masterbl_id,
            shipment_fee_party: bs.shipment_fee_party,
            fee_data_code: bs.fee_data_code,
            shipment_fee_type: 'R'
          }
        })
        if(bsfs && bsfs.length > 0) {
          for(let f of bsfs) {
            if(invoiceStatus.indexOf(f.shipment_fee_status) >= 0) {
              f.shipment_fee_status = 'BA'
              f.updated_at = curDate
              await f.save()
            }
          }
        }
      }
    }
    queryStr = `SELECT f.*, u.user_name, u.user_address, u.user_tin FROM 
                tbl_zhongtan_export_shipment_fee f LEFT JOIN tbl_common_user u ON f.shipment_fee_party = u.user_id 
                WHERE f.state = ? AND f.export_masterbl_id = ? AND f.shipment_fee_type = 'R' AND f.shipment_fee_status IN (?) ORDER BY u.user_name, f.fee_data_fixed DESC, f.shipment_fee_fixed_amount DESC;`
    replacements = [GLBConfig.ENABLE, doc.export_masterbl_id, invoiceStatus]
    let invoice_shipment = await model.simpleSelect(queryStr, replacements) 
    if(invoice_shipment && invoice_shipment.length > 0) {
      let renderParty = {}
      for(let i of invoice_shipment) {
        let inCustomer = await tb_user.findOne({
          where: {
            user_id: i.shipment_fee_party
          }
        })
        let split_party = i.shipment_fee_party
        if(inCustomer && inCustomer.export_split_shipment && inCustomer.export_split_shipment.indexOf(i.fee_data_code) >= 0) {
          split_party += '#split'
        }
        if(!renderParty[split_party]) {
          renderParty[split_party] = []
        }
        renderParty[split_party].push(i)
      }
      for(let rp in renderParty) {
        let invoices = renderParty[rp]
        if(invoices && invoices.length > 0) {
          let renderData = {}
          renderData.shipmentParty = invoices[0].user_name
          renderData.partyTin = invoices[0].user_tin
          renderData.partyVrn = invoices[0].user_vrn
          renderData.partyAddress = invoices[0].user_address
          renderData.cargoType = bl.export_masterbl_cargo_type
          renderData.invoiceDate = moment().format('YYYY/MM/DD')
          let invoiceNo = await seq.genShipmentInvoiceSeq()
          renderData.invoiceNo = invoiceNo
          renderData.vesselName = ves.export_vessel_name
          renderData.voyageNumber = ves.export_vessel_voyage
          renderData.portOfDischarge = bl.export_masterbl_port_of_discharge
          renderData.masterbiBl = bl.export_masterbl_bl
          renderData.vesselEtd = ves.export_vessel_etd ? moment(ves.export_vessel_etd, 'DD/MM/YYYY').format('YYYY/MM/DD') : ves.export_vessel_etd
          renderData.containerSizeType = size_type
          renderData.receivable = []
          let totalReceivable = 0
          // 合并费用
          let renderFee = {}
          for(let i of invoices) {
            if(!renderFee[i.fee_data_code]) {
              renderFee[i.fee_data_code] = []
            }
            renderFee[i.fee_data_code].push(i)
          }
          for(let f in renderFee) {
            let fi = renderFee[f]
            let fee_name = ''
            let fee_amount = 0
            for(let i of fi) {
              for(let fd of fds) {
                if(i.fee_data_code === fd.fee_data_code) {
                  fee_name = fd.fee_data_name
                  break
                }
              }
              fee_amount = new Decimal(fee_amount).plus(new Decimal(i.shipment_fee_amount))
            }
            if(fee_amount != 0){
              let r = {
                fee_type: fee_name,
                fee_amount: fee_amount
              }
              renderData.receivable.push(r)
              totalReceivable = new Decimal(totalReceivable).plus(new Decimal(fee_amount))
            }
          }
          totalReceivable = Decimal.isDecimal(totalReceivable) ? totalReceivable.toNumber() : totalReceivable
          renderData.totalReceivable = totalReceivable
          if(totalReceivable > 0) {
            renderData.totalReceivableStr = numberToText(totalReceivable, 'english')
          } else {
            renderData.totalReceivableStr = 'MINUS ' + numberToText(new Decimal(totalReceivable).absoluteValue(), 'english')
          }
          renderData.user_name = commonUser.user_name
          renderData.user_phone = commonUser.user_phone
          renderData.user_email = commonUser.user_email
          try {
            let fileInfo = await common.ejs2Pdf(bl.bk_cancellation_status === GLBConfig.ENABLE ? 'cancellationInvoice.ejs' : 'shipmentInvoice.ejs', renderData, 'zhongtan')
            let invoice_file = await tb_uploadfile.create({
              api_name: 'SHIPMENT-INVOICE',
              user_id: user.user_id,
              uploadfile_index1: bl.export_masterbl_id,
              uploadfile_name: fileInfo.name,
              uploadfile_url: fileInfo.url,
              uploadfile_currency: 'USD',
              uploadfile_state: 'AP', // TODO state PM => PB
              uploadfile_amount: totalReceivable,
              uploadfile_customer_id: invoices[0].shipment_fee_party,
              uploadfile_invoice_no: invoiceNo,
              uploadfil_release_date: curDate,
              uploadfil_release_user_id: user.user_id
            })
            for(let i of invoices) {
              let sf = await tb_shipment_fee.findOne({
                where: {
                  shipment_fee_id: i.shipment_fee_id
                }
              })
              if(sf) {
                if(sf.shipment_fee_invoice_id) {
                  let old_if = await tb_uploadfile.findOne({
                    where: {
                      uploadfile_id: sf.shipment_fee_invoice_id
                    }
                  })
                  if(old_if) {
                    old_if.state = GLBConfig.DISABLE
                    await old_if.save()
                  }
                }
                sf.shipment_fee_status = 'IN'
                sf.shipment_fee_invoice_by = user.user_id
                sf.shipment_fee_invoice_at = curDate
                sf.shipment_fee_invoice_id = invoice_file.uploadfile_id
                sf.shipment_fee_invoice_no = invoiceNo
                await sf.save()
              }
            }
          } catch(e) {
            return common.error('generate_file_01')
          }
        }
      }
    }
  }
}

exports.resetShipmentAct = async req =>{
  let doc = common.docValidate(req), curDate = new Date()
  let bl = await tb_bl.findOne({
    where: {
      export_masterbl_id: doc.export_masterbl_id,
      state: GLBConfig.ENABLE
    }
  })
  if(bl) {
    let fees = await tb_shipment_fee.findAll({
      where: {
        export_masterbl_id: bl.export_masterbl_id,
        state: GLBConfig.ENABLE
      }
    })
    if(fees) {
      let resetStatus = ['SU', 'AP', 'IN', 'BA']
      for(let f of fees) {
        if(f.shipment_fee_type === 'R') {
          if(resetStatus.indexOf(f.shipment_fee_status) >= 0) {
            if(f.shipment_fee_status === 'RE') {
              // 删除对应的收据和发票及审核记录
              // let rf = await tb_uploadfile.findOne({
              //   where: {
              //     uploadfile_id: f.shipment_fee_receipt_id,
              //     state: GLBConfig.ENABLE
              //   }
              // })
              // if(rf) {
              //   rf.state = GLBConfig.DISABLE
              //   rf.updated_at = curDate
              //   await rf.save()
              // }
              // let inf = await tb_uploadfile.findOne({
              //   where: {
              //     uploadfile_id: f.shipment_fee_invoice_id,
              //     state: GLBConfig.ENABLE
              //   }
              // })
              // if(inf) {
              //   inf.state = GLBConfig.DISABLE
              //   inf.updated_at = curDate
              //   await inf.save()
              // }
            } else if(f.shipment_fee_status === 'IN') {
              // 删除对应的发票及审核记录
              let inf = await tb_uploadfile.findOne({
                where: {
                  uploadfile_id: f.shipment_fee_invoice_id,
                  state: GLBConfig.ENABLE
                }
              })
              if(inf) {
                inf.state = GLBConfig.DISABLE
                inf.updated_at = curDate
                await inf.save()
              }
            } else if(f.shipment_fee_status === 'AP') {
              // TODO删除对应的审核
            }
            f.shipment_fee_submit_by = null
            f.shipment_fee_submit_at = null
            f.shipment_fee_approve_by = null
            f.shipment_fee_approve_at = null
            f.shipment_fee_invoice_by = null
            f.shipment_fee_invoice_at = null
            f.shipment_fee_invoice_no = null
            f.shipment_fee_receipt_by = null
            f.shipment_fee_receipt_at = null
            f.shipment_fee_receipt_no = null
            f.shipment_fee_invoice_id = null
            f.shipment_fee_receipt_id = null
            f.shipment_fee_status = 'SA'
            f.updated_at = curDate
            await f.save()
          }
        } else if(f.shipment_fee_type === 'P' && f.shipment_fee_status != 'AP') {
          // f.shipment_fee_submit_by = null
          // f.shipment_fee_submit_at = null
          // f.shipment_fee_approve_by = null
          // f.shipment_fee_approve_at = null
          // f.shipment_fee_invoice_by = null
          // f.shipment_fee_invoice_at = null
          // f.shipment_fee_invoice_no = null
          // f.shipment_fee_receipt_by = null
          // f.shipment_fee_receipt_at = null
          // f.shipment_fee_receipt_no = null
          // f.shipment_fee_invoice_id = null
          // f.shipment_fee_receipt_id = null
          // f.shipment_fee_status = 'SA'
          // f.updated_at = curDate
          // await f.save()
        }
      }
    }
  }
  return common.success()
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

const calculationShipmentFee = async function(fee_data_code, shipment_fee_type, export_vessel_id, export_masterbl_bl, export_masterbl_cargo_type) {
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
    if(export_masterbl_cargo_type === 'TRANSIT' && fee_data[0].fee_data_transit === GLBConfig.ENABLE) {
      // 过境不收费
      returnData = {
        fee_amount: '',
        fee_currency: fee_data[0].fee_data_payable_amount_currency
      }
    } else {
      if(fee_data_type === 'BL') {
        let shipment_fee_party = ''
        
        if(shipment_fee_type === 'R') {
          if(export_masterbl_bl.indexOf('COSU') >= 0){
            shipment_fee_party = fee_data[0].fee_data_receivable_cosco_party ? fee_data[0].fee_data_receivable_cosco_party : fee_data[0].fee_data_receivable_common_party
          } else if(export_masterbl_bl.indexOf('OOLU') >= 0){
            shipment_fee_party = fee_data[0].fee_data_receivable_oocl_party ? fee_data[0].fee_data_receivable_oocl_party : fee_data[0].fee_data_receivable_common_party
          }
          returnData = {
            fee_amount: fee_data[0].fee_data_receivable_amount,
            fee_currency: fee_data[0].fee_data_receivable_amount_currency,
            shipment_fee_party: shipment_fee_party
          }
        } else {
          if(export_masterbl_bl.indexOf('COSU') >= 0){
            shipment_fee_party = fee_data[0].fee_data_payable_cosco_party ? fee_data[0].fee_data_payable_cosco_party : fee_data[0].fee_data_payable_common_party
          } else if(export_masterbl_bl.indexOf('OOLU') >= 0){
            shipment_fee_party = fee_data[0].fee_data_payable_oocl_party ? fee_data[0].fee_data_payable_oocl_party : fee_data[0].fee_data_payable_common_party
          }
          returnData = {
            fee_amount: fee_data[0].fee_data_payable_amount,
            fee_currency: fee_data[0].fee_data_payable_amount_currency,
            shipment_fee_party: shipment_fee_party
          }
        }
      } else {
        queryStr =  `SELECT COUNT(export_container_size_type) AS size_type_count, export_container_size_type AS size_type 
                    FROM tbl_zhongtan_export_proforma_container WHERE export_vessel_id = ? AND export_container_bl = ? AND state = ? GROUP BY export_container_size_type`
        replacements = [export_vessel_id, export_masterbl_bl, GLBConfig.ENABLE]
        let sts =  await model.simpleSelect(queryStr, replacements)
        let fee_amount = 0
        let fee_currency = ''
        let shipment_fee_party = ''
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
                  fee_amount = new Decimal(fee_amount).plus(new Decimal(con_fee_data.fee_data_receivable_amount).times(s.size_type_count))
                }else {
                  fee_amount = '$'
                }
                fee_currency = con_fee_data.fee_data_receivable_amount_currency
                if(export_masterbl_bl.indexOf('COSU') >= 0){
                  shipment_fee_party = con_fee_data.fee_data_receivable_cosco_party ? con_fee_data.fee_data_receivable_cosco_party : con_fee_data.fee_data_receivable_common_party
                } else if(export_masterbl_bl.indexOf('OOLU') >= 0){
                  shipment_fee_party = con_fee_data.fee_data_receivable_oocl_party ? con_fee_data.fee_data_receivable_oocl_party : con_fee_data.fee_data_receivable_common_party
                }
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
                  fee_amount = new Decimal(fee_amount).plus(new Decimal(con_fee_data.fee_data_payable_amount).times(s.size_type_count))
                } else {
                  fee_amount = '$'
                }
                fee_currency = con_fee_data.fee_data_payable_amount_currency
                if(export_masterbl_bl.indexOf('COSU') >= 0){
                  shipment_fee_party = con_fee_data.fee_data_payable_cosco_party ? con_fee_data.fee_data_payable_cosco_party : con_fee_data.fee_data_payable_amount_currency
                } else if(export_masterbl_bl.indexOf('OOLU') >= 0){
                  shipment_fee_party = con_fee_data.fee_data_payable_oocl_party ? con_fee_data.fee_data_payable_oocl_party : con_fee_data.fee_data_payable_amount_currency
                }
              }
            }
          }
        }
        returnData = {
          fee_amount: Decimal.isDecimal(fee_amount) ? fee_amount.toNumber() : fee_amount,
          fee_currency: fee_currency,
          shipment_fee_party: shipment_fee_party
        }
      }
    }
  }else {
    returnData = {
      fee_amount: '',
      fee_currency: 'USD'
    }
  }
  if(returnData.fee_amount && (returnData.fee_amount === '$' || returnData.fee_amount > 0)) {
    returnData.fee_amount_fixed = GLBConfig.ENABLE
  } else {
    returnData.fee_amount = ''
    returnData.fee_amount_fixed = GLBConfig.DISABLE
  }
  
  return returnData
}

const setShipmentFeeDisabled = async function(sf) {
  let disabled = {
    party_disabled: false,
    fee_disabled: false,
    amount_disabled: false,
    currency_disabled: false
  }
  if(sf) {
    let editStatus = ['NE', 'SA', 'DE', 'UN']
    if(editStatus.indexOf(sf.shipment_fee_status) >= 0) {
      if(sf.fee_data_fixed && sf.fee_data_fixed === '1') {
        if(sf.shipment_fee_fixed_amount && sf.shipment_fee_fixed_amount === '1') {
          disabled.amount_disabled = true
          disabled.currency_disabled = true
        }
        disabled.fee_disabled = true
      } else if(sf.shipment_fee_fixed_amount && sf.shipment_fee_fixed_amount === '1') {
        disabled.amount_disabled = true
        disabled.currency_disabled = true
      }
      if(sf.shipment_fee_type === 'P' && sf.fee_data_fixed === '1') {
        disabled.party_disabled = true
      }
    } else {
      disabled.party_disabled = true
      disabled.fee_disabled = true
      disabled.amount_disabled = true
      disabled.currency_disabled = true
    }
  } else {
    disabled.party_disabled = true
    disabled.fee_disabled = true
    disabled.amount_disabled = true
    disabled.currency_disabled = true
  }
    return disabled
  }