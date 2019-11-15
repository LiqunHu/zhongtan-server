const X = require('xlsx')
const moment = require('moment')
// const logger = require('../../../app/logger').createLogger(__filename)
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')

const tb_vessel = model.zhongtan_invoice_vessel
const tb_bl = model.zhongtan_invoice_masterbl
const tb_container = model.zhongtan_invoice_containers

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

    let vessel = await tb_vessel.findOne({
      where: {
        invoice_vessel_name: vesslInfoJS[0]['Vessel Name'],
        invoice_vessel_voyage: vesslInfoJS[0]['Voyage']
      }
    })

    if (vessel) {
      return common.error('import_01')
    } else {
      vessel = await tb_vessel.create({
        invoice_vessel_mrn: vesslInfoJS[0]['MRN'],
        invoice_vessel_name: vesslInfoJS[0]['Vessel Name'],
        invoice_vessel_call_sign: vesslInfoJS[0]['Call Sign'],
        invoice_vessel_voyage: vesslInfoJS[0]['Voyage'],
        invoice_vessel_departure_date: vesslInfoJS[0]['Departure Date'],
        invoice_vessel_arrival_date: vesslInfoJS[0]['Arrival Date'],
        invoice_vessel_tpa_uid: vesslInfoJS[0]['TPA UID']
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
  let doc = common.docValidate(req)

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

  return common.success(vessels)
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
  returnData.MasterBl = JSON.parse(JSON.stringify(bl))
  returnData.Containers = JSON.parse(JSON.stringify(container))

  return common.success(returnData)
}