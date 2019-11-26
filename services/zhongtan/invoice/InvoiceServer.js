const X = require('xlsx')
const moment = require('moment')
// const logger = require('../../../app/logger').createLogger(__filename)
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')

const tb_vessel = model.zhongtan_invoice_vessel
const tb_bl = model.zhongtan_invoice_masterbl
const tb_container = model.zhongtan_invoice_containers
const tb_customer = model.zhongtan_invoice_customer
const tb_uploadfile = model.zhongtan_uploadfile

exports.initAct = async () => {
  let returnData = {
    TFINFO: GLBConfig.TFINFO,
    RECEIPT_TYPE_INFO: GLBConfig.RECEIPT_TYPE_INFO
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
        invoice_vessel_eta: vesslInfoJS[0]['ETA'],
        invoice_vessel_ata: vesslInfoJS[0]['ATA'],
        invoice_vessel_atd: vesslInfoJS[0]['ATD']
      })

      for (let m of masterBIJS) {
        await tb_bl.create({
          invoice_vessel_id: vessel.invoice_vessel_id,
          invoice_masterbi_bl: m['#M B/L No'],
          invoice_masterbi_cargo_type: m['Cargo Classification'],
          invoice_masterbi_bl_type: m['*B/L Type'],
          invoice_masterbi_destination: m['Place of Destination'],
          invoice_masterbi_delivery: m['Place of Delivery'],
          invoice_masterbi_oil_type: m['Oil Type'] || '',
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
          invoice_masterbi_freight_charge: m['Freight Charge'] || '',
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
    returnData = []

  let queryStr = `select * from tbl_zhongtan_invoice_vessel
                    where state = '1'`
  let replacements = []

  if (doc.start_date) {
    queryStr += ' and created_at >= ? and created_at <= ?'
    replacements.push(doc.start_date)
    replacements.push(
      moment(doc.end_date, 'YYYY-MM-DD')
        .add(1, 'days')
        .format('YYYY-MM-DD')
    )
  }

  let vessels = await model.simpleSelect(queryStr, replacements)

  for (let v of vessels) {
    let row = JSON.parse(JSON.stringify(v))
    let rcount = await tb_bl.count({
      where: {
        invoice_vessel_id: v.invoice_vessel_id,
        invoice_vessel_release_state: '1'
      }
    })
    let acount = await tb_bl.count({
      where: {
        invoice_vessel_id: v.invoice_vessel_id
      }
    })
    row.invoice_release = rcount + '/' + acount
    returnData.push(row)
  }

  return common.success(returnData)
}

exports.getVoyageDetailAct = async req => {
  let doc = common.docValidate(req),
    returnData = {
      MasterBl: [],
      Containers: []
    }

  let bl = await tb_bl.findAll({
    where: {
      invoice_vessel_id: doc.invoice_vessel_id
    }
  })

  let container = await tb_container.findAll({
    where: {
      invoice_vessel_id: doc.invoice_vessel_id
    }
  })
  for (let b of bl) {
    let d = JSON.parse(JSON.stringify(b))
    d.files = []
    let files = await tb_uploadfile.findAll({
      where: {
        uploadfile_index1: b.invoice_masterbi_id
      },
      order: [['created_at', 'DESC']]
    })
    for (let f of files) {
      let filetype = ''
      if (f.api_name === 'RECEIPT-DEPOSIT') {
        filetype = 'Deposit'
        d.files.push({
          filetype: filetype,
          date: moment(f.created_at).format('YYYY-MM-DD'),
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          name: f.uploadfile_name,
          remark: f.uploadfile_remark
        })
      } else if (f.api_name === 'RECEIPT-FEE') {
        filetype = 'Fee'
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
    returnData.MasterBl.push(d)
  }
  returnData.Containers = JSON.parse(JSON.stringify(container))

  return common.success(returnData)
}

exports.downloadDoAct = async (req, res) => {
  let doc = common.docValidate(req)
  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: doc.invoice_masterbi_id
    }
  })

  if (bl.invoice_vessel_release_state === '0') {
    bl.invoice_masterbi_delivery_to = doc.invoice_masterbi_delivery_to
    bl.invoice_masterbi_do_date = moment().format('YYYY-MM-DD')
    bl.invoice_masterbi_valid_to = doc.invoice_masterbi_valid_to
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
  renderData.delivery_order_no = ('000000000000000' + bl.invoice_masterbi_id).slice(-8)
  renderData.invoice_vessel_name = vessel.invoice_vessel_name
  renderData.invoice_vessel_voyage = vessel.invoice_vessel_voyage
  renderData.vessel_eta = moment(vessel.invoice_vessel_eta, 'DD-MM-YYYY').format('DD/MM/YYYY')
  renderData.do_date = moment(bl.invoice_masterbi_do_date).format('DD/MM/YYYY')
  renderData.valid_to = moment(bl.invoice_masterbi_valid_to).format('DD/MM/YYYY')
  renderData.containers = JSON.parse(JSON.stringify(continers))
  let cSize = []
  for (let i = 0; i < renderData.containers.length; i++) {
    renderData.containers[i].invoice_containers_tare = common.getContainerTare(renderData.containers[i].invoice_containers_size)
    if (cSize.indexOf(renderData.containers[i].invoice_containers_size) < 0) {
      cSize.push(renderData.containers[i].invoice_containers_size)
    }
  }
  renderData.container_count = bl.invoice_masterbi_container_no + 'X' + cSize.join(' ')

  return common.ejs2Word('doTemplate.docx', renderData, res)
}

exports.doReleaseAct = async req => {
  let doc = common.docValidate(req)
  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: doc.invoice_masterbi_id
    }
  })
  bl.invoice_vessel_release_state = '1'
  bl.invoice_vessel_release_date = new Date()
  await bl.save()
  return common.success()
}

exports.searchCustomerAct = async req => {
  let doc = common.docValidate(req),
    returnData = []

  let queryStr = `SELECT invoice_customer_name
    FROM
      tbl_zhongtan_invoice_customer
    WHERE
    invoice_customer_name like ?`
  let replacements = ['%' + doc.search_text + '%']

  let data = await model.simpleSelect(queryStr, replacements)
  data.forEach(value => {
    returnData.push(value.invoice_customer_name)
  })
  return common.success(returnData)
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

  let customer = await tb_customer.findOne({
    where: {
      invoice_customer_name: doc.invoice_masterbi_customer
    }
  })

  if (!customer) {
    await tb_customer.create({
      invoice_customer_name: doc.invoice_masterbi_customer
    })
  }

  if (doc.depositType === 'Container Deposit') {
    bl.invoice_masterbi_customer = doc.invoice_masterbi_customer
    bl.invoice_masterbi_carrier = doc.invoice_masterbi_carrier
    bl.invoice_masterbi_deposit = doc.invoice_masterbi_deposit
    bl.invoice_masterbi_deposit_date = new Date()
    await bl.save()

    let renderData = JSON.parse(JSON.stringify(bl))
    renderData.deposit_date = moment(bl.invoice_masterbi_deposit_date).format('YYYY/MM/DD')
    renderData.vessel_name = vessel.invoice_vessel_name
    renderData.voyage_number = vessel.invoice_vessel_voyage
    renderData.voyage_atd_date = vessel.invoice_vessel_atd

    let fileInfo = await common.ejs2Pdf('deposit.ejs', renderData, 'zhongtan')

    await tb_uploadfile.create({
      api_name: 'RECEIPT-DEPOSIT',
      user_id: user.user_id,
      uploadfile_index1: bl.invoice_masterbi_id,
      uploadfile_name: fileInfo.name,
      uploadfile_url: fileInfo.url
    })

    return common.success({ url: fileInfo.url })
  } else if (doc.depositType === 'Invoice Fee') {
    bl.invoice_masterbi_transfer = doc.invoice_masterbi_transfer
    bl.invoice_masterbi_lolf = doc.invoice_masterbi_lolf
    bl.invoice_masterbi_lcl = doc.invoice_masterbi_lcl
    bl.invoice_masterbi_amendment = doc.invoice_masterbi_amendment
    bl.invoice_masterbi_tasac = doc.invoice_masterbi_tasac
    bl.invoice_masterbi_printing = doc.invoice_masterbi_printing
    bl.invoice_masterbi_fee_date = new Date()
    await bl.save()

    let renderData = JSON.parse(JSON.stringify(bl))

    renderData.fee_date = moment(bl.invoice_masterbi_fee_date).format('YYYY/MM/DD')
    renderData.vessel_name = vessel.invoice_vessel_name
    renderData.voyage_number = vessel.invoice_vessel_voyage
    renderData.voyage_atd_date = vessel.invoice_vessel_atd

    renderData.fee = []
    renderData.sum_fee = 0
    if (bl.invoice_masterbi_transfer) {
      renderData.fee.push({ type: 'TRANSFER', amount: bl.invoice_masterbi_transfer })
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_transfer)
    }
    if (bl.invoice_masterbi_lolf) {
      renderData.fee.push({ type: 'LOLF', amount: bl.invoice_masterbi_lolf })
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_lolf)
    }
    if (bl.invoice_masterbi_lcl) {
      renderData.fee.push({ type: 'LCL', amount: bl.invoice_masterbi_lcl })
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_lcl)
    }
    if (bl.invoice_masterbi_amendment) {
      renderData.fee.push({ type: 'AMENDMENT', amount: bl.invoice_masterbi_amendment })
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_amendment)
    }
    if (bl.invoice_masterbi_tasac) {
      renderData.fee.push({ type: 'TASAC', amount: bl.invoice_masterbi_tasac })
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_tasac)
    }
    if (bl.invoice_masterbi_printing) {
      renderData.fee.push({ type: 'PTINTING', amount: bl.invoice_masterbi_printing })
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_printing)
    }

    let fileInfo = await common.ejs2Pdf('fee.ejs', renderData, 'zhongtan')

    await tb_uploadfile.create({
      api_name: 'RECEIPT-FEE',
      user_id: user.user_id,
      uploadfile_index1: bl.invoice_masterbi_id,
      uploadfile_name: fileInfo.name,
      uploadfile_url: fileInfo.url
    })

    return common.success({ url: fileInfo.url })
  }
  return common.success()
}
