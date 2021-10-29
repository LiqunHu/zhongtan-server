const moment = require('moment')
const Decimal = require('decimal.js')
const numberToText = require('number2text')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const GLBConfig = require('../../../util/GLBConfig')
const opSrv = require('../../common/system/OperationPasswordServer')
const seq = require('../../../util/Sequence')

const tb_shipment_list = model.zhongtan_logistics_shipment_list
const tb_verification = model.zhongtan_logistics_verification
const tb_verification_freight = model.zhongtan_logistics_verification_freight
const tb_uploadfile = model.zhongtan_uploadfile
const tb_payment_extra = model.zhongtan_logistics_payment_extra
const tb_user = model.common_user

exports.initAct = async () => {
  let returnData = {}
  let queryStr = `select * from tbl_common_vendor where state = ? order by vendor_code, vendor_name`
  let replacements = [GLBConfig.ENABLE]
  let vendors = await model.simpleSelect(queryStr, replacements)
  let VENDOR = []
  if(vendors) {
    for(let v of vendors) {
      VENDOR.push({
        id: v.vendor_id,
        text: v.vendor_code + '-' + v.vendor_name
      })
    }
  }
  returnData.VENDOR = VENDOR
  returnData.RECEIPT_CURRENCY = GLBConfig.RECEIPT_CURRENCY
  returnData.RECEIVABLE_STATUS = GLBConfig.FREIGHT_RECEIVABLE_STATUS
  returnData.CASH_BANK_INFO = GLBConfig.CASH_BANK_INFO
  queryStr = `SELECT user_id, user_name FROM tbl_common_user WHERE state = '1' AND user_type = ? ORDER BY user_name`
  replacements = [GLBConfig.TYPE_CUSTOMER]
  returnData['COMMON_CUSTOMER'] = await model.simpleSelect(queryStr, replacements)
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}
  let queryWhere = await queryWhereJoin(doc)
  let queryStr = queryWhere.queryStr + ' ORDER BY ss.sort_date DESC, ss.shipment_list_bill_no, s.shipment_list_container_no'
  let result = await model.queryWithCount(doc, queryStr, queryWhere.replacements)
  returnData.total = result.count
  let rows = []
  if(result.data && result.data.length > 0) {
    // 应收状态 0：未添加，1：已添加，2：申请发票，3已开发票，4已开收据，5申请额外发票，6已开额外发票，7已开额外收据
    for(let d of result.data) {
      if(d.shipment_list_receivable_status === '2' || d.shipment_list_receivable_status === '3' || d.shipment_list_receivable_status === '5' || d.shipment_list_receivable_status === '6') {
        d._disabled = true
      } else {
        d._disabled = false
      }
      d._checked = false
      queryStr = `SELECT u.*, cu.user_name FROM tbl_zhongtan_uploadfile u LEFT JOIN tbl_common_user cu ON u.uploadfil_release_user_id = cu.user_id WHERE u.state = ? AND uploadfile_index1 IN (
                  SELECT logistics_verification_id FROM tbl_zhongtan_logistics_verification_freight WHERE state = ? AND shipment_list_id = ? AND logistics_freight_state = 'AP') 
                  AND api_name IN ('FREIGHT INVOICE', 'FREIGHT RECEIPT') ORDER BY uploadfile_id DESC`
      let replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, d.shipment_list_id]
      let paymentFiles = await model.simpleSelect(queryStr, replacements)
      let files = []
      if(paymentFiles) {
        for(let pf of paymentFiles) {
          files.push({
            filetype: pf.api_name,
            creater: pf.user_name,
            amount: pf.uploadfile_amount,
            currency: pf.uploadfile_currency,
            date: moment(pf.created_at).format('YYYY-MM-DD HH:mm:ss'),
            url: pf.uploadfile_url,
            file_id : pf.uploadfile_id,
            relation_id: pf.uploadfile_index1,
            invoice_no: pf.uploadfile_invoice_no,
            receipt_no: pf.uploadfile_receipt_no,
            customer_id: pf.uploadfile_customer_id
          })
        }
      }
      queryStr = `SELECT u.*, cu.user_name FROM tbl_zhongtan_uploadfile u LEFT JOIN tbl_common_user cu ON u.user_id = cu.user_id WHERE u.state = ? AND uploadfile_index1 IN (
        SELECT logistics_verification_id FROM tbl_zhongtan_logistics_verification_freight WHERE state = ? AND logistics_freight_state = 'AP' 
        AND shipment_list_id IN (SELECT payment_extra_id FROM tbl_zhongtan_logistics_payment_extra WHERE state = 1 AND payment_extra_type = 'R' AND payment_extra_status = '6' AND payment_extra_shipment_id = ?)) 
        AND api_name IN ('EXTRA INVOICE', 'EXTRA RECEIPT') ORDER BY uploadfile_id DESC`
      replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, d.shipment_list_id]
      let extraFiles = await model.simpleSelect(queryStr, replacements)
      if(extraFiles) {
        for(let ex of extraFiles) {
          files.push({
            filetype: ex.api_name,
            creater: ex.user_name,
            amount: ex.uploadfile_amount,
            currency: ex.uploadfile_currency,
            date: moment(ex.created_at).format('YYYY-MM-DD HH:mm:ss'),
            url: ex.uploadfile_url,
            file_id : ex.uploadfile_id,
            relation_id: ex.uploadfile_index1,
            receipt_no: ex.uploadfile_receipt_no,
            customer_id: ex.uploadfile_customer_id
          })
        }
      }
      d.files = files
      rows.push(d)
    }
  }
  returnData.rows = rows
  return common.success(returnData)
}

const queryWhereJoin = async (param) => {
  let queryStr = `select s.*, v.vendor_code as shipment_list_vendor_code, v.vendor_name as shipment_list_vendor_name, u.user_name as shipment_list_invoice_customer from tbl_zhongtan_logistics_shipment_list s 
                  left join (SELECT shipment_list_bill_no, IFNULL(shipment_list_discharge_date, shipment_list_depot_gate_out_date) AS sort_date FROM tbl_zhongtan_logistics_shipment_list GROUP BY shipment_list_bill_no) ss ON s.shipment_list_bill_no = ss.shipment_list_bill_no
                  left join tbl_common_vendor v on s.shipment_list_vendor = v.vendor_id 
                  left join tbl_common_user u on s.shipment_list_customer = u.user_id 
                  where s.state = ? and s.shipment_list_receivable_status in (?)`
  let replacements = [GLBConfig.ENABLE, ['3', '4', '5', '6', '7']] // 只查询已经开发票的单子
  let searchPara = param.searchPara
  if(searchPara) {
    if(searchPara.shipment_list_bill_no) {
      queryStr = queryStr + ' and s.shipment_list_bill_no like ? '
      replacements.push('%' + searchPara.shipment_list_bill_no + '%')
    }
    if(searchPara.shipment_list_container_no) {
      queryStr = queryStr + ' and s.shipment_list_container_no like ? '
      replacements.push('%' + searchPara.shipment_list_container_no + '%')
    }
    if(searchPara.shipment_list_cntr_owner) {
      queryStr = queryStr + ' and s.shipment_list_cntr_owner = ? '
      replacements.push(searchPara.shipment_list_cntr_owner)
    }
    if(searchPara.shipment_list_cargo_type) {
      queryStr = queryStr + ' and s.shipment_list_cargo_type = ? '
      replacements.push(searchPara.shipment_list_cargo_type)
    }
    if(searchPara.shipment_list_payment_status) {
      queryStr = queryStr + ' and s.shipment_list_payment_status = ? '
      replacements.push(searchPara.shipment_list_payment_status)
    }
    if(searchPara.shipment_list_business_type) {
      queryStr = queryStr + ' and s.shipment_list_business_type = ? '
      replacements.push(searchPara.shipment_list_business_type)
      if(searchPara.shipment_list_in_date && searchPara.shipment_list_in_date.length > 1) {
        if(searchPara.shipment_list_business_type === 'I') {
          queryStr = queryStr + ' and s.shipment_list_discharge_date >= ? and s.shipment_list_discharge_date <= ? '
        } else {
          queryStr = queryStr + ' and s.shipment_list_depot_gate_out_date >= ? and s.shipment_list_depot_gate_out_date <= ? '
        }
        replacements.push(searchPara.shipment_list_in_date[0])
        replacements.push(searchPara.shipment_list_in_date[1])
      }
      if(searchPara.shipment_list_out_date && searchPara.shipment_list_out_date.length > 1) {
        if(searchPara.shipment_list_business_type === 'I') {
          queryStr = queryStr + ' and s.shipment_list_empty_return_date >= ? and s.shipment_list_empty_return_date <= ? '
        } else {
          queryStr = queryStr + ' and s.shipment_list_loading_date >= ? and s.shipment_list_loading_date <= ? '
        }
        replacements.push(searchPara.shipment_list_out_date[0])
        replacements.push(searchPara.shipment_list_out_date[1])
      }
    } else {
      if(searchPara.shipment_list_in_date && searchPara.shipment_list_in_date.length > 1) {
        queryStr = queryStr + ' and ((s.shipment_list_discharge_date >= ? and s.shipment_list_discharge_date <= ?) OR (s.shipment_list_depot_gate_out_date >= ? and s.shipment_list_depot_gate_out_date <= ?)) '
        replacements.push(searchPara.shipment_list_in_date[0])
        replacements.push(searchPara.shipment_list_in_date[1])
        replacements.push(searchPara.shipment_list_in_date[0])
        replacements.push(searchPara.shipment_list_in_date[1])
      }
      if(searchPara.shipment_list_out_date && searchPara.shipment_list_out_date.length > 1) {
        queryStr = queryStr + ' and ((s.shipment_list_empty_return_date >= ? and s.shipment_list_empty_return_date <= ?) or (s.shipment_list_loading_date >= ? and s.shipment_list_loading_date <= ?)) '
        replacements.push(searchPara.shipment_list_out_date[0])
        replacements.push(searchPara.shipment_list_out_date[1])
        replacements.push(searchPara.shipment_list_in_date[0])
        replacements.push(searchPara.shipment_list_in_date[1])
      }
    }
    if(searchPara.shipment_list_vendor) {
      queryStr = queryStr + ' and s.shipment_list_vendor = ? '
      replacements.push(searchPara.shipment_list_vendor)
    }
    if(searchPara.shipment_list_customer) {
      queryStr = queryStr + ' and (s.shipment_list_customer = ? or s.shipment_list_extra_customer = ?) '
      replacements.push(searchPara.shipment_list_customer)
      replacements.push(searchPara.shipment_list_customer)
    }

    if(searchPara.shipment_list_invoice_no) {
      // 发票编号
      let like_invoice_no = '%' + searchPara.shipment_list_invoice_no + '%'
      queryStr = queryStr + ` and (s.shipment_list_id IN (SELECT lv.shipment_list_id FROM tbl_zhongtan_logistics_verification_freight lv LEFT JOIN tbl_zhongtan_uploadfile u ON lv.logistics_verification_id = u.uploadfile_index1 WHERE lv.state = 1 AND lv.logistics_freight_state = 'AP' AND u.api_name = 'FREIGHT INVOICE' AND u.state = 1 AND u.uploadfile_invoice_no LIKE ?) 
                OR s.shipment_list_id IN (SELECT lpe.payment_extra_shipment_id FROM tbl_zhongtan_logistics_payment_extra lpe LEFT JOIN tbl_zhongtan_logistics_verification_freight vf ON lpe.payment_extra_id = vf.shipment_list_id WHERE lpe.state = 1 AND lpe.payment_extra_type = 'R' AND lpe.payment_extra_status = '6' AND vf.state = 1 AND vf.logistics_freight_state = 'AP' AND vf.logistics_verification_id IN (SELECT uploadfile_index1 FROM tbl_zhongtan_uploadfile WHERE state = 1 AND api_name = 'EXTRA INVOICE' AND uploadfile_invoice_no LIKE ?))) `
      replacements.push(like_invoice_no)
      replacements.push(like_invoice_no)
    }

    if(searchPara.shipment_list_receipt_no) {
      // 收据编号
      let like_receipt_no = '%' + searchPara.shipment_list_receipt_no + '%'
      queryStr = queryStr + ` and (s.shipment_list_id IN (SELECT lv.shipment_list_id FROM tbl_zhongtan_logistics_verification_freight lv LEFT JOIN tbl_zhongtan_uploadfile u ON lv.logistics_verification_id = u.uploadfile_index1 WHERE lv.state = 1 AND lv.logistics_freight_state = 'AP' AND u.api_name = 'FREIGHT RECEIPT' AND u.state = 1 AND u.uploadfile_receipt_no LIKE ?) 
                OR s.shipment_list_id IN (SELECT lpe.payment_extra_shipment_id FROM tbl_zhongtan_logistics_payment_extra lpe LEFT JOIN tbl_zhongtan_logistics_verification_freight vf ON lpe.payment_extra_id = vf.shipment_list_id WHERE lpe.state = 1 AND lpe.payment_extra_type = 'R' AND lpe.payment_extra_status = '6' AND vf.state = 1 AND vf.logistics_freight_state = 'AP' AND vf.logistics_verification_id IN (SELECT uploadfile_index1 FROM tbl_zhongtan_uploadfile WHERE state = 1 AND api_name = 'EXTRA RECEIPT' AND uploadfile_receipt_no LIKE ?))) `
      replacements.push(like_receipt_no)
      replacements.push(like_receipt_no)
    }
  }
  return {
    queryStr: queryStr,
    replacements: replacements
  }
}

exports.exportAct = async (req, res) => {
  let doc = common.docValidate(req)
  let queryWhere = await queryWhereJoin(doc)
  let queryStr = queryWhere.queryStr + ' ORDER BY ss.sort_date DESC, ss.shipment_list_bill_no, s.shipment_list_container_no'
  let result = await model.simpleSelect(queryStr, queryWhere.replacements)

  let jsData = []
  let transits = []
  let imports = []
  for (let r of result) {
    if(r.shipment_list_business_type === 'I') {
      r.shipment_list_in_date = r.shipment_list_discharge_date
      r.shipment_list_out_date = r.shipment_list_empty_return_date
    } else {
      r.shipment_list_in_date = r.shipment_list_depot_gate_out_date
      r.shipment_list_out_date = r.shipment_list_loading_date
    }
    if(r.shipment_list_cargo_type === 'LOCAL') {
      r.shipment_list_cargo_type = 'IMPORT'
    }

    queryStr = `SELECT u.* FROM tbl_zhongtan_uploadfile u WHERE u.state = ? AND uploadfile_index1 IN (
      SELECT logistics_verification_id FROM tbl_zhongtan_logistics_verification_freight WHERE state = ? AND shipment_list_id = ? AND logistics_freight_state = 'AP') 
      AND api_name IN ('FREIGHT INVOICE') ORDER BY uploadfile_id DESC`
    let replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, r.shipment_list_id]
    let paymentFiles = await model.simpleSelect(queryStr, replacements)
    if(paymentFiles && paymentFiles.length > 0) {
      if(paymentFiles[0].uploadfile_invoice_no) {
        r.shipment_list_freight_invoice_no = paymentFiles[0].uploadfile_invoice_no
      }
      if(paymentFiles[0].uploadfile_receipt_no) {
        r.shipment_list_freight_receipt_no = paymentFiles[0].uploadfile_receipt_no
      }
    }
    if(r.shipment_list_payment_status === '3' || r.shipment_list_payment_status === '4') {
      r.shipment_list_freight_payable_usd = r.shipment_list_advance_payment
    } else if(r.shipment_list_payment_status === '5' || r.shipment_list_payment_status === '6' || r.shipment_list_payment_status === '7' || r.shipment_list_payment_status === '8') {
      r.shipment_list_freight_payable_usd = r.shipment_list_total_freight
    }
    if(r.shipment_list_total_freight_tzs) {
      r.shipment_list_freight_payable_tzs = r.shipment_list_total_freight_tzs
    }
    if(r.shipment_list_business_type === 'I') {
      imports.push(r)
    } else {
      transits.push(r)
    }
  }
  jsData.push(transits)
  jsData.push(imports)
  let filepath = await common.ejs2xlsx('LogisticsFreightReceipt.xlsx', jsData)
  res.sendFile(filepath)
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

exports.freightReceiptAct = async req => {
  let doc = common.docValidate(req), user = req.user, curDate = new Date()
  let invoice_file = await tb_uploadfile.findOne({
    where: {
      uploadfile_id: doc.file_id
    }
  })
  if(invoice_file) {
    try {
      let commonUser = await tb_user.findOne({
        where: {
          user_id: user.user_id
        }
      })
      let invoice_customer = await tb_user.findOne({
        where: {
          user_id: invoice_file.uploadfile_customer_id
        }
      })
      let shipment_list = []
      let renderData = {}
      let receipt_no = await seq.genLogisticsSeq('CT-L')
      renderData.freight_receipt_no = receipt_no
      renderData.receipt_date = moment().format('MMM DD, YYYY')
      renderData.freight_received_from = invoice_customer.user_name
      renderData.freight_receipt_currency = invoice_file.uploadfile_currency
      renderData.sum_fee = invoice_file.uploadfile_amount
      renderData.sum_fee_str = numberToText(invoice_file.uploadfile_amount, 'english')
      if (doc.freight_check_cash === 'CASH') {
        renderData.check_cash = 'Cash'
      } else if (doc.freight_check_cash === 'TRANSFER') {
        renderData.check_cash = 'Bank transfer/ ' + doc.freight_bank_reference_no
      } else {
        renderData.check_cash = 'Cheque/ ' + doc.freight_check_no
      }
      renderData.user_name = commonUser.user_name
      renderData.user_phone = commonUser.user_phone
      renderData.user_email = commonUser.user_email
      let api_name = 'FREIGHT RECEIPT'
      let queryStr = ''
      let replacements = []
      if(invoice_file.api_name === 'FREIGHT INVOICE') {
        queryStr = `SELECT * FROM tbl_zhongtan_logistics_shipment_list WHERE state = ? 
                        AND shipment_list_id IN (SELECT shipment_list_id FROM tbl_zhongtan_logistics_verification_freight WHERE logistics_verification_id = ?) 
                        order by shipment_list_bill_no`
        replacements = [GLBConfig.ENABLE, invoice_file.uploadfile_index1]
      } else if(invoice_file.api_name === 'EXTRA INVOICE') {
        api_name = 'EXTRA RECEIPT'
        queryStr = `SELECT * FROM tbl_zhongtan_logistics_shipment_list WHERE state = ? AND shipment_list_bill_no 
                      IN (SELECT payment_extra_bl_no FROM tbl_zhongtan_logistics_payment_extra WHERE state = ? AND  payment_extra_id 
                      IN (SELECT shipment_list_id FROM tbl_zhongtan_logistics_verification_freight WHERE state = ? AND logistics_verification_id = ?)) `
        replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE, GLBConfig.ENABLE, invoice_file.uploadfile_index1]
      }
      let smls = await model.simpleSelect(queryStr, replacements)
      if(smls) {
        let gbns = await common.groupingJson(smls, 'shipment_list_bill_no')
        if(gbns.length > 1) {
          renderData.freight_bl_nos = smls[0].shipment_list_bill_no + '  ETC'
        } else {
          renderData.freight_bl_nos = smls[0].shipment_list_bill_no
        }
        for(let s of smls) {
          shipment_list.push(s)
        }
      }
      invoice_file.uploadfile_receipt_no = receipt_no
      let fileInfo = await common.ejs2Pdf('freightReceipt.ejs', renderData, 'zhongtan')
      await tb_uploadfile.create({
        api_name: api_name,
        user_id: user.user_id,
        uploadfile_index1: invoice_file.uploadfile_index1,
        uploadfile_index3: invoice_file.uploadfile_id,
        uploadfile_name: fileInfo.name,
        uploadfile_url: fileInfo.url,
        uploadfile_acttype: 'receipt',
        uploadfile_amount: invoice_file.uploadfile_amount,
        uploadfile_currency: invoice_file.uploadfile_currency,
        uploadfile_check_cash: doc.freight_check_cash,
        uploadfile_check_no: doc.freight_check_no,
        uploadfile_bank_reference_no: doc.freight_bank_reference_no,
        uploadfile_customer_id: invoice_file.uploadfile_customer_id,
        uploadfile_received_from: invoice_customer.user_name,
        uploadfile_receipt_no: receipt_no,
        uploadfil_release_date: curDate,
        uploadfil_release_user_id: user.user_id
      })
      await invoice_file.save()
      for(let s of shipment_list) {
        let sp = await tb_shipment_list.findOne({
          where: {
            shipment_list_id: s.shipment_list_id,
            state: GLBConfig.ENABLE
          }
        })
        if(sp) {
          if(invoice_file.api_name === 'FREIGHT INVOICE') {
            sp.shipment_list_receivable_freight_receipt = moment().format('YYYY-MM-DD')
            sp.shipment_list_receivable_status = '4'
          } else if(invoice_file.api_name === 'EXTRA INVOICE') {
            if(invoice_file.uploadfile_currency === 'USD') {
              sp.shipment_list_receivable_extra_usd_receipt = moment().format('YYYY-MM-DD')
            } else {
              sp.shipment_list_receivable_extra_tzs_receipt = moment().format('YYYY-MM-DD')
            }
            sp.shipment_list_receivable_status = '7'
          }
          await sp.save()
        }
      }
      return common.success({ url: fileInfo.url })
    } catch(e) {
      return common.error('generate_file_01')
    }
  } else {
    return common.error('generate_file_01')
  }
}

exports.undoFreightAct = async req => {
  let doc = common.docValidate(req), user = req.user, curDate = new Date()
  let file = await tb_uploadfile.findOne({
    where: {
      uploadfile_id: doc.file_id,
      state: GLBConfig.ENABLE
    }
  })
  if(file) {
    file.state = GLBConfig.DISABLE
    await file.save()
  }
  let ver = await tb_verification.findOne({
    where: {
      logistics_verification_id: doc.relation_id,
      state: GLBConfig.ENABLE
    }
  })
  if(ver) {
    ver.logistics_verification_state = 'UN'
    ver.logistics_verification_undo_user = user.user_id
    ver.logistics_verification_undo_time = curDate
    await ver.save()
    let vfs = await tb_verification_freight.findAll({
      where: {
        logistics_verification_id: ver.logistics_verification_id,
        state: GLBConfig.ENABLE
      }
    })
    if(vfs) {
      for(let v of vfs) {
        v.logistics_freight_state = 'UN'
        await v.save()
        if(ver.logistics_verification_api_name === 'FREIGHT INVOICE') {
          let sp = await tb_shipment_list.findOne({
            where: {
              shipment_list_id: v.shipment_list_id,
              state: GLBConfig.ENABLE
            }
          })
          if(sp) {
            // 支付状态 0：未添加，1：已添加，2：申请预付，3预付支付，4申请余款，5余款支付，6申请额外费用，7额外费用支付
            sp.shipment_list_receivable_status = '0'
            sp.shipment_list_receivable_freight = null
            sp.shipment_list_receivable_freight_invoice = null
            sp.shipment_list_customer = null
            await sp.save()
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
            let sp = await tb_shipment_list.findOne({
              where: {
                shipment_list_id: extra.payment_extra_shipment_id,
                state: GLBConfig.ENABLE
              }
            })
            if(sp) {
              if(extra.payment_extra_amount_usd) {
                if(extra.payment_extra_amount_usd === sp.shipment_list_receivable_extra_usd) {
                  sp.shipment_list_receivable_extra_usd = null
                  sp.shipment_list_receivable_extra_usd_invoice = null
                } else {
                  sp.shipment_list_receivable_extra_usd = new Decimal(sp.shipment_list_receivable_extra_usd).sub(extra.payment_extra_amount_usd).toNumber()
                  let queryStr = `SELECT DATE_FORMAT(logistics_verification_manager_time, '%Y-%m-%d') AS payment_date 
                                  FROM tbl_zhongtan_logistics_verification WHERE state = 1 AND logistics_verification_api_name = 'PAYMENT EXTRA' AND logistics_verification_state = 'AP' 
                                  AND logistics_verification_id IN (SELECT logistics_verification_id FROM tbl_zhongtan_logistics_verification_freight WHERE state = 1 AND logistics_freight_api_name = 'EXTRA INVOICE' 
                                  AND shipment_list_id IN (SELECT MAX(payment_extra_id) FROM tbl_zhongtan_logistics_payment_extra WHERE state = 1 AND payment_extra_type = 'R' AND payment_extra_status = '6' 
                                  AND payment_extra_bl_no = ? AND payment_extra_amount_usd IS NOT NULL))`
                  let replacements = [sp.shipment_list_bill_no]
                  let apextras = await model.simpleSelect(queryStr, replacements)
                  if(apextras && apextras.length > 0) {
                    sp.shipment_list_receivable_extra_usd_invoice = apextras[0].payment_date
                  }
                }
              } else if(extra.payment_extra_amount_tzs){
                if(extra.payment_extra_amount_tzs === sp.shipment_list_receivable_extra_tzs) {
                  sp.shipment_list_receivable_extra_tzs = null
                  sp.shipment_list_receivable_extra_tzs_invoice = null
                } else {
                  sp.shipment_list_receivable_extra_tzs = new Decimal(sp.shipment_list_receivable_extra_tzs).sub(extra.payment_extra_amount_tzs).toNumber()
                  let queryStr = `SELECT DATE_FORMAT(logistics_verification_manager_time, '%Y-%m-%d') AS payment_date 
                                  FROM tbl_zhongtan_logistics_verification WHERE state = 1 AND logistics_verification_api_name = 'PAYMENT EXTRA' AND logistics_verification_state = 'AP' 
                                  AND logistics_verification_id IN (SELECT logistics_verification_id FROM tbl_zhongtan_logistics_verification_freight WHERE state = 1 AND logistics_freight_api_name = 'EXTRA EXTRA' 
                                  AND shipment_list_id IN (SELECT MAX(payment_extra_id) FROM tbl_zhongtan_logistics_payment_extra WHERE state = 1 AND payment_extra_type = 'R' AND payment_extra_status = '6' 
                                  AND payment_extra_bl_no = ? AND payment_extra_amount_tzs IS NOT NULL))`
                  let replacements = [sp.shipment_list_bill_no]
                  let apextras = await model.simpleSelect(queryStr, replacements)
                  if(apextras && apextras.length > 0) {
                    sp.shipment_list_receivable_extra_tzs_invoice = apextras[0].payment_date
                  }
                }
              }
              await sp.save()
            }
            let extra_file = await tb_uploadfile.findOne({
              where: {
                api_name: 'EXTRA EXTRA ATTACHMENT',
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

exports.checkPasswordAct = async req => {
  let doc = common.docValidate(req)
  let check = await opSrv.checkPassword(doc.action, doc.checkPassword)
  if(check) {
    return common.success()
  } else {
    return common.error('auth_24')
  }
}