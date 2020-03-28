const moment = require('moment')
// const logger = require('../../../app/logger').createLogger(__filename)
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')

const tb_uploadfile = model.zhongtan_uploadfile

exports.searchAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}
  let queryStr = `select * from 
    tbl_zhongtan_invoice_masterbl a ,
    tbl_zhongtan_uploadfile b ,
    tbl_common_user c
  WHERE
    a.invoice_masterbi_id = b.uploadfile_index1
  AND b.user_id = c.user_id
  AND b.api_name IN(
    'RECEIPT-OF' ,
    'RECEIPT-DEPOSIT' ,
    'RECEIPT-FEE'
  )
  AND b.uploadfile_state = 'PB'`
  let replacements = []

  if (doc.bl) {
    queryStr += ' AND a.invoice_masterbi_bl = ?'
    replacements.push(doc.bl)
  }

  if (doc.start_date) {
    queryStr += ' and b.created_at >= ? and b.created_at <= ?'
    replacements.push(doc.start_date)
    replacements.push(
      moment(doc.end_date, 'YYYY-MM-DD')
        .add(1, 'days')
        .format('YYYY-MM-DD')
    )
  }

  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  returnData.rows = []
  for (let r of result.data) {
    let row = {}
    row.invoice_masterbi_id = r.invoice_masterbi_id
    row.invoice_masterbi_bl = r.invoice_masterbi_bl
    row.uploadfile_id = r.uploadfile_id
    row.user_name = r.user_name
    row.comment = r.uploadfile_amount_comment
    row.of = ''
    row.deposit = ''
    row.lolf = ''
    row.amendment = ''
    row.tasac = ''
    row.printing = ''
    row.others = ''
    if (r.api_name === 'RECEIPT-OF') {
      row.receipt_type = 'Ocean Freight'
      row.of = r.invoice_masterbi_of
    } else if (r.api_name === 'RECEIPT-DEPOSIT') {
      row.receipt_type = 'Deposit Amount'
      row.deposit = r.invoice_masterbi_deposit
    } else if (r.api_name === 'RECEIPT-FEE') {
      row.receipt_type = 'Invoice Fee'
      row.lolf = r.invoice_masterbi_lolf
      row.amendment = r.invoice_masterbi_amendment
      row.tasac = r.invoice_masterbi_tasac
      row.printing = r.invoice_masterbi_printing
      row.others = r.invoice_masterbi_others
    }
    returnData.rows.push(row)
  }

  return common.success(returnData)
}

exports.approveAct = async req => {
  let doc = common.docValidate(req)
  let file = await tb_uploadfile.findOne({
    where: {
      uploadfile_id: doc.uploadfile_id
    }
  })
  file.uploadfile_state = 'AP'
  await file.save()
}

exports.declineAct = async req => {
  let doc = common.docValidate(req)
  let file = await tb_uploadfile.findOne({
    where: {
      uploadfile_id: doc.uploadfile_id
    }
  })
  file.uploadfile_state = 'BD'
  await file.save()
}