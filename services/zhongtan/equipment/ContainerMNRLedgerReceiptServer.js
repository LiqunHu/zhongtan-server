const moment = require('moment')
const numberToText = require('number2text')
const Decimal = require('decimal.js')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')
const customer_srv = require('../../zhongtan/configuration/CustomerServer')

const tb_mnr_ledger = model.zhongtan_container_mnr_ledger
const tb_uploadfile = model.zhongtan_uploadfile
const tb_user = model.common_user
const tb_discharge_port = model.zhongtan_discharge_port
const tb_bank_info = model.zhongtan_bank_info

exports.initAct = async () => {
  let returnData = {}
  let queryStr = `SELECT container_size_code, GROUP_CONCAT(container_size_name) container_size_name FROM tbl_zhongtan_container_size WHERE state = 1 GROUP BY container_size_code ORDER BY container_size_code`
  let replacements = []
  returnData['CONTAINER_SIZE'] = await model.simpleSelect(queryStr, replacements)
  returnData['DESTINATION'] = await tb_discharge_port.findAll({
    attributes: ['discharge_port_code', 'discharge_port_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['discharge_port_code', 'ASC']]
  })
  returnData['UPLOAD_STATE'] = GLBConfig.UPLOAD_STATE
  returnData['MNR_CARGO_TYPE'] = GLBConfig.MNR_CARGO_TYPE
  returnData['MNR_DESCRIPTION'] = GLBConfig.MNR_DESCRIPTION
  returnData['CASH_BANK_INFO'] = GLBConfig.CASH_BANK_INFO
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
  returnData['BANK_INFOS'] = BANK_INFOS
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `SELECT * from tbl_zhongtan_container_mnr_ledger WHERE state = '1' AND container_mnr_ledger_id in (SELECT uploadfile_index1 FROM tbl_zhongtan_uploadfile WHERE state = '1' AND api_name = 'MNR-INVOICE' AND uploadfile_state = 'AP') `
  let replacements = []
  if(doc.search_data) {
    if(doc.search_data.date && doc.search_data.date.length > 1) {
      let start_date = doc.search_data.date[0]
      let end_date = doc.search_data.date[1]
      queryStr += ` AND created_at >= ? and created_at < ? `
      replacements.push(start_date)
      replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.mnr_ledger_bl) {
      queryStr += ' and mnr_ledger_bl like ? '
      replacements.push('%' + doc.search_data.mnr_ledger_bl + '%')
    }
    if (doc.search_data.container_no) {
      queryStr += ' and mnr_ledger_container_no like ? '
      replacements.push('%' + doc.search_data.container_no + '%')
    }
  }
  queryStr += ' ORDER BY container_mnr_ledger_id DESC'
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  returnData.rows = []
  for(let r of result.data) {
    r.mnr_atts = await tb_uploadfile.findAll({
      where: {
        api_name: 'MNR-LEDGER',
        uploadfile_index1: r.container_mnr_ledger_id
      }
    })

    queryStr = `SELECT a.*, b.user_name FROM tbl_zhongtan_uploadfile a
      left join tbl_common_user b on a.uploadfil_release_user_id = b.user_id
      WHERE a.uploadfile_index1 = ? and (api_name = ? or api_name = ?) and a.state = '1' order by a.uploadfile_id desc`
    replacements = [r.container_mnr_ledger_id, 'MNR-INVOICE', 'MNR-RECEIPT']
    r.mnr_files = []
    let files = await model.simpleSelect(queryStr, replacements)
    if(files) {
      for(let f of files) {
        let filetype = 'MNR Invoice'
        if(f.api_name === 'MNR-RECEIPT') {
          filetype = 'MNR Receipt'
        }
        r.mnr_files.push({
          container_mnr_ledger_id: r.container_mnr_ledger_id,
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

    queryStr = `SELECT * FROM tbl_zhongtan_uploadfile WHERE state = '1' and uploadfile_index1 = ? AND api_name = 'MNR-INVOICE' AND uploadfile_state = 'AP' 
      AND uploadfile_id > IFNULL((SELECT MAX(uploadfile_id) FROM tbl_zhongtan_uploadfile WHERE state = '1' and uploadfile_index1 = ? AND api_name = 'MNR-RECEIPT'), 0) ORDER BY uploadfile_id DESC LIMIT 1`
    replacements = [r.container_mnr_ledger_id, r.container_mnr_ledger_id]
    let apFiles = await model.simpleSelect(queryStr, replacements)
    if(apFiles && apFiles.length > 0) {
      r.receipt_disabled =  false
      r.receipts = JSON.parse(JSON.stringify(apFiles[0]))
      if(r.receipts.uploadfile_customer_id) {
        let customer = await tb_user.findOne({
          where: {
            user_id: r.receipts.uploadfile_customer_id
          }
        })
        r.receipts.customers = [{
          user_id: customer.user_id,
          user_name: customer.user_name
        }]
      }
    } else {
      // 没有满足条件可开收据的invoice
      r.receipt_disabled =  true
    }
    returnData.rows.push(r)
  }
  return common.success(returnData)
}

exports.receiptAct = async req => {
  let doc = common.docValidate(req), user = req.user, curDate = new Date()
  let file_id = doc.uploadfile_id
  if(doc.mnr_invoice_check_cash === 'TRANSFER' && !doc.receipt_bank_info) {
    // && moment().isAfter(moment('2023-12-31', 'YYYY/MM/DD'))
    return common.error('import_14')
  }
  let commonUser = await tb_user.findOne({
    where: {
      user_id: user.user_id
    }
  })

  let invoice = await tb_uploadfile.findOne({
    where: {
      uploadfile_id: file_id
    }
  })

  let mnr = await tb_mnr_ledger.findOne({
    where: {
      container_mnr_ledger_id: invoice.uploadfile_index1
    }
  })

  let charge_carrier = 'COSCO'
  if(mnr.mnr_ledger_bl.indexOf('COS') >= 0) {
    charge_carrier  = 'COSCO'
  } else if(mnr.mnr_ledger_bl.indexOf('OOLU') >= 0) {
    charge_carrier  = 'OOCL'
  }
  let receipt_no = await seq.genMNRReceiptSeq(charge_carrier)
  
  let renderData = {}
  renderData.receipt_no = receipt_no
  renderData.received_from = doc.received_from
  renderData.receipt_currency = 'USD'
  renderData.container_no = mnr.mnr_ledger_container_no
  renderData.receipt_date = moment().format('MMM DD, YYYY')
  if (doc.mnr_invoice_check_cash === 'CASH') {
    renderData.check_cash = 'Cash'
  } else if (doc.mnr_invoice_check_cash === 'TRANSFER') {
    renderData.check_cash = 'Bank transfer(' + doc.receipt_bank_info + ')/ ' + doc.mnr_invoice_bank_reference_no
  } else {
    renderData.check_cash = 'Cheque/ ' + doc.mnr_invoice_check_no
  }
  renderData.sum_fee = parseFloat(invoice.uploadfile_amount.replace(/,/g, '') || 0)

  if(invoice.uploadfile_amount && invoice.uploadfile_amount.indexOf('-') < 0) {
    renderData.sum_fee_str = numberToText(invoice.uploadfile_amount, 'english')
  } else {
    renderData.sum_fee_str = 'MINUS ' + numberToText(new Decimal(invoice.uploadfile_amount).absoluteValue(), 'english')
  }
  renderData.user_name = commonUser.user_name
  renderData.user_phone = commonUser.user_phone
  renderData.user_email = commonUser.user_email
  try {
    let fileInfo = await common.ejs2Pdf('mnrReceipt.ejs', renderData, 'zhongtan')
    await tb_uploadfile.create({
      api_name: 'MNR-RECEIPT',
      user_id: user.user_id,
      uploadfile_index1: invoice.uploadfile_index1,
      uploadfile_index3: invoice.uploadfile_id,
      uploadfile_name: fileInfo.name,
      uploadfile_url: fileInfo.url,
      uploadfile_acttype: 'MNR',
      uploadfile_amount: invoice.uploadfile_amount,
      uploadfile_currency: invoice.uploadfile_currency,
      uploadfile_check_cash: doc.mnr_invoice_check_cash,
      uploadfile_check_no: doc.mnr_invoice_check_no,
      uploadfile_received_from: doc.received_from,
      uploadfile_receipt_no: receipt_no,
      uploadfil_release_date: curDate,
      uploadfil_release_user_id: user.user_id,
      uploadfile_bank_reference_no: doc.mnr_invoice_bank_reference_no,
      uploadfile_bank_info: doc.receipt_bank_info
    })
    invoice.uploadfile_receipt_no = receipt_no
    invoice.save()

    mnr.mnr_ledger_receipt_amount = invoice.uploadfile_amount
    mnr.mnr_ledger_receipt_date = moment(curDate).format('YYYY-MM-DD HH:mm:ss')
    mnr.mnr_ledger_receipt_no = receipt_no
    mnr.mnr_ledger_check_cash = doc.mnr_invoice_check_cash
    mnr.mnr_ledger_check_no = doc.mnr_invoice_check_no
    mnr.mnr_ledger_bank_reference_no = doc.mnr_invoice_bank_reference_no
    mnr.mnr_ledger_bank_info = doc.receipt_bank_info
    mnr.save()


    await customer_srv.importDemurrageCheck(mnr.mnr_ledger_corresponding_payer_id)
    return common.success({ url: fileInfo.url })
  } catch(e) {
    return common.error('generate_file_01')
  }
}

exports.searchCustomerAct = async req => {
  let doc = common.docValidate(req)
  let search_text = '%' + doc.search_text + '%'
  let queryStr = `SELECT user_id, user_name from tbl_common_user WHERE user_type = '${GLBConfig.TYPE_CUSTOMER}' AND user_name LIKE ? GROUP BY user_name ORDER BY user_name LIMIT 10 `
  let replacements = [search_text]
  let result = await model.simpleSelect(queryStr, replacements)
  if(result && result.length > 0) {
    return common.success(result)
  } 
  return common.success()
}
