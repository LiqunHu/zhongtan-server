const moment = require('moment')
const numberToText = require('number2text')
// const logger = require('../../../app/logger').createLogger(__filename)
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')

const Op = model.Op

const tb_user = model.common_user
const tb_bl = model.zhongtan_invoice_masterbl
const tb_vessel = model.zhongtan_invoice_vessel
const tb_uploadfile = model.zhongtan_uploadfile

exports.initAct = async () => {
  let returnData = {
    TFINFO: GLBConfig.TFINFO,
    RECEIPT_TYPE_INFO: GLBConfig.RECEIPT_TYPE_INFO,
    CASH_BANK_INFO: GLBConfig.CASH_BANK_INFO,
    RECEIPT_CURRENCY: GLBConfig.RECEIPT_CURRENCY
  }

  return common.success(returnData)
}

exports.searchVoyageAct = async req => {
  let doc = common.docValidate(req),
    returnData = { masterbl: {}, vessels: [] },
    queryStr = '',
    replacements = [],
    vessels = []

  if (doc.bl) {
    queryStr = `select
      a.*, b.user_name
    from
      tbl_zhongtan_invoice_masterbl a
    LEFT JOIN tbl_common_user b ON b.user_id = a.invoice_masterbi_customer_id
    WHERE
      a.invoice_masterbi_bl = ?`
    replacements = [doc.bl]
    let result = await model.queryWithCount(doc, queryStr, replacements)
    returnData.masterbl.total = result.count
    returnData.masterbl.rows = []

    for (let b of result.data) {
      let d = JSON.parse(JSON.stringify(b))
      d.customerINFO = [
        {
          id: d.invoice_masterbi_customer_id,
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
      replacements = [b.invoice_masterbi_id]
      let files = await model.simpleSelect(queryStr, replacements)
      d.invoice_masterbi_do_release_date_fmt = moment(d.invoice_masterbi_do_release_date).format('DD/MM/YYYY hh:mm')
      d.invoice_masterbi_invoice_release_date_fmt = moment(d.invoice_masterbi_invoice_release_date).format('DD/MM/YYYY hh:mm')
      for (let f of files) {
        let filetype = ''
        if (f.api_name === 'RECEIPT-DEPOSIT') {
          filetype = 'Deposit'
          d.files.push({
            invoice_masterbi_id: b.invoice_masterbi_id,
            filetype: filetype,
            date: moment(f.created_at).format('YYYY-MM-DD'),
            file_id: f.uploadfile_id,
            url: f.uploadfile_url,
            release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
            release_user: f.user_name
          })
        } else if (f.api_name === 'RECEIPT-FEE') {
          filetype = 'Fee'
          d.files.push({
            invoice_masterbi_id: b.invoice_masterbi_id,
            filetype: filetype,
            date: moment(f.created_at).format('YYYY-MM-DD'),
            file_id: f.uploadfile_id,
            url: f.uploadfile_url,
            release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
            release_user: f.user_name
          })
        } else if (f.api_name === 'RECEIPT-OF') {
          filetype = 'Freight'
          d.files.push({
            invoice_masterbi_id: b.invoice_masterbi_id,
            filetype: filetype,
            date: moment(f.created_at).format('YYYY-MM-DD'),
            file_id: f.uploadfile_id,
            url: f.uploadfile_url,
            release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
            release_user: f.user_name
          })
        } else if (f.api_name === 'RECEIPT-DO') {
          filetype = 'DO'
          d.files.push({
            invoice_masterbi_id: b.invoice_masterbi_id,
            filetype: filetype,
            date: moment(f.created_at).format('YYYY-MM-DD'),
            file_id: f.uploadfile_id,
            url: f.uploadfile_url,
            release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
            release_user: f.user_name
          })
        } else if (f.api_name === 'RECEIPT-RECEIPT') {
          filetype = 'Receipt'
          d.files.push({
            invoice_masterbi_id: b.invoice_masterbi_id,
            filetype: filetype,
            date: moment(f.created_at).format('YYYY-MM-DD'),
            file_id: f.uploadfile_id,
            url: f.uploadfile_url,
            release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
            release_user: f.user_name
          })
        }
      }
      returnData.masterbl.rows.push(d)
    }

    if (result.data.length > 0) {
      vessels = await tb_vessel.findAll({
        where: {
          invoice_vessel_id: result.data[0].invoice_vessel_id
        }
      })
    }
  } else {
    queryStr = `select * from tbl_zhongtan_invoice_vessel
                    where state = '1'`

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
    returnData.vessels.push(row)
  }

  return common.success(returnData)
}

exports.getMasterbiDataAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}

  let queryStr = `select
    a.*, b.user_name
  from
    tbl_zhongtan_invoice_masterbl a
  LEFT JOIN tbl_common_user b ON b.user_id = a.invoice_masterbi_customer_id
  WHERE
    a.invoice_vessel_id = ?`
  let replacements = [doc.invoice_vessel_id]
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
    d.files = []
    queryStr = `SELECT
        a.*, b.user_name
      FROM
        tbl_zhongtan_uploadfile a
      left join tbl_common_user b on a.uploadfil_release_user_id = b.user_id
      WHERE
        a.uploadfile_index1 = ?`
    replacements = [b.invoice_masterbi_id]
    let files = await model.simpleSelect(queryStr, replacements)
    d.invoice_masterbi_do_release_date_fmt = moment(d.invoice_masterbi_do_release_date).format('DD/MM/YYYY hh:mm')
    d.invoice_masterbi_invoice_release_date_fmt = moment(d.invoice_masterbi_invoice_release_date).format('DD/MM/YYYY hh:mm')
    // default invoice currency
    d.invoice_container_deposit_currency = 'USD'
    d.invoice_ocean_freight_fee_currency = 'USD'
    d.invoice_fee_currency = 'USD'
    for (let f of files) {
      let filetype = ''
      if (f.api_name === 'RECEIPT-DEPOSIT') {
        filetype = 'Deposit'
        d.files.push({
          invoice_masterbi_id: b.invoice_masterbi_id,
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
          release_user: f.user_name
        })
        if (f.uploadfile_currency) {
          d.invoice_container_deposit_currency = f.uploadfile_currency
          d.invoice_masterbi_receipt_currency = f.uploadfile_currency
        }
      } else if (f.api_name === 'RECEIPT-FEE') {
        filetype = 'Fee'
        d.files.push({
          invoice_masterbi_id: b.invoice_masterbi_id,
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
          release_user: f.user_name
        })
        if (f.uploadfile_currency) {
          d.invoice_fee_currency = f.uploadfile_currency
        }
      } else if (f.api_name === 'RECEIPT-OF') {
        filetype = 'Freight'
        d.files.push({
          invoice_masterbi_id: b.invoice_masterbi_id,
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
          release_user: f.user_name
        })
        if (f.uploadfile_currency) {
          d.invoice_ocean_freight_fee_currency = f.uploadfile_currency
        }
      } else if (f.api_name === 'RECEIPT-DO') {
        filetype = 'DO'
        d.files.push({
          invoice_masterbi_id: b.invoice_masterbi_id,
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
          release_user: f.user_name
        })
      } else if (f.api_name === 'RECEIPT-RECEIPT') {
        filetype = 'Receipt'
        d.files.push({
          invoice_masterbi_id: b.invoice_masterbi_id,
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
          release_user: f.user_name
        })
      }
    }
    returnData.rows.push(d)
  }

  return common.success(returnData)
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
    user = req.user

  if (!doc.checkType) {
    return common.error('import_06')
  }

  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: doc.invoice_masterbi_id
    }
  })

  // if (!bl.invoice_masterbi_invoice_release_date) {
  //   return common.error('import_07')
  // }

  bl.invoice_masterbi_receipt_amount = doc.invoice_masterbi_receipt_amount
  bl.invoice_masterbi_receipt_currency = doc.invoice_masterbi_receipt_currency
  bl.invoice_masterbi_check_cash = doc.invoice_masterbi_check_cash
  bl.invoice_masterbi_check_no = doc.invoice_masterbi_check_no
  bl.invoice_masterbi_received_from = doc.invoice_masterbi_received_from
  bl.invoice_masterbi_receipt_no = await seq.genInvoiceReceiptNo(bl.invoice_masterbi_carrier)

  let renderData = JSON.parse(JSON.stringify(bl))
  renderData.receipt_date = moment().format('MMM DD, YYYY')

  if (bl.invoice_masterbi_check_cash === 'CASH') {
    renderData.check_cash = 'Cash'
  } else if (bl.invoice_masterbi_check_cash === 'TRANSFER') {
    renderData.check_cash = 'Bank transfer'
  } else {
    renderData.check_cash = bl.invoice_masterbi_check_no
  }

  renderData.sum_fee = parseFloat(bl.invoice_masterbi_receipt_amount.replace(/,/g, '') || 0)

  renderData.sum_fee_str = numberToText(renderData.sum_fee)

  let fileInfo = await common.ejs2Pdf('receipta.ejs', renderData, 'zhongtan')

  await tb_uploadfile.destroy({
    where: {
      api_name: 'RECEIPT-RECEIPT',
      uploadfile_index1: bl.invoice_masterbi_id,
      uploadfile_acttype: doc.checkType
    }
  })
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
    uploadfile_receipt_no: bl.invoice_masterbi_receipt_no
  })

  return common.success({ url: fileInfo.url })
}

exports.doReleaseAct = async req => {
  let doc = common.docValidate(req),
    user = req.user
  let file = await tb_uploadfile.findOne({
    where: {
      uploadfile_id: doc.file_id
    }
  })
  file.uploadfil_release_date = new Date()
  file.uploadfil_release_user_id = user.user_id
  await file.save()

  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: file.uploadfile_index1
    }
  })

  if (file.api_name === 'RECEIPT-RECEIPT') {
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
          [Op.ne]: null
        }
      }
    })
    if (acount === rcount) {
      bl.invoice_masterbi_receipt_release_date = file.uploadfil_release_date
      await bl.save()
    }
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
    WHERE
      b.uploadfile_acttype IN('deposit' , 'fee' , 'freight')
    AND a.invoice_masterbi_id = b.uploadfile_index1
    AND a.invoice_masterbi_customer_id = c.user_id
    AND a.invoice_vessel_id = v.invoice_vessel_id
    AND a.invoice_masterbi_carrier = ?
    AND b.created_at > ?
    AND b.created_at < ?`
  let replacements = [
    doc.carrier,
    moment(doc.collect_date[0])
      .add(1, 'days')
      .format('YYYY-MM-DD'),
    moment(doc.collect_date[1])
      .add(2, 'days')
      .format('YYYY-MM-DD')
  ]

  let result = await model.simpleSelect(queryStr, replacements)

  let renderData = []

  for (let r of result) {
    let row = {}
    row.date = moment(r.invoice_masterbi_receipt_release_date).format('YYYY/MM/DD')
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
    if (r.uploadfile_acttype === 'freight') {
      row.invoice_masterbi_of = r.invoice_masterbi_of
    }
    if (r.uploadfile_acttype === 'fee') {
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
  bl.invoice_masterbi_receipt_release_date = null
  await bl.save()
  return common.success()
}
