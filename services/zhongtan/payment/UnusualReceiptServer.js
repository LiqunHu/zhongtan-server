const Decimal = require('decimal.js')
const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const opSrv = require('../../common/system/OperationPasswordServer')
const seq = require('../../../util/Sequence')
const numberToText = require('number2text')

const tb_unusual_invoice = model.zhongtan_unusual_invoice
const tb_uploadfile = model.zhongtan_uploadfile
const tb_user = model.common_user
const tb_bank_info = model.zhongtan_bank_info

exports.initAct = async () => {
  let returnData = {}
  returnData.CASH_BANK_INFO = GLBConfig.CASH_BANK_INFO
  returnData.CARGO_TYPE = GLBConfig.MNR_CARGO_TYPE
  returnData.UNUSUAL_STATUS = GLBConfig.UNUSUAL_STATUS
  let queryStr = `SELECT user_id, user_name, user_address, user_tin FROM tbl_common_user WHERE state = '1' AND user_type = ? ORDER BY user_name`
  let replacements = [GLBConfig.TYPE_CUSTOMER]
  returnData.COMMON_CUSTOMER = await model.simpleSelect(queryStr, replacements)

  queryStr = `SELECT payment_items_code, payment_items_name FROM tbl_zhongtan_payment_items WHERE state = '1' ORDER BY payment_items_code`
  replacements = []
  returnData.UNUSUAL_ITEMS = await model.simpleSelect(queryStr, replacements)

  returnData.VESSELS = []
  queryStr = `SELECT CONCAT(invoice_vessel_name, '/',invoice_vessel_voyage) AS vessel_voyage FROM tbl_zhongtan_invoice_vessel WHERE state = 1 GROUP BY invoice_vessel_name, invoice_vessel_voyage ORDER BY STR_TO_DATE(invoice_vessel_ata, '%d/%m/%Y') DESC;`
  replacements = []
  let imVs = await model.simpleSelect(queryStr, replacements)
  if(imVs) {
    for(let i of imVs) {
      returnData.VESSELS.push(i)
    }
  }
  queryStr = `SELECT CONCAT(export_vessel_name, '/',export_vessel_voyage) AS vessel_voyage FROM tbl_zhongtan_export_vessel WHERE state = 1 GROUP BY export_vessel_name, export_vessel_voyage ORDER BY STR_TO_DATE(export_vessel_etd, '%d/%m/%Y') DESC;`
  replacements = []
  let exVs = await model.simpleSelect(queryStr, replacements)
  if(exVs) {
    for(let e of exVs) {
      returnData.VESSELS.push(e)
    }
  }
  let BANK_INFOS = []
  let banks = await tb_bank_info.findAll({
    where: {
      state: GLBConfig.ENABLE
    }
  })
  if(banks && banks.length > 0) {
    for(let b of banks) {
      BANK_INFOS.push({
        bank_code: b.bank_code,
        bank_name: b.bank_name
      })
    }
  }
  returnData.BANK_INFOS = BANK_INFOS
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select ui.*, CONCAT(ui.unusual_invoice_vessel, '/', ui.unusual_invoice_voyaga) AS unusual_invoice_vessel_voyage, cb.user_name as unusual_invoice_party_name, cb.user_address as unusual_invoice_party_address, cb.user_tin as unusual_invoice_party_tin, pi.payment_items_name as unusual_invoice_items_name
                  from tbl_zhongtan_unusual_invoice ui left join tbl_common_user cb on ui.unusual_invoice_party = cb.user_id 
                  left join tbl_zhongtan_payment_items pi on ui.unusual_invoice_items = pi.payment_items_code
                  where ui.state = ? and unusual_invoice_status in (?) `
  let replacements = []
  replacements.push(GLBConfig.ENABLE)
  replacements.push(['2', '3'])
  let search_data = doc.search_data
  if(search_data) {
    if (search_data.unusual_invoice_no) {
      queryStr += ' and unusual_invoice_no like ?'
      replacements.push('%' + search_data.unusual_invoice_no + '%')
    }
    if (search_data.unusual_receipt_no) {
      queryStr += ' and unusual_receipt_no like ?'
      replacements.push('%' + search_data.unusual_receipt_no + '%')
    }
    if (search_data.unusual_invoice_bl) {
      queryStr += ' and unusual_invoice_bl like ?'
      replacements.push('%' + search_data.unusual_invoice_bl + '%')
    }
  
    if (search_data.unusual_invoice_cargo_type) {
      queryStr += ' and unusual_invoice_cargo_type = ?'
      replacements.push(search_data.unusual_invoice_cargo_type)
    }
  
    if (search_data.unusual_invoice_items) {
      queryStr += ' and unusual_invoice_items = ?'
      replacements.push(search_data.unusual_invoice_items)
    }
  
    if (search_data.unusual_invoice_party) {
      queryStr += ' and unusual_invoice_party = ?'
      replacements.push(search_data.unusual_invoice_party)
    }
  }

  queryStr += ' order by unusual_invoice_id desc'
  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  let rows = []
  if(result.data) {
    for(let d of result.data) {
      if(d.unusual_invoice_status === '2' || d.unusual_invoice_status === '3') {
        d.unusual_invoice_files = await tb_uploadfile.findOne({
          where: {
            uploadfile_index1: d.unusual_invoice_id,
            api_name: 'UNUSUAL INVOICE',
            state: GLBConfig.ENABLE
          }
        })
        d.unusual_receipt_files = await tb_uploadfile.findOne({
          where: {
            uploadfile_index1: d.unusual_invoice_id,
            api_name: 'UNUSUAL RECEIPT',
            state: GLBConfig.ENABLE
          }
        })
      }
      rows.push(d)
    }
  }
  returnData.rows = rows
  return common.success(returnData)
}

exports.receiptAct = async req => {
  let doc = common.docValidate(req), user = req.user, curDate = new Date()

  if(doc.unusual_receipt_check_cash === 'TRANSFER' && !doc.unusual_receipt_bank_info) {
    // && moment().isAfter(moment('2023-12-31', 'YYYY/MM/DD'))
    return common.error('import_14')
  }
  let commonUser = await tb_user.findOne({
    where: {
      user_id: user.user_id
    }
  })
  let ifile = doc.unusual_invoice_files
  let unusal = await tb_unusual_invoice.findOne({
    where: {
      unusual_invoice_id: doc.unusual_invoice_id
    }
  })
  let receipt_no = 'U' + await seq.genUnusualSeq()
  let renderData = {}
  renderData.unusual_receipt_no = receipt_no
  renderData.unusual_receipt_date = moment().format('MMM DD, YYYY')
  renderData.unusual_receipt_party = doc.unusual_invoice_party_name
  renderData.unusual_receipt_currency = 'USD'
  renderData.unusual_receipt_bl = unusal.unusual_invoice_bl
  if (doc.unusual_receipt_check_cash === 'CASH') {
    renderData.check_cash = 'Cash'
  } else if (doc.unusual_receipt_check_cash === 'TRANSFER') {
    renderData.check_cash = 'Bank transfer(' + doc.unusual_receipt_bank_info + ')/ ' + doc.unusual_receipt_bank_reference_no
  } else {
    renderData.check_cash = 'Cheque/ ' + doc.unusual_receipt_check_no
  }
  renderData.unusual_receipt_sum_fee = parseFloat(unusal.unusual_invoice_amount.replace(/,/g, '') || 0)
  if(renderData.unusual_receipt_sum_fee >= 0) {
    renderData.unusual_receipt_sum_fee_str = numberToText(renderData.unusual_receipt_sum_fee, 'english')
  } else {
    renderData.unusual_receipt_sum_fee_str = 'MINUS ' + numberToText(new Decimal(renderData.unusual_receipt_sum_fee).absoluteValue(), 'english')
  }
  renderData.user_name = commonUser.user_name
  renderData.user_phone = commonUser.user_phone
  renderData.user_email = commonUser.user_email
  try {
    let fileInfo = await common.ejs2Pdf('unusualReceipt.ejs', renderData, 'zhongtan')
    await tb_uploadfile.create({
      api_name: 'UNUSUAL RECEIPT',
      user_id: user.user_id,
      uploadfile_index1: doc.unusual_invoice_id,
      uploadfile_index3: ifile.uploadfile_id,
      uploadfile_name: fileInfo.name,
      uploadfile_url: fileInfo.url,
      uploadfile_acttype: 'unusual',
      uploadfile_amount: unusal.unusual_invoice_amount,
      uploadfile_currency: 'USD',
      uploadfile_check_cash: doc.unusual_receipt_check_cash ? doc.unusual_receipt_check_cash : '',
      uploadfile_check_no: doc.unusual_receipt_check_no ? doc.unusual_receipt_check_no : '',
      uploadfile_received_from: doc.unusual_invoice_party_name,
      uploadfile_customer_id: doc.unusual_invoice_party,
      uploadfile_receipt_no: receipt_no,
      uploadfil_release_date: curDate,
      uploadfil_release_user_id: user.user_id,
      uploadfile_bank_reference_no: doc.unusual_receipt_bank_reference_no ? doc.unusual_receipt_bank_reference_no : '',
      uploadfile_bank_info: doc.unusual_receipt_bank_info
    })
    unusal.unusual_invoice_status = '3'
    unusal.unusual_receipt_no = receipt_no
    unusal.unusual_receipt_date = moment().format('YYYY/MM/DD HH:mm:ss')
    await unusal.save()
    return common.success({ url: fileInfo.url })
  } catch(e) {
    return common.error('generate_file_01')
  }
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

exports.exportAct = async (req, res) => {
  let doc = common.docValidate(req)
  let queryStr = `select ui.*, CONCAT(ui.unusual_invoice_vessel, '/', ui.unusual_invoice_voyaga) AS unusual_invoice_vessel_voyage, cb.user_name as unusual_invoice_party_name, cb.user_address as unusual_invoice_party_address, cb.user_tin as unusual_invoice_party_tin, pi.payment_items_name as unusual_invoice_items_name
                  from tbl_zhongtan_unusual_invoice ui left join tbl_common_user cb on ui.unusual_invoice_party = cb.user_id 
                  left join tbl_zhongtan_payment_items pi on ui.unusual_invoice_items = pi.payment_items_code
                  where ui.state = ? and unusual_invoice_status in (?) `
  let replacements = []
  replacements.push(GLBConfig.ENABLE)
  replacements.push(['2', '3'])
  let search_data = doc.search_data
  if(search_data) {
    if (search_data.unusual_invoice_no) {
      queryStr += ' and unusual_invoice_no like ?'
      replacements.push('%' + search_data.unusual_invoice_no + '%')
    }
    if (search_data.unusual_receipt_no) {
      queryStr += ' and unusual_receipt_no like ?'
      replacements.push('%' + search_data.unusual_receipt_no + '%')
    }
    if (search_data.unusual_invoice_bl) {
      queryStr += ' and unusual_invoice_bl like ?'
      replacements.push('%' + search_data.unusual_invoice_bl + '%')
    }
  
    if (search_data.unusual_invoice_cargo_type) {
      queryStr += ' and unusual_invoice_cargo_type = ?'
      replacements.push(search_data.unusual_invoice_cargo_type)
    }
  
    if (search_data.unusual_invoice_items) {
      queryStr += ' and unusual_invoice_items = ?'
      replacements.push(search_data.unusual_invoice_items)
    }
  
    if (search_data.unusual_invoice_party) {
      queryStr += ' and unusual_invoice_party = ?'
      replacements.push(search_data.unusual_invoice_party)
    }
  }

  let result = await model.simpleSelect(queryStr, replacements)
  let filepath = await common.ejs2xlsx('UnusualReceipt.xlsx', result)
  res.sendFile(filepath)
}