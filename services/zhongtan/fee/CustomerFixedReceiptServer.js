const moment = require('moment')
const numberToText = require('number2text')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')

const tb_user = model.common_user
const tb_fixed_deposit = model.zhongtan_customer_fixed_deposit
const tb_uploadfile = model.zhongtan_uploadfile

exports.initAct = async () => {
  let returnData = {
    CASH_BANK: GLBConfig.CASH_BANK_INFO,
    RECEIPT_CURRENCY: GLBConfig.RECEIPT_CURRENCY,
    DEPOSIT_TYPE: GLBConfig.FIXED_DEPOSIT_TYPE,
    WORK_STATE: GLBConfig.FIXED_DEPOSIT_WORK_STATE,
    UPLOAD_STATE: GLBConfig.UPLOAD_STATE
  }
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `select a.*, b.user_name from tbl_zhongtan_customer_fixed_deposit a LEFT JOIN tbl_common_user b ON b.user_id = a.fixed_deposit_customer_id where a.state = '1' `
  let replacements = []
  if (doc.fixed_deposit_customer_id) {
    queryStr += ' AND a.fixed_deposit_customer_id = ?'
    replacements.push(doc.fixed_deposit_customer_id)
  }
  if (doc.fixed_deposit_type) {
    queryStr += ' AND a.fixed_deposit_type = ?'
    replacements.push(doc.fixed_deposit_type)
  }
  if (doc.deposit_work_state) {
    queryStr += ' AND a.deposit_work_state = ?'
    replacements.push(doc.deposit_work_state)
  }
  queryStr += ' ORDER BY a.created_at DESC'
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  returnData.rows = []
  for(let r of result.data) {
    let d = JSON.parse(JSON.stringify(r))
    d.deposit_invoice_date_fm = d.deposit_invoice_date ? 'Invoice Date: ' + moment(d.deposit_invoice_date).format('DD/MM/YYYY HH:mm') : ''
    d.deposit_invoice_release_date_fm = d.deposit_invoice_release_date ? 'Invoice Release Date: ' + moment(d.deposit_invoice_release_date).format('DD/MM/YYYY HH:mm') : ''
    d.deposit_receipt_date_fm = d.deposit_receipt_date ? 'Receipt Date: ' + moment(d.deposit_receipt_date).format('DD/MM/YYYY HH:mm') : ''
    d.deposit_receipt_release_date_fm = d.deposit_receipt_release_date ? 'Receipt Release Date: ' + moment(d.deposit_receipt_release_date).format('DD/MM/YYYY HH:mm') : ''
    d.deposit_approve_date_fm = d.deposit_approve_date ? 'Invoice Approve Date: ' + moment(d.deposit_approve_date).format('DD/MM/YYYY HH:mm') : ''
    d.deposit_invalid_date_fm = d.deposit_invalid_date ? 'Invoice Approve Date: ' + moment(d.deposit_invalid_date).format('DD/MM/YYYY HH:mm') : ''
    d.customerINFO = [
      {
        id: d.fixed_deposit_customer_id,
        text: d.user_name
      }
    ]
    d.files = []
    queryStr = `SELECT
        a.*, b.user_name
      FROM
        tbl_zhongtan_uploadfile a
      left join tbl_common_user b on a.uploadfil_release_user_id = b.user_id
      WHERE
        a.uploadfile_index1 = ?`
    replacements = [r.fixed_deposit_id]
    let files = await model.simpleSelect(queryStr, replacements)
    for (let f of files) {
      let filetype = ''
      if (f.api_name === 'GUARANTEE-LETTER') {
        filetype = 'Guarantee Letter'
        d.files.push({
          fixed_deposit_id: r.fixed_deposit_id,
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          state: f.uploadfile_state,
          release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
          release_user: f.user_name,
          deposit_work_state: r.deposit_work_state
        })
      } else if (f.api_name === 'FIXED-INVOICE') {
        filetype = 'Fixed Invoice'
        d.files.push({
          fixed_deposit_id: r.fixed_deposit_id,
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          state: f.uploadfile_state,
          release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
          release_user: f.user_name,
          deposit_work_state: r.deposit_work_state
        })
      } else if (f.api_name === 'FIXED-RECEIPT') {
        filetype = 'Fixed Receipt'
        d.files.push({
          fixed_deposit_id: r.fixed_deposit_id,
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          state: f.uploadfile_state,
          release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
          release_user: f.user_name,
          deposit_work_state: r.deposit_work_state
        })
      }
    }
    returnData.rows.push(d)
  }
  return common.success(returnData)
}

exports.receiptAct = async req => {
  let doc = common.docValidate(req), user = req.user, curDate = new Date()
  let theDeposit = await tb_fixed_deposit.findOne({
    where: {
      fixed_deposit_id: doc.fixed_deposit_id,
      state: GLBConfig.ENABLE
    }
  })
  if(!theDeposit) {
    return common.error('fee_04')
  }

  let theCustomer = await tb_user.findOne({
    where: {
      user_id: doc.fixed_deposit_customer_id
    }
  })
  if (!theCustomer) {
    return common.error('import_04')
  }

  theDeposit.deposit_check_cash_no = doc.deposit_check_cash_no
  theDeposit.deposit_receipt_no = await seq.genFixedReceiptSeq()
  theDeposit.deposit_receipt_date = curDate
  theDeposit.updated_at = curDate
  theDeposit.deposit_receipt_release_date = curDate
  theDeposit.deposit_work_state = 'W'
  await theDeposit.save()

  let renderData = {}
  renderData.fixed_deposit_receipt_no = theDeposit.deposit_receipt_no
  renderData.fixed_deposit_receipt_date = moment().format('MMM DD, YYYY')
  renderData.fixed_deposit_received_from = theCustomer.user_name
  renderData.fixed_deposit_currency = theDeposit.deposit_currency
  renderData.fixed_deposit_amount = parseFloat(theDeposit.deposit_amount.replace(/,/g, '') || 0)
  renderData.fixed_deposit_amount_str = numberToText(renderData.fixed_deposit_amount)
  renderData.fixed_deposit_check_cash = theDeposit.deposit_check_cash

  let fileInfo = await common.ejs2Pdf('fixedReceipt.ejs', renderData, 'zhongtan')

  await tb_uploadfile.destroy({
    where: {
      api_name: 'FIXED-RECEIPT',
      uploadfile_index1: theDeposit.fixed_deposit_id
    }
  })

  await tb_uploadfile.create({
    api_name: 'FIXED-RECEIPT',
    user_id: user.user_id,
    uploadfile_index1: theDeposit.fixed_deposit_id,
    uploadfile_name: fileInfo.name,
    uploadfile_url: fileInfo.url,
    uploadfile_currency: theDeposit.deposit_currency,
    uploadfile_amount: theDeposit.deposit_amount,
    uploadfile_check_cash: theDeposit.deposit_check_cash,
    uploadfile_check_no: theDeposit.deposit_check_cash_no,
    uploadfile_received_from: theCustomer.user_name,
    uploadfile_receipt_no: theDeposit.deposit_receipt_no,
    uploadfil_release_date: curDate,
    uploadfil_release_user_id: user.user_id
  })

  return common.success({ url: fileInfo.url })
}

exports.releaseAct = async req => {
  let doc = common.docValidate(req), user = req.user

  let file = await tb_uploadfile.findOne({
    where: {
      uploadfile_id: doc.file_id
    }
  })

  let fixedDeposit = await tb_fixed_deposit.findOne({
    where: {
      fixed_deposit_id: file.uploadfile_index1,
      state: GLBConfig.ENABLE
    }
  })

  file.uploadfil_release_date = new Date()
  file.uploadfil_release_user_id = user.user_id
  file.updated_at = new Date()
  await file.save()

  fixedDeposit.deposit_receipt_release_date = new Date()
  fixedDeposit.deposit_work_state = 'W'
  fixedDeposit.updated_at = new Date()
  await fixedDeposit.save()

  return common.success()
}

exports.searchCustomerAct = async req => {
  let doc = common.docValidate(req)
  if (doc.search_text) {
    let returnData = {
      customerINFO: []
    }
    let queryStr = `select * from tbl_common_user 
                where state = "1" and user_type = "${GLBConfig.TYPE_CUSTOMER}"  
                and (user_username like ? or user_phone like ? or user_name like ?)`
    let replacements = []
    let search_text = '%' + doc.search_text + '%'
    replacements.push(search_text)
    replacements.push(search_text)
    replacements.push(search_text)
    let shippers = await model.simpleSelect(queryStr, replacements)
    for (let s of shippers) {
      returnData.customerINFO.push({
        id: s.user_id,
        text: s.user_name
      })
    }
    return common.success(returnData)
  } else {
    return common.success()
  }
}