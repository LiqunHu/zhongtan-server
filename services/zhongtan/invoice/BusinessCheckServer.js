const moment = require('moment')
// const logger = require('../../../app/logger').createLogger(__filename)
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const GLBConfig = require('../../../util/GLBConfig')
const Op = model.Op

const tb_vessel = model.zhongtan_invoice_vessel
const tb_bl = model.zhongtan_invoice_masterbl
const tb_container = model.zhongtan_invoice_containers

const tb_uploadfile = model.zhongtan_uploadfile
const tb_verification = model.zhongtan_invoice_verification_log
const tb_fixed_deposit = model.zhongtan_customer_fixed_deposit

exports.initAct = async () => {
  let returnData = {
    UPLOAD_STATE: GLBConfig.UPLOAD_STATE
  }
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}
  let queryStr = `select a.*, b.*, c.*, d.*, e.user_name as fixed_deposit_customer_name, f.user_name as invoice_masterbi_customer_name from 
    tbl_zhongtan_uploadfile a LEFT JOIN tbl_zhongtan_invoice_masterbl b ON a.uploadfile_index1 = b.invoice_masterbi_id
    LEFT JOIN tbl_zhongtan_customer_fixed_deposit c ON a.uploadfile_index1 = c.fixed_deposit_id
    LEFT JOIN tbl_common_user d ON a.user_id = d.user_id
    LEFT JOIN tbl_common_user e ON c.fixed_deposit_customer_id = e.user_id
    LEFT JOIN tbl_common_user f ON b.invoice_masterbi_customer_id = f.user_id
  WHERE
  a.api_name IN(
    'RECEIPT-OF' ,
    'RECEIPT-DEPOSIT' ,
    'RECEIPT-FEE',
    'GUARANTEE-LETTER',
    'FIXED-INVOICE'
  )`
  let replacements = []
  
  if (doc.upload_state) {
    queryStr += ' AND a.uploadfile_state = ?'
    replacements.push(doc.upload_state)
  }

  if (doc.bl) {
    queryStr += ' AND b.invoice_masterbi_bl = ?'
    replacements.push(doc.bl)
  }

  if (doc.start_date) {
    queryStr += ' and ((a.created_at >= ? and a.created_at <= ?) or (c.created_at >= ? and c.created_at <= ?))'
    replacements.push(doc.start_date)
    replacements.push(moment(doc.end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    replacements.push(doc.start_date)
    replacements.push(moment(doc.end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
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
    row.deposit_work_state = r.deposit_work_state
    row.invoice_customer_name = r.invoice_masterbi_customer_name
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
      row.blAmendment = r.invoice_masterbi_bl_amendment
      row.codCharge = r.invoice_masterbi_cod_charge
      row.transfer = r.invoice_masterbi_transfer
      row.lolf = r.invoice_masterbi_lolf
      row.lcl = r.invoice_masterbi_lcl
      row.amendment = r.invoice_masterbi_amendment
      row.tasac = r.invoice_masterbi_tasac
      row.printing = r.invoice_masterbi_printing
      row.others = r.invoice_masterbi_others
    } else if (r.api_name === 'GUARANTEE-LETTER') {
      row.receipt_type = 'Guarantee Letter'
      row.invoice_customer_name = r.fixed_deposit_customer_name
    } else if (r.api_name === 'FIXED-INVOICE') {
      row.receipt_type = 'Fixed Invoice'
      row.invoice_customer_name = r.fixed_deposit_customer_name
      row.fixed_deposit_amount = r.deposit_amount
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

  if(file.api_name === 'GUARANTEE-LETTER' || file.api_name === 'FIXED-INVOICE') {
    let fixedDeposit = await tb_fixed_deposit.findOne({
      where: {
        fixed_deposit_id: file.uploadfile_index1,
        state: GLBConfig.ENABLE
      }
    })
    if(fixedDeposit.deposit_work_state === 'I') {
      return common.error('fee_05')
    }
    fixedDeposit.deposit_approve_date = new Date()
    fixedDeposit.updated_at = new Date()
    if(file.api_name === 'GUARANTEE-LETTER') {
      fixedDeposit.deposit_work_state = 'W'
    }
    await fixedDeposit.save()
  }

  await tb_verification.create({
    invoice_masterbi_id: file.uploadfile_index1,
    uploadfile_id: file.uploadfile_id,
    user_id: user.user_id,
    api_name: file.api_name,
    uploadfile_state_pre: file.uploadfile_state,
    uploadfile_state: 'AP'
  })
  file.uploadfile_state = 'AP'
  // TODO business check release
  file.uploadfil_release_date = new Date()
  file.uploadfil_release_user_id = user.user_id
  await file.save()

  // TODO business check release
  if (file.api_name === 'RECEIPT-DEPOSIT' || file.api_name === 'RECEIPT-FEE' || file.api_name === 'RECEIPT-OF') {
    let bl = await tb_bl.findOne({
      where: {
        invoice_masterbi_id: file.uploadfile_index1
      }
    })
    let acount = await tb_uploadfile.count({
      where: {
        uploadfile_index1: file.uploadfile_index1,
        api_name: ['RECEIPT-DEPOSIT', 'RECEIPT-FEE', 'RECEIPT-OF']
      }
    })

    let rcount = await tb_uploadfile.count({
      where: {
        uploadfile_index1: file.uploadfile_index1,
        api_name: ['RECEIPT-DEPOSIT', 'RECEIPT-FEE', 'RECEIPT-OF'],
        uploadfil_release_date: {
          [Op.ne]: null
        }
      }
    })
    if (acount === rcount) {
      bl.invoice_masterbi_invoice_release_date = file.uploadfil_release_date
      await bl.save()
    }
  }
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

  if(file.api_name === 'FIXED-INVOICE') {
    let fixedDeposit = await tb_fixed_deposit.findOne({
      where: {
        fixed_deposit_id: file.uploadfile_index1,
        state: GLBConfig.ENABLE
      }
    })
    if(fixedDeposit.deposit_work_state === 'I') {
      return common.error('fee_05')
    }
    fixedDeposit.deposit_invoice_date = null
    fixedDeposit.updated_at = new Date()
    await fixedDeposit.save()
  }

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

exports.getTimelineAct = async req => {
  let doc = common.docValidate(req)
  let queryStr = `select a.*, b.user_username, b.user_email, b.user_name from 
    tbl_zhongtan_invoice_verification_log a ,
    tbl_common_user b
    WHERE
      a.user_id = b.user_id`
    let replacements = []
    if (doc.uploadfile_id) {
      queryStr += ' AND a.uploadfile_id = ?'
      replacements.push(doc.uploadfile_id)
    }
    queryStr += ' ORDER BY a.created_at DESC'
    let verifications = await model.simpleSelect(queryStr, replacements)
    let timeline = []
    if(verifications) {
      for (let v of verifications) {
        timeline.push({
          'verification_log_id': v.verification_log_id,
          'uploadfile_state_pre': common.glbConfigId2Text(GLBConfig.UPLOAD_STATE, v.uploadfile_state_pre),
          'uploadfile_state': common.glbConfigId2Text(GLBConfig.UPLOAD_STATE, v.uploadfile_state),
          'created_at': moment(v.created_at).format('DD/MM/YYYY HH:mm'),
          'user_username': v.user_username,
          'user_email': v.user_email,
          'user_name': v.user_name,
        })
      }
    }
    return timeline
}