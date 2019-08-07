const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')

const tb_user = model.common_user
const tb_billlading = model.zhongtan_billlading
const tb_uploadfile = model.zhongtan_uploadfile

exports.initAct = async () => {
  let returnData = {
    BLSTATUSINFO: [{ id: 'IV', text: 'Invoice', style: 'label-invoice' }, { id: 'RE', text: 'Receipt', style: 'label-receipt' }]
  }

  return common.success(returnData)
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

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_billlading 
                    where state = '1'
                    and (billlading_state = 'IV' OR billlading_state = 'RE')`
  let replacements = []

  if (doc.billlading_state) {
    queryStr += ' and billlading_state = ?'
    replacements.push(doc.billlading_state)
  }

  if (doc.customer) {
    queryStr += ' and billlading_customer_id = ?'
    replacements.push(doc.customer)
  }

  if (doc.search_text) {
    queryStr += ' and billlading_no like ?'
    let search_text = '%' + doc.search_text + '%'
    replacements.push(search_text)
  }

  if (doc.start_date) {
    queryStr += ' and created_at >= ? and created_at <= ?'
    replacements.push(doc.start_date)
    replacements.push(
      moment(doc.end_date, 'YYYY-MM-DD')
        .add(1, 'days')
        .format('YYYY-MM-DD')
    )
  }
  queryStr += ' order by created_at desc'

  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = []

  for (let bl of result.data) {
    let d = JSON.parse(JSON.stringify(bl))

    let customer = await tb_user.findOne({
      where: {
        user_id: d.billlading_customer_id
      }
    })

    d.customerINFO = {
      name: customer.user_name,
      address: customer.user_address,
      email: customer.user_email,
      phone: customer.user_phone
    }

    d.booking_date = moment(bl.created_at).format('YYYY-MM-DD')

    d.files = []
    let files = await tb_uploadfile.findAll({
      where: {
        uploadfile_index1: d.billlading_id
      },
      order: [['created_at', 'DESC']]
    })
    for (let f of files) {
      let filetype = ''
      if (f.api_name === 'BOOKING-INVOICE') {
        filetype = 'Invoice'
        d.files.push({
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          name: f.uploadfile_name,
          remark: f.uploadfile_remark
        })
      } else if (f.api_name === 'BOOKING-RECEIPT') {
        filetype = 'Receipt'
        d.files.push({
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          name: f.uploadfile_name,
          remark: f.uploadfile_remark
        })
      }
    }

    // d.fees = {}
    // d.fees.billlading_teu_standard = common.money2Str(d.billlading_teu_standard)
    // d.fees.billlading_feu_standard = common.money2Str(d.billlading_feu_standard)
    // d.fees.billlading_feu_high_cube = common.money2Str(d.billlading_feu_high_cube)
    // d.billlading_teu_standard_f = common.money2Str(d.billlading_teu_standard)
    // d.billlading_feu_standard_f = common.money2Str(d.billlading_feu_standard)
    // d.billlading_feu_high_cube_f = common.money2Str(d.billlading_feu_high_cube)
    // d.fees.sum_fee = common.money2Str(d.billlading_teu_standard + d.billlading_feu_standard + d.billlading_feu_high_cube)

    d.sum_fee = common.money2Str(
      d.billlading_invoice_freight +
        d.billlading_invoice_blanding +
        d.billlading_invoice_tasac +
        d.billlading_invoice_ammendment +
        d.billlading_invoice_isp +
        d.billlading_invoice_surchage
    )
    d.billlading_invoice_freight = common.money2Str(d.billlading_invoice_freight)
    d.billlading_invoice_blanding = common.money2Str(d.billlading_invoice_blanding)
    d.billlading_invoice_tasac = common.money2Str(d.billlading_invoice_tasac)
    d.billlading_invoice_ammendment = common.money2Str(d.billlading_invoice_ammendment)
    d.billlading_invoice_isp = common.money2Str(d.billlading_invoice_isp)
    d.billlading_invoice_surchage = common.money2Str(d.billlading_invoice_surchage)

    returnData.rows.push(d)
  }

  logger.info('success')

  return common.success(returnData)
}

exports.receiptAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      state: GLBConfig.ENABLE
    }
  })

  if (billlading.billlading_state != GLBConfig.BLSTATUS_INVOICE) {
    return common.error('billlading_01')
  } else {
    billlading.billlading_state = GLBConfig.BLSTATUS_RECEIPT
    billlading.billlading_received_from = doc.billlading_received_from
    billlading.billlading_received = doc.billlading_received
    billlading.billlading_receipt_operator = user.user_id
    billlading.billlading_receipt_time = new Date()
    await billlading.save()

    let renderData = JSON.parse(JSON.stringify(billlading))

    let fileInfo = await common.ejs2Pdf('receipt.ejs', renderData, 'zhongtan')

    await tb_uploadfile.create({
      api_name: 'BOOKING-RECEIPT',
      user_id: user.user_id,
      uploadfile_index1: billlading.billlading_id,
      uploadfile_name: fileInfo.name,
      uploadfile_url: fileInfo.url
    })

    return common.success({url: fileInfo.url})
  }
}
