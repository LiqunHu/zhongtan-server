const moment = require('moment')
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
          release_user: f.user_name
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
          release_user: f.user_name
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
          release_user: f.user_name
        })
      }
    }
    returnData.rows.push(d)
  }
  return common.success(returnData)
}

exports.createAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let oldStr = `select * from tbl_zhongtan_customer_fixed_deposit where state = '1' 
                  AND fixed_deposit_customer_id = ? AND fixed_deposit_type = ? AND (deposit_work_state = ? OR deposit_work_state = ?)
                  AND ((deposit_begin_date <= ? AND deposit_long_term = ?) OR (deposit_begin_date <= ? AND deposit_expire_date >= ?))`
  let oldReplacements = [doc.fixed_deposit_customer_id, doc.fixed_deposit_type, 'N', 'W', moment().format('YYYY-MM-DD'), GLBConfig.ENABLE, moment().format('YYYY-MM-DD'), moment().format('YYYY-MM-DD')]
  let oldDeposits = await model.simpleSelect(oldStr, oldReplacements)
  if(oldDeposits && oldDeposits.length > 0) {
    return common.error('fee_02')
  }
  let newDeposits = await tb_fixed_deposit.create({
    fixed_deposit_customer_id: doc.fixed_deposit_customer_id,
    fixed_deposit_type: doc.fixed_deposit_type,
    deposit_begin_date: doc.deposit_begin_date ? moment(doc.deposit_begin_date, 'YYYY-MM-DD').format('YYYY-MM-DD') : null,
    deposit_expire_date: doc.deposit_expire_date ? moment(doc.deposit_expire_date, 'YYYY-MM-DD').format('YYYY-MM-DD') : null,
    deposit_long_term: doc.deposit_long_term ? GLBConfig.ENABLE : GLBConfig.DISABLE,
    deposit_guarantee_letter_no: doc.fixed_deposit_type === 'GU' ? doc.deposit_guarantee_letter_no: '',
    deposit_amount: doc.fixed_deposit_type === 'FD' ? doc.deposit_amount: '',
    deposit_currency: doc.fixed_deposit_type === 'FD' ? doc.deposit_currency : '',
    deposit_check_cash: doc.fixed_deposit_type === 'FD' ? doc.deposit_check_cash: '',
    deposit_check_cash_no: doc.fixed_deposit_type === 'FD' ? doc.deposit_check_cash_no: '',
    deposit_work_state: 'N',
    user_id: user.user_id
  })
  if(doc.fixed_deposit_type === 'GU' && doc.deposit_guarantee_letter_list && doc.deposit_guarantee_letter_list.length > 0) {
    // save file to mongo
    await tb_uploadfile.destroy({
      where: {
        api_name: 'GUARANTEE-LETTER',
        uploadfile_index1: newDeposits.fixed_deposit_id
      }
    })
    
    for(let letter of doc.deposit_guarantee_letter_list) {
      let fileInfo = await common.fileSaveMongo(letter.response.info.path, 'zhongtan')
      await tb_uploadfile.create({
        api_name: 'GUARANTEE-LETTER',
        user_id: user.user_id,
        uploadfile_index1: newDeposits.fixed_deposit_id,
        uploadfile_name: fileInfo.name,
        uploadfile_url: fileInfo.url,
        uploadfile_state: 'PB'
      })
    }
  }
  return common.success()
}

exports.updateAct = async req => {
  let doc = common.docValidate(req), user = req.user

  let updateDeposit = await tb_fixed_deposit.findOne({
    where: {
      fixed_deposit_id: doc.fixed_deposit_id,
      state: GLBConfig.ENABLE
    }
  })
  if(updateDeposit) {
    if(updateDeposit.deposit_approve_date) {
      return common.error('fee_03')
    }
    updateDeposit.deposit_begin_date = doc.deposit_begin_date ? moment(doc.deposit_begin_date, 'YYYY-MM-DD').format('YYYY-MM-DD') : null
    updateDeposit.deposit_expire_date = doc.deposit_expire_date ? moment(doc.deposit_expire_date, 'YYYY-MM-DD').format('YYYY-MM-DD') : null
    updateDeposit.deposit_long_term = doc.deposit_long_term ? GLBConfig.ENABLE : GLBConfig.DISABLE
    updateDeposit.user_id = user.user_id
    if(doc.fixed_deposit_type === 'FD') {
      updateDeposit.deposit_amount = doc.deposit_amount
      updateDeposit.deposit_currency = doc.deposit_currency
      updateDeposit.deposit_check_cash = doc.deposit_check_cash
      updateDeposit.deposit_check_cash_no = doc.deposit_check_cash_no
    } else {
      updateDeposit.deposit_guarantee_letter_no = doc.deposit_guarantee_letter_no

      await tb_uploadfile.destroy({
        where: {
          api_name: 'GUARANTEE-LETTER',
          uploadfile_index1: updateDeposit.fixed_deposit_id
        }
      })
      
      for(let letter of doc.deposit_guarantee_letter_list) {
        let fileInfo = await common.fileSaveMongo(letter.response.info.path, 'zhongtan')
        await tb_uploadfile.create({
          api_name: 'GUARANTEE-LETTER',
          user_id: user.user_id,
          uploadfile_index1: updateDeposit.fixed_deposit_id,
          uploadfile_name: fileInfo.name,
          uploadfile_url: fileInfo.url,
          uploadfile_state: 'PB'
        })
      }
    }
    updateDeposit.updated_at = new Date()
    await updateDeposit.save()
  } else {
    return common.error('fee_04')
  }
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

exports.invoiceAct = async req => {
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

  if(theDeposit.deposit_approve_date) {
    return common.error('fee_03')
  }

  let theCustomer = await tb_user.findOne({
    where: {
      user_id: doc.fixed_deposit_customer_id
    }
  })
  if (!theCustomer) {
    return common.error('import_04')
  }

  theDeposit.deposit_invoice_date = new Date()
  theDeposit.updated_at = new Date()
  await theDeposit.save()

  let renderData = {}
  renderData.fixed_deposit_carrier = 'A'
  renderData.fixed_deposit_number = '848'
  renderData.fixed_deposit_invoice_no = await seq.genFixedInvoiceSeq()
  renderData.fixed_deposit_date = moment(theDeposit.deposit_invoice_date).format('YYYY/MM/DD')
  renderData.fixed_deposit_customer_name = theCustomer.user_name
  renderData.fixed_deposit_customer_address = theCustomer.user_address
  renderData.fixed_deposit_customer_address1 = theCustomer.user_addres1
  renderData.fixed_deposit_customer_address2 = theCustomer.user_address2
  renderData.fixed_deposit_amount = theDeposit.deposit_amount
  renderData.fixed_deposit_amount_total = formatCurrency(theDeposit.deposit_amount)
  renderData.fixed_deposit_currency = theDeposit.deposit_currency
  renderData.user_name = user.user_name
  renderData.user_email = user.user_email

  let fileInfo = await common.ejs2Pdf('fixedInvoice.ejs', renderData, 'zhongtan')

  await tb_uploadfile.destroy({
    where: {
      api_name: 'FIXED-INVOICE',
      uploadfile_index1: theDeposit.fixed_deposit_id
    }
  })

  await tb_uploadfile.create({
    api_name: 'FIXED-INVOICE',
    user_id: user.user_id,
    uploadfile_index1: theDeposit.fixed_deposit_id,
    uploadfile_name: fileInfo.name,
    uploadfile_url: fileInfo.url,
    uploadfile_currency: theDeposit.deposit_currency,
    uploadfile_state: 'PB'
  })

  return common.success()
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

  fixedDeposit.deposit_invoice_release_date = new Date()
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

exports.uploadAct = async req => {
  let fileInfo = await common.fileSaveTemp(req)
  return common.success(fileInfo)
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