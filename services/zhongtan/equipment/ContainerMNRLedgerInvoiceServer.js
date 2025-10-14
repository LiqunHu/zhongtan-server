const moment = require('moment')
const numberToText = require('number2text')
const Decimal = require('decimal.js')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')
const opSrv = require('../../common/system/OperationPasswordServer')
const rateSrv = require('../configuration/ExchangeRateConfigServer')

const tb_mnr_ledger = model.zhongtan_container_mnr_ledger
const tb_uploadfile = model.zhongtan_uploadfile
const tb_user = model.common_user
const tb_discharge_port = model.zhongtan_discharge_port

exports.initAct = async () => {
  let returnData = {}
  let queryStr = `SELECT container_size_code, GROUP_CONCAT(container_size_name) container_size_name FROM tbl_zhongtan_container_size WHERE state = 1 GROUP BY container_size_code ORDER BY container_size_code`
  let replacements = []
  returnData['CONTAINER_SIZE'] = await model.simpleSelect(queryStr, replacements)
  returnData['DESTINATION'] = await tb_discharge_port.findAll({
    attributes: ['discharge_port_code', 'discharge_port_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['discharge_port_code', 'ASC']]
  })
  queryStr = `SELECT user_id, user_name FROM tbl_common_user WHERE state = 1 AND user_type = '${GLBConfig.TYPE_CUSTOMER}' ORDER BY user_name`
  replacements = []
  returnData['CUSTOMER'] = await model.simpleSelect(queryStr, replacements)
  returnData['UPLOAD_STATE'] = GLBConfig.UPLOAD_STATE
  returnData['MNR_CARGO_TYPE'] = GLBConfig.MNR_CARGO_TYPE
  returnData['MNR_DESCRIPTION'] = GLBConfig.MNR_DESCRIPTION
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `SELECT * from tbl_zhongtan_container_mnr_ledger WHERE state = '1' `
  let replacements = []
  if(doc.search_data) {
    if(doc.search_data.date && doc.search_data.date.length > 1 && doc.search_data.date[0] && doc.search_data.date[1]) {
      let start_date = doc.search_data.date[0]
      let end_date = doc.search_data.date[1]
      queryStr += ` AND created_at >= ? and created_at < ? `
      replacements.push(start_date)
      replacements.push(moment(end_date, 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.mnr_ledger_corresponding_payer_id) {
      queryStr += ' and mnr_ledger_corresponding_payer_id = ? '
      replacements.push(doc.search_data.mnr_ledger_corresponding_payer_id)
    }
    if (doc.search_data.mnr_ledger_bl) {
      queryStr += ' and mnr_ledger_bl like ? '
      replacements.push('%' + doc.search_data.mnr_ledger_bl + '%')
    }
    if (doc.search_data.container_no) {
      queryStr += ' and mnr_ledger_container_no like ? '
      replacements.push('%' + doc.search_data.container_no + '%')
    }
     if (doc.search_data.is_paid) {
      if(doc.search_data.is_paid === '1') {
        queryStr += ' and mnr_ledger_receipt_no IS NOT NULL '
      } else {
        queryStr += ' and mnr_ledger_receipt_no IS NULL '
      }
    }
  }
  queryStr += ' ORDER BY container_mnr_ledger_id DESC'
  let result = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = result.count
  returnData.rows = []
  for(let r of result.data) {
    r.mnr_atts = await tb_uploadfile.findAll({
      where: {
        api_name: 'MNR-LEDGER',
        uploadfile_index1: r.container_mnr_ledger_id
      }
    })
    r.invoice_disabled = true
    if(r.mnr_ledger_bl && r.mnr_ledger_container_no && r.mnr_ledger_container_size 
      && r.mnr_ledger_corresponding_payer_id && r.mnr_ledger_actual_charge_amount && r.mnr_atts && r.mnr_atts.length > 0) {
      r.invoice_disabled = false
    }
    queryStr = `SELECT a.*, b.user_name FROM tbl_zhongtan_uploadfile a
      left join tbl_common_user b on a.uploadfil_release_user_id = b.user_id
      WHERE a.uploadfile_index1 = ? and (api_name = ? or api_name = ?) and a.state = '1' order by a.uploadfile_id desc`
    replacements = [r.container_mnr_ledger_id, 'MNR-INVOICE', 'MNR-RECEIPT']
    r.mnr_files = []
    let files = await model.simpleSelect(queryStr, replacements)
    r.edit_disabled = false
    if(files) {
      for(let f of files) {
        if(f.api_name === 'MNR-INVOICE' && f.uploadfile_state === 'AP') {
          // 已审核的发票，不能修改
          r.edit_disabled = true
        }
        let filetype = 'MNR Invoice'
        if(f.api_name === 'MNR-RECEIPT') {
          filetype = 'MNR Receipt'
        }
        r.mnr_files.push({
          container_mnr_ledger_id: r.container_mnr_ledger_id,
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          state: f.uploadfile_state,
          release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
          release_user: f.user_name,
          receipt_status: !!r.mnr_ledger_receipt_date
        })
      }
    }
    returnData.rows.push(r)
  }
  return common.success(returnData)
}

exports.uploadAct = async req => {
  let fileInfo = await common.fileSaveTemp(req)
  let user = req.user
  let iu = await tb_uploadfile.findOne({
        where: {
          api_name: 'ContainerMNRLedgerInvoiceServer_temporary',
          uploadfile_name: fileInfo.name,
          state: GLBConfig.ENABLE,
        }
      });
  if(iu) {
    return common.error('import_16')
  } else {
    await tb_uploadfile.create({
      api_name: 'ContainerMNRLedgerInvoiceServer_temporary',
      user_id: user.user_id,
      uploadfile_index1: '0',
      uploadfile_name: fileInfo.name,
      uploadfile_url: fileInfo.path
    })
  }
  return common.success(fileInfo)
}

exports.addAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let queryStr = `SELECT * from tbl_zhongtan_container_mnr_ledger WHERE state = '1' AND mnr_ledger_container_no = ? AND mnr_ledger_description = ?`
  let replacements = [doc.mnr_ledger_container_no, doc.mnr_ledger_description]
  let existsMnr = await model.simpleSelect(queryStr, replacements)
  if(existsMnr && existsMnr.length > 0) {
    return common.error('mnr_01')
  }
  let mnr = await tb_mnr_ledger.create({
    mnr_ledger_container_no_id: doc.mnr_ledger_container_no_id,
    mnr_ledger_vessel_id: doc.mnr_ledger_vessel_id,
    mnr_ledger_vessel_name: doc.mnr_ledger_vessel_name,
    mnr_ledger_vessel_voyage: doc.mnr_ledger_vessel_voyage,
    mnr_ledger_vessel_ata: doc.mnr_ledger_vessel_ata,
    mnr_ledger_bl: doc.mnr_ledger_bl,
    mnr_ledger_container_no: doc.mnr_ledger_container_no,
    mnr_ledger_destination: doc.mnr_ledger_destination,
    mnr_ledger_cargo_type: doc.mnr_ledger_cargo_type,
    mnr_ledger_container_size: doc.mnr_ledger_container_size,
    mnr_ledger_dv_amount: doc.mnr_ledger_dv_amount,
    mnr_ledger_actual_charge_amount: doc.mnr_ledger_actual_charge_amount,
    mnr_ledger_loss_declaring_date: doc.mnr_ledger_loss_declaring_date,
    mnr_ledger_corresponding_payer_id: doc.mnr_ledger_corresponding_payer_id,
    mnr_ledger_corresponding_payer: doc.mnr_ledger_corresponding_payer,
    mnr_ledger_payment_date: doc.mnr_ledger_payment_date,
    mnr_ledger_termination: doc.mnr_ledger_termination,
    mnr_ledger_description: doc.mnr_ledger_description
  })
  if(doc.mnr_attachments){
    for(let att of doc.mnr_attachments) {
      let fileInfo = await common.fileSaveMongo(att.response.info.path, 'zhongtan')
      await tb_uploadfile.create({
        api_name: 'MNR-LEDGER',
        user_id: user.user_id,
        uploadfile_index1: mnr.container_mnr_ledger_id,
        uploadfile_name: fileInfo.name,
        uploadfile_url: fileInfo.url
      })
    }
  }
  return common.success()
}

exports.updateAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let queryStr = `SELECT * from tbl_zhongtan_container_mnr_ledger WHERE state = '1' AND mnr_ledger_container_no = ? AND mnr_ledger_description = ? AND container_mnr_ledger_id <> ?`
  let replacements = [doc.mnr_ledger_container_no, doc.mnr_ledger_description, doc.container_mnr_ledger_id]
  let existsMnr = await model.simpleSelect(queryStr, replacements)
  if(existsMnr && existsMnr.length > 0) {
    return common.error('mnr_01')
  }
  let mnr = await tb_mnr_ledger.findOne({
    where: {
      container_mnr_ledger_id: doc.container_mnr_ledger_id
    }
  })
  if(mnr) {
    mnr.mnr_ledger_container_no_id = doc.mnr_ledger_container_no_id
    mnr.mnr_ledger_vessel_id =doc.mnr_ledger_vessel_id
    mnr.mnr_ledger_vessel_name = doc.mnr_ledger_vessel_name
    mnr.mnr_ledger_vessel_voyage = doc.mnr_ledger_vessel_voyage
    mnr.mnr_ledger_vessel_ata = doc.mnr_ledger_vessel_ata
    mnr.mnr_ledger_bl = doc.mnr_ledger_bl
    mnr.mnr_ledger_container_no = doc.mnr_ledger_container_no
    mnr.mnr_ledger_destination = doc.mnr_ledger_destination
    mnr.mnr_ledger_cargo_type = doc.mnr_ledger_cargo_type
    mnr.mnr_ledger_container_size = doc.mnr_ledger_container_size
    mnr.mnr_ledger_dv_amount = doc.mnr_ledger_dv_amount
    mnr.mnr_ledger_actual_charge_amount = doc.mnr_ledger_actual_charge_amount
    mnr.mnr_ledger_loss_declaring_date = doc.mnr_ledger_loss_declaring_date
    mnr.mnr_ledger_corresponding_payer_id = doc.mnr_ledger_corresponding_payer_id
    mnr.mnr_ledger_corresponding_payer = doc.mnr_ledger_corresponding_payer
    mnr.mnr_ledger_payment_date = doc.mnr_ledger_payment_date
    mnr.mnr_ledger_termination = doc.mnr_ledger_termination
    mnr.mnr_ledger_description = doc.mnr_ledger_description
    if(mnr.mnr_ledger_invoice_date) {
      mnr.mnr_ledger_reedit_flg = GLBConfig.ENABLE
    }
    await mnr.save()
    if(doc.mnr_attachments){
      // await tb_uploadfile.destroy({
      //   where: {
      //     api_name: 'MNR-LEDGER',
      //     uploadfile_index1: mnr.container_mnr_ledger_id
      //   }
      // })

      let replacements = ['MNR-LEDGER', mnr.container_mnr_ledger_id]
      let delFileStr = `UPDATE tbl_zhongtan_uploadfile SET state = 0 WHERE api_name = ? AND uploadfile_index1 = ?;`
      await model.simpleUpdate(delFileStr, replacements)

      for(let att of doc.mnr_attachments) {
        let fileInfo = await common.fileSaveMongo(att.response.info.path, 'zhongtan')
        await tb_uploadfile.create({
          api_name: 'MNR-LEDGER',
          user_id: user.user_id,
          uploadfile_index1: mnr.container_mnr_ledger_id,
          uploadfile_name: fileInfo.name,
          uploadfile_url: fileInfo.url
        })
      }
    }
  }
  return common.success()
}

exports.invoiceAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let mnr = await tb_mnr_ledger.findOne({
    where: {
      container_mnr_ledger_id: doc.container_mnr_ledger_id
    }
  })
  if(mnr) {
    let customer = await tb_user.findOne({
      where: {
        user_id: mnr.mnr_ledger_corresponding_payer_id
      }
    })
  
    let commonUser = await tb_user.findOne({
      where: {
        user_id: user.user_id
      }
    })

    let renderData = {}
    renderData.customerName = customer.user_name
    renderData.customerTin = customer.user_tin
    renderData.address = customer.user_address
    renderData.destination = mnr.mnr_ledger_destination
    renderData.cargoType = mnr.mnr_ledger_cargo_type
    renderData.masterbiBl = mnr.mnr_ledger_bl
    renderData.invoiceDate = moment().format('YYYY/MM/DD')
    let invoiceNo = await seq.genMNRInvoiceSeq()
    renderData.invoiceNo = invoiceNo
    renderData.vesselName = mnr.mnr_ledger_vessel_name
    renderData.voyageNumber = mnr.mnr_ledger_vessel_voyage
    renderData.arrivalDate = mnr.mnr_ledger_vessel_ata
    renderData.containerNo = mnr.mnr_ledger_container_no
    renderData.sizeType = mnr.mnr_ledger_container_size
    renderData.decsription = mnr.mnr_ledger_description
    renderData.mnrAmount = mnr.mnr_ledger_actual_charge_amount
    renderData.mnrTotal = formatCurrency(mnr.mnr_ledger_actual_charge_amount)
    renderData.mnrTotalStr = numberToText(mnr.mnr_ledger_actual_charge_amount, 'english')
    if(mnr.mnr_ledger_actual_charge_amount && mnr.mnr_ledger_actual_charge_amount.indexOf('-') < 0) {
      renderData.mnrTotalStr = numberToText(mnr.mnr_ledger_actual_charge_amount, 'english')
    } else {
      renderData.mnrTotalStr = 'MINUS ' + numberToText(new Decimal(mnr.mnr_ledger_actual_charge_amount).absoluteValue(), 'english')
    }
    renderData.user_name = commonUser.user_name
    renderData.user_phone = commonUser.user_phone
    renderData.user_email = commonUser.user_email

    renderData.rate_currency = 'TZS'
    let rate = await rateSrv.getCurrentExchangeRateTZS(renderData.mnrTotal)
    renderData.current_rate =  common.formatAmountCurrency(rate.rate)
    renderData.rate_amount =  common.formatAmountCurrency(rate.amount)

    try {
      let fileInfo = await common.ejs2Pdf('mnrInvoice.ejs', renderData, 'zhongtan')
      // await tb_uploadfile.destroy({
      //   where: {
      //     api_name: 'MNR-INVOICE',
      //     uploadfile_index1: mnr.container_mnr_ledger_id
      //   }
      // })

      let replacements = ['MNR-INVOICE', mnr.container_mnr_ledger_id]
      let delFileStr = `UPDATE tbl_zhongtan_uploadfile SET state = 0 WHERE api_name = ? AND uploadfile_index1 = ?;`
      await model.simpleUpdate(delFileStr, replacements)

      await tb_uploadfile.create({
        api_name: 'MNR-INVOICE',
        user_id: user.user_id,
        uploadfile_index1: mnr.container_mnr_ledger_id,
        uploadfile_name: fileInfo.name,
        uploadfile_url: fileInfo.url,
        uploadfile_currency: 'USD',
        uploadfile_state: 'PB', // TODO state PM => PB
        uploadfile_amount: mnr.mnr_ledger_actual_charge_amount,
        uploadfile_customer_id: customer.user_id,
        uploadfile_invoice_no: invoiceNo,
        uploadfile_amount_rate: renderData.current_rate
      })
      mnr.mnr_ledger_reedit_flg = GLBConfig.DISABLE
      mnr.mnr_ledger_invoice_date = moment().format('YYYY-MM-DD HH:mm:ss')
      mnr.mnr_ledger_invoice_no = invoiceNo
      await mnr.save()
      // 修箱费开票后拉入黑名单
      customer.user_blacklist = GLBConfig.ENABLE
      customer.blacklist_order = 'NMR_' + mnr.container_mnr_ledger_id
      await customer.save()
      return common.success()
    } catch(e) {
      return common.error('generate_file_01')
    }
  }
}

exports.searchContainerAct = async req => {
  let doc = common.docValidate(req)
  let search_text = '%' + doc.search_text + '%'
  let queryStr = `SELECT c.invoice_containers_id, c.invoice_containers_no, c.invoice_containers_bl, c.invoice_containers_size, SUBSTR(b.invoice_masterbi_destination, 1, 2) AS invoice_masterbi_destination, b.invoice_masterbi_cargo_type, v.invoice_vessel_name, v.invoice_vessel_voyage, v.invoice_vessel_ata 
  FROM tbl_zhongtan_invoice_containers c LEFT JOIN tbl_zhongtan_invoice_masterbl b ON c.invoice_vessel_id = b.invoice_vessel_id AND c.invoice_containers_bl = b.invoice_masterbi_bl LEFT JOIN tbl_zhongtan_invoice_vessel v ON c.invoice_vessel_id = v.invoice_vessel_id WHERE c.state = 1 AND invoice_containers_no LIKE ? ORDER BY invoice_containers_no LIMIT 5  `
  let replacements = [search_text]
  let result = await model.simpleSelect(queryStr, replacements)
  if(result && result.length > 0) {
    for(let r of result) {
      if(r.invoice_masterbi_cargo_type === 'TR' || r.invoice_masterbi_cargo_type === 'TRANSIT') {
        r.invoice_masterbi_cargo_type = 'TRANSIT'
      } else {
        r.invoice_masterbi_cargo_type = 'LOCAL'
      }
    }
    return common.success(result)
  } else {
    let returnData = [{'invoice_containers_id' : '0', 'invoice_containers_no' : doc.search_text}]
    return common.success(returnData)
  }
}

exports.searchCustomerAct = async req => {
  let doc = common.docValidate(req)
  let search_text = '%' + doc.search_text + '%'
  let queryStr = `SELECT user_id, user_name from tbl_common_user WHERE state = 1 and user_type = '${GLBConfig.TYPE_CUSTOMER}' AND user_name LIKE ? GROUP BY user_name ORDER BY user_name LIMIT 10 `
  let replacements = [search_text]
  let result = await model.simpleSelect(queryStr, replacements)
  if(result && result.length > 0) {
    return common.success(result)
  } 
  return common.success()
}

function formatCurrency(num) {
  num = num.toString().replace(/[^\d.-]/g, '') //转成字符串并去掉其中除数字, . 和 - 之外的其它字符。
  if (isNaN(num)) num = '0' //是否非数字值
  let sign = num == (num = Math.abs(num))
  num = Math.floor(num * 100 + 0.50000000001) //下舍入
  let cents = num % 100 //求余 余数 = 被除数 - 除数 * 商
  cents = cents < 10 ? '0' + cents : cents //小于2位数就补齐
  num = Math.floor(num / 100).toString()
  for (let i = 0; i < Math.floor((num.length - (1 + i)) / 3); i++) {
    //每隔三位小数分始开隔
    //4 ==> 三位小数加一个分隔符，
    num = num.substring(0, num.length - (4 * i + 3)) + ',' + num.substring(num.length - (4 * i + 3))
  }
  return (sign ? '' : '-') + num + '.' + cents
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

exports.deleteMNRInvoieAct = async req => {
  let doc = common.docValidate(req)
  let f = await tb_uploadfile.findOne({
    where: {
      uploadfile_id: doc.file_id,
      state: GLBConfig.ENABLE
    }
  })
  if(f) {
    f.state = GLBConfig.DISABLE
    await f.save()

    let mnr = await tb_mnr_ledger.findOne({
      where: {
        container_mnr_ledger_id: doc.container_mnr_ledger_id
      }
    })
    if(mnr) {
      mnr.mnr_ledger_invoice_amount = ''
      mnr.mnr_ledger_invoice_date = ''
      mnr.mnr_ledger_invoice_no = ''
      await mnr.save()
    }
  }
  return common.success()
}

exports.deleteMNRAct = async req => {
  let doc = common.docValidate(req)
  let mnr = await tb_mnr_ledger.findOne({
    where: {
      container_mnr_ledger_id: doc.container_mnr_ledger_id,
      state: GLBConfig.ENABLE
    }
  })
  if(mnr) {
    mnr.state = GLBConfig.DISABLE
    await mnr.save()
  }
  return common.success()
}