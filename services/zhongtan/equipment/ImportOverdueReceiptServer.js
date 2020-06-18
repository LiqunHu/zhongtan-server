const moment = require('moment')
const numberToText = require('number2text')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')

const tb_user = model.common_user
const tb_bl = model.zhongtan_invoice_masterbl
const tb_container_size = model.zhongtan_container_size
const tb_discharge_port = model.zhongtan_discharge_port
const tb_container = model.zhongtan_invoice_containers
const tb_invoice_container = model.zhongtan_overdue_invoice_containers
const tb_uploadfile = model.zhongtan_uploadfile

exports.initAct = async () => {
  let returnData = {}
  returnData['CONTAINER_SIZE'] = await tb_container_size.findAll({
    attributes: ['container_size_code', 'container_size_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['container_size_code', 'ASC']]
  })
  returnData['DISCHARGE_PORT'] = await tb_discharge_port.findAll({
    attributes: ['discharge_port_code', 'discharge_port_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['discharge_port_code', 'ASC']]
  })
  returnData['UPLOAD_STATE'] = GLBConfig.UPLOAD_STATE
  returnData['CASH_BANK_INFO'] = GLBConfig.CASH_BANK_INFO
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `SELECT a.*, b.invoice_vessel_name, b.invoice_vessel_voyage, b.invoice_vessel_ata, b.invoice_vessel_atd, b.invoice_vessel_eta, c.invoice_masterbi_id, c.invoice_masterbi_cargo_type, c.invoice_masterbi_destination from tbl_zhongtan_invoice_containers a LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id AND b.state = '1' LEFT JOIN tbl_zhongtan_invoice_masterbl c ON a.invoice_containers_bl = c.invoice_masterbi_bl AND c.state = 1 WHERE a.state = '1'`
  let replacements = []

  if(doc.search_data) {
    if (doc.search_data.invoice_containers_bl) {
      queryStr += ' and a.invoice_containers_bl like ? '
      replacements.push('%' + doc.search_data.invoice_containers_bl + '%')
    }
    if (doc.search_data.invoice_containers_no) {
      queryStr += ' and a.invoice_containers_no like ? '
      replacements.push('%' + doc.search_data.invoice_containers_no + '%')
    }
    if (doc.search_data.invoice_vessel_name) {
      queryStr += ' and b.invoice_vessel_name like ? '
      replacements.push('%' + doc.search_data.invoice_vessel_name + '%')
    }
  }
  queryStr += ' ORDER BY b.invoice_vessel_id DESC, a.invoice_containers_bl, a.invoice_containers_no'
  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = result.data
  if(result.data) {
    for(let d of result.data) {
      d.files = []
      let queryStr = `SELECT a.*, b.user_name FROM tbl_zhongtan_uploadfile a
          left join tbl_common_user b on a.uploadfil_release_user_id = b.user_id
          WHERE a.uploadfile_index1 = ? AND a.api_name IN('OVERDUE-INVOICE', 'OVERDUE-RECEIPT') ORDER BY a.uploadfile_id DESC`
      let replacements = [d.invoice_masterbi_id]
      let files = await model.simpleSelect(queryStr, replacements)
      if(files) {
        let fileType = 'INVOICE'
        for(let f of files) {
          if(f.api_name === 'OVERDUE-INVOICE') {
            fileType = 'INVOICE'
          } else {
            fileType = 'RECEIPT'
          }

          let customer = await tb_user.findOne({
            where: {
              user_id: f.uploadfile_customer_id
            }
          })

          d.files.push({
            date: moment(f.created_at).format('YYYY-MM-DD'),
            file_id: f.uploadfile_id,
            url: f.uploadfile_url,
            state: f.uploadfile_state,
            file_type: fileType,
            demurrage: f.uploadfile_amount,
            received_from: customer ? customer.user_name : '',
            receipt_no: f.uploadfile_receipt_no,
            release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
            release_user: f.user_name
          })
        }
      }
    }
  }
  return common.success(returnData)
}

exports.doReceiptAct = async req => {
  let doc = common.docValidate(req), user = req.user, curDate = new Date()
  let file_id = doc.file_id
  let invoice = await tb_uploadfile.findOne({
    where: {
      uploadfile_id: file_id
    }
  })

  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: invoice.uploadfile_index1
    }
  })
  let receipt_no = await seq.genEquipmentReceiptSeq()
  
  let renderData = {}
  renderData.overdue_invoice_receipt_no = receipt_no
  renderData.overdue_invoice_received_from = doc.overdue_invoice_received_from
  renderData.overdue_invoice_receipt_currency = invoice.uploadfile_currency
  renderData.overdue_invoice_bl = bl.invoice_masterbi_bl
  renderData.receipt_date = moment().format('MMM DD, YYYY')
  if (doc.overdue_invoice_check_cash === 'CASH') {
    renderData.check_cash = 'Cash'
  } else if (doc.overdue_invoice_check_cash === 'TRANSFER') {
    renderData.check_cash = 'Bank transfer/ ' + doc.overdue_invoice_bank_reference_no
  } else {
    renderData.check_cash = 'Cheque/ ' + doc.overdue_invoice_check_no
  }
  renderData.sum_fee = parseFloat(invoice.uploadfile_amount.replace(/,/g, '') || 0)
  renderData.sum_fee_str = numberToText(renderData.sum_fee)
  let fileInfo = await common.ejs2Pdf('demurrageReceipt.ejs', renderData, 'zhongtan')
  await tb_uploadfile.create({
    api_name: 'OVERDUE-RECEIPT',
    user_id: user.user_id,
    uploadfile_index1: invoice.uploadfile_index1,
    uploadfile_index3: invoice.uploadfile_id,
    uploadfile_name: fileInfo.name,
    uploadfile_url: fileInfo.url,
    uploadfile_acttype: 'overdue',
    uploadfile_amount: invoice.uploadfile_amount,
    uploadfile_currency: invoice.uploadfile_currency,
    uploadfile_check_cash: doc.overdue_invoice_check_cash,
    uploadfile_check_no: doc.overdue_invoice_check_no,
    uploadfile_received_from: doc.overdue_invoice_received_from,
    uploadfile_receipt_no: receipt_no,
    uploadfil_release_date: curDate,
    uploadfil_release_user_id: user.user_id,
    uploadfile_bank_reference_no: doc.overdue_invoice_bank_reference_no,
  })

  let invoiceContainers = await tb_invoice_container.findAll({
    where: {
      overdue_invoice_containers_invoice_uploadfile_id : file_id
    }
  })
  for(let incon of invoiceContainers) {
    let con = await tb_container.findOne({
      where: {
        invoice_containers_id : incon.overdue_invoice_containers_invoice_containers_id
      }
    })
    con.invoice_containers_empty_return_receipt_date = curDate
    con.invoice_containers_empty_return_receipt_release_date = curDate
    con.invoice_containers_empty_return_date_receipt = incon.overdue_invoice_containers_return_date
    con.invoice_containers_empty_return_overdue_days_receipt = incon.overdue_invoice_containers_overdue_days
    con.invoice_containers_empty_return_overdue_amount_receipt = incon.overdue_invoice_containers_overdue_amount
    con.invoice_containers_empty_return_date_receipt_no = receipt_no
    con.save()

    incon.overdue_invoice_containers_receipt_date = curDate
    incon.save()
  }
  invoice.uploadfile_receipt_no = receipt_no
  invoice.save()
  return common.success({ url: fileInfo.url })
}