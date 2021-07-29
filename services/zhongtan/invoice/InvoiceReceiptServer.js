const moment = require('moment')
const numberToText = require('number2text')
// const logger = require('../../../app/logger').createLogger(__filename)
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')
const opSrv = require('../../common/system/OperationPasswordServer')
const Op = model.Op

const tb_user = model.common_user
const tb_bl = model.zhongtan_invoice_masterbl
const tb_vessel = model.zhongtan_invoice_vessel
const tb_uploadfile = model.zhongtan_uploadfile

exports.initAct = async () => {
  let VESSEL_VOYAGE = []
  let queryStr = `SELECT invoice_vessel_id, concat(invoice_vessel_name, ' / ', invoice_vessel_voyage) as invoice_vessel FROM tbl_zhongtan_invoice_vessel WHERE state = '1' ORDER BY invoice_vessel_id DESC;`
  let replacements = []
  let vessels = await model.simpleSelect(queryStr, replacements)
  if(vessels) {
    for(let d of vessels) {
      VESSEL_VOYAGE.push(d)
    }
  }

  let CUSTOMER = []
  let RECEIVES = []
  queryStr = `SELECT user_id, user_name FROM tbl_common_user WHERE state = '1' AND user_type = ? ORDER BY user_name`
  replacements = [GLBConfig.TYPE_CUSTOMER]
  let deliverys = await model.simpleSelect(queryStr, replacements)
  if(deliverys) {
    for(let d of deliverys) {
      CUSTOMER.push(d)
      let dt = d.user_name.trim()
      if(RECEIVES.indexOf(dt) < 0) {
        RECEIVES.push(dt)
      }
    }
  }

  let returnData = {
    TFINFO: GLBConfig.TFINFO,
    RECEIPT_TYPE_INFO: GLBConfig.RECEIPT_TYPE_INFO,
    CASH_BANK_INFO: GLBConfig.CASH_BANK_INFO,
    RECEIPT_CURRENCY: GLBConfig.RECEIPT_CURRENCY,
    VESSEL_VOYAGE: VESSEL_VOYAGE,
    CUSTOMER: CUSTOMER,
    RECEIVES: RECEIVES
  }

  return common.success(returnData)
}

exports.searchVoyageAct = async req => {
  let doc = common.docValidate(req),
    returnData = { masterbl: {}, vessels: [] },
    queryStr = '',
    replacements = [],
    vessels = []

  if (doc.bl || doc.invoice_no) {
    queryStr = `select a.*, b.user_name from tbl_zhongtan_invoice_masterbl a LEFT JOIN tbl_common_user b ON b.user_id = a.invoice_masterbi_customer_id WHERE a.state = ? `
    replacements = [GLBConfig.ENABLE]
    if(doc.bl) {
      queryStr += `  AND a.invoice_masterbi_bl = ? `
      replacements.push(doc.bl)
    }
    if(doc.invoice_no) {
      queryStr += `  AND a.invoice_masterbi_id in (SELECT uploadfile_index1 FROM tbl_zhongtan_uploadfile WHERE state = ? AND api_name in ('RECEIPT-FEE', 'RECEIPT-DEPOSIT') AND uploadfile_invoice_no LIKE ?) `
      replacements.push(GLBConfig.ENABLE)
      replacements.push('%' + doc.invoice_no)
    }
    let result = await model.queryWithCount(doc, queryStr, replacements)
    returnData.masterbl.total = result.count
    returnData.masterbl.rows = []

    let diff_vessel = []
    for (let b of result.data) {
      if(diff_vessel && diff_vessel.length > 0) {
        if(!common.isContain(diff_vessel, b.invoice_vessel_id)) {
          diff_vessel.push(b.invoice_vessel_id)
        }
      } else {
        diff_vessel.push(b.invoice_vessel_id)
      }
    }
    if(!diff_vessel || diff_vessel.length <= 1) {
      for (let b of result.data) {
        let d = JSON.parse(JSON.stringify(b))
        d.customerINFO = [
          {
            id: d.invoice_masterbi_customer_id,
            text: d.user_name
          }
        ]
        if (d.invoice_masterbi_tasac && d.invoice_masterbi_tasac_receipt 
          && parseFloat(d.invoice_masterbi_tasac) > parseFloat(d.invoice_masterbi_tasac_receipt)) {
            d.invoice_masterbi_tasac = parseFloat(d.invoice_masterbi_tasac) - parseFloat(d.invoice_masterbi_tasac_receipt)
        } else if(d.invoice_masterbi_tasac && d.invoice_masterbi_tasac_receipt ){
          d.invoice_masterbi_tasac = ''
        }
        d.invoice_masterbi_do_release_date_fmt = moment(d.invoice_masterbi_do_release_date).format('DD/MM/YYYY hh:mm')
        d.invoice_masterbi_invoice_release_date_fmt = moment(d.invoice_masterbi_invoice_release_date).format('DD/MM/YYYY hh:mm')
        d.invoice_masterbi_receipt_release_date_fmt = moment(d.invoice_masterbi_receipt_release_date).format('DD/MM/YYYY hh:mm')
        d.invoice_container_deposit_currency = 'USD'
        d.invoice_ocean_freight_fee_currency = 'USD'
        d.invoice_fee_currency = 'USD'
        d = await this.getMasterbiFiles(d)
        returnData.masterbl.rows.push(d)
      }
    }
    if (diff_vessel.length > 0) {
      for (let b of diff_vessel) {
        let ves = await tb_vessel.findOne({
          where: {
            invoice_vessel_id: b,
            state: GLBConfig.ENABLE
          }
        })
        if(ves) {
          vessels.push(ves)
        }
      }
    }
  } else {
    queryStr = `select * from tbl_zhongtan_invoice_vessel where state = '1'`
    if (doc.start_date) {
      queryStr += ' and created_at >= ? and created_at <= ?'
      replacements.push(doc.start_date)
      replacements.push(
        moment(doc.end_date, 'YYYY-MM-DD')
          .add(1, 'days')
          .format('YYYY-MM-DD')
      )
    }

    if (doc.vesselName) {
      queryStr += ' and invoice_vessel_name like ? '
      replacements.push('%' + doc.vesselName + '%')
    }

    vessels = await model.simpleSelect(queryStr, replacements)
  }

  for (let v of vessels) {
    let row = JSON.parse(JSON.stringify(v))
    let rcount = await tb_bl.count({
      where: {
        invoice_vessel_id: v.invoice_vessel_id,
        invoice_masterbi_do_release_date: {
          [Op.ne]: null
        }
      }
    })
    let acount = await tb_bl.count({
      where: {
        invoice_vessel_id: v.invoice_vessel_id
      }
    })
    row.invoice_do_release_rcount = rcount
    row.invoice_acount = acount

    let ircount = await tb_bl.count({
      where: {
        invoice_vessel_id: v.invoice_vessel_id,
        invoice_masterbi_invoice_release_date: {
          [Op.ne]: null
        }
      }
    })
    row.invoice_invoice_release_rcount = ircount

    let rrcount = await tb_bl.count({
      where: {
        invoice_vessel_id: v.invoice_vessel_id,
        invoice_masterbi_receipt_release_date: {
          [Op.ne]: null
        }
      }
    })
    row.invoice_receipt_release_rcount = rrcount
    queryStr = `SELECT COUNT(DISTINCT invoice_containers_no) as count FROM tbl_zhongtan_invoice_containers WHERE invoice_vessel_id = ? AND state = ? AND invoice_containers_type = ? `
    replacements = []
    replacements.push(v.invoice_vessel_id)
    replacements.push(GLBConfig.ENABLE)
    replacements.push('S')
    let scount = await model.simpleSelect(queryStr, replacements)
    row.invoice_container_soc_count = scount[0].count

    queryStr = `SELECT COUNT(DISTINCT invoice_containers_no) as count FROM tbl_zhongtan_invoice_containers WHERE invoice_vessel_id = ? AND state = ? `
    replacements = []
    replacements.push(v.invoice_vessel_id)
    replacements.push(GLBConfig.ENABLE)
    let ccount = await model.simpleSelect(queryStr, replacements)
    row.invoice_container_count = ccount[0].count
    returnData.vessels.push(row)
  }

  return common.success(returnData)
}

exports.getMasterbiDataAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}

  let queryStr = `select a.*, b.user_name from tbl_zhongtan_invoice_masterbl a
  LEFT JOIN tbl_common_user b ON b.user_id = a.invoice_masterbi_customer_id
  WHERE a.invoice_vessel_id = ?`
  let replacements = [doc.invoice_vessel_id]
  if (doc.bl) {
    queryStr += `  AND a.invoice_masterbi_bl = ? `
    replacements.push(doc.bl)
  }
  if(doc.invoice_no) {
    queryStr += `  AND a.invoice_masterbi_id in (SELECT uploadfile_index1 FROM tbl_zhongtan_uploadfile WHERE state = ? AND api_name in ('RECEIPT-FEE', 'RECEIPT-DEPOSIT') AND uploadfile_invoice_no LIKE ?) `
    replacements.push(GLBConfig.ENABLE)
    replacements.push('%' + doc.invoice_no)
  }
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  returnData.rows = []

  for (let b of result.data) {
    let d = JSON.parse(JSON.stringify(b))
    d.customerINFO = [
      {
        id: d.invoice_masterbi_customer_id,
        text: d.user_name
      }
    ]
    if (d.invoice_masterbi_tasac && d.invoice_masterbi_tasac_receipt 
      && parseFloat(d.invoice_masterbi_tasac) > parseFloat(d.invoice_masterbi_tasac_receipt)) {
        d.invoice_masterbi_tasac = parseFloat(d.invoice_masterbi_tasac) - parseFloat(d.invoice_masterbi_tasac_receipt)
    } else if(d.invoice_masterbi_tasac && d.invoice_masterbi_tasac_receipt ){
      d.invoice_masterbi_tasac = ''
    }
    d.invoice_masterbi_do_release_date_fmt = moment(d.invoice_masterbi_do_release_date).format('DD/MM/YYYY hh:mm')
    d.invoice_masterbi_invoice_release_date_fmt = moment(d.invoice_masterbi_invoice_release_date).format('DD/MM/YYYY hh:mm')
    d.invoice_masterbi_receipt_release_date_fmt = moment(d.invoice_masterbi_receipt_release_date).format('DD/MM/YYYY hh:mm')
    // default invoice currency
    d.invoice_container_deposit_currency = 'USD'
    d.invoice_ocean_freight_fee_currency = 'USD'
    d.invoice_fee_currency = 'USD'
    d = await this.getMasterbiFiles(d)
    returnData.rows.push(d)
  }

  return common.success(returnData)
}

exports.getMasterbiFiles = async d => {
  d.files = []
  let queryStr = `SELECT a.*, b.user_name FROM tbl_zhongtan_uploadfile a
      left join tbl_common_user b on a.uploadfil_release_user_id = b.user_id
      WHERE a.state = '1' and a.uploadfile_index1 = ? order by created_at`
  let replacements = [d.invoice_masterbi_id]
  let files = await model.simpleSelect(queryStr, replacements)
  let lastReceiptDeposit = await tb_uploadfile.findOne({
    where: {
      state: GLBConfig.ENABLE,
      uploadfile_index1: d.invoice_masterbi_id,
      uploadfile_acttype: 'deposit'
    },
    order: [['created_at', 'DESC']]
  })
  let lastReceiptFee= await tb_uploadfile.findOne({
    where: {
      state: GLBConfig.ENABLE,
      uploadfile_index1: d.invoice_masterbi_id,
      uploadfile_acttype: 'fee'
    },
    order: [['created_at', 'DESC']]
  })
  for (let f of files) {
    let filetype = ''
    if (f.api_name === 'RECEIPT-DEPOSIT') {
      filetype = 'Deposit'
      d.files.push({
        invoice_masterbi_id: d.invoice_masterbi_id,
        filetype: filetype,
        date: moment(f.created_at).format('YYYY-MM-DD'),
        file_id: f.uploadfile_id,
        url: f.uploadfile_url,
        state: f.uploadfile_state,
        release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
        release_user: f.user_name,
        invoice_no: f.uploadfile_invoice_no
      })
      d.invoice_masterbi_deposit_state = f.uploadfile_state
      if (f.uploadfile_currency) {
        d.invoice_container_deposit_currency = f.uploadfile_currency
      }
      d.invoice_masterbi_deposit_comment = f.uploadfile_amount_comment
      if(f.uploadfile_state === 'AP' || f.uploadfil_release_date) {
        d.invoice_masterbi_deposit_release_date = f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : moment(f.updated_at).format('DD/MM/YYYY HH:mm')
        if(lastReceiptDeposit && moment(f.created_at).isAfter(lastReceiptDeposit.created_at)) {
          // 新审核deposit在最后一张收据之后
          d.invoice_masterbi_deposit_receipt_date = null
        }
      }
      if(f.uploadfile_received_from) {
        d.invoice_masterbi_deposit_received_from = f.uploadfile_received_from
      }
    } else if (f.api_name === 'RECEIPT-FEE') {
      filetype = 'Fee'
      d.files.push({
        invoice_masterbi_id: d.invoice_masterbi_id,
        filetype: filetype,
        date: moment(f.created_at).format('YYYY-MM-DD'),
        file_id: f.uploadfile_id,
        url: f.uploadfile_url,
        state: f.uploadfile_state,
        release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
        release_user: f.user_name,
        invoice_no: f.uploadfile_invoice_no
      })
      d.invoice_fee_state = f.uploadfile_state
      if (f.uploadfile_currency) {
        d.invoice_fee_currency = f.uploadfile_currency
      }
      d.invoice_fee_comment = f.uploadfile_amount_comment
      if(f.uploadfile_state === 'AP' || f.uploadfil_release_date) {
        d.invoice_masterbi_fee_release_date = f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : moment(f.updated_at).format('DD/MM/YYYY HH:mm')
        if(lastReceiptFee && moment(f.created_at).isAfter(lastReceiptFee.created_at)) {
          // 新审核Fee在最后一张收据之后
          d.invoice_masterbi_invoice_receipt_date = null
        }
      }
      if(f.uploadfile_received_from) {
        d.invoice_masterbi_invoice_received_from = f.uploadfile_received_from
      }
    } else if (f.api_name === 'RECEIPT-OF') {
      filetype = 'Freight'
      d.files.push({
        invoice_masterbi_id: d.invoice_masterbi_id,
        filetype: filetype,
        date: moment(f.created_at).format('YYYY-MM-DD'),
        file_id: f.uploadfile_id,
        url: f.uploadfile_url,
        state: f.uploadfile_state,
        release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
        release_user: f.user_name
      })
      d.invoice_ocean_freight_fee_state = f.uploadfile_state
      if (f.uploadfile_currency) {
        d.invoice_masterbi_of_currency = f.uploadfile_currency
      }
      d.invoice_masterbi_of_comment = f.uploadfile_amount_comment
      if(f.uploadfile_state === 'AP' || f.uploadfil_release_date) {
        d.invoice_masterbi_fee_release_date = f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : moment(f.updated_at).format('DD/MM/YYYY HH:mm')
      }
    } else if (f.api_name === 'RECEIPT-DO') {
      filetype = 'DO'
      d.files.push({
        invoice_masterbi_id: d.invoice_masterbi_id,
        filetype: filetype,
        date: moment(f.created_at).format('YYYY-MM-DD'),
        file_id: f.uploadfile_id,
        url: f.uploadfile_url,
        state: f.uploadfile_state,
        release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
        release_user: f.user_name,
        edi_state: d.invoice_masterbi_do_edi_state
      })
    } else if (f.api_name === 'RECEIPT-RECEIPT') {
      filetype = 'Receipt'
      d.files.push({
        invoice_masterbi_id: d.invoice_masterbi_id,
        filetype: filetype,
        receipt_type: f.uploadfile_acttype,
        date: moment(f.created_at).format('YYYY-MM-DD'),
        file_id: f.uploadfile_id,
        url: f.uploadfile_url,
        state: f.uploadfile_state,
        release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
        release_user: f.user_name
      })
      // if(f.uploadfile_acttype === 'deposit') {
      //   let rcount = await tb_uploadfile.count({
      //     where: {
      //       uploadfile_index1: d.invoice_masterbi_id,
      //       api_name: 'RECEIPT-DEPOSIT',
      //       uploadfil_release_date: {
      //         [Op.gt]: f.created_at
      //       }
      //     }
      //   })
      //   if(rcount <= 0) {
      //     d.invoice_masterbi_deposit_receipt_date = moment(f.created_at).format('DD/MM/YYYY HH:mm')
      //   } else {
      //     d.invoice_masterbi_invoice_receipt_date = null
      //   }
      // } else if(f.uploadfile_acttype === 'fee') {
      //   let rcount = await tb_uploadfile.count({
      //     where: {
      //       uploadfile_index1: d.invoice_masterbi_id,
      //       api_name: 'RECEIPT-FEE',
      //       uploadfil_release_date: {
      //         [Op.gt]: f.created_at
      //       }
      //     }
      //   })
      //   if(rcount <= 0) {
      //     d.invoice_masterbi_invoice_receipt_date = moment(f.created_at).format('DD/MM/YYYY HH:mm')
      //   } else {
      //     d.invoice_masterbi_invoice_receipt_date = null
      //   }
      // }
    }
  }
  return d
}

exports.getContainersDataAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}

  let queryStr = `select *
  from
  tbl_zhongtan_invoice_containers
  WHERE
    invoice_vessel_id = ?`
  let replacements = [doc.invoice_vessel_id]
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  returnData.rows = result.data

  return common.success(returnData)
}

exports.downloadReceiptAct = async req => {
  let doc = common.docValidate(req),
    user = req.user, curDate = new Date()

  if (!doc.checkType) {
    return common.error('import_06')
  }

  let commonUser = await tb_user.findOne({
    where: {
      user_id: user.user_id
    }
  })
  
  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: doc.invoice_masterbi_id
    }
  })
  bl.invoice_masterbi_receipt_amount = doc.invoice_masterbi_receipt_amount
  bl.invoice_masterbi_receipt_currency = doc.invoice_masterbi_receipt_currency
  bl.invoice_masterbi_check_cash = doc.invoice_masterbi_check_cash
  bl.invoice_masterbi_check_no = doc.invoice_masterbi_check_no
  bl.invoice_masterbi_bank_reference_no = doc.invoice_masterbi_bank_reference_no
  if(doc.invoice_masterbi_received_from) {
    bl.invoice_masterbi_received_from = doc.invoice_masterbi_received_from
  } else if(bl.invoice_masterbi_customer_id){
    let customer = await tb_user.findOne({
      where: {
        user_id: bl.invoice_masterbi_customer_id
      }
    })
    if(customer) {
      bl.invoice_masterbi_received_from = customer.user_name
    }
  }
  if(!doc.invoice_masterbi_received_from) {
    return common.error('import_04')
  }
  bl.invoice_masterbi_receipt_no = await seq.genInvoiceReceiptNo(bl.invoice_masterbi_carrier)
  let receipt_type = ''
  if(doc.checkType === 'deposit') {
    bl.invoice_masterbi_deposit_receipt_date = curDate
    receipt_type = 'DEPOSIT'
  } else if(doc.checkType === 'fee') {
    if(bl.invoice_masterbi_tasac) {
      bl.invoice_masterbi_tasac_receipt = bl.invoice_masterbi_tasac
    }
    bl.invoice_masterbi_invoice_receipt_date = curDate
    receipt_type = 'INVOICE FEE'
  }
  if(common.checkDoState(bl)) {
    bl.invoice_masterbi_receipt_release_date = curDate
  }
  let renderData = JSON.parse(JSON.stringify(bl))
  renderData.receipt_type = receipt_type
  renderData.receipt_date = moment().format('MMM DD, YYYY')
  if (bl.invoice_masterbi_check_cash === 'CASH') {
    renderData.check_cash = 'Cash'
  } else if (bl.invoice_masterbi_check_cash === 'TRANSFER') {
    renderData.check_cash = 'Bank transfer/ ' + bl.invoice_masterbi_bank_reference_no
  } else {
    renderData.check_cash = 'Cheque/ ' + bl.invoice_masterbi_check_no
  }
  renderData.sum_fee = parseFloat(bl.invoice_masterbi_receipt_amount.replace(/,/g, '') || 0)
  renderData.sum_fee_str = numberToText(renderData.sum_fee, 'english')
  renderData.user_name = commonUser.user_name
  renderData.user_phone = commonUser.user_phone
  renderData.user_email = commonUser.user_email
  try {
    let fileInfo = await common.ejs2Pdf('receipta.ejs', renderData, 'zhongtan')
    await tb_uploadfile.create({
      api_name: 'RECEIPT-RECEIPT',
      user_id: user.user_id,
      uploadfile_index1: bl.invoice_masterbi_id,
      uploadfile_name: fileInfo.name,
      uploadfile_url: fileInfo.url,
      uploadfile_acttype: doc.checkType,
      uploadfile_amount: doc.invoice_masterbi_receipt_amount,
      uploadfile_currency: doc.invoice_masterbi_receipt_currency,
      uploadfile_check_cash: doc.invoice_masterbi_check_cash,
      uploadfile_check_no: doc.invoice_masterbi_check_no,
      uploadfile_received_from: doc.invoice_masterbi_received_from,
      uploadfile_receipt_no: bl.invoice_masterbi_receipt_no,
      uploadfil_release_date: curDate,
      uploadfil_release_user_id: user.user_id,
      uploadfile_bank_reference_no: doc.invoice_masterbi_bank_reference_no,
    })
    await bl.save()
    return common.success({ url: fileInfo.url })
  } catch(e) {
    return common.error('generate_file_01')
  }
}

exports.doReleaseAct = async req => {
  let doc = common.docValidate(req),
    user = req.user, curDate = new Date()
  let file = await tb_uploadfile.findOne({
    where: {
      uploadfile_id: doc.file_id
    }
  })
  file.uploadfil_release_date = curDate
  file.uploadfil_release_user_id = user.user_id
  await file.save()

  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: file.uploadfile_index1
    }
  })
  if(common.checkDoState(bl)) {
    bl.invoice_masterbi_receipt_release_date = curDate
    await bl.save()
  }

  return common.success()
}

exports.downloadCollectAct = async (req, res) => {
  let doc = common.docValidate(req)
  let queryStr = `SELECT *
    FROM
      tbl_zhongtan_invoice_masterbl a ,
      tbl_zhongtan_uploadfile b ,
      tbl_common_user c,
      tbl_zhongtan_invoice_vessel v
    WHERE a.state = '1' AND b.state = '1' AND v.state = '1'
    AND a.invoice_masterbi_id = b.uploadfile_index1
    AND a.invoice_masterbi_customer_id = c.user_id
    AND a.invoice_vessel_id = v.invoice_vessel_id`
  let replacements = []
  let receiptFlg = true
  if(doc.carrier) {
    queryStr = queryStr + ` AND a.invoice_masterbi_carrier = ? `
    replacements.push(doc.carrier)
  }
  if(doc.collect_date && doc.collect_date.length === 2 && doc.collect_date[0] && doc.collect_date[1]) {
    receiptFlg = false
    queryStr = queryStr + ` AND STR_TO_DATE(v.invoice_vessel_ata, "%d/%m/%Y") >= ? AND STR_TO_DATE(v.invoice_vessel_ata, "%d/%m/%Y") < ? `
    replacements.push(doc.collect_date[0])
    replacements.push(moment(doc.collect_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
  }
  if(doc.receipt_date && doc.receipt_date.length === 2 && doc.receipt_date[0] && doc.receipt_date[1]) {
    queryStr = queryStr + ` AND b.created_at >= ? AND b.created_at < ? `
    replacements.push(doc.receipt_date[0])
    replacements.push(moment(doc.receipt_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
  }
  if(receiptFlg) {
    queryStr = queryStr + ` AND b.uploadfile_acttype IN('deposit' , 'fee' , 'freight') `
  }
  queryStr = queryStr + ` order by v.invoice_vessel_id desc, a.invoice_masterbi_bl`
  let result = await model.simpleSelect(queryStr, replacements)
  let renderData = []
  for (let r of result) {
    let row = {}
    row.date = moment(r.uploadfil_release_date).format('YYYY/MM/DD')
    row.invoice_masterbi_receipt_no = r.uploadfile_receipt_no
    row.invoice_masterbi_receipt_currency = r.uploadfile_currency
    row.sum_amount = r.uploadfile_amount
    row.bc = ''
    if (r.uploadfile_check_cash === 'CASH') {
      row.bc = '1'
    } else if (r.uploadfile_check_cash === 'CHEQUE') {
      row.bc = '2'
    } else if (r.uploadfile_check_cash === 'TRANSFER') {
      row.bc = '3'
    }
    row.user_name = r.user_name
    row.invoice_masterbi_bl = r.invoice_masterbi_bl
    row.invoice_masterbi_check_no = r.uploadfile_check_no
    row.invoice_masterbi_bank_reference_no = r.uploadfile_bank_reference_no
    row.invoice_masterbi_deposit = ''
    row.invoice_masterbi_bl_amendment = ''
    row.invoice_masterbi_cod_charge = ''
    row.invoice_masterbi_of = ''
    row.invoice_masterbi_transfer = ''
    row.invoice_masterbi_lolf = ''
    row.invoice_masterbi_lcl = ''
    row.invoice_masterbi_amendment = ''
    row.invoice_masterbi_tasac = ''
    row.invoice_masterbi_printing = ''
    row.invoice_masterbi_others = ''
    if (r.uploadfile_acttype === 'deposit') {
      row.invoice_masterbi_deposit = r.invoice_masterbi_deposit
    }
    if (r.uploadfile_acttype === 'fee') {
      row.invoice_masterbi_of = r.invoice_masterbi_of
      row.invoice_masterbi_bl_amendment = r.invoice_masterbi_bl_amendment
      row.invoice_masterbi_cod_charge = r.invoice_masterbi_cod_charge
      row.invoice_masterbi_transfer = r.invoice_masterbi_transfer
      row.invoice_masterbi_lolf = r.invoice_masterbi_lolf
      row.invoice_masterbi_lcl = r.invoice_masterbi_lcl
      row.invoice_masterbi_amendment = r.invoice_masterbi_amendment
      row.invoice_masterbi_tasac = r.invoice_masterbi_tasac
      row.invoice_masterbi_printing = r.invoice_masterbi_printing
      row.invoice_masterbi_others = r.invoice_masterbi_others
    }
    row.invoice_vessel_name = r.invoice_vessel_name
    row.invoice_vessel_voyage = r.invoice_vessel_voyage
    renderData.push(row)
  }

  let filepath = await common.ejs2xlsx('collectTemplate.xlsx', renderData)

  res.sendFile(filepath)
}

exports.doUndoReleaseAct = async req => {
  let doc = common.docValidate(req), user = req.user

  if(!doc.undo_release_password) {
    return common.error('auth_18')
  } else {
    let adminUser = await tb_user.findOne({
      where: {
        user_username: 'admin'
      }
    })
    if(adminUser) {
      if(adminUser.user_password !== doc.undo_release_password) {
        return common.error('auth_24')
      }
    } else {
      return common.error('auth_18')
    }
  }
  let file = await tb_uploadfile.findOne({
    where: {
      uploadfile_id: doc.file_id
    }
  })
  file.uploadfil_release_date = null
  file.uploadfil_release_user_id = null
  file.uploadfil_undo_release_date = new Date()
  file.uploadfil_undo_release_user_id = user.user_id
  await file.save()

  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: file.uploadfile_index1
    }
  })
  if(file.api_name === 'RECEIPT-DEPOSIT' || file.api_name === 'RECEIPT-FEE') {
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
          [Op.eq]: null
        }
      }
    })
    if(acount === rcount) {
      bl.invoice_masterbi_invoice_release_date = null
      await bl.save()
    }
  } else if (file.api_name === 'RECEIPT-DO') {
    bl.invoice_masterbi_do_release_date = null
    await bl.save()
  } else if (file.api_name === 'RECEIPT-RECEIPT') {
    let acount = await tb_uploadfile.count({
      where: {
        uploadfile_index1: file.uploadfile_index1,
        api_name: 'RECEIPT-RECEIPT'
      }
    })

    let rcount = await tb_uploadfile.count({
      where: {
        uploadfile_index1: file.uploadfile_index1,
        api_name: 'RECEIPT-RECEIPT',
        uploadfil_release_date: {
          [Op.eq]: null
        }
      }
    })
    if(acount === rcount) {
      bl.invoice_masterbi_receipt_release_date = null
      await bl.save()
    }
  }
  return common.success()
}

exports.exportReceiptAct = async (req, res) => {
  let doc = common.docValidate(req)
  let queryStr = `SELECT a.*, b.invoice_vessel_ata, b.invoice_vessel_name, b.invoice_vessel_voyage 
            FROM tbl_zhongtan_invoice_masterbl a LEFT JOIN tbl_zhongtan_invoice_vessel b ON a.invoice_vessel_id = b.invoice_vessel_id 
            WHERE a.state = ? AND b.state = ? `
  let replacements = [GLBConfig.ENABLE, GLBConfig.ENABLE]
  if(doc.invoice_vessel_id) {
    queryStr += ` AND a.invoice_vessel_id = ? `
    replacements.push(doc.invoice_vessel_id)
  }
  if(doc.invoice_vessel_ata && doc.invoice_vessel_ata.length > 1 && doc.invoice_vessel_ata[0] && doc.invoice_vessel_ata[1]) {
    queryStr += ' and STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y") >= ? and STR_TO_DATE(b.invoice_vessel_ata, "%d/%m/%Y") < ? '
    replacements.push(doc.invoice_vessel_ata[0])
    replacements.push(moment(doc.invoice_vessel_ata[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
  }
  let customer = {}
  if(doc.invoice_customer_id) {
    customer = await tb_user.findOne({
      where: {
        user_id: doc.invoice_customer_id
      }
    })
    queryStr += ` AND (a.invoice_masterbi_customer_id = ? OR a.invoice_masterbi_delivery_to = ?) `
    replacements.push(doc.invoice_customer_id)
    replacements.push(customer.user_name.trim())
  }
  if(doc.invoice_do_date && doc.invoice_do_date.length > 1 && doc.invoice_do_date[0] && doc.invoice_do_date[1]) {
    queryStr += ' and a.invoice_masterbi_do_date >= ? and a.invoice_masterbi_do_date < ? '
    replacements.push(doc.invoice_do_date[0])
    replacements.push(moment(doc.invoice_do_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
  }
  let result = await model.simpleSelect(queryStr, replacements)
  let renderData = []
  for (let r of result) {
    let row = {}
    row.bl = r.invoice_masterbi_bl
    row.vessel = r.invoice_vessel_name + '/' + r.invoice_vessel_voyage
    row.vessel_ata = r.invoice_vessel_ata
    row.cargo = r.invoice_masterbi_cargo_type
    row.bl_type = r.invoice_masterbi_bl_type
    row.destination = r.invoice_masterbi_destination
    row.delivery = r.invoice_masterbi_delivery
    row.freight_terms = r.invoice_masterbi_freight
    row.loading = r.invoice_masterbi_loading
    row.containers_number = r.invoice_masterbi_container_no
    row.exporter_name = r.invoice_masterbi_exporter_name
    row.exporter_address = r.invoice_masterbi_exporter_address
    row.consignee_name = r.invoice_masterbi_consignee_name
    row.consignee_address = r.invoice_masterbi_consignee_address
    row.notify_name = r.invoice_masterbi_notify_name
    row.notify_address = r.invoice_masterbi_notify_address
    row.do_release_party = r.invoice_masterbi_delivery_to ? r.invoice_masterbi_delivery_to.trim() : ''
    if(doc.invoice_customer_id && doc.invoice_customer_id === r.invoice_masterbi_customer_id) { 
      row.container_deposit_party = r.invoice_masterbi_customer_id ? customer.user_name.trim() : ''
    } else if(r.invoice_masterbi_customer_id){
      customer = await tb_user.findOne({
        where: {
          user_id: r.invoice_masterbi_customer_id
        }
      })
      if(customer) {
        row.container_deposit_party = customer.user_name.trim()
      }
    }
    row.do_date = r.invoice_masterbi_do_date
    if(r.invoice_masterbi_do_date) {
      let file = await tb_uploadfile.findOne({
        where: {
          state: GLBConfig.ENABLE,
          api_name: 'RECEIPT-DO',
          uploadfile_index1: r.invoice_masterbi_id
        },
        order: [['uploadfile_id', 'DESC']]
      })
      if(file && file.user_id) {
        let user = await tb_user.findOne({
          where: {
            user_id: file.user_id
          }
        })
        if(user) {
          row.do_user = user.user_name
        }
      }
    }
    row.empty_return_depot = r.invoice_masterbi_do_return_depot
    renderData.push(row)
  }
  let filepath = await common.ejs2xlsx('exportReceiptTemplate.xlsx', renderData)
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