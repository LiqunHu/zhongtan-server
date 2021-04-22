const moment = require('moment')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')
const numberToText = require('number2text')

const tb_user = model.common_user
const tb_verificatione = model.zhongtan_logistics_verification
const tb_verification_freight = model.zhongtan_logistics_verification_freight
const tb_shipment_list = model.zhongtan_logistics_shipment_list
const tb_vendor = model.common_vendor
const tb_uploadfile = model.zhongtan_uploadfile

exports.initAct = async () => {
  let returnData = {
    FREIGHT_STATE: GLBConfig.LOGISTICS_FREIGHT_STATE
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
    ver.logistics_verification_state = 'AP'
    ver.logistics_verification_manager_user = user.user_id
    ver.logistics_verification_manager_time = curDate
    await ver.save()
    let vendor = await tb_vendor.findOne({
      where: {
        vendor_id: ver.logistics_verification_vendor
      }
    })
    let vfs = await tb_verification_freight.findAll({
      where: {
        logistics_verification_id: ver.logistics_verification_id,
        state: GLBConfig.ENABLE
      }
    })
    if(vfs) {
      let payments = []
      for(let v of vfs) {
        v.logistics_freight_state = 'AP'
        await v.save()
        let pt = await tb_shipment_list.findOne({
          where: {
            shipment_list_id: v.shipment_list_id,
            state: GLBConfig.ENABLE
          }
        })
        if(pt) {
          payments.push(pt)
          // 支付状态 0：未添加，1：已添加，2：申请预付，3预付支付，4申请余款，5余款支付，6申请额外费用，7额外费用支付
          if(ver.logistics_verification_api_name === 'PAYMENT ADVANCE') {
            pt.shipment_list_payment_status = '3'
            pt.shipment_list_advance_payment_date = moment().format('YYYY-MM-DD')
            await pt.save()
          } else if(ver.logistics_verification_api_name === 'PAYMENT BALANCE') {
            pt.shipment_list_payment_status = '5'
            pt.shipment_list_balance_payment_date = moment().format('YYYY-MM-DD')
            await pt.save()
          } else if(ver.logistics_verification_api_name === 'PAYMENT EXTRA') {
            // TODO
            // pt.shipment_list_payment_status = '7'
            // pt.shipment_list_advance_payment_date = moment().format('YYYY-MM-DD')
            // await pt.save()
          }
        }
      }
      // 生成对应支付单
      if(ver.logistics_verification_api_name === 'PAYMENT ADVANCE' || ver.logistics_verification_api_name === 'PAYMENT BALANCE') {
        let payment_no = await seq.genLogisticsSeq('CT-L')
        let renderData = {}
        renderData.vendor_code = vendor.vendor_code
        renderData.vendor_name = vendor.vendor_name
        renderData.vendor_bank_name = vendor.vendor_bank_name
        renderData.vendor_bank_address = vendor.vendor_bank_address
        renderData.vendor_account_no = vendor.vendor_bank_account
        renderData.vendor_swift_code = vendor.vendor_swift_code
        renderData.payment_no = payment_no
        renderData.payment_total = formatCurrency(ver.logistics_verification_amount)
        renderData.payment_total_str = numberToText(ver.logistics_verification_amount)
        if(ver.logistics_verification_create_user) {
          let prepared = await tb_user.findOne({
            where: {
              user_id: ver.logistics_verification_create_user
            }
          })
          if(prepared) {
            renderData.prepared_by = prepared.user_name
          }
        }
        if(ver.logistics_verification_business_user) {
          let checked = await tb_user.findOne({
            where: {
              user_id: ver.logistics_verification_business_user
            }
          })
          if(checked) {
            renderData.checked_by = checked.user_name
          }
        }
        if(ver.logistics_verification_manager_user) {
          let approve = await tb_user.findOne({
            where: {
              user_id: ver.logistics_verification_manager_user
            }
          })
          if(approve) {
            renderData.approve_by = approve.user_name
          }
        }
        if(ver.logistics_verification_api_name === 'PAYMENT ADVANCE') {
          let payment_list = []
          let advance_percent = ''
          for(let p of payments) {
            payment_list.push({
              bl: p.shipment_list_bill_no,
              container_no: p.shipment_list_container_no,
              size_type: p.shipment_list_size_type,
              fnd: p.shipment_list_business_type === 'I' ? 'TZDAR' : p.shipment_list_port_of_loading,
              amount: p.shipment_list_advance_payment
            })
            advance_percent = p.shipment_list_advance_percent + '%'
          }
          renderData.payment_list = payment_list
          renderData.advance_percent = advance_percent
          let fileInfo = await common.ejs2Pdf('paymentAdvance.ejs', renderData, 'zhongtan')
          await tb_uploadfile.create({
            api_name: 'PAYMENT ADVANCE',
            user_id: user.user_id,
            uploadfile_index1: ver.logistics_verification_id,
            uploadfile_name: fileInfo.name,
            uploadfile_url: fileInfo.url,
            uploadfile_acttype: 'advance',
            uploadfile_amount: ver.logistics_verification_amount,
            uploadfile_currency: 'USD',
            uploadfile_received_from: vendor.vendor_name,
            uploadfile_customer_id: vendor.vendor_id,
            uploadfile_invoice_no: payment_no,
            uploadfil_release_date: curDate,
            uploadfil_release_user_id: user.user_id
          })
        } else if(ver.logistics_verification_api_name === 'PAYMENT BALANCE') {
          let payment_list = []
          for(let p of payments) {
            payment_list.push({
              bl: p.shipment_list_bill_no,
              container_no: p.shipment_list_container_no,
              size_type: p.shipment_list_size_type,
              fnd: p.shipment_list_business_type === 'I' ? 'TZDAR' : p.shipment_list_port_of_loading,
              amount: p.shipment_list_balance_payment
            })
          }
          renderData.payment_list = payment_list
          let fileInfo = await common.ejs2Pdf('paymentBalance.ejs', renderData, 'zhongtan')
          await tb_uploadfile.create({
            api_name: 'PAYMENT BALANCE',
            user_id: user.user_id,
            uploadfile_index1: ver.logistics_verification_id,
            uploadfile_name: fileInfo.name,
            uploadfile_url: fileInfo.url,
            uploadfile_acttype: 'balance',
            uploadfile_amount: ver.logistics_verification_amount,
            uploadfile_currency: 'USD',
            uploadfile_received_from: vendor.vendor_name,
            uploadfile_customer_id: vendor.vendor_id,
            uploadfile_invoice_no: payment_no,
            uploadfil_release_date: curDate,
            uploadfil_release_user_id: user.user_id
          })
        }
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
    ver.logistics_verification_state = 'MD'
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
        v.logistics_freight_state = 'MD'
        await v.save()
        let sp = await tb_shipment_list.findOne({
          where: {
            shipment_list_id: v.shipment_list_id,
            state: GLBConfig.ENABLE
          }
        })
        if(sp) {
          sp.shipment_list_payment_status = '1'
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

function formatCurrency(num) {
  num = num.toString().replace(/[^\d.-]/g, '') //转成字符串并去掉其中除数字, . 和 - 之外的其它字符。
  if (isNaN(num)) num = '0' //是否非数字值
  let sign = num == (num = Math.abs(num))
  num = Math.floor(num * 100 + 0.50000000001) //下舍入
  let cents = num % 100 //求余 余数 = 被除数 - 除数 * 商
  cents = cents < 10 ? '0' + cents : cents //小于2位数就补齐
  num = Math.floor(num / 100).toString()
  for (let i = 0; i < Math.floor((num.length - (1 + i)) / 3); i++) {
    //每隔三位小数分始开隔
    //4 ==> 三位小数加一个分隔符，
    num = num.substring(0, num.length - (4 * i + 3)) + ',' + num.substring(num.length - (4 * i + 3))
  }
  return (sign ? '' : '-') + num + '.' + cents
}