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
const tb_fixed_deposit = model.zhongtan_customer_fixed_deposit
const tb_invoice_container = model.zhongtan_overdue_invoice_containers
const tb_mnr_ledger = model.zhongtan_container_mnr_ledger

exports.initAct = async () => {
  let returnData = {
    UPLOAD_STATE: GLBConfig.UPLOAD_STATE
  }
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}
  let queryStr = `select a.*, a.created_at as uploadfile_created_at, b.*, c.*, d.*, e.user_name as fixed_deposit_customer_name, g.user_name as invoice_masterbi_customer_name, g.user_name as overdue_invoice_customer_name from 
    tbl_zhongtan_uploadfile a LEFT JOIN tbl_zhongtan_invoice_masterbl b ON a.uploadfile_index1 = b.invoice_masterbi_id
    LEFT JOIN tbl_zhongtan_customer_fixed_deposit c ON a.uploadfile_index1 = c.fixed_deposit_id
    LEFT JOIN tbl_common_user d ON a.user_id = d.user_id
    LEFT JOIN tbl_common_user e ON c.fixed_deposit_customer_id = e.user_id
    LEFT JOIN tbl_common_user g ON a.uploadfile_customer_id = g.user_id
  WHERE a.state = '1' AND
  a.api_name IN(
    'RECEIPT-OF' ,
    'RECEIPT-DEPOSIT' ,
    'RECEIPT-FEE',
    'GUARANTEE-LETTER',
    'FIXED-INVOICE',
    'OVERDUE-INVOICE',
    'MNR-INVOICE'
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
  queryStr = queryStr + " order by a.uploadfile_id desc"
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
    row.uploadfile_created_at = moment(r.uploadfile_created_at).format("YYYY-MM-DD HH:mm")
    row.of = ''
    row.deposit = ''
    row.transfer = ''
    row.lolf = ''
    row.lcl = ''
    row.amendment = ''
    row.tasac = ''
    row.printing = ''
    row.others = ''
    if (r.api_name === 'RECEIPT-DEPOSIT') {
      row.receipt_type = 'Deposit Amount'
      row.deposit = r.invoice_masterbi_deposit
      row.deposit_attachment = r.invoice_masterbi_deposit_file
    } else if (r.api_name === 'RECEIPT-FEE') {
      row.receipt_type = 'Invoice Fee'
      row.of = r.invoice_masterbi_of
      row.blAmendment = r.invoice_masterbi_bl_amendment
      row.codCharge = r.invoice_masterbi_cod_charge
      row.transfer = r.invoice_masterbi_transfer
      row.lolf = r.invoice_masterbi_lolf
      row.lcl = r.invoice_masterbi_lcl
      row.amendment = r.invoice_masterbi_amendment
      if(r.invoice_masterbi_tasac && r.invoice_masterbi_tasac_receipt) {
        row.tasac = parseFloat(r.invoice_masterbi_tasac) - parseFloat(r.invoice_masterbi_tasac_receipt)
      } else if(r.invoice_masterbi_tasac) {
        row.tasac = r.invoice_masterbi_tasac
      }
      row.printing = r.invoice_masterbi_printing
      row.others = r.invoice_masterbi_others
      if(r.invoice_masterbi_do_fee && r.invoice_masterbi_do_fee_receipt) {
        row.doFee = parseFloat(r.invoice_masterbi_do_fee) - parseFloat(r.invoice_masterbi_do_fee_receipt)
      } else if(r.invoice_masterbi_do_fee) {
        row.doFee = r.invoice_masterbi_do_fee
      }
      row.feeTotal = 0
      if(row.of) {
        row.feeTotal += parseFloat(row.of)
      }
      if(row.blAmendment) {
        row.feeTotal += parseFloat(row.blAmendment)
      }
      if(row.codCharge) {
        row.feeTotal += parseFloat(row.codCharge)
      }
      if(row.transfer) {
        row.feeTotal += parseFloat(row.transfer)
      }
      if(row.lolf) {
        row.feeTotal += parseFloat(row.lolf)
      }
      if(row.lcl) {
        row.feeTotal += parseFloat(row.lcl)
      }
      if(row.amendment) {
        row.feeTotal += parseFloat(row.amendment)
      }
      if(row.tasac) {
        row.feeTotal += parseFloat(row.tasac)
      }
      if(row.printing) {
        row.feeTotal += parseFloat(row.printing)
      }
      if(row.others) {
        row.feeTotal += parseFloat(row.others)
      }
      if(row.doFee) {
        row.feeTotal += parseFloat(row.doFee)
      }
    } else if (r.api_name === 'GUARANTEE-LETTER') {
      row.receipt_type = 'Guarantee Letter'
      row.invoice_customer_name = r.fixed_deposit_customer_name
    } else if (r.api_name === 'FIXED-INVOICE') {
      row.receipt_type = 'Fixed Invoice'
      row.invoice_customer_name = r.fixed_deposit_customer_name
      row.fixed_deposit_amount = r.deposit_amount
    } else if(r.api_name === 'OVERDUE-INVOICE') {
      row.receipt_type = 'Overdue Invoice'
      row.invoice_customer_name = r.overdue_invoice_customer_name
      row.overdue_invoice_amount = r.uploadfile_amount
    } else if(r.api_name === 'MNR-INVOICE') {
      row.receipt_type = 'MNR Invoice'
      let mnr = await tb_mnr_ledger.findOne({
        where: {
          container_mnr_ledger_id: r.uploadfile_index1
        }
      })
      if(mnr) {
        row.container_mnr_ledger_id = mnr.container_mnr_ledger_id
        row.invoice_customer_name = mnr.mnr_ledger_corresponding_payer
        row.mnr_amount = r.uploadfile_amount
        row.invoice_masterbi_bl = mnr.mnr_ledger_bl
      }
    }
    returnData.rows.push(row)
  }

  return common.success(returnData)
}

exports.approveAct = async req => {
  let doc = common.docValidate(req),
    user = req.user, curDate = new Date()

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
  file.uploadfil_release_date = curDate
  file.uploadfil_release_user_id = user.user_id
  await file.save()

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
    fixedDeposit.deposit_approve_date = curDate
    fixedDeposit.updated_at = curDate
    if(file.api_name === 'GUARANTEE-LETTER') {
      fixedDeposit.deposit_work_state = 'W'
    } else {
      fixedDeposit.deposit_invoice_release_date = curDate
    }
    await fixedDeposit.save()

    // 多保函更新
    let otherFiles = await tb_uploadfile.findAll({
      where: {
        uploadfile_index1: file.uploadfile_index1,
        uploadfile_state: 'PB'
      }
    })
    if(otherFiles) {
      for(let f of otherFiles) {
        await tb_verification.create({
          invoice_masterbi_id: f.uploadfile_index1,
          uploadfile_id: f.uploadfile_id,
          user_id: user.user_id,
          api_name: f.api_name,
          uploadfile_state_pre: f.uploadfile_state,
          uploadfile_state: 'AP'
        })
        f.uploadfile_state = 'AP'
        f.uploadfil_release_date = curDate
        f.uploadfil_release_user_id = user.user_id
        await f.save()
      }
    }
  } else if(file.api_name === 'OVERDUE-INVOICE') {
    let containers = await tb_invoice_container.findAll({
      where: {
        overdue_invoice_containers_invoice_uploadfile_id: file.uploadfile_id
      }
    })
    if(containers) {
      for(let c of containers) {
        let con = await tb_container.findOne({
          where: {
            invoice_containers_id: c.overdue_invoice_containers_invoice_containers_id
          }
        })
        con.invoice_containers_empty_return_invoice_release_date = curDate
        await con.save()
      }
    }
  } else if(file.api_name === 'MNR-INVOICE') {
    let mnr = await tb_mnr_ledger.findOne({
      where: {
        container_mnr_ledger_id: doc.container_mnr_ledger_id
      }
    })
    if(mnr) {
      mnr.mnr_ledger_invoice_amount = file.uploadfile_amount
      await mnr.save()
    }
    
  } else {
    let bl = await tb_bl.findOne({
      where: {
        invoice_masterbi_id: file.uploadfile_index1
      }
    })
    if (file.api_name === 'RECEIPT-DEPOSIT') {
      bl.invoice_masterbi_deposit_release_date = curDate
    } else if (file.api_name === 'RECEIPT-FEE') {
      bl.invoice_masterbi_fee_release_date = curDate
    }
    if(common.checkInvoiceState(bl)) {
      bl.invoice_masterbi_invoice_release_date = curDate
    }
    await bl.save()
  }

  return common.success()
}

exports.declineAct = async req => {
  let doc = common.docValidate(req),
    user = req.user, curDate = new Date()
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
    fixedDeposit.updated_at = curDate
    await fixedDeposit.save()
  } else if(file.api_name === 'OVERDUE-INVOICE') {
    //
  } else if(file.api_name === 'MNR-INVOICE') {
    //
  } else {
    let bl = await tb_bl.findOne({
      where: {
        invoice_masterbi_id: file.uploadfile_index1
      }
    })
    if (file.api_name === 'RECEIPT-DEPOSIT') {
      bl.invoice_masterbi_deposit_date = null
    } else if (file.api_name === 'RECEIPT-FEE') {
      bl.invoice_masterbi_fee_date = null
    }
    bl.updated_at = curDate
    await bl.save()
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
    invoice_masterbi_cargo_type: bl.invoice_masterbi_cargo_type,
    invoice_masterbi_freight: bl.invoice_masterbi_freight
  }

  return common.success(returnData)
}

exports.getOverdueInvoiceDetailAct = async req => {
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

  let queryStr = `SELECT a.*, b.invoice_containers_no, b.invoice_containers_size
                  FROM tbl_zhongtan_overdue_invoice_containers a
                  LEFT JOIN tbl_zhongtan_invoice_containers b ON a.overdue_invoice_containers_invoice_containers_id = b.invoice_containers_id
                  WHERE a.overdue_invoice_containers_invoice_uploadfile_id = ?`
  let replacements = [doc.uploadfile_id]
  let invoice_contaienrs = await model.simpleSelect(queryStr, replacements)

  let returnData = {
    invoice_vessel_name: vessel.invoice_vessel_name,
    invoice_vessel_voyage: vessel.invoice_vessel_voyage,
    invoice_masterbi_bl: bl.invoice_masterbi_bl,
    container_size_type: containerSize,
    invoice_masterbi_loading: bl.invoice_masterbi_loading,
    invoice_masterbi_destination: bl.invoice_masterbi_destination,
    invoice_masterbi_cargo_type: bl.invoice_masterbi_cargo_type,
    invoice_masterbi_freight: bl.invoice_masterbi_freight,
    invoice_contaienrs : invoice_contaienrs
  }

  return common.success(returnData)
}

exports.getMNRInvoiceDetailAct = async req => {
  let doc = common.docValidate(req)
  let mnr = await tb_mnr_ledger.findOne({
    where: {
      container_mnr_ledger_id: doc.container_mnr_ledger_id
    }
  })
  if(mnr) {
    let containers = [{
      mnr_ledger_container_no: mnr.mnr_ledger_container_no,
      mnr_ledger_dv_amount: mnr.mnr_ledger_dv_amount,
      mnr_ledger_actual_charge_amount: mnr.mnr_ledger_actual_charge_amount,
      mnr_ledger_loss_declaring_date: mnr.mnr_ledger_loss_declaring_date,
      mnr_ledger_payment_date: mnr.mnr_ledger_payment_date,
    }]
    let returnData = {
      invoice_vessel_name: mnr.mnr_ledger_vessel_name,
      invoice_vessel_voyage: mnr.mnr_ledger_vessel_voyage,
      invoice_masterbi_bl: mnr.mnr_ledger_bl,
      container_size_type: mnr.mnr_ledger_container_size,
      invoice_masterbi_destination: mnr.mnr_ledger_destination,
      invoice_masterbi_cargo_type: mnr.mnr_ledger_cargo_type,
      mnr_containers: containers
    }
    return common.success(returnData)
  }
  return common.success()
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