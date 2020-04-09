const X = require('xlsx')
const moment = require('moment')
// const logger = require('../../../app/logger').createLogger(__filename)
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')
const mailer = require('../../../util/Mail')
const Op = model.Op

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

exports.uploadImportAct = async req => {
  let doc = common.docValidate(req)

  for (let f of doc.upload_files) {
    // var parser = new xml2js.Parser();
    let wb = X.readFile(f.response.info.path, {
      cellFormula: true,
      bookVBA: true,
      cellNF: true,
      cellHTML: true,
      sheetStubs: true,
      cellDates: true,
      cellStyles: true
    })

    let vesselInfo = wb.Sheets['VesselInformation']
    let masterBI = wb.Sheets['MasterBl']
    let containers = wb.Sheets['Containers']

    let vesslInfoJS = X.utils.sheet_to_json(vesselInfo, {})
    let masterBIJS = X.utils.sheet_to_json(masterBI, {})
    let containersJS = X.utils.sheet_to_json(containers, {})
    // const data = fs.readFileSync(f.response.info.path, 'utf8')
    // console.log(data)

    if (!(vesslInfoJS[0]['VESSEL NAME'] && vesslInfoJS[0]['VOYAGE NUM'])) {
      return common.error('import_03')
    }

    let vessel = await tb_vessel.findOne({
      where: {
        invoice_vessel_name: vesslInfoJS[0]['VESSEL NAME'],
        invoice_vessel_voyage: vesslInfoJS[0]['VOYAGE NUM']
      }
    })

    if (vessel) {
      return common.error('import_01')
    } else {
      vessel = await tb_vessel.create({
        invoice_vessel_name: vesslInfoJS[0]['VESSEL NAME'],
        invoice_vessel_code: vesslInfoJS[0]['VESSEL CODE'],
        invoice_vessel_voyage: vesslInfoJS[0]['VOYAGE NUM'],
        invoice_vessel_eta: typeof vesslInfoJS[0]['ETA'] === 'object' ? vesslInfoJS[0]['ETA'].Format('dd/MM/yyyy') : vesslInfoJS[0]['ETA'],
        invoice_vessel_ata: typeof vesslInfoJS[0]['ATA'] === 'object' ? vesslInfoJS[0]['ATA'].Format('dd/MM/yyyy') : vesslInfoJS[0]['ATA'],
        invoice_vessel_atd: typeof vesslInfoJS[0]['ATD'] === 'object' ? vesslInfoJS[0]['ATD'].Format('dd/MM/yyyy') : vesslInfoJS[0]['ATD'],
        invoice_vessel_call_sign: vesslInfoJS[0]['CALL SIGN'],
      })

      for (let m of masterBIJS) {
        await tb_bl.create({
          invoice_vessel_id: vessel.invoice_vessel_id,
          invoice_masterbi_bl: m['#M B/L No'],
          invoice_masterbi_cargo_type: m['Cargo Classification'],
          invoice_masterbi_bl_type: m['*B/L Type'],
          invoice_masterbi_destination: m['Place of Destination'],
          invoice_masterbi_delivery: m['Place of Delivery'],
          invoice_masterbi_freight: m['Freight'] || '',
          invoice_masterbi_loading: m['Port of Loading'],
          invoice_masterbi_container_no: m['Number of Containers'],
          invoice_masterbi_goods_description: m['Description of Goods'],
          invoice_masterbi_package_no: m['Number of Package'],
          invoice_masterbi_package_unit: m['Package Unit'],
          invoice_masterbi_gross_weight: m['Gross Weight'],
          invoice_masterbi_gross_weight_unit: m['Gross Weight Unit'],
          invoice_masterbi_gross_volume: m['Gross Volume'],
          invoice_masterbi_gross_volume_unit: m['Gross Volume Unit'],
          invoice_masterbi_invoice_value: m['Invoice Value'] || '',
          invoice_masterbi_invoice_currency: m['Invoice Currency'] || '',
          invoice_masterbi_freight_charge: m['Freight Terms'] || '',
          invoice_masterbi_freight_currency: m['Freight Currency'] || '',
          invoice_masterbi_imdg: m['IMDG Code'] || '',
          invoice_masterbi_packing_type: m['Packing Type'] || '',
          invoice_masterbi_forwarder_code: m['Forwarder Code'] || '',
          invoice_masterbi_forwarder_name: m['Forwarder Name'] || '',
          invoice_masterbi_forwarder_tel: m['Forwarder Tel'] || '',
          invoice_masterbi_exporter_name: m['Exporter Name'] || '',
          invoice_masterbi_exporter_tel: m['Exporter Tel'] || '',
          invoice_masterbi_exporter_address: m['Exporter Address'] || '',
          invoice_masterbi_exporter_tin: m['Exporter TIN'] || '',
          invoice_masterbi_consignee_name: m['Consignee Name'] || '',
          invoice_masterbi_consignee_tel: m['Consignee Tel'] || '',
          invoice_masterbi_consignee_address: m['Consignee Address'] || '',
          invoice_masterbi_consignee_tin: m['Consignee TIN'] || '',
          invoice_masterbi_notify_name: m['Notify Name'] || '',
          invoice_masterbi_notify_tel: m['Notify Tel'] || '',
          invoice_masterbi_notify_address: m['Notify Address'] || '',
          invoice_masterbi_notify_tin: m['Notify TIN'] || '',
          invoice_masterbi_shipping_mark: m['Shipping Mark'] || '',
          invoice_masterbi_net_weight: m['Net Weight'] || '',
          invoice_masterbi_net_weight_unit: m['Net Weight Unit'] || '',
          invoice_masterbi_line_code: m['LineAgent Code'] || '',
          invoice_masterbi_terminal_code: m['TerminalCode'] || ''
        })
      }

      for (let c of containersJS) {
        await tb_container.create({
          invoice_vessel_id: vessel.invoice_vessel_id,
          invoice_containers_bl: c['#M B/L No'],
          invoice_containers_type: c['Type Of Container'],
          invoice_containers_no: c['Container No'],
          invoice_containers_size: c['Container Size'],
          invoice_containers_seal1: c['Seal No.1'],
          invoice_containers_seal2: c['Seal No.2'] || '',
          invoice_containers_seal3: c['Seal No.3'] || '',
          invoice_containers_freight_indicator: c['Freight Indicator'] || '',
          invoice_containers_package_no: c['No Of Package'] || '',
          invoice_containers_package_unit: c['Package Unit'] || '',
          invoice_containers_volumn: c['Volumn'] || '',
          invoice_containers_volumn_unit: c['Volumn Unit'] || '',
          invoice_containers_weight: c['Weight'] || '',
          invoice_containers_weight_unit: c['Weight Unit'] || '',
          invoice_containers_plug_reefer: c['Plug type of reefer'] || '',
          invoice_containers_min_temperature: c['Minimum Temperature'] || '',
          invoice_containers_max_temperature: c['Maximum Temperature'] | ''
        })
      }
    }
  }
  return common.success()
}

exports.uploadAct = async req => {
  let fileInfo = await common.fileSaveTemp(req)
  return common.success(fileInfo)
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
            state: f.uploadfile_state,
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
            state: f.uploadfile_state,
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
            state: f.uploadfile_state,
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
            state: f.uploadfile_state,
            release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
            release_user: f.user_name,
            edi_state: b.invoice_masterbi_do_edi_state
          })
        } else if (f.api_name === 'RECEIPT-RECEIPT') {
          filetype = 'Receipt'
          d.files.push({
            invoice_masterbi_id: b.invoice_masterbi_id,
            filetype: filetype,
            date: moment(f.created_at).format('YYYY-MM-DD'),
            file_id: f.uploadfile_id,
            url: f.uploadfile_url,
            state: f.uploadfile_state,
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
    a.invoice_vessel_id = ? `
  let replacements = [doc.invoice_vessel_id]

  if (doc.collect) {
    if (doc.collect === 'COLLECT') {
      queryStr += 'AND a.invoice_masterbi_freight = "COLLECT" '
    } else {
      queryStr += 'AND a.invoice_masterbi_freight != "COLLECT" OR a.invoice_masterbi_freight IS NULL OR a.invoice_masterbi_freight = ""'
    }
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
    // vessel info
    let vessel = await tb_vessel.findOne({
      where: {
        invoice_vessel_id: d.invoice_vessel_id
      }
    })
    d.invoice_vessel_name = vessel.invoice_vessel_name
    d.invoice_vessel_voyage = vessel.invoice_vessel_voyage
    // container info
    let continers = await tb_container.findAll({
      where: {
        invoice_vessel_id: d.invoice_vessel_id,
        invoice_containers_bl: d.invoice_masterbi_bl
      },
      order: [['invoice_containers_size', 'ASC']]
    })
    let cMap = new Map()
    for (let c of continers) {
      if(cMap.get(c.invoice_containers_size)) {
        cMap.set(c.invoice_containers_size, cMap.get(c.invoice_containers_size) + 1)
      } else {
        cMap.set(c.invoice_containers_size, 1)
      }
    }
    let containerSize = ''
    for (var [k, v] of cMap) {
      containerSize = containerSize + k + ' * ' + v + '    '
    }
    d.container_size_type = containerSize
    // file info
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
          state: f.uploadfile_state,
          release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
          release_user: f.user_name
        })
        d.invoice_masterbi_deposit_state = f.uploadfile_state
        if (f.uploadfile_currency) {
          d.invoice_container_deposit_currency = f.uploadfile_currency
        }
        d.invoice_masterbi_deposit_comment = f.uploadfile_amount_comment
      } else if (f.api_name === 'RECEIPT-FEE') {
        filetype = 'Fee'
        d.files.push({
          invoice_masterbi_id: b.invoice_masterbi_id,
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
      } else if (f.api_name === 'RECEIPT-OF') {
        filetype = 'Freight'
        d.files.push({
          invoice_masterbi_id: b.invoice_masterbi_id,
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
          d.invoice_ocean_freight_fee_currency = f.uploadfile_currency
        }
        d.invoice_masterbi_of_comment = f.uploadfile_amount_comment
      } else if (f.api_name === 'RECEIPT-DO') {
        filetype = 'DO'
        d.files.push({
          invoice_masterbi_id: b.invoice_masterbi_id,
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          state: f.uploadfile_state,
          release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
          release_user: f.user_name,
          edi_state: b.invoice_masterbi_do_edi_state
        })
      } else if (f.api_name === 'RECEIPT-RECEIPT') {
        filetype = 'Receipt'
        d.files.push({
          invoice_masterbi_id: b.invoice_masterbi_id,
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          state: f.uploadfile_state,
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

  if (file.api_name === 'RECEIPT-DO') {
    bl.invoice_masterbi_do_release_date = file.uploadfil_release_date
    await bl.save()
  }

  if (file.api_name === 'RECEIPT-DEPOSIT' || file.api_name === 'RECEIPT-FEE' || file.api_name === 'RECEIPT-OF') {
    if(file.uploadfile_state !== 'AP') {
      return common.error('import_08')
    }
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

exports.depositDoAct = async req => {
  let doc = common.docValidate(req),
    user = req.user
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

  let customer = await tb_user.findOne({
    where: {
      user_id: doc.invoice_masterbi_customer_id
    }
  })

  if (!customer) {
    return common.error('import_04')
  }

  if (!doc.invoice_masterbi_carrier) {
    return common.error('import_05')
  }

  if (doc.depositType === 'Container Deposit') {
    bl.invoice_masterbi_customer_id = doc.invoice_masterbi_customer_id
    bl.invoice_masterbi_carrier = doc.invoice_masterbi_carrier
    bl.invoice_masterbi_deposit = doc.invoice_masterbi_deposit
    bl.invoice_masterbi_deposit_date = new Date()
    await bl.save()

    let renderData = JSON.parse(JSON.stringify(bl))
    renderData.deposit_date = moment(bl.invoice_masterbi_deposit_date).format('YYYY/MM/DD')
    renderData.receipt_no = await seq.genReceiptNo()
    renderData.customer_name = customer.user_name
    renderData.address = customer.user_address
    renderData.address1 = customer.user_address1
    renderData.address2 = customer.user_address2
    renderData.user_name = user.user_name
    renderData.user_email = user.user_email
    renderData.vessel_name = vessel.invoice_vessel_name
    renderData.voyage_number = vessel.invoice_vessel_voyage
    renderData.voyage_ata_date = vessel.invoice_vessel_ata
    renderData.invoice_deposit_currency = doc.invoice_container_deposit_currency
    renderData.invoice_masterbi_deposit_comment = doc.invoice_masterbi_deposit_comment

    let fileInfo = await common.ejs2Pdf('deposit.ejs', renderData, 'zhongtan')

    await tb_uploadfile.destroy({
      where: {
        api_name: 'RECEIPT-DEPOSIT',
        uploadfile_index1: bl.invoice_masterbi_id
      }
    })

    await tb_uploadfile.create({
      api_name: 'RECEIPT-DEPOSIT',
      user_id: user.user_id,
      uploadfile_index1: bl.invoice_masterbi_id,
      uploadfile_name: fileInfo.name,
      uploadfile_url: fileInfo.url,
      uploadfile_currency: doc.invoice_container_deposit_currency,
      uploadfile_state: 'PM',
      uploadfile_amount_comment: doc.invoice_masterbi_deposit_comment
    })

    return common.success({ url: fileInfo.url })
  } else if (doc.depositType === 'Invoice Fee') {
    bl.invoice_masterbi_customer_id = doc.invoice_masterbi_customer_id
    bl.invoice_masterbi_carrier = doc.invoice_masterbi_carrier
    bl.invoice_masterbi_transfer = doc.invoice_masterbi_transfer
    bl.invoice_masterbi_lolf = doc.invoice_masterbi_lolf
    bl.invoice_masterbi_lcl = doc.invoice_masterbi_lcl
    bl.invoice_masterbi_amendment = doc.invoice_masterbi_amendment
    bl.invoice_masterbi_tasac = doc.invoice_masterbi_tasac
    bl.invoice_masterbi_printing = doc.invoice_masterbi_printing
    bl.invoice_masterbi_others = doc.invoice_masterbi_others
    bl.invoice_masterbi_fee_date = new Date()
    await bl.save()

    bl = await tb_bl.findOne({
      where: {
        invoice_masterbi_id: doc.invoice_masterbi_id
      }
    })

    let renderData = JSON.parse(JSON.stringify(bl))

    renderData.fee_date = moment(bl.invoice_masterbi_fee_date).format('YYYY/MM/DD')
    renderData.customer_name = customer.user_name
    renderData.address = customer.user_address
    renderData.address1 = customer.user_address1
    renderData.address2 = customer.user_address2
    renderData.user_name = user.user_name
    renderData.user_email = user.user_email
    renderData.receipt_no = await seq.genReceiptNo()
    renderData.vessel_name = vessel.invoice_vessel_name
    renderData.voyage_number = vessel.invoice_vessel_voyage
    renderData.voyage_ata_date = vessel.invoice_vessel_ata
    renderData.fee_currency = doc.invoice_fee_currency
    renderData.fee_comment = doc.invoice_fee_comment

    renderData.fee = []
    renderData.sum_fee = 0
    if (bl.invoice_masterbi_transfer) {
      renderData.fee.push({ type: 'CONTAINER TRANSFER', amount: formatCurrency(bl.invoice_masterbi_transfer) })
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_transfer)
    }
    if (bl.invoice_masterbi_lolf) {
      renderData.fee.push({ type: 'LIFT ON LIFT OFF', amount: formatCurrency(bl.invoice_masterbi_lolf) })
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_lolf)
    }
    if (bl.invoice_masterbi_lcl) {
      renderData.fee.push({ type: 'LCL FEE', amount: formatCurrency(bl.invoice_masterbi_lcl) })
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_lcl)
    }
    if (bl.invoice_masterbi_amendment) {
      renderData.fee.push({ type: 'AMENDMENT FEE', amount: formatCurrency(bl.invoice_masterbi_amendment) })
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_amendment)
    }
    if (bl.invoice_masterbi_tasac) {
      renderData.fee.push({ type: 'TASAC FEE', amount: formatCurrency(bl.invoice_masterbi_tasac) })
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_tasac)
    }
    if (bl.invoice_masterbi_printing) {
      renderData.fee.push({ type: 'B/L PRINTING FEE', amount: formatCurrency(bl.invoice_masterbi_printing) })
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_printing)
    }
    if (bl.invoice_masterbi_others) {
      renderData.fee.push({ type: 'OTHERS', amount: formatCurrency(bl.invoice_masterbi_others) })
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_others)
    }
    renderData.sum_fee = formatCurrency(renderData.sum_fee)

    let fileInfo = await common.ejs2Pdf('fee.ejs', renderData, 'zhongtan')

    await tb_uploadfile.destroy({
      where: {
        api_name: 'RECEIPT-FEE',
        uploadfile_index1: bl.invoice_masterbi_id
      }
    })

    await tb_uploadfile.create({
      api_name: 'RECEIPT-FEE',
      user_id: user.user_id,
      uploadfile_index1: bl.invoice_masterbi_id,
      uploadfile_name: fileInfo.name,
      uploadfile_url: fileInfo.url,
      uploadfile_currency: doc.invoice_fee_currency,
      uploadfile_state: 'PM',
      uploadfile_amount_comment: doc.invoice_fee_comment
    })

    return common.success({ url: fileInfo.url })
  } else if (doc.depositType === 'Ocean Freight') {
    bl.invoice_masterbi_customer_id = doc.invoice_masterbi_customer_id
    bl.invoice_masterbi_carrier = doc.invoice_masterbi_carrier
    bl.invoice_masterbi_of = doc.invoice_masterbi_of
    bl.invoice_masterbi_of_date = new Date()
    await bl.save()

    let renderData = JSON.parse(JSON.stringify(bl))
    renderData.fee_date = moment(bl.invoice_masterbi_of_date).format('YYYY/MM/DD')
    renderData.customer_name = customer.user_name
    renderData.address = customer.user_address
    renderData.address1 = customer.user_address1
    renderData.address2 = customer.user_address2
    renderData.user_name = user.user_name
    renderData.user_email = user.user_email
    renderData.receipt_no = await seq.genReceiptNo()
    renderData.vessel_name = vessel.invoice_vessel_name
    renderData.voyage_number = vessel.invoice_vessel_voyage
    renderData.voyage_ata_date = vessel.invoice_vessel_ata
    renderData.fee_currency = doc.invoice_ocean_freight_fee_currency
    renderData.fee_comment = doc.invoice_masterbi_of_comment

    renderData.fee = []
    renderData.sum_fee = 0

    renderData.fee.push({ type: 'OCEAN FREIGHT', amount: formatCurrency(bl.invoice_masterbi_of) })
    renderData.sum_fee += parseFloat(bl.invoice_masterbi_of)

    renderData.sum_fee = formatCurrency(renderData.sum_fee)

    let fileInfo = await common.ejs2Pdf('fee.ejs', renderData, 'zhongtan')

    await tb_uploadfile.destroy({
      where: {
        api_name: 'RECEIPT-OF',
        uploadfile_index1: bl.invoice_masterbi_id
      }
    })

    await tb_uploadfile.create({
      api_name: 'RECEIPT-OF',
      user_id: user.user_id,
      uploadfile_index1: bl.invoice_masterbi_id,
      uploadfile_name: fileInfo.name,
      uploadfile_url: fileInfo.url,
      uploadfile_currency: doc.invoice_ocean_freight_fee_currency,
      uploadfile_state: 'PM',
      uploadfile_amount_comment: doc.invoice_masterbi_of_comment
    })

    return common.success({ url: fileInfo.url })
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

exports.changeCollectAct = async req => {
  let doc = common.docValidate(req)

  if(!doc.collet_change_password) {
    return common.error('auth_18')
  } else {
    let adminUser = await tb_user.findOne({
      where: {
        user_username: 'admin'
      }
    })
    if(adminUser) {
      if(adminUser.user_password !== doc.collet_change_password) {
        return common.error('auth_24')
      }
    } else {
      return common.error('auth_18')
    }
  }

  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: doc.invoice_masterbi_id
    }
  })

  bl.invoice_masterbi_freight = doc.act
  await bl.save()
  return common.success()
}

exports.changeblAct = async req => {
  let doc = common.docValidate(req)

  for (let b of doc.changedbl) {
    let bl = await tb_bl.findOne({
      where: {
        invoice_masterbi_id: b.invoice_masterbi_id
      }
    })

    bl.invoice_masterbi_cargo_type = b.invoice_masterbi_cargo_type
    bl.invoice_masterbi_bl_type = b.invoice_masterbi_bl_type
    bl.invoice_masterbi_destination = b.invoice_masterbi_destination
    bl.invoice_masterbi_delivery = b.invoice_masterbi_delivery
    bl.invoice_masterbi_loading = b.invoice_masterbi_loading
    bl.invoice_masterbi_container_no = b.invoice_masterbi_container_no
    bl.invoice_masterbi_goods_description = b.invoice_masterbi_goods_description
    bl.invoice_masterbi_package_no = b.invoice_masterbi_package_no
    bl.invoice_masterbi_package_unit = b.invoice_masterbi_package_unit
    bl.invoice_masterbi_gross_weight = b.invoice_masterbi_gross_weight
    bl.invoice_masterbi_gross_weight_unit = b.invoice_masterbi_gross_weight_unit
    bl.invoice_masterbi_gross_volume = b.invoice_masterbi_gross_volume
    bl.invoice_masterbi_gross_volume_unit = b.invoice_masterbi_gross_volume_unit
    bl.invoice_masterbi_invoice_value = b.invoice_masterbi_invoice_value
    bl.invoice_masterbi_invoice_currency = b.invoice_masterbi_invoice_currency
    bl.invoice_masterbi_freight_charge = b.invoice_masterbi_freight_charge
    bl.invoice_masterbi_freight_currency = b.invoice_masterbi_freight_currency
    bl.invoice_masterbi_imdg = b.invoice_masterbi_imdg
    bl.invoice_masterbi_packing_type = b.invoice_masterbi_packing_type
    bl.invoice_masterbi_forwarder_code = b.invoice_masterbi_forwarder_code
    bl.invoice_masterbi_forwarder_name = b.invoice_masterbi_forwarder_name
    bl.invoice_masterbi_forwarder_tel = b.invoice_masterbi_forwarder_tel
    bl.invoice_masterbi_exporter_name = b.invoice_masterbi_exporter_name
    bl.invoice_masterbi_exporter_tel = b.invoice_masterbi_exporter_tel
    bl.invoice_masterbi_exporter_address = b.invoice_masterbi_exporter_address
    bl.invoice_masterbi_exporter_tin = b.invoice_masterbi_exporter_tin
    bl.invoice_masterbi_consignee_name = b.invoice_masterbi_consignee_name
    bl.invoice_masterbi_consignee_tel = b.invoice_masterbi_consignee_tel
    bl.invoice_masterbi_consignee_address = b.invoice_masterbi_consignee_address
    bl.invoice_masterbi_consignee_tin = b.invoice_masterbi_consignee_tin
    bl.invoice_masterbi_notify_name = b.invoice_masterbi_notify_name
    bl.invoice_masterbi_notify_tel = b.invoice_masterbi_notify_tel
    bl.invoice_masterbi_notify_address = b.invoice_masterbi_notify_address
    bl.invoice_masterbi_notify_tin = b.invoice_masterbi_notify_tin
    bl.invoice_masterbi_shipping_mark = b.invoice_masterbi_shipping_mark
    bl.invoice_masterbi_net_weight = b.invoice_masterbi_net_weight
    bl.invoice_masterbi_net_weight_unit = b.invoice_masterbi_net_weight_unit
    bl.invoice_masterbi_line_code = b.invoice_masterbi_line_code
    bl.invoice_masterbi_terminal_code = b.invoice_masterbi_terminal_code

    await bl.save()
  }

  return common.success()
}

exports.deleteVoyageAct = async req => {
  let doc = common.docValidate(req)
  if(!doc.delete_voyage_password) {
    return common.error('auth_18')
  } else {
    let adminUser = await tb_user.findOne({
      where: {
        user_username: 'admin'
      }
    })
    if(adminUser) {
      if(adminUser.user_password !== doc.delete_voyage_password) {
        return common.error('auth_24')
      }
    } else {
      return common.error('auth_18')
    }
  }

  await tb_container.destroy({
    where: {
      invoice_vessel_id: doc.invoice_vessel_id
    }
  })

  await tb_bl.destroy({
    where: {
      invoice_vessel_id: doc.invoice_vessel_id
    }
  })

  await tb_vessel.destroy({
    where: {
      invoice_vessel_id: doc.invoice_vessel_id
    }
  })

  return common.success()
}

exports.doCreateEdiAct = async req => {
  let doc = common.docValidate(req)
  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: doc.invoice_masterbi_id
    }
  })
  if(!bl.invoice_masterbi_do_delivery_order_no) {
    let delivery_order_no = ('000000000000000' + bl.invoice_masterbi_id).slice(-8)
    bl.invoice_masterbi_do_delivery_order_no = delivery_order_no
  }
  bl.invoice_masterbi_do_edi_state = '9' // GLBConfig.EDI_MESSAGE_FUNCTION
  bl.invoice_masterbi_do_edi_create_time = new Date()
  await bl.save()

  let customer = await tb_user.findOne({
    where: {
      user_id: bl.invoice_masterbi_customer_id
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
    }
  })
  this.createEditFile(bl, customer, vessel, continers, '9')
}

exports.doCancelEdiAct = async req => {
  let doc = common.docValidate(req)
  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: doc.invoice_masterbi_id
    }
  })
  bl.invoice_masterbi_do_edi_state = '1' // GLBConfig.EDI_MESSAGE_FUNCTION
  bl.invoice_masterbi_do_edi_cancel_time = new Date()
  await bl.save()

  let customer = await tb_user.findOne({
    where: {
      user_id: bl.invoice_masterbi_customer_id
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
  this.createEditFile(bl, customer, vessel, continers, '1')
}

exports.createEditFile = async (bl, customer, vessel, continers, ediStatus) =>{
  let ediData = {}
  let curMoment = moment()
  ediData.interchangeTime = curMoment.format('YYMMDD:HHmm')
  ediData.interchangeID = await seq.genEdiInterchangeID()
  ediData.messageID = await seq.genEdiInterchangeID()
  ediData.ediName = ediData.interchangeID + '.edi'
  ediData.messageFunction = ediStatus // GLBConfig.EDI_MESSAGE_FUNCTION
  ediData.documentDateTime = curMoment.format('YYYYMMDDHHMM')
  ediData.deliveryOrderNumber = bl.invoice_masterbi_do_delivery_order_no
  ediData.billOfLadingNo = bl.invoice_masterbi_bl
  ediData.expiryDate = moment(bl.invoice_masterbi_valid_to).format('YYYYMMDD')
  ediData.effectiveDate = curMoment.format('YYYYMMDD')
  ediData.voyageNo = vessel.invoice_vessel_voyage
  ediData.carrierID = bl.invoice_masterbi_carrier
  ediData.vesselCallsign = vessel.invoice_vessel_call_sign
  ediData.vesselName = vessel.invoice_vessel_name
  ediData.voyageNo = vessel.invoice_vessel_voyage
  ediData.deliveryPlace = bl.invoice_masterbi_delivery
  ediData.portFinalDestination = bl.invoice_masterbi_destination
  ediData.portOfLoading = bl.invoice_masterbi_loading
  ediData.eta = moment(vessel.invoice_vessel_eta).format('YYYYMMDD')
  ediData.messageSender = 'COSCO'
  ediData.consignee = bl.invoice_masterbi_consignee_name
  ediData.tin = customer.user_tin
  var ediCs = []
  for(let c of continers) {
    let cc = {
      containerNumber: c.invoice_containers_no,
      containerTypeISOcode: c.invoice_containers_size,
      equipmentStatus: '3'
    }
    ediCs.push(cc)
  }
  ediData.containers = ediCs
  // create edi file
  let fileInfo = await common.fs2Edi(ediData)
  
  let mailSubject = 'EDI ' + bl.invoice_masterbi_bl
  let mailContent = ''
  let mailHtml = ''
  let attachments = [{
    filename : ediData.ediName,
    path: fileInfo
  }]
  await mailer.sendEdiMail(GLBConfig.EDI_EMAIL_SENDER, GLBConfig.EDI_EMAIL_RECEIVER, GLBConfig.EDI_EMAIL_CARBON_COPY, GLBConfig.EDI_EMAIL_BLIND_CARBON_COPY, mailSubject, mailContent, mailHtml, attachments)
}
