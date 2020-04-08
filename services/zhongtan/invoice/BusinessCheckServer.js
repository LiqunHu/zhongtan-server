const moment = require('moment')
// const logger = require('../../../app/logger').createLogger(__filename)
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const GLBConfig = require('../../../util/GLBConfig')

const tb_vessel = model.zhongtan_invoice_vessel
const tb_bl = model.zhongtan_invoice_masterbl
const tb_container = model.zhongtan_invoice_containers

const tb_uploadfile = model.zhongtan_uploadfile
const tb_verification = model.zhongtan_invoice_verification_log

exports.initAct = async () => {
  let returnData = {
    UPLOAD_STATE: GLBConfig.UPLOAD_STATE
  }
  return common.success(returnData)
}

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
  )`
  let replacements = []
  
  if (doc.upload_state) {
    queryStr += ' AND b.uploadfile_state = ?'
    replacements.push(doc.upload_state)
  }

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
    row.upload_state = r.uploadfile_state
    row.of = ''
    row.deposit = ''
    row.transfer = ''
    row.lolf = ''
    row.lcl = ''
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
      row.transfer = r.invoice_masterbi_transfer
      row.lolf = r.invoice_masterbi_lolf
      row.lcl = r.invoice_masterbi_lcl
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
  let doc = common.docValidate(req),
    user = req.user
  let file = await tb_uploadfile.findOne({
    where: {
      uploadfile_id: doc.uploadfile_id
    }
  })
  await tb_verification.create({
    invoice_masterbi_id: file.uploadfile_index1,
    uploadfile_id: file.uploadfile_id,
    user_id: user.user_id,
    api_name: file.api_name,
    uploadfile_state_pre: file.uploadfile_state,
    uploadfile_state: 'AP'
  })
  file.uploadfile_state = 'AP'
  await file.save()
  return common.success()
}

exports.declineAct = async req => {
  let doc = common.docValidate(req),
    user = req.user
  let file = await tb_uploadfile.findOne({
    where: {
      uploadfile_id: doc.uploadfile_id
    }
  })
  await tb_verification.create({
    invoice_masterbi_id: file.uploadfile_index1,
    uploadfile_id: file.uploadfile_id,
    user_id: user.user_id,
    api_name: file.api_name,
    uploadfile_state_pre: file.uploadfile_state,
    uploadfile_state: 'BD'
  })
  file.uploadfile_state = 'BD'
  await file.save()
  return common.success()
}

exports.getInvoiceDetailAct = async req => {
  let doc = common.docValidate(req)

  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: doc.invoice_masterbi_id
    }
  })

  let vessel = await tb_vessel.findOne({
    where: {
      invoice_vessel_id: bl.invoice_vessel_id
    }
  })

  let continers = await tb_container.findAll({
    where: {
      invoice_vessel_id: bl.invoice_vessel_id,
      invoice_containers_bl: bl.invoice_masterbi_bl
    },
    order: [['invoice_containers_size', 'ASC']]
  })
  let cMap = new Map()
  for (let c of continers) {
    if (cMap.get(c.invoice_containers_size)) {
      cMap.set(c.invoice_containers_size, cMap.get(c.invoice_containers_size) + 1)
    } else {
      cMap.set(c.invoice_containers_size, 1)
    }
  }
  let containerSize = ''
  for (var [k, v] of cMap) {
    containerSize = containerSize + k + ' * ' + v + '    '
  }

  let returnData = {
    invoice_vessel_name: vessel.invoice_vessel_name,
    invoice_vessel_voyage: vessel.invoice_vessel_voyage,
    invoice_masterbi_bl: bl.invoice_masterbi_bl,
    container_size_type: containerSize,
    invoice_masterbi_loading: bl.invoice_masterbi_loading,
    invoice_masterbi_destination: bl.invoice_masterbi_destination,
    invoice_masterbi_cargo_type: bl.invoice_masterbi_cargo_type
  }

  return common.success(returnData)
}
