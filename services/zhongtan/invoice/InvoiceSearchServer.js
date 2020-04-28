const moment = require('moment')
// const logger = require('../../../app/logger').createLogger(__filename)
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')

const tb_user = model.common_user
const tb_vessel = model.zhongtan_invoice_vessel
const tb_bl = model.zhongtan_invoice_masterbl
const tb_container = model.zhongtan_invoice_containers
const tb_uploadfile = model.zhongtan_uploadfile

exports.initAct = async () => {
  let returnData = {
    TFINFO: GLBConfig.TFINFO,
    RECEIPT_TYPE_INFO: GLBConfig.RECEIPT_TYPE_INFO,
    CASH_BANK_INFO: GLBConfig.CASH_BANK_INFO,
    COLLECT_FLAG: GLBConfig.COLLECT_FLAG,
    RECEIPT_CURRENCY: GLBConfig.RECEIPT_CURRENCY,
    UPLOAD_STATE: GLBConfig.UPLOAD_STATE
  }

  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}

  let queryStr = `select
      a.*, b.user_name, v.*
    from
      tbl_zhongtan_invoice_masterbl a
    LEFT JOIN tbl_common_user b ON b.user_id = a.invoice_masterbi_customer_id
    LEFT JOIN tbl_zhongtan_invoice_vessel v ON v.invoice_vessel_id = a.invoice_vessel_id
    WHERE
      (a.invoice_masterbi_deposit_date IS NOT NULL OR a.invoice_masterbi_fee_date IS NOT NULL) AND a.invoice_masterbi_do_date is null AND a.state = ? `
  let replacements = [GLBConfig.ENABLE]
  if (doc.start_date && doc.end_date) {
    queryStr += ' AND ((a.invoice_masterbi_fee_date >= ? and a.invoice_masterbi_fee_date < ?) OR (a.invoice_masterbi_deposit_date >= ? and a.invoice_masterbi_deposit_date < ?))'
    replacements.push(doc.start_date)
    replacements.push(moment(doc.end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    replacements.push(doc.start_date)
    replacements.push(moment(doc.end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
  }
  if (doc.collect) {
    if (doc.collect === 'COLLECT') {
      queryStr += 'AND a.invoice_masterbi_freight = "COLLECT" '
    } else {
      queryStr += 'AND (a.invoice_masterbi_freight != "COLLECT" OR a.invoice_masterbi_freight IS NULL OR a.invoice_masterbi_freight = "")'
    }
  }
  if (doc.vesselName) {
    queryStr += ' and v.invoice_vessel_name like ? '
    replacements.push('%' + doc.vesselName + '%')
  }
  if (doc.bl) {
    queryStr += ' and a.invoice_masterbi_bl like ? '
    replacements.push('%' + doc.bl + '%')
  }
  queryStr += ' ORDER BY v.created_at DESC, a.invoice_masterbi_bl'
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
    d.invoice_masterbi_do_release_date_fmt = moment(d.invoice_masterbi_do_release_date).format('DD/MM/YYYY hh:mm')
    d.invoice_masterbi_invoice_release_date_fmt = moment(d.invoice_masterbi_invoice_release_date).format('DD/MM/YYYY hh:mm')
    // Carrier
    if(!d.invoice_masterbi_carrier) {
      if(d.invoice_masterbi_bl.indexOf('COS') >= 0) {
        d.invoice_masterbi_carrier  = 'COSCO'
      } else if(d.invoice_masterbi_bl.indexOf('OOLU') >= 0) {
        d.invoice_masterbi_carrier  = 'OOCL'
      }
    }
    // default invoice currency
    d.invoice_container_deposit_currency = 'USD'
    d.invoice_masterbi_of_currency = 'USD'
    d.invoice_fee_currency = 'USD'
    // container info
    queryStr = `SELECT invoice_containers_size, COUNT(invoice_containers_size) AS invoice_containers_count 
      FROM tbl_zhongtan_invoice_containers WHERE invoice_containers_bl= ? AND invoice_vessel_id = ? AND state = ? 
      GROUP BY invoice_containers_size ORDER BY invoice_containers_size`
    replacements = []
    replacements.push(d.invoice_masterbi_bl)
    replacements.push(d.invoice_vessel_id)
    replacements.push(GLBConfig.ENABLE)
    let continers = await model.simpleSelect(queryStr, replacements)

    let containerSize = ''
    for (let c of continers) {
      containerSize = containerSize + c.invoice_containers_size + ' * ' + c.invoice_containers_count + '    '
    }
    d.container_size_type = containerSize
    // D/O state
    d.invoice_masterbi_do_state = common.checkDoState(d)
    // delivery to
    if(!d.invoice_masterbi_delivery_to && d.customerINFO && d.customerINFO.length === 1) {
      d.invoice_masterbi_delivery_to = d.customerINFO[0].text
    }
    // file info
    d = await this.getMasterbiFiles(d)
    returnData.rows.push(d)
  }

  return common.success(returnData)
}

exports.getMasterbiFiles = async d => {
  d.files = []
  let queryStr = `SELECT a.*, b.user_name FROM tbl_zhongtan_uploadfile a
      left join tbl_common_user b on a.uploadfil_release_user_id = b.user_id
      WHERE a.uploadfile_index1 = ?`
  let replacements = [d.invoice_masterbi_id]
  let files = await model.simpleSelect(queryStr, replacements)
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
        release_user: f.user_name
      })
      d.invoice_masterbi_deposit_state = f.uploadfile_state
      if (f.uploadfile_currency) {
        d.invoice_container_deposit_currency = f.uploadfile_currency
      }
      d.invoice_masterbi_deposit_comment = f.uploadfile_amount_comment
      if(f.uploadfile_state === 'AP' || f.uploadfil_release_date) {
        d.invoice_masterbi_deposit_release_date = f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : moment(f.updated_at).format('DD/MM/YYYY HH:mm')
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
        release_user: f.user_name
      })
      d.invoice_fee_state = f.uploadfile_state
      if (f.uploadfile_currency) {
        d.invoice_fee_currency = f.uploadfile_currency
      }
      d.invoice_fee_comment = f.uploadfile_amount_comment
      if(f.uploadfile_state === 'AP' || f.uploadfil_release_date) {
        d.invoice_masterbi_fee_release_date = f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : moment(f.updated_at).format('DD/MM/YYYY HH:mm')
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
      if(f.uploadfile_acttype === 'deposit') {
        d.invoice_masterbi_deposit_receipt_date = moment(f.created_at).format('DD/MM/YYYY HH:mm')
      } else if(f.uploadfile_acttype === 'fee') {
        d.invoice_masterbi_invoice_receipt_date = moment(f.created_at).format('DD/MM/YYYY HH:mm')
      }
    }
  }
  return d
}

exports.downloadDoAct = async req => {
  let doc = common.docValidate(req),
    user = req.user
  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: doc.invoice_masterbi_id
    }
  })
  let delivery_order_no = ('000000000000000' + bl.invoice_masterbi_id).slice(-8)
  if (!bl.invoice_masterbi_do_release_date) {
    bl.invoice_masterbi_delivery_to = doc.invoice_masterbi_delivery_to
    bl.invoice_masterbi_do_date = moment().format('YYYY-MM-DD')
    bl.invoice_masterbi_valid_to = doc.invoice_masterbi_valid_to
    bl.invoice_masterbi_do_delivery_order_no = delivery_order_no
    await bl.save()
  }

  let vessel = await tb_vessel.findOne({
    where: {
      invoice_vessel_id: bl.invoice_vessel_id
    }
  })

  let continers = await tb_container.findAll({
    where: {
      invoice_vessel_id: bl.invoice_vessel_id,
      invoice_containers_bl: bl.invoice_masterbi_bl
    }
  })
  
  let renderData = JSON.parse(JSON.stringify(bl))
  renderData.delivery_order_no = delivery_order_no
  renderData.invoice_vessel_name = vessel.invoice_vessel_name
  renderData.invoice_vessel_voyage = vessel.invoice_vessel_voyage
  renderData.vessel_eta = moment(vessel.invoice_vessel_eta, 'DD-MM-YYYY').format('DD/MM/YYYY')
  renderData.do_date = moment(bl.invoice_masterbi_do_date).format('DD/MM/YYYY')
  renderData.valid_to = moment(bl.invoice_masterbi_valid_to).format('DD/MM/YYYY')
  renderData.delivery_to = common.getDelivery(bl.invoice_masterbi_delivery)
  renderData.user_name = user.user_name
  renderData.user_email = user.user_email
  renderData.containers = JSON.parse(JSON.stringify(continers))
  let cSize = []
  for (let i = 0; i < renderData.containers.length; i++) {
    renderData.containers[i].invoice_containers_tare = common.getContainerTare(renderData.containers[i].invoice_containers_size)
    if (cSize.indexOf(renderData.containers[i].invoice_containers_size) < 0) {
      cSize.push(renderData.containers[i].invoice_containers_size)
    }
  }
  renderData.container_count = bl.invoice_masterbi_container_no + 'X' + cSize.join(' ')

  let fileInfo = await common.ejs2Pdf('do.ejs', renderData, 'zhongtan')

  await tb_uploadfile.destroy({
    where: {
      api_name: 'RECEIPT-DO',
      uploadfile_index1: bl.invoice_masterbi_id
    }
  })

  await tb_uploadfile.create({
    api_name: 'RECEIPT-DO',
    user_id: user.user_id,
    uploadfile_index1: bl.invoice_masterbi_id,
    uploadfile_name: fileInfo.name,
    uploadfile_url: fileInfo.url
  })
  return common.success({ url: fileInfo.url })
}

exports.checkPasswordAct = async req => {
  let doc = common.docValidate(req)
  if(!doc.check_password) {
    return common.error('auth_18')
  } else {
    let adminUser = await tb_user.findOne({
      where: {
        user_username: 'admin'
      }
    })
    if(adminUser) {
      if(adminUser.user_password !== doc.check_password) {
        return common.error('auth_24')
      }
    } else {
      return common.error('auth_18')
    }
  }
  return common.success()
}