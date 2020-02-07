const moment = require('moment')
const numberToText = require('number2text')
// const logger = require('../../../app/logger').createLogger(__filename)
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const Op = model.Op

const tb_bl = model.zhongtan_invoice_masterbl
const tb_vessel = model.zhongtan_invoice_vessel
const tb_uploadfile = model.zhongtan_uploadfile

exports.initAct = async () => {
  let returnData = {
    TFINFO: GLBConfig.TFINFO,
    RECEIPT_TYPE_INFO: GLBConfig.RECEIPT_TYPE_INFO,
    CASH_BANK_INFO: GLBConfig.CASH_BANK_INFO
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
      let files = await tb_uploadfile.findAll({
        where: {
          uploadfile_index1: b.invoice_masterbi_id
        },
        order: [['created_at', 'DESC']]
      })
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
            release_date: f.uploadfil_release_date
          })
        } else if (f.api_name === 'RECEIPT-FEE') {
          filetype = 'Fee'
          d.files.push({
            invoice_masterbi_id: b.invoice_masterbi_id,
            filetype: filetype,
            date: moment(f.created_at).format('YYYY-MM-DD'),
            file_id: f.uploadfile_id,
            url: f.uploadfile_url,
            release_date: f.uploadfil_release_date
          })
        } else if (f.api_name === 'RECEIPT-DO') {
          filetype = 'DO'
          d.files.push({
            invoice_masterbi_id: b.invoice_masterbi_id,
            filetype: filetype,
            date: moment(f.created_at).format('YYYY-MM-DD'),
            file_id: f.uploadfile_id,
            url: f.uploadfile_url,
            release_date: f.uploadfil_release_date
          })
        } else if (f.api_name === 'RECEIPT-RECEIPT') {
          filetype = 'Receipt'
          d.files.push({
            invoice_masterbi_id: b.invoice_masterbi_id,
            filetype: filetype,
            date: moment(f.created_at).format('YYYY-MM-DD'),
            file_id: f.uploadfile_id,
            url: f.uploadfile_url,
            release_date: f.uploadfil_release_date
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
    let files = await tb_uploadfile.findAll({
      where: {
        uploadfile_index1: b.invoice_masterbi_id
      },
      order: [['created_at', 'DESC']]
    })
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
          release_date: f.uploadfil_release_date
        })
      } else if (f.api_name === 'RECEIPT-FEE') {
        filetype = 'Fee'
        d.files.push({
          invoice_masterbi_id: b.invoice_masterbi_id,
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          release_date: f.uploadfil_release_date
        })
      } else if (f.api_name === 'RECEIPT-DO') {
        filetype = 'DO'
        d.files.push({
          invoice_masterbi_id: b.invoice_masterbi_id,
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          release_date: f.uploadfil_release_date
        })
      } else if (f.api_name === 'RECEIPT-RECEIPT') {
        filetype = 'Receipt'
        d.files.push({
          invoice_masterbi_id: b.invoice_masterbi_id,
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          release_date: f.uploadfil_release_date
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
  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: doc.invoice_masterbi_id
    }
  })

  if (!bl.invoice_masterbi_receipt_release_date) {
    bl.invoice_masterbi_receipt_amount = doc.invoice_masterbi_receipt_amount
    bl.invoice_masterbi_check_cash = doc.invoice_masterbi_check_cash
    bl.invoice_masterbi_check_no = doc.invoice_masterbi_check_no
    bl.invoice_masterbi_received_from = doc.invoice_masterbi_received_from
    bl.invoice_masterbi_receipt_no =
      bl.invoice_masterbi_carrier + moment().format('YYYYMMDD') + ('000000000000000' + bl.invoice_masterbi_bl).slice(-4)
    await bl.save()
  }

  let renderData = JSON.parse(JSON.stringify(bl))
  renderData.receipt_date = moment().format('MMM DD, YYYY')

  if (bl.invoice_masterbi_check_cash === 'CASH') {
    renderData.check_cash = 'Cash'
  } else {
    renderData.check_cash = bl.invoice_masterbi_check_no
  }

  renderData.sum_fee = parseFloat(bl.invoice_masterbi_receipt_amount || 0)

  renderData.sum_fee_str = numberToText(renderData.sum_fee)

  let fileInfo = await common.ejs2Pdf('receipta.ejs', renderData, 'zhongtan')

  await tb_uploadfile.create({
    api_name: 'RECEIPT-RECEIPT',
    user_id: user.user_id,
    uploadfile_index1: bl.invoice_masterbi_id,
    uploadfile_name: fileInfo.name,
    uploadfile_url: fileInfo.url
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

  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: file.uploadfile_index1
    }
  })

  if (file.api_name === 'RECEIPT-DO') {
    bl.invoice_masterbi_do_release_date = file.uploadfil_release_date
  }

  if (file.api_name === 'RECEIPT-DEPOSIT' || file.api_name === 'RECEIPT-FEE') {
    bl.invoice_masterbi_invoice_release_date = file.uploadfil_release_date
  }

  if (file.api_name === 'RECEIPT-RECEIPT') {
    bl.invoice_masterbi_receipt_release_date = file.uploadfil_release_date
  }

  await file.save()
  await bl.save()

  return common.success()
}

exports.downloadCollectAct = async (req, res) => {
  let doc = common.docValidate(req)
  let queryStr = `SELECT	*
    FROM
      tbl_zhongtan_invoice_masterbl a 
    INNER JOIN tbl_zhongtan_invoice_vessel b on a.invoice_vessel_id = b.invoice_vessel_id
    LEFT JOIN tbl_common_user c ON c.user_id = a.invoice_masterbi_customer_id
    WHERE b.invoice_vessel_code = ?
    and a.invoice_masterbi_receipt_release_date > ?
    and a.invoice_masterbi_receipt_release_date < ?`
  let replacements = [
    doc.carrier,
    moment(doc.collect_date[0]).subtract(1, 'days').format('YYYY-MM-DD'),
    moment(doc.collect_date[1])
      .add(1, 'days')
      .format('YYYY-MM-DD')
  ]

  let result = await model.simpleSelect(queryStr, replacements)

  let renderData = []

  for (let r of result) {
    let row = JSON.parse(JSON.stringify(r))
    row.date = moment(r.invoice_masterbi_receipt_release_date).format('YYYY/MM/DD')
    renderData.push(row)
  }

  let filepath = await common.ejs2xlsx('collectTemplate.xlsx', renderData)

  res.sendFile(filepath)
}
