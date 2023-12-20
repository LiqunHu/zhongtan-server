const moment = require('moment')
const numberToText = require('number2text')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')
const opSrv = require('../../common/system/OperationPasswordServer')

const tb_user = model.common_user
const tb_fixed_deposit = model.zhongtan_customer_fixed_deposit
const tb_uploadfile = model.zhongtan_uploadfile
const tb_bank_info = model.zhongtan_bank_info

exports.initAct = async () => {
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
  let returnData = {
    CASH_BANK: GLBConfig.CASH_BANK_INFO,
    RECEIPT_CURRENCY: GLBConfig.RECEIPT_CURRENCY,
    DEPOSIT_TYPE: GLBConfig.FIXED_DEPOSIT_TYPE,
    WORK_STATE: GLBConfig.FIXED_DEPOSIT_WORK_STATE,
    UPLOAD_STATE: GLBConfig.UPLOAD_STATE,
    BANK_INFOS: BANK_INFOS
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

  if(!doc.deposit_bank_info) {
    // && moment().isAfter(moment('2023-12-31', 'YYYY/MM/DD'))
    return common.error('import_14')
  }

  let theCustomer = await tb_user.findOne({
    where: {
      user_id: doc.fixed_deposit_customer_id
    }
  })
  if (!theCustomer) {
    return common.error('import_04')
  }

  let commonUser = await tb_user.findOne({
    where: {
      user_id: user.user_id
    }
  })
  
  theDeposit.deposit_check_cash_no = doc.deposit_check_cash_no
  theDeposit.deposit_bank_reference_no = doc.deposit_bank_reference_no
  theDeposit.deposit_receipt_no = await seq.genFixedReceiptSeq()
  theDeposit.deposit_receipt_date = curDate
  theDeposit.updated_at = curDate
  theDeposit.deposit_receipt_release_date = curDate
  theDeposit.deposit_work_state = 'W'
  theDeposit.deposit_bank_info = doc.deposit_bank_info

  let renderData = {}
  renderData.fixed_deposit_receipt_no = theDeposit.deposit_receipt_no
  renderData.fixed_deposit_receipt_date = moment().format('MMM DD, YYYY')
  renderData.fixed_deposit_received_from = theCustomer.user_name
  renderData.fixed_deposit_currency = theDeposit.deposit_currency
  renderData.fixed_deposit_amount = parseFloat(theDeposit.deposit_amount.replace(/,/g, '') || 0)
  renderData.fixed_deposit_amount_str = numberToText(renderData.fixed_deposit_amount, 'english')
  if (theDeposit.deposit_check_cash === 'CASH') {
    renderData.fixed_deposit_check_cash = 'Cash'
  } else if (theDeposit.deposit_check_cash === 'TRANSFER') {
    renderData.fixed_deposit_check_cash = 'Bank transfer/ ' + theDeposit.deposit_bank_reference_no
  } else {
    renderData.fixed_deposit_check_cash = 'Cheque/ ' + theDeposit.deposit_check_cash_no
  }
  renderData.user_name = commonUser.user_name
  renderData.user_phone = commonUser.user_phone
  renderData.user_email = commonUser.user_email
  try {
    let fileInfo = await common.ejs2Pdf('fixedReceipt.ejs', renderData, 'zhongtan')
    await theDeposit.save()
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
      uploadfil_release_user_id: user.user_id,
      uploadfile_bank_info: doc.deposit_bank_info
    })
    return common.success({ url: fileInfo.url })
  } catch(e) {
    return common.error('generate_file_01')
  }
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
    let search_text = doc.search_text + '%'
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

exports.cancelAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let theDeposit = await tb_fixed_deposit.findOne({
    where: {
      fixed_deposit_id: doc.fixed_deposit_id,
      state: GLBConfig.ENABLE
    }
  })
  if(!theDeposit) {
    return common.error('fee_04')
  }
  theDeposit.deposit_work_state = 'C'
  theDeposit.deposit_invalid_date = new Date()
  theDeposit.deposit_invalid_user_id = user.user_id
  await theDeposit.save()
  return common.success()
}

exports.invalidAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let theDeposit = await tb_fixed_deposit.findOne({
    where: {
      fixed_deposit_id: doc.fixed_deposit_id,
      state: GLBConfig.ENABLE
    }
  })
  if(!theDeposit) {
    return common.error('fee_04')
  }
  theDeposit.deposit_work_state = 'I'
  theDeposit.deposit_invalid_date = new Date()
  theDeposit.deposit_invalid_user_id = user.user_id
  await theDeposit.save()
  return common.success()
}

exports.exportFixedDepositAct = async (req, res) => {
  let doc = common.docValidate(req)
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
  let result = await model.simpleSelect(queryStr, replacements)
  let renderData = []
  if(result && result.length > 0) {
    for(let r of result) {
      let row = {}
      row.fixed_deposit_customer = r.user_name
      for(let t of GLBConfig.FIXED_DEPOSIT_TYPE) {
        if(t.id === r.fixed_deposit_type) {
          row.fixed_deposit_type = t.text
          break
        }
      }
      if(r.deposit_long_term === '1') {
        row.fixed_deposit_range = r.deposit_begin_date + ' To Long Term'
      } else if (r.deposit_begin_date && r.deposit_expire_date) {
        row.fixed_deposit_range = r.deposit_begin_date + ' To ' + r.deposit_expire_date
      } else if(r.deposit_begin_date) {
        row.fixed_deposit_range = r.deposit_begin_date + ' To '
      } else if(r.deposit_expire_date){
        row.fixed_deposit_range = ' To ' + r.deposit_expire_date
      }
      row.fixed_deposit_amount = r.deposit_amount
      row.fixed_deposit_currency = r.deposit_currency
      row.fixed_deposit_check_cash = r.deposit_check_cash
      if(r.deposit_guarantee_letter_no) {
        row.fixed_deposit_letter_no = r.deposit_guarantee_letter_no
      } else if(r.deposit_bank_reference_no) {
        row.fixed_deposit_letter_no = r.deposit_bank_reference_no
      } else if(r.deposit_check_cash_no) {
        row.fixed_deposit_letter_no = r.deposit_check_cash_no
      }
      for(let t of GLBConfig.FIXED_DEPOSIT_WORK_STATE) {
        if(t.id === r.deposit_work_state) {
          row.fixed_deposit_stauts = t.text
          break
        }
      }
      renderData.push(row)
    }
  }
  let filepath = await common.ejs2xlsx('FixedDepositTemplate.xlsx', renderData)
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