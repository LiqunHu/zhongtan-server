const moment = require('moment')
const Decimal = require('decimal.js')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')
const numberToText = require('number2text')
const rateSrv = require('../configuration/ExchangeRateConfigServer')

const tb_user = model.common_user
const tb_verification = model.zhongtan_logistics_verification
const tb_verification_freight = model.zhongtan_logistics_verification_freight
const tb_shipment_list = model.zhongtan_logistics_shipment_list
const tb_uploadfile = model.zhongtan_uploadfile
const tb_payment_extra = model.zhongtan_logistics_payment_extra
const tb_vendor = model.common_vendor

exports.initAct = async () => {
  let returnData = {
    FREIGHT_STATE: GLBConfig.LOGISTICS_FREIGHT_STATE
  }
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `select v.*, c.user_name, 
                CASE WHEN LOCATE('INVOICE', v.logistics_verification_api_name) > 0 THEN
                  (SELECT user_name FROM tbl_common_user WHERE user_id = v.logistics_verification_vendor)
                ELSE
                  (SELECT vendor_name FROM tbl_common_vendor WHERE vendor_id = v.logistics_verification_vendor)
                END vendor
                from tbl_zhongtan_logistics_verification v 
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
      if(dd.logistics_verification_api_name === 'PAYMENT ADVANCE') {
        let ra = await tb_uploadfile.findAll({
          where: {
            api_name: 'PAYMENT ADVANCE ATTACHMENT',
            uploadfile_index1: dd.logistics_verification_id,
            state: GLBConfig.ENABLE
          }
        })
        if(ra) {
          dd.files = []
          for(let a of ra) {
            dd.files.push({
              url: a.uploadfile_url
            })
          }
        }
      } else if(dd.logistics_verification_api_name === 'PAYMENT BALANCE') {
        let ra = await tb_uploadfile.findAll({
          where: {
            api_name: 'PAYMENT BALANCE ATTACHMENT',
            uploadfile_index1: dd.logistics_verification_id,
            state: GLBConfig.ENABLE
          }
        })
        if(ra) {
          dd.files = []
          for(let a of ra) {
            dd.files.push({
              url: a.uploadfile_url
            })
          }
        }
      } else if(dd.logistics_verification_api_name === 'PAYMENT FULL') {
        let ra = await tb_uploadfile.findAll({
          where: {
            api_name: 'PAYMENT FULL ATTACHMENT',
            uploadfile_index1: dd.logistics_verification_id,
            state: GLBConfig.ENABLE
          }
        })
        if(ra) {
          dd.files = []
          for(let a of ra) {
            dd.files.push({
              url: a.uploadfile_url
            })
          }
        }
      }
      rows.push(dd)
    }
  }
  returnData.rows = rows
  return common.success(returnData)
}

exports.approveAct = async req => {
  let doc = common.docValidate(req),
    user = req.user, curDate = new Date()
  let ver = await tb_verification.findOne({
    where: {
      logistics_verification_id: doc.logistics_verification_id,
      state: GLBConfig.ENABLE
    }
  })
  if(ver) {
    ver.logistics_verification_state = 'AP'
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
      let payments = []
      let extras = []
      for(let v of vfs) {
        v.logistics_freight_state = 'AP'
        await v.save()
        if(ver.logistics_verification_api_name === 'PAYMENT ADVANCE' 
            || ver.logistics_verification_api_name === 'PAYMENT BALANCE' 
            || ver.logistics_verification_api_name === 'PAYMENT FULL' 
            || ver.logistics_verification_api_name === 'FREIGHT INVOICE') {
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
            } else if(ver.logistics_verification_api_name === 'PAYMENT BALANCE' || ver.logistics_verification_api_name === 'PAYMENT FULL') {
              pt.shipment_list_payment_status = '5'
              pt.shipment_list_balance_payment_date = moment().format('YYYY-MM-DD')
              await pt.save()
            } else if(ver.logistics_verification_api_name === 'FREIGHT INVOICE') {
              pt.shipment_list_receivable_status = '3'
              pt.shipment_list_receivable_freight_invoice = moment().format('YYYY-MM-DD')
              await pt.save()
            }
          }
        } else if(ver.logistics_verification_api_name === 'PAYMENT EXTRA') {
          let ex = await tb_payment_extra.findOne({
            where: {
              payment_extra_id: v.shipment_list_id,
              payment_extra_type: 'P',
              state: GLBConfig.ENABLE
            }
          })
          if(ex) {
            extras.push(ex)
            ex.payment_extra_status = '7'
            await ex.save()
            let shipment_list = await tb_shipment_list.findAll({
              where: {
                shipment_list_bill_no: ex.payment_extra_bl_no,
                state: GLBConfig.ENABLE
              }
            })
            if(shipment_list && shipment_list.length > 0) {
              for (let sl of shipment_list) {
                sl.shipment_list_payment_status = '7'
                if(sl.shipment_list_id == ex.payment_extra_shipment_id) {
                  if(ex.payment_extra_amount_usd) {
                    if(sl.shipment_list_extra_charges_usd) {
                      sl.shipment_list_extra_charges_usd = new Decimal(sl.shipment_list_extra_charges_usd).plus(ex.payment_extra_amount_usd).toNumber()
                    } else {
                      sl.shipment_list_extra_charges_usd = ex.payment_extra_amount_usd
                    }
                    sl.shipment_list_extra_charges_usd_date = moment().format('YYYY-MM-DD')
                    sl.shipment_list_total_freight = new Decimal(sl.shipment_list_advance_payment).plus(sl.shipment_list_balance_payment).plus(sl.shipment_list_extra_charges_usd).toNumber()
                  } else if(ex.payment_extra_amount_tzs) {
                    if(sl.shipment_list_extra_charges_tzs) {
                      sl.shipment_list_extra_charges_tzs = new Decimal(sl.shipment_list_extra_charges_tzs).plus(ex.payment_extra_amount_tzs).toNumber()
                    } else {
                      sl.shipment_list_extra_charges_tzs = ex.payment_extra_amount_tzs
                    }
                    sl.shipment_list_extra_charges_tzs_date = moment().format('YYYY-MM-DD')
                    sl.shipment_list_total_freight_tzs = sl.shipment_list_extra_charges_tzs
                  }
                }
                await sl.save()
              }
            }
          }
        } else if(ver.logistics_verification_api_name === 'EXTRA INVOICE') {
          let ex = await tb_payment_extra.findOne({
            where: {
              payment_extra_id: v.shipment_list_id,
              payment_extra_type: 'R',
              state: GLBConfig.ENABLE
            }
          })
          if(ex) {
            extras.push(ex)
            ex.payment_extra_status = '6'
            await ex.save()
            let shipment_list = await tb_shipment_list.findAll({
              where: {
                shipment_list_bill_no: ex.payment_extra_bl_no,
                state: GLBConfig.ENABLE
              }
            })
            if(shipment_list && shipment_list.length > 0) {
              for (let sl of shipment_list) {
                sl.shipment_list_receivable_status = '6'
                if(sl.shipment_list_id == ex.payment_extra_shipment_id) {
                  sl.shipment_list_extra_customer = ex.payment_extra_vendor
                  if(ex.payment_extra_amount_usd) {
                    if(sl.shipment_list_receivable_extra_usd) {
                      sl.shipment_list_receivable_extra_usd = new Decimal(sl.shipment_list_receivable_extra_usd).plus(ex.payment_extra_amount_usd).toNumber()
                    } else {
                      sl.shipment_list_receivable_extra_usd = ex.payment_extra_amount_usd
                    }
                    sl.shipment_list_receivable_extra_usd_invoice = moment().format('YYYY-MM-DD')
                  } else if(ex.payment_extra_amount_tzs) {
                    if(sl.shipment_list_receivable_extra_tzs) {
                      sl.shipment_list_receivable_extra_tzs = new Decimal(sl.shipment_list_receivable_extra_tzs).plus(ex.payment_extra_amount_tzs).toNumber()
                    } else {
                      sl.shipment_list_receivable_extra_tzs = ex.payment_extra_amount_tzs
                    }
                    sl.shipment_list_receivable_extra_tzs_invoice = moment().format('YYYY-MM-DD')
                  }
                }
                await sl.save()
              }
            }
          }
        }
      }
      // 生成对应支付单
      if(ver.logistics_verification_api_name === 'PAYMENT ADVANCE' 
            || ver.logistics_verification_api_name === 'PAYMENT BALANCE' 
            || ver.logistics_verification_api_name === 'PAYMENT FULL' 
            || ver.logistics_verification_api_name === 'PAYMENT EXTRA') {
        let vendor = await tb_vendor.findOne({
          where: {
            vendor_id: ver.logistics_verification_vendor
          }
        })
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
        renderData.payment_total_str = numberToText(ver.logistics_verification_amount, 'english')

        renderData.rate_currency = 'TZS'
        let rate = await rateSrv.getCurrentExchangeRateTZS(ver.logistics_verification_amount)
        renderData.current_rate =  common.formatAmountCurrency(rate.rate)
        renderData.rate_amount =  common.formatAmountCurrency(rate.amount)

        if(ver.logistics_verification_create_user) {
          let prepared = await tb_user.findOne({
            where: {
              user_id: ver.logistics_verification_create_user
            }
          })
          if(prepared) {
            renderData.prepared_by = prepared.user_name
          }
          renderData.prepared_time = moment(ver.created_at).format('YYYY-MM-DD HH:mm:ss')
        }
        if(ver.logistics_verification_section_user) {
          let section = await tb_user.findOne({
            where: {
              user_id: ver.logistics_verification_section_user
            }
          })
          if(section) {
            renderData.section_by = section.user_name
          }
          renderData.section_time = moment(ver.logistics_verification_section_time).format('YYYY-MM-DD HH:mm:ss')
        }
        if(ver.logistics_verification_manager_user) {
          let checked = await tb_user.findOne({
            where: {
              user_id: ver.logistics_verification_manager_user
            }
          })
          if(checked) {
            renderData.checked_by = checked.user_name
          }
          renderData.checked_time = moment(ver.logistics_verification_manager_time).format('YYYY-MM-DD HH:mm:ss')
        }
        if(ver.logistics_verification_business_user) {
          let approve = await tb_user.findOne({
            where: {
              user_id: ver.logistics_verification_business_user
            }
          })
          if(approve) {
            renderData.approve_by = approve.user_name
          }
          renderData.approve_time = moment(ver.logistics_verification_business_time).format('YYYY-MM-DD HH:mm:ss')
        }
        if(ver.logistics_verification_api_name === 'PAYMENT ADVANCE') {
          let payment_list = []
          let advance_percent = ''
          for(let p of payments) {
            payment_list.push({
              bl: p.shipment_list_bill_no,
              container_no: p.shipment_list_container_no,
              size_type: p.shipment_list_size_type,
              fnd: p.shipment_list_business_type === 'I' ?  p.shipment_list_port_of_destination : p.shipment_list_port_of_loading,
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
            uploadfil_release_user_id: user.user_id,
            uploadfile_amount_rate: renderData.current_rate
          })
        } else if(ver.logistics_verification_api_name === 'PAYMENT BALANCE') {
          let payment_list = []
          for(let p of payments) {
            payment_list.push({
              bl: p.shipment_list_bill_no,
              container_no: p.shipment_list_container_no,
              size_type: p.shipment_list_size_type,
              fnd: p.shipment_list_business_type === 'I' ?  p.shipment_list_port_of_destination : p.shipment_list_port_of_loading,
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
            uploadfil_release_user_id: user.user_id,
            uploadfile_amount_rate: renderData.current_rate
          })
        } else if(ver.logistics_verification_api_name === 'PAYMENT FULL') {
          let payment_list = []
          for(let p of payments) {
            payment_list.push({
              bl: p.shipment_list_bill_no,
              container_no: p.shipment_list_container_no,
              size_type: p.shipment_list_size_type,
              fnd: p.shipment_list_business_type === 'I' ?  p.shipment_list_port_of_destination : p.shipment_list_port_of_loading,
              amount: p.shipment_list_total_freight
            })
          }
          renderData.payment_list = payment_list
          let fileInfo = await common.ejs2Pdf('paymentFull.ejs', renderData, 'zhongtan')
          await tb_uploadfile.create({
            api_name: 'PAYMENT FULL',
            user_id: user.user_id,
            uploadfile_index1: ver.logistics_verification_id,
            uploadfile_name: fileInfo.name,
            uploadfile_url: fileInfo.url,
            uploadfile_acttype: 'full',
            uploadfile_amount: ver.logistics_verification_amount,
            uploadfile_currency: 'USD',
            uploadfile_received_from: vendor.vendor_name,
            uploadfile_customer_id: vendor.vendor_id,
            uploadfile_invoice_no: payment_no,
            uploadfil_release_date: curDate,
            uploadfil_release_user_id: user.user_id,
            uploadfile_amount_rate: renderData.current_rate
          })
        } else if(ver.logistics_verification_api_name === 'PAYMENT EXTRA') {
          let payment_list = []
          let extra_currency = 'USD'
          for(let e of extras) {
            payment_list.push({
              bl: e.payment_extra_bl_no,
              amount: e.payment_extra_amount_usd ? e.payment_extra_amount_usd : e.payment_extra_amount_tzs
            })
            extra_currency = e.payment_extra_amount_usd ? 'USD' : 'TZS'
          }
          renderData.payment_list = payment_list
          renderData.extra_currency = extra_currency

          if(renderData.extra_currency !== 'TZS') {
            renderData.rate_currency = 'TZS'
            let rate = await rateSrv.getCurrentExchangeRateTZS(ver.logistics_verification_amount)
            renderData.current_rate =  common.formatAmountCurrency(rate.rate)
            renderData.rate_amount =  common.formatAmountCurrency(rate.amount)
          } else {
            renderData.rate_currency = 'USD'
            let rate = await rateSrv.getCurrentExchangeRateUSD(ver.logistics_verification_amount)
            renderData.current_rate =  common.formatAmountCurrency(rate.rate)
            renderData.rate_amount =  common.formatAmountCurrency(rate.amount)
          }

          let fileInfo = await common.ejs2Pdf('paymentExtra.ejs', renderData, 'zhongtan')
          await tb_uploadfile.create({
            api_name: 'PAYMENT EXTRA',
            user_id: user.user_id,
            uploadfile_index1: ver.logistics_verification_id,
            uploadfile_name: fileInfo.name,
            uploadfile_url: fileInfo.url,
            uploadfile_acttype: 'extra',
            uploadfile_amount: ver.logistics_verification_amount,
            uploadfile_currency: extra_currency,
            uploadfile_received_from: vendor.vendor_name,
            uploadfile_customer_id: vendor.vendor_id,
            uploadfile_invoice_no: payment_no,
            uploadfil_release_date: curDate,
            uploadfil_release_user_id: user.user_id,
            uploadfile_amount_rate: renderData.current_rate
          })
        }
      } else if(ver.logistics_verification_api_name === 'FREIGHT INVOICE') {
        let customer = await tb_user.findOne({
          where: {
            user_id: ver.logistics_verification_vendor
          }
        })
        
        // 生成发票
        let freight_no = await seq.genLogisticsSeq('CT-L')
        let renderData = {}
        renderData.customer_name = customer ? customer.user_name : ''
        renderData.freight_no = freight_no
        renderData.freight_total = formatCurrency(ver.logistics_verification_amount)
        renderData.freight_total_str = numberToText(ver.logistics_verification_amount, 'english')
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
        let freight_list = []
        for(let p of payments) {
          let vendor_code = ''
          if(customer.user_name === 'COSCO SHIPPING LINES') {
            let vendor = await tb_vendor.findOne({
              where: {
                vendor_id: p.shipment_list_vendor
              }
            })
            if(vendor) {
              vendor_code = vendor.vendor_code
            }
          } else {
            vendor_code = 'CTJT'
          }
          freight_list.push({
            bl: p.shipment_list_bill_no,
            container_no: p.shipment_list_container_no,
            size_type: p.shipment_list_size_type,
            discharge_date: p.shipment_list_discharge_date,
            fnd: p.shipment_list_business_type === 'I' ?  p.shipment_list_port_of_destination : p.shipment_list_port_of_loading,
            amount: p.shipment_list_receivable_freight,
            vc: vendor_code
          })
        }
        renderData.freight_list = freight_list

        renderData.rate_currency = 'TZS'
        let rate = await rateSrv.getCurrentExchangeRateTZS(renderData.freight_total)
        renderData.current_rate =  common.formatAmountCurrency(rate.rate)
        renderData.rate_amount =  common.formatAmountCurrency(rate.amount)

        let fileInfo = await common.ejs2Pdf('freightInvoice.ejs', renderData, 'zhongtan')
        await tb_uploadfile.create({
          api_name: 'FREIGHT INVOICE',
          user_id: user.user_id,
          uploadfile_index1: ver.logistics_verification_id,
          uploadfile_name: fileInfo.name,
          uploadfile_url: fileInfo.url,
          uploadfile_acttype: 'invoice',
          uploadfile_amount: ver.logistics_verification_amount,
          uploadfile_currency: 'USD',
          uploadfile_received_from: customer.user_name,
          uploadfile_customer_id: customer.user_id,
          uploadfile_invoice_no: freight_no,
          uploadfil_release_date: curDate,
          uploadfil_release_user_id: user.user_id,
          uploadfile_amount_rate: renderData.current_rate
        })
      } else if(ver.logistics_verification_api_name === 'EXTRA INVOICE') {
        let customer = await tb_user.findOne({
          where: {
            user_id: ver.logistics_verification_vendor
          }
        })
        // 生成发票
        let freight_no = await seq.genLogisticsSeq('CT-L')
        let renderData = {}
        renderData.customer_name = customer ? customer.user_name : ''
        renderData.freight_no = freight_no
        renderData.freight_total = formatCurrency(ver.logistics_verification_amount)
        renderData.freight_total_str = numberToText(ver.logistics_verification_amount, 'english')
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
        let freight_list = []
        let extra_currency = 'USD'
        for(let e of extras) {
          freight_list.push({
            bl: e.payment_extra_bl_no,
            amount: e.payment_extra_amount_usd ? e.payment_extra_amount_usd : e.payment_extra_amount_tzs
          })
          extra_currency = e.payment_extra_amount_usd ? 'USD' : 'TZS'
        }
        renderData.freight_list = freight_list
        renderData.extra_currency = extra_currency

        if(renderData.extra_currency !== 'TZS') {
          renderData.rate_currency = 'TZS'
          let rate = await rateSrv.getCurrentExchangeRateTZS(renderData.freight_total)
          renderData.current_rate =  common.formatAmountCurrency(rate.rate)
          renderData.rate_amount =  common.formatAmountCurrency(rate.amount)
        } else {
          renderData.rate_currency = 'USD'
          let rate = await rateSrv.getCurrentExchangeRateUSD(renderData.freight_total)
          renderData.current_rate =  common.formatAmountCurrency(rate.rate)
          renderData.rate_amount =  common.formatAmountCurrency(rate.amount)
        }

        let fileInfo = await common.ejs2Pdf('freightExtra.ejs', renderData, 'zhongtan')
        await tb_uploadfile.create({
          api_name: 'EXTRA INVOICE',
          user_id: user.user_id,
          uploadfile_index1: ver.logistics_verification_id,
          uploadfile_name: fileInfo.name,
          uploadfile_url: fileInfo.url,
          uploadfile_acttype: 'invoice',
          uploadfile_amount: ver.logistics_verification_amount,
          uploadfile_currency: extra_currency,
          uploadfile_received_from: customer.user_name,
          uploadfile_customer_id: customer.user_id,
          uploadfile_invoice_no: freight_no,
          uploadfil_release_date: curDate,
          uploadfil_release_user_id: user.user_id,
          uploadfile_amount_rate: renderData.current_rate
        })
      }
    }
  }
  return common.success()
}

exports.declineAct = async req => {
  let doc = common.docValidate(req),
    user = req.user, curDate = new Date()
  let ver = await tb_verification.findOne({
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
        if(ver.logistics_verification_api_name === 'PAYMENT ADVANCE' 
            || ver.logistics_verification_api_name === 'PAYMENT BALANCE' 
            || ver.logistics_verification_api_name === 'PAYMENT FULL' 
            || ver.logistics_verification_api_name === 'FREIGHT INVOICE') {
          let sp = await tb_shipment_list.findOne({
            where: {
              shipment_list_id: v.shipment_list_id,
              state: GLBConfig.ENABLE
            }
          })
          if(sp) {
            if(ver.logistics_verification_api_name === 'PAYMENT ADVANCE' || ver.logistics_verification_api_name === 'PAYMENT FULL') {
              sp.shipment_list_payment_status = '1'
            } else if(ver.logistics_verification_api_name === 'PAYMENT BALANCE') {
              sp.shipment_list_payment_status = '3'
            } else if(ver.logistics_verification_api_name === 'FREIGHT INVOICE') {
              sp.shipment_list_receivable_status = '1'
            }
            await sp.save()
          }
        } else if(ver.logistics_verification_api_name === 'PAYMENT EXTRA') {
          let extra = await tb_payment_extra.findOne({
            where: {
              payment_extra_id: v.shipment_list_id,
              payment_extra_type: 'P',
              state: GLBConfig.ENABLE
            }
          })
          if(extra) {
            extra.state = GLBConfig.DISABLE
            await extra.save()
            let extra_file = await tb_uploadfile.findOne({
              where: {
                api_name: 'PAYMENT EXTRA ATTACHMENT',
                uploadfile_index1: extra.payment_extra_id,
                state: GLBConfig.ENABLE
              }
            })
            if(extra_file) {
              extra_file.state = GLBConfig.DISABLE
              await extra_file.save()
            }
          }
          let exist_extras = await tb_payment_extra.findAll({
            where: {
              payment_extra_bl_no: extra.payment_extra_bl_no,
              payment_extra_type: 'P',
              state: GLBConfig.ENABLE
            }
          })
          let shipment_list = await tb_shipment_list.findAll({
            where: {
              shipment_list_bill_no: extra.payment_extra_bl_no,
              state: GLBConfig.ENABLE
            }
          })
          if(shipment_list && shipment_list.length > 0) {
            for (let sl of shipment_list) {
              if(!exist_extras || exist_extras.length <= 0) {
                sl.shipment_list_payment_status = '5'
              } else {
                sl.shipment_list_payment_status = '7'
              }
              await sl.save()
            }
          }
        } else if(ver.logistics_verification_api_name === 'EXTRA INVOICE') {
          let extra = await tb_payment_extra.findOne({
            where: {
              payment_extra_id: v.shipment_list_id,
              payment_extra_type: 'R',
              state: GLBConfig.ENABLE
            }
          })
          if(extra) {
            extra.state = GLBConfig.DISABLE
            await extra.save()
            let extra_file = await tb_uploadfile.findOne({
              where: {
                api_name: 'EXTRA INVOICE ATTACHMENT',
                uploadfile_index1: extra.payment_extra_id,
                state: GLBConfig.ENABLE
              }
            })
            if(extra_file) {
              extra_file.state = GLBConfig.DISABLE
              await extra_file.save()
            }
          }
          let exist_extras = await tb_payment_extra.findAll({
            where: {
              payment_extra_bl_no: extra.payment_extra_bl_no,
              payment_extra_type: 'R',
              state: GLBConfig.ENABLE
            }
          })
          let shipment_list = await tb_shipment_list.findAll({
            where: {
              shipment_list_bill_no: extra.payment_extra_bl_no,
              state: GLBConfig.ENABLE
            }
          })
          if(shipment_list && shipment_list.length > 0) {
            for (let sl of shipment_list) {
              if(!exist_extras || exist_extras.length <= 0) {
                sl.shipment_list_receivable_status = '4'
              } else {
                sl.shipment_list_receivable_status = '7'
              }
              await sl.save()
            }
          }
        }
      } 
    }
  }
  return common.success()
}

exports.verificationDetailAct = async req => {
  let doc = common.docValidate(req)
  let ver = await tb_verification.findOne({
    where: {
      logistics_verification_id: doc.logistics_verification_id,
      state: GLBConfig.ENABLE
    }
  })
  let returnData = []
  if(ver) {
    // 托单审核
    if(ver.logistics_verification_api_name === 'PAYMENT ADVANCE' || ver.logistics_verification_api_name === 'PAYMENT BALANCE' || ver.logistics_verification_api_name === 'PAYMENT FULL') {
      let queryStr = `SELECT sl.*, CONCAT(cv.vendor_code, '/', cv.vendor_name) AS vendor FROM tbl_zhongtan_logistics_verification_freight vf 
                      LEFT JOIN tbl_zhongtan_logistics_shipment_list sl ON vf.shipment_list_id = sl.shipment_list_id 
                      LEFT JOIN tbl_common_vendor cv ON sl.shipment_list_vendor = cv.vendor_id WHERE vf.state = 1 AND vf.logistics_verification_id = ?`
      let replacements = [doc.logistics_verification_id]
      returnData = await model.simpleSelect(queryStr, replacements)
    } else if(ver.logistics_verification_api_name === 'PAYMENT EXTRA') {
      let queryStr = `SELECT pe.*, CONCAT(cv.vendor_code, '/', cv.vendor_name) AS vendor FROM tbl_zhongtan_logistics_verification_freight vf 
                      LEFT JOIN tbl_zhongtan_logistics_payment_extra pe ON vf.shipment_list_id = pe.payment_extra_id AND pe.payment_extra_type = 'P'
                      LEFT JOIN tbl_common_vendor cv ON pe.payment_extra_vendor = cv.vendor_id WHERE vf.state = 1 AND vf.logistics_verification_id = ?`
      let replacements = [doc.logistics_verification_id]
      let extras = await model.simpleSelect(queryStr, replacements)
      if(extras) {
        for(let e of extras) {
          let ej = JSON.parse(JSON.stringify(e))
          let ea = await tb_uploadfile.findAll({
            where: {
              api_name: 'PAYMENT EXTRA ATTACHMENT',
              uploadfile_index1: ej.payment_extra_id,
              state: GLBConfig.ENABLE
            }
          })
          ej.files = []
          if(ea) {
            for(let a of ea) {
              ej.files.push({
                url: a.uploadfile_url
              })
            }
          }
          returnData.push(ej)
        }
      }
    } else if(ver.logistics_verification_api_name === 'FREIGHT INVOICE') {
      let queryStr = `SELECT sl.*, cv.user_name AS vendor FROM tbl_zhongtan_logistics_verification_freight vf 
                      LEFT JOIN tbl_zhongtan_logistics_shipment_list sl ON vf.shipment_list_id = sl.shipment_list_id 
                      LEFT JOIN tbl_common_user cv ON sl.shipment_list_customer = cv.user_id WHERE vf.state = 1 AND vf.logistics_verification_id = ?`
      let replacements = [doc.logistics_verification_id]
      returnData = await model.simpleSelect(queryStr, replacements)
    } else if(ver.logistics_verification_api_name === 'EXTRA INVOICE') {
      let queryStr = `SELECT pe.*, cv.user_name AS vendor FROM tbl_zhongtan_logistics_verification_freight vf 
                      LEFT JOIN tbl_zhongtan_logistics_payment_extra pe ON vf.shipment_list_id = pe.payment_extra_id AND pe.payment_extra_type = 'R'
                      LEFT JOIN tbl_common_user cv ON pe.payment_extra_vendor = cv.user_id WHERE vf.state = 1 AND vf.logistics_verification_id = ?`
      let replacements = [doc.logistics_verification_id]
      let extras = await model.simpleSelect(queryStr, replacements)
      if(extras) {
        for(let e of extras) {
          let ej = JSON.parse(JSON.stringify(e))
          let ea = await tb_uploadfile.findAll({
            where: {
              api_name: 'EXTRA INVOICE ATTACHMENT',
              uploadfile_index1: ej.payment_extra_id,
              state: GLBConfig.ENABLE
            }
          })
          ej.files = []
          if(ea) {
            for(let a of ea) {
              ej.files.push({
                url: a.uploadfile_url
              })
            }
          }
          returnData.push(ej)
        }
      }
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