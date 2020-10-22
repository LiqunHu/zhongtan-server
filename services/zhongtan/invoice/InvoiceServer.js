const X = require('xlsx')
const moment = require('moment')
const numberToText = require('number2text')
// const logger = require('../../../app/logger').createLogger(__filename)
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')
const mailer = require('../../../util/Mail')
const cal_config_srv = require('../equipment/OverdueCalculationConfigServer')
const Op = model.Op

const tb_user = model.common_user
const tb_vessel = model.zhongtan_invoice_vessel
const tb_bl = model.zhongtan_invoice_masterbl
const tb_container = model.zhongtan_invoice_containers
const tb_uploadfile = model.zhongtan_uploadfile
const tb_fee_config = model.zhongtan_invoice_fixed_fee_config
const tb_fixed_deposit = model.zhongtan_customer_fixed_deposit
const tb_icd = model.zhongtan_icd

exports.initAct = async () => {
  let DELIVER = []
  let queryStr = `SELECT user_name FROM tbl_common_user WHERE state = '1' AND user_type = ? ORDER BY user_name`
  let replacements = [GLBConfig.TYPE_CUSTOMER]
  let deliverys = await model.simpleSelect(queryStr, replacements)
  if(deliverys) {
    for(let d of deliverys) {
      let dt = d.user_name.trim()
      if(DELIVER.indexOf(dt) < 0) {
        DELIVER.push(dt)
      }
    }
  }

  let ICD = []
  queryStr = `SELECT icd_name, icd_code FROM tbl_zhongtan_icd WHERE state = ? ORDER BY icd_code`
  replacements = [GLBConfig.ENABLE]
  let icds = await model.simpleSelect(queryStr, replacements)
  if(icds) {
    ICD = icds
  }

  let DEPOT = []
  queryStr = `SELECT edi_depot_id, edi_depot_name FROM tbl_zhongtan_edi_depot WHERE state = ? ORDER BY edi_depot_name`
  replacements = [GLBConfig.ENABLE]
  let depots = await model.simpleSelect(queryStr, replacements)
  if(depots) {
    DEPOT = depots
  }

  let returnData = {
    TFINFO: GLBConfig.TFINFO,
    RECEIPT_TYPE_INFO: GLBConfig.RECEIPT_TYPE_INFO,
    CASH_BANK_INFO: GLBConfig.CASH_BANK_INFO,
    COLLECT_FLAG: GLBConfig.COLLECT_FLAG,
    RECEIPT_CURRENCY: GLBConfig.RECEIPT_CURRENCY,
    UPLOAD_STATE: GLBConfig.UPLOAD_STATE,
    DELIVER: DELIVER,
    ICD: ICD,
    DEPOT: DEPOT
  }

  return common.success(returnData)
}

exports.initDOAct = async () => {
  let DELIVER = []
  let queryStr = `SELECT user_name FROM tbl_common_user WHERE state = '1' AND user_type = ? ORDER BY user_name`
  let replacements = [GLBConfig.TYPE_CUSTOMER]
  let deliverys = await model.simpleSelect(queryStr, replacements)
  if(deliverys) {
    for(let d of deliverys) {
      let dt = d.user_name.trim()
      if(DELIVER.indexOf(dt) < 0) {
        DELIVER.push(dt)
      }
    }
  }

  let ICD = []
  queryStr = `SELECT icd_name, icd_code FROM tbl_zhongtan_icd WHERE state = ? ORDER BY icd_code`
  replacements = [GLBConfig.ENABLE]
  let icds = await model.simpleSelect(queryStr, replacements)
  if(icds) {
    ICD = icds
  }

  let DEPOT = []
  queryStr = `SELECT edi_depot_id, edi_depot_name FROM tbl_zhongtan_edi_depot WHERE state = ? ORDER BY edi_depot_name`
  replacements = [GLBConfig.ENABLE]
  let depots = await model.simpleSelect(queryStr, replacements)
  if(depots) {
    DEPOT = depots
  }

  let returnData = {
    DELIVER: DELIVER,
    ICD: ICD,
    DEPOT: DEPOT
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
    if(doc.importFileType && doc.importFileType === 'bulk') {
      // 散货
      let bulkInfo = wb.Sheets['BULKSHIPMENT']
      if(!bulkInfo) {
        let sheetNames = wb.SheetNames
        if(sheetNames && sheetNames.length > 0) {
          bulkInfo = wb.Sheets[sheetNames[0]]
        }
      }
      if(!bulkInfo) {
        return common.error('import_12')
      }
      let bulkInfoJS = X.utils.sheet_to_json(bulkInfo, {})
      if (!bulkInfoJS[0]['Ves/Voy']) {
        return common.error('import_03')
      }
      let ves = bulkInfoJS[0]['Ves/Voy'].split('/')[0].trim()
      let voy = bulkInfoJS[0]['Ves/Voy'].split('/')[1].trim()
      let vessel = await tb_vessel.findOne({
        where: {
          invoice_vessel_name: ves,
          invoice_vessel_voyage: voy,
          state: GLBConfig.ENABLE
        }
      })
      if (vessel) {
        return common.error('import_01')
      } else {
        vessel = await tb_vessel.create({
          invoice_vessel_name: ves,
          invoice_vessel_voyage: voy,
          invoice_vessel_eta: typeof bulkInfoJS[0]['ETA'] === 'object' ? moment(bulkInfoJS[0]['ETA']).add(1, 'days').format('DD/MM/YYYY') : bulkInfoJS[0]['ETA'],
          invoice_vessel_atd: typeof bulkInfoJS[0]['ETD'] === 'object' ? moment(bulkInfoJS[0]['ETD']).add(1, 'days').format('DD/MM/YYYY') : bulkInfoJS[0]['ETD'],
          invoice_vessel_type: 'Bulk'
        })

        for (let m of bulkInfoJS) {
          let pcs = ''
          let qty = ''
          let weight = ''
          let weight_unit = ''
          let measurement = ''
          let measurement_unit = ''
          let freight = m['Freight Terms'] || ''
          if(m['PCS/QTY']) {
            let pcsExec = /(\d+(\.\d+)?)/i.exec(m['PCS/QTY'])
            if(pcsExec && pcsExec.length > 0) {
              pcs = pcsExec[0]
              qty = m['PCS/QTY'].replace(pcs, '').trim()
            }
          }
          if(m['Weight']) {
            let weightExec = /(\d+(\.\d+)?)/i.exec(m['Weight'])
            if(weightExec && weightExec.length > 0) {
              weight = weightExec[0]
              weight_unit = m['Weight'].replace(weight, '').trim()
            }
          }
          if(m['Measurement']) {
            let measurementExec = /(\d+(\.\d+)?)/i.exec(m['Measurement'])
            if(measurementExec && measurementExec.length > 0) {
              measurement = measurementExec[0]
              measurement_unit = m['Measurement'].replace(measurement, '').trim()
            }
          }
          if(m['Freight Terms']) {
            freight = m['Freight Terms']
          }
          if(freight) {
            if(freight.toUpperCase().indexOf('PREPAID') != -1) {
              freight = 'PREPAID'
            } else if(freight.toUpperCase().indexOf('COLLECT') != -1) {
              freight = 'COLLECT'
            }
          } else {
            freight = 'PREPAID'
          }

          await tb_bl.create({
            invoice_vessel_id: vessel.invoice_vessel_id,
            invoice_masterbi_bl: m['B/L Nr.'],
            invoice_masterbi_loading: m['Loading Port'],
            invoice_masterbi_destination: m['Discharge Port'],
            invoice_masterbi_delivery: m['Delivery'],
            invoice_masterbi_cargo_type: m['Cargo Classification'],
            invoice_masterbi_exporter_name: m['SHIPPER'] || '',
            invoice_masterbi_consignee_name: m['CNEE'] || '',
            invoice_masterbi_consignee_address: m['CNEE ADDRESS'] || '',
            invoice_masterbi_delivery_to: m['CNEE ADDRESS'] || '',
            invoice_masterbi_notify_name: m['NOTIFY'] || '',
            invoice_masterbi_shipping_mark: m['MARKS & NRS'] || '',
            invoice_masterbi_goods_description: m['COMMODITY'],
            invoice_masterbi_package_no: pcs,
            invoice_masterbi_package_unit: qty,
            invoice_masterbi_gross_weight: weight,
            invoice_masterbi_gross_weight_unit: weight_unit,
            invoice_masterbi_gross_volume: measurement,
            invoice_masterbi_gross_volume_unit: measurement_unit,
            invoice_masterbi_freight: freight,
            invoice_masterbi_do_icd: m['ICD NAME'] || '',
            invoice_masterbi_vessel_type: 'Bulk'
          })
        }
      }
    } else {
      // 集装箱
      let vesselInfo = wb.Sheets['VesselInformation']
      let masterBI = wb.Sheets['MasterBl']
      let containers = wb.Sheets['Containers']
      if(!vesselInfo || !masterBI || !containers) {
        return common.error('import_03')
      }

      let vesslInfoJS = X.utils.sheet_to_json(vesselInfo, {})
      let masterBIJS = X.utils.sheet_to_json(masterBI, {})
      let containersJS = X.utils.sheet_to_json(containers, {})

      if (!(vesslInfoJS[0]['VESSEL NAME'] && vesslInfoJS[0]['VOYAGE NUM'])) {
        return common.error('import_03')
      }

      let vessel = await tb_vessel.findOne({
        where: {
          invoice_vessel_name: vesslInfoJS[0]['VESSEL NAME'],
          invoice_vessel_voyage: vesslInfoJS[0]['VOYAGE NUM'],
          invoice_vessel_code: vesslInfoJS[0]['VESSEL CODE']
        }
      })

      if (vessel) {
        return common.error('import_01')
      } else {
        for (let m of masterBIJS) {
          let masterbi_freight = m['Freight Terms'] || ''
          if(masterbi_freight) {
            if(masterbi_freight.toUpperCase().indexOf('PREPAID') != -1) {
              masterbi_freight = 'PREPAID'
            } else if(masterbi_freight.toUpperCase().indexOf('COLLECT') != -1) {
              masterbi_freight = 'COLLECT'
            }
          }
          let freight_charge = m['Freight Charge'] || ''
          if(freight_charge && isNaN(Number(freight_charge))) {
            return common.error('import_11')
          }
          if(masterbi_freight === 'COLLECT' && !freight_charge) {
            return common.error('import_10')
          }
        }

        vessel = await tb_vessel.create({
          invoice_vessel_name: vesslInfoJS[0]['VESSEL NAME'],
          invoice_vessel_code: vesslInfoJS[0]['VESSEL CODE'],
          invoice_vessel_voyage: vesslInfoJS[0]['VOYAGE NUM'],
          invoice_vessel_eta: typeof vesslInfoJS[0]['ETA'] === 'object' ? moment(vesslInfoJS[0]['ETA']).add(1, 'days').format('DD/MM/YYYY') : vesslInfoJS[0]['ETA'],
          invoice_vessel_ata: typeof vesslInfoJS[0]['ATA'] === 'object' ? moment(vesslInfoJS[0]['ATA']).add(1, 'days').format('DD/MM/YYYY') : vesslInfoJS[0]['ATA'],
          invoice_vessel_atd: typeof vesslInfoJS[0]['ATD'] === 'object' ? moment(vesslInfoJS[0]['ATD']).add(1, 'days').format('DD/MM/YYYY') : vesslInfoJS[0]['ATD'],
          invoice_vessel_call_sign: vesslInfoJS[0]['CALL SIGN'],
          invoice_vessel_type: 'Container'
        })

        for (let m of masterBIJS) {
          if(m['#M B/L No']) {
            let masterbi_freight = m['Freight Terms'] || ''
            if(masterbi_freight) {
              if(masterbi_freight.toUpperCase().indexOf('PREPAID') != -1) {
                masterbi_freight = 'PREPAID'
              } else if(masterbi_freight.toUpperCase().indexOf('COLLECT') != -1) {
                masterbi_freight = 'COLLECT'
              }
            }
            let freight_charge = m['Freight Charge'] || ''
            if(!freight_charge || isNaN(Number(freight_charge))) {
              freight_charge = ''
            }

            let freight_currency = m['Freight Currency'] || ''
            if(freight_currency) {
              if(masterbi_freight.toUpperCase().indexOf('USD') != -1) {
                freight_currency = 'USD'
              } else if(masterbi_freight.toUpperCase().indexOf('TZS') != -1) {
                freight_currency = 'TZS'
              }
            }
            let masterbi_bl = m['#M B/L No']
            let masterbi_carrier = ''
            if(masterbi_bl.indexOf('COS') >= 0) {
              masterbi_carrier  = 'COSCO'
            } else if(masterbi_bl.indexOf('OOLU') >= 0) {
              masterbi_carrier  = 'OOCL'
            }
            await tb_bl.create({
              invoice_vessel_id: vessel.invoice_vessel_id,
              invoice_masterbi_bl: masterbi_bl,
              invoice_masterbi_carrier: masterbi_carrier,
              invoice_masterbi_cargo_type: m['Cargo Classification'],
              invoice_masterbi_bl_type: m['*B/L Type'],
              invoice_masterbi_destination: m['Place of Destination'],
              invoice_masterbi_delivery: m['Place of Delivery'],
              invoice_masterbi_freight: masterbi_freight,
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
              invoice_masterbi_freight_charge: freight_charge,
              invoice_masterbi_freight_currency: freight_currency,
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
              invoice_masterbi_terminal_code: m['TerminalCode'] || '',
              invoice_masterbi_vessel_type: 'Container'
            })
          }
        }

        for (let c of containersJS) {
          if(c['#M B/L No'] && c['Container No']) {
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
      // vessel info
      let vessel = await tb_vessel.findOne({
        where: {
          invoice_vessel_id: d.invoice_vessel_id
        }
      })
      d.invoice_vessel_name = vessel.invoice_vessel_name
      d.invoice_vessel_voyage = vessel.invoice_vessel_voyage
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
      let scount = await tb_container.count({
        where: {
          invoice_containers_bl: d.invoice_masterbi_bl,
          invoice_vessel_id: d.invoice_vessel_id,
          state: GLBConfig.ENABLE,
          invoice_containers_type: 'S'
        }
      })
      d.container_has_soc = scount > 0
      // Invoice state
      d.invoice_masterbi_invoice_state = await checkConditionInvoiceState(d)
      // D/O state overdue check
      let doCondition = await checkConditionDoState(d, vessel)
      d.invoice_masterbi_do_state = common.checkDoState(d) && doCondition.check
      if(doCondition.msg) {
        d.invoice_masterbi_do_state_message = doCondition.msg
      }
      // delivery to
      if(!d.invoice_masterbi_delivery_to && d.customerINFO && d.customerINFO.length === 1) {
        d.invoice_masterbi_delivery_to = d.customerINFO[0].text
      }
      // 客户类型代理不可更改收货人
      d.invoice_masterbi_delivery_to_customer_type = '0'
      if(d.invoice_masterbi_delivery_to) {
        let delivery = await tb_user.findOne({
          where: {
            user_name: d.invoice_masterbi_delivery_to,
            state: GLBConfig.ENABLE,
            user_type: GLBConfig.TYPE_CUSTOMER
          }
        })
        if(delivery) {
          d.invoice_masterbi_delivery_to_customer_type= delivery.user_customer_type
        }
      }

      // depot
      if(!d.invoice_masterbi_do_return_depot) {
        d.invoice_masterbi_do_return_depot = 'FANTUZZI'
      }
      d.invoice_masterbi_do_return_depot_disabled = await checkDoDepotState(d)
      // files
      d = await this.getMasterbiFiles(d)

      // Place of delivery
      if(!d.invoice_masterbi_do_icd && d.invoice_masterbi_delivery) {
        let icd = await tb_icd.findOne({
          where: {
            state : GLBConfig.ENABLE,
            [Op.or]: [{ icd_name: d.invoice_masterbi_delivery }, { icd_code: d.invoice_masterbi_delivery }]
          }
        })
        if(icd) {
          d.invoice_masterbi_do_icd = icd.icd_name
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
      queryStr += 'AND (a.invoice_masterbi_freight != "COLLECT" OR a.invoice_masterbi_freight IS NULL OR a.invoice_masterbi_freight = "")'
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
    // vessel info
    let vessel = await tb_vessel.findOne({
      where: {
        invoice_vessel_id: d.invoice_vessel_id
      }
    })
    d.invoice_vessel_name = vessel.invoice_vessel_name
    d.invoice_vessel_voyage = vessel.invoice_vessel_voyage
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
    let scount = await tb_container.count({
      where: {
        invoice_containers_bl: d.invoice_masterbi_bl,
        invoice_vessel_id: d.invoice_vessel_id,
        state: GLBConfig.ENABLE,
        invoice_containers_type: 'S'
      }
    })
    d.container_has_soc = scount > 0
    // Invoice state
    d.invoice_masterbi_invoice_state = await checkConditionInvoiceState(d)
    // D/O state
    let doCondition = await checkConditionDoState(d, vessel)
    d.invoice_masterbi_do_state = common.checkDoState(d) && doCondition.check
    if(doCondition.msg) {
      d.invoice_masterbi_do_state_message = doCondition.msg
    }
    // delivery to
    if(!d.invoice_masterbi_delivery_to && d.customerINFO && d.customerINFO.length === 1) {
      d.invoice_masterbi_delivery_to = d.customerINFO[0].text
    }
    // 客户类型代理不可更改收货人
    d.invoice_masterbi_delivery_to_customer_type = '0'
    if(d.invoice_masterbi_delivery_to) {
      let delivery = await tb_user.findOne({
        where: {
          user_name: d.invoice_masterbi_delivery_to,
          state: GLBConfig.ENABLE,
          user_type: GLBConfig.TYPE_CUSTOMER
        }
      })
      if(delivery) {
        d.invoice_masterbi_delivery_to_customer_type= delivery.user_customer_type
      }
    }
    // depot
    if(!d.invoice_masterbi_do_return_depot) {
      d.invoice_masterbi_do_return_depot = 'FANTUZZI'
    }
    d.invoice_masterbi_do_return_depot_disabled = await checkDoDepotState(d)
    // file info
    d = await this.getMasterbiFiles(d)

    // Place of delivery
    if(!d.invoice_masterbi_do_icd && d.invoice_masterbi_delivery) {
      let icd = await tb_icd.findOne({
        where: {
          state : GLBConfig.ENABLE,
          [Op.or]: [{ icd_name: d.invoice_masterbi_delivery }, { icd_code: d.invoice_masterbi_delivery }]
        }
      })
      if(icd) {
        d.invoice_masterbi_do_icd = icd.icd_name
      }
    }
    returnData.rows.push(d)
  }

  return common.success(returnData)
}

exports.getMasterbiFiles = async d => {
  d.files = []
  let queryStr = `SELECT a.*, b.user_name FROM tbl_zhongtan_uploadfile a
      left join tbl_common_user b on a.uploadfil_release_user_id = b.user_id
      WHERE a.state = '1' and a.uploadfile_index1 = ?`
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

exports.getContainersDataAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}
  let queryStr = `select * from tbl_zhongtan_invoice_containers WHERE state = ?`
  let replacements = [GLBConfig.ENABLE]
  if(doc.invoice_vessel_id) {
    queryStr += ` AND invoice_vessel_id = ?`
    replacements.push(doc.invoice_vessel_id)
  }
  if(doc.bl) {
    queryStr += ` AND invoice_containers_bl = ?`
    replacements.push(doc.bl)
  }
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
  if(!doc.invoice_masterbi_delivery_to || !doc.invoice_masterbi_valid_to) {
    return common.error('do_01')
  }

  let dc = await tb_user.findOne({
    where: {
      user_name: doc.invoice_masterbi_delivery_to,
      state: GLBConfig.ENABLE,
      user_type: GLBConfig.TYPE_CUSTOMER
    }
  })
  if(!dc) {
    return common.error('do_02')
  }
  if(dc.user_customer_type == GLBConfig.USER_CUSTOMER_TYPE_CONSIGNEE && dc.user_name != bl.invoice_masterbi_consignee_name) {
    // Delivery To 是收货人，必须与舱单收货人名称一致
    return common.error('do_03')
  }
  let delivery_order_no = ('000000000000000' + bl.invoice_masterbi_id).slice(-8)
  bl.invoice_masterbi_delivery_to = doc.invoice_masterbi_delivery_to
  bl.invoice_masterbi_do_date = moment().format('YYYY-MM-DD')
  if(doc.invoice_masterbi_valid_to) {
    if(doc.invoice_masterbi_valid_to.indexOf('T') >= 0) {
      bl.invoice_masterbi_valid_to = moment(moment.utc(doc.invoice_masterbi_valid_to).toDate()).format('YYYY-MM-DD')
    } else {
      bl.invoice_masterbi_valid_to = moment(doc.invoice_masterbi_valid_to, 'YYYY-MM-DD').format('YYYY-MM-DD')
    }
  } else {
    bl.invoice_masterbi_valid_to = null
  }
  bl.invoice_masterbi_do_delivery_order_no = delivery_order_no
  bl.invoice_masterbi_do_fcl = doc.invoice_masterbi_do_fcl
  bl.invoice_masterbi_do_icd = doc.invoice_masterbi_do_icd
  bl.invoice_masterbi_do_return_depot = doc.invoice_masterbi_do_return_depot
  bl.invoice_masterbi_do_release_date = new Date()
  await bl.save()

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
  
  let commonUser = await tb_user.findOne({
    where: {
      user_id: user.user_id
    }
  })

  let renderData = JSON.parse(JSON.stringify(bl))
  renderData.delivery_order_no = delivery_order_no
  renderData.invoice_vessel_name = vessel.invoice_vessel_name
  renderData.invoice_vessel_voyage = vessel.invoice_vessel_voyage
  renderData.vessel_eta = vessel.invoice_vessel_eta ? moment(vessel.invoice_vessel_eta, 'DD-MM-YYYY').format('DD/MM/YYYY') : ''
  renderData.vessel_atd = vessel.invoice_vessel_atd ? moment(vessel.invoice_vessel_atd, 'DD-MM-YYYY').format('DD/MM/YYYY') : ''
  renderData.do_date = bl.invoice_masterbi_do_date ? moment(bl.invoice_masterbi_do_date).format('DD/MM/YYYY') : ''
  renderData.valid_to = bl.invoice_masterbi_valid_to ? moment(bl.invoice_masterbi_valid_to).format('DD/MM/YYYY') : ''
  renderData.delivery_to = bl.invoice_masterbi_do_icd
  renderData.fcl = bl.invoice_masterbi_do_fcl
  renderData.depot = bl.invoice_masterbi_do_return_depot
  renderData.user_name = commonUser.user_name
  renderData.user_phone = commonUser.user_phone
  renderData.user_email = commonUser.user_email
  let fileInfo = {}
  if(vessel.invoice_vessel_type && vessel.invoice_vessel_type === 'Bulk') {
    fileInfo = await common.ejs2Pdf('doBulk.ejs', renderData, 'zhongtan')
  } else {
    renderData.containers = JSON.parse(JSON.stringify(continers))
    let cSize = []
    for (let i = 0; i < renderData.containers.length; i++) {
      renderData.containers[i].invoice_containers_tare = common.getContainerTare(renderData.containers[i].invoice_containers_size)
      if (cSize.indexOf(renderData.containers[i].invoice_containers_size) < 0) {
        cSize.push(renderData.containers[i].invoice_containers_size)
      }
    }
    renderData.container_count = bl.invoice_masterbi_container_no + 'X' + cSize.join(' ')
    fileInfo = await common.ejs2Pdf('do.ejs', renderData, 'zhongtan')
  }
  // await tb_uploadfile.destroy({
  //   where: {
  //     api_name: 'RECEIPT-DO',
  //     uploadfile_index1: bl.invoice_masterbi_id
  //   }
  // })

  await tb_uploadfile.create({
    api_name: 'RECEIPT-DO',
    user_id: user.user_id,
    uploadfile_index1: bl.invoice_masterbi_id,
    uploadfile_name: fileInfo.name,
    uploadfile_url: fileInfo.url,
    uploadfil_release_date: new Date(),
    uploadfil_release_user_id: user.user_id
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
    let queryStr = `select a.*, c.fixed_deposit_id from tbl_common_user a left join 
                    (select MAX(fixed_deposit_id) fixed_deposit_id, fixed_deposit_customer_id from tbl_zhongtan_customer_fixed_deposit b 
                      where b.state = '1' and b.deposit_work_state = 'W' and ((b.deposit_begin_date <= ? AND b.deposit_long_term = '1') 
                      OR (b.deposit_begin_date <= ? AND b.deposit_expire_date >= ?)) GROUP BY fixed_deposit_customer_id) 
                      c on a.user_id = c.fixed_deposit_customer_id 
                   where a.state = '1' and a.user_type = '${GLBConfig.TYPE_CUSTOMER}'  
                   and (a.user_username like ? or a.user_phone like ? or a.user_name like ?)`
    let replacements = []
    replacements.push(moment().format('YYYY-MM-DD'))
    replacements.push(moment().format('YYYY-MM-DD'))
    replacements.push(moment().format('YYYY-MM-DD'))
    let search_text = doc.search_text + '%'
    replacements.push(search_text)
    replacements.push(search_text)
    replacements.push(search_text)
    let shippers = await model.simpleSelect(queryStr, replacements)
    for (let s of shippers) {
      returnData.customerINFO.push({
        id: s.user_id,
        text: s.user_name,
        fixed: s.fixed_deposit_id,
        balcklist: s.user_blacklist
      })
    }
    return common.success(returnData)
  } else {
    return common.success()
  }
}

exports.depositDoAct = async req => {
  let doc = common.docValidate(req),
    user = req.user, curDate = new Date()
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

  let commonUser = await tb_user.findOne({
    where: {
      user_id: user.user_id
    }
  })

  if (!customer) {
    return common.error('import_04')
  }

  if (!doc.invoice_masterbi_carrier) {
    return common.error('import_05')
  }
  
  let queryStr = `SELECT invoice_containers_size, COUNT(invoice_containers_size) AS invoice_containers_count 
      FROM tbl_zhongtan_invoice_containers WHERE invoice_containers_bl= ? AND invoice_vessel_id = ? AND state = ? 
      GROUP BY invoice_containers_size ORDER BY invoice_containers_size`
  let replacements = []
  replacements.push(bl.invoice_masterbi_bl)
  replacements.push(bl.invoice_vessel_id)
  replacements.push(GLBConfig.ENABLE)
  let continers = await model.simpleSelect(queryStr, replacements)

  if (doc.depositType === 'Container Deposit') {
    if(!doc.invoice_masterbi_deposit) {
      return common.error('deposit_01')
    }
    bl.invoice_masterbi_customer_id = doc.invoice_masterbi_customer_id
    bl.invoice_masterbi_delivery_to = customer.user_name
    bl.invoice_masterbi_carrier = doc.invoice_masterbi_carrier
    bl.invoice_masterbi_deposit = doc.invoice_masterbi_deposit
    bl.invoice_masterbi_deposit_date = curDate
    let fd = null
    if(doc.invoice_masterbi_deposit_fixed && doc.invoice_masterbi_deposit_fixed === '1' && doc.invoice_masterbi_deposit_fixed_id && !doc.depositEdit) {
      if(bl.invoice_masterbi_deposit_release_date) {
        return common.error('import_09')
      }
      bl.invoice_masterbi_deposit_fixed = GLBConfig.ENABLE
      bl.invoice_masterbi_deposit_release_date = curDate
      fd = await tb_fixed_deposit.findOne({
        where: {
          fixed_deposit_id: doc.invoice_masterbi_deposit_fixed_id,
          state: GLBConfig.ENABLE
        }
      })
      if(!fd) {
        return common.error('fee_04')
      }
    }
    
    let renderData = JSON.parse(JSON.stringify(bl))
    renderData.deposit_date = moment(bl.invoice_masterbi_deposit_date).format('YYYY/MM/DD')
    renderData.receipt_no = await seq.genReceiptNo()
    renderData.customer_name = customer.user_name
    renderData.address = customer.user_address
    renderData.address1 = customer.user_address1
    renderData.address2 = customer.user_address2
    renderData.user_name = commonUser.user_name
    renderData.user_phone = commonUser.user_phone
    renderData.user_email = commonUser.user_email
    renderData.vessel_name = vessel.invoice_vessel_name
    renderData.voyage_number = vessel.invoice_vessel_voyage
    renderData.voyage_ata_date = vessel.invoice_vessel_ata
    renderData.invoice_deposit_currency = doc.invoice_container_deposit_currency
    renderData.invoice_masterbi_deposit_comment = doc.invoice_masterbi_deposit_comment
    renderData.containers = []
    if(doc.invoice_masterbi_deposit_fixed && doc.invoice_masterbi_deposit_fixed === '1' && doc.invoice_masterbi_deposit_fixed_id && !doc.depositEdit) {
      // fixed container deposit
      renderData.containers.push({
        quantity: 'FIXED',
        cnty_type: 'CNT',
        standard: 'DEPOSIT'
      })
    } else if(doc.invoice_masterbi_deposit_necessary) {
      if(doc.invoice_masterbi_deposit_type ==='BL') {
        renderData.containers.push({
          quantity: '1',
          cnty_type: '',
          standard: 'B/L'
        })
      } else {
        for(let c of continers) {
          renderData.containers.push({
            quantity: c.invoice_containers_count,
            cnty_type: c.invoice_containers_size,
            standard: ''
          })
        }
      }
    }
    let fileInfo = await common.ejs2Pdf('deposit.ejs', renderData, 'zhongtan')
    if(!bl.invoice_masterbi_deposit_receipt_date) {
      await tb_uploadfile.destroy({
        where: {
          api_name: 'RECEIPT-DEPOSIT',
          uploadfile_index1: bl.invoice_masterbi_id
        }
      })
    }
    let uploadfile_state = 'PB' // TODO state PM => PB
    let uploadfil_release_date = null
    let uploadfil_release_user_id = null
    if(doc.invoice_masterbi_deposit_fixed && doc.invoice_masterbi_deposit_fixed === '1' && doc.invoice_masterbi_deposit_fixed_id && !doc.depositEdit) {
      // fixed container deposit auto check=> release=> receipt=> receipt release
      uploadfile_state = 'AP'
      uploadfil_release_date = curDate
      uploadfil_release_user_id = user.user_id
    }
    await tb_uploadfile.create({
      api_name: 'RECEIPT-DEPOSIT',
      user_id: user.user_id,
      uploadfile_index1: bl.invoice_masterbi_id,
      uploadfile_name: fileInfo.name,
      uploadfile_url: fileInfo.url,
      uploadfile_currency: doc.invoice_container_deposit_currency,
      uploadfile_state: uploadfile_state, 
      uploadfile_amount_comment: doc.invoice_masterbi_deposit_comment,
      uploadfil_release_date: uploadfil_release_date,
      uploadfil_release_user_id: uploadfil_release_user_id,
      uploadfile_received_from: customer.user_name,
      uploadfile_invoice_no: 'CTS/' + renderData.invoice_masterbi_carrier + '/' + renderData.voyage_number + '/' + renderData.receipt_no
    })
    if(doc.invoice_masterbi_deposit_fixed && doc.invoice_masterbi_deposit_fixed === '1' && doc.invoice_masterbi_deposit_fixed_id && !doc.depositEdit) {
      bl.invoice_masterbi_receipt_amount = bl.invoice_masterbi_deposit
      bl.invoice_masterbi_receipt_currency = fd.deposit_currency
      bl.invoice_masterbi_check_cash = fd.deposit_check_cash
      bl.invoice_masterbi_check_no = fd.deposit_check_cash_no
      bl.invoice_masterbi_bank_reference_no = fd.deposit_bank_reference_no
      bl.invoice_masterbi_received_from = customer.user_name
      bl.invoice_masterbi_receipt_no = await seq.genInvoiceReceiptNo(bl.invoice_masterbi_carrier)
      if(common.checkInvoiceState(bl)) {
        bl.invoice_masterbi_invoice_release_date = curDate
      }
      bl.invoice_masterbi_deposit_receipt_date = curDate
      if(common.checkDoState(bl)) {
        bl.invoice_masterbi_receipt_release_date = curDate
      }
      let renderData = JSON.parse(JSON.stringify(bl))
      renderData.receipt_type = 'DEPOSIT'
      renderData.receipt_date = moment().format('MMM DD, YYYY')
      if (bl.invoice_masterbi_check_cash === 'CASH') {
        renderData.check_cash = 'Cash'
      } else if (bl.invoice_masterbi_check_cash === 'TRANSFER') {
        renderData.check_cash = 'Bank transfer/ ' + bl.invoice_masterbi_bank_reference_no
      } else {
        renderData.check_cash = 'Cheque/ ' + bl.invoice_masterbi_check_no
      }
      if(bl.invoice_masterbi_receipt_amount) {
        renderData.sum_fee = parseFloat(bl.invoice_masterbi_receipt_amount.toString().replace(/,/g, '') || 0)
      } else {
        renderData.sum_fee = parseFloat('0'.replace(/,/g, '') || 0)
      }
      renderData.sum_fee_str = numberToText(renderData.sum_fee)
      renderData.user_name = commonUser.user_name
      renderData.user_phone = commonUser.user_phone
      renderData.user_email = commonUser.user_email
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
        uploadfile_acttype: 'deposit',
        uploadfile_amount: bl.invoice_masterbi_receipt_amount,
        uploadfile_currency: bl.invoice_masterbi_receipt_currency,
        uploadfile_check_cash: bl.invoice_masterbi_check_cash,
        uploadfile_check_no: bl.invoice_masterbi_check_no,
        uploadfile_bank_reference_no: bl.invoice_masterbi_bank_reference_no,
        uploadfile_received_from: bl.invoice_masterbi_received_from,
        uploadfile_receipt_no: bl.invoice_masterbi_receipt_no,
        uploadfil_release_date: uploadfil_release_date,
        uploadfil_release_user_id: uploadfil_release_user_id
      })
    }
    await bl.save()
    return common.success({ url: fileInfo.url })
  } else if (doc.depositType === 'Invoice Fee') {
    if(bl.invoice_masterbi_freight === 'COLLECT') {
      if(bl.invoice_masterbi_cargo_type === 'IM') {
        if(!(doc.invoice_masterbi_of &&
          (doc.invoice_masterbi_bl_amendment || doc.invoice_masterbi_cod_charge || doc.invoice_masterbi_transfer 
            || doc.invoice_masterbi_lolf || doc.invoice_masterbi_lcl || doc.invoice_masterbi_amendment 
            || doc.invoice_masterbi_tasac || doc.invoice_masterbi_printing || doc.invoice_masterbi_others))) {
              return common.error('deposit_03')
            }
      }else if(bl.invoice_masterbi_cargo_type === 'TR' && !doc.invoice_masterbi_of){
        return common.error('deposit_04')
      }
    } else {
      if(!(doc.invoice_masterbi_of || doc.invoice_masterbi_bl_amendment || doc.invoice_masterbi_cod_charge || doc.invoice_masterbi_transfer 
        || doc.invoice_masterbi_lolf || doc.invoice_masterbi_lcl || doc.invoice_masterbi_amendment 
        || doc.invoice_masterbi_tasac || doc.invoice_masterbi_printing || doc.invoice_masterbi_others)) {
          return common.error('deposit_02')
        }
    }
    if(!bl.invoice_masterbi_customer_id) {
      bl.invoice_masterbi_customer_id = doc.invoice_masterbi_customer_id
      bl.invoice_masterbi_delivery_to = customer.user_name
      bl.invoice_masterbi_carrier = doc.invoice_masterbi_carrier
    }
    bl.invoice_masterbi_of = doc.invoice_masterbi_of
    bl.invoice_masterbi_bl_amendment = doc.invoice_masterbi_bl_amendment
    bl.invoice_masterbi_cod_charge = doc.invoice_masterbi_cod_charge
    bl.invoice_masterbi_transfer = doc.invoice_masterbi_transfer
    bl.invoice_masterbi_lolf = doc.invoice_masterbi_lolf
    bl.invoice_masterbi_lcl = doc.invoice_masterbi_lcl
    bl.invoice_masterbi_amendment = doc.invoice_masterbi_amendment
    bl.invoice_masterbi_tasac = doc.invoice_masterbi_tasac
    bl.invoice_masterbi_printing = doc.invoice_masterbi_printing
    bl.invoice_masterbi_others = doc.invoice_masterbi_others
    bl.invoice_masterbi_fee_date = curDate
    bl.invoice_masterbi_fee_release_date = null
    bl.invoice_masterbi_invoice_release_date = null

    let renderData = JSON.parse(JSON.stringify(bl))
    renderData.fee_date = moment(bl.invoice_masterbi_fee_date).format('YYYY/MM/DD')
    renderData.customer_name = customer.user_name
    renderData.address = customer.user_address
    renderData.address1 = customer.user_address1
    renderData.address2 = customer.user_address2
    renderData.user_name = commonUser.user_name
    renderData.user_phone = commonUser.user_phone
    renderData.user_email = commonUser.user_email
    renderData.receipt_no = await seq.genReceiptNo()
    renderData.vessel_name = vessel.invoice_vessel_name
    renderData.voyage_number = vessel.invoice_vessel_voyage
    renderData.voyage_ata_date = vessel.invoice_vessel_ata
    renderData.fee_currency = doc.invoice_fee_currency
    renderData.fee_comment = doc.invoice_fee_comment

    renderData.fee = []
    renderData.sum_fee = 0

    if (bl.invoice_masterbi_bl_amendment) {
      let fee = { type: 'B/L AMENDMENT', amount: formatCurrency(bl.invoice_masterbi_bl_amendment), containers: []}
      if(doc.invoice_masterbi_bl_amendment_necessary) {
        if(doc.invoice_masterbi_bl_amendment_type ==='BL') {
          fee.containers.push({
            quantity: '1',
            cnty_type: '',
            standard: 'B/L'
          })
        } else {
          for(let c of continers) {
            fee.containers.push({
              quantity: c.invoice_containers_count,
              cnty_type: c.invoice_containers_size,
              standard: ''
            })
          }
        }
      }
      renderData.fee.push(fee)
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_bl_amendment)
    }
    if (bl.invoice_masterbi_cod_charge) {
      let fee = { type: 'COD CHARGE', amount: formatCurrency(bl.invoice_masterbi_cod_charge), containers: []}
      if(doc.invoice_masterbi_cod_charge_necessary) {
        if(doc.invoice_masterbi_cod_charge_type ==='BL') {
          fee.containers.push({
            quantity: '1',
            cnty_type: '',
            standard: 'B/L'
          })
        } else {
          for(let c of continers) {
            fee.containers.push({
              quantity: c.invoice_containers_count,
              cnty_type: c.invoice_containers_size,
              standard: ''
            })
          }
        }
      }
      renderData.fee.push(fee)
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_cod_charge)
    }
    if (bl.invoice_masterbi_transfer) {
      let fee = { type: 'CONTAINER TRANSFER', amount: formatCurrency(bl.invoice_masterbi_transfer), containers: []}
      if(doc.invoice_masterbi_transfer_necessary) {
        if(doc.invoice_masterbi_transfer_type ==='BL') {
          fee.containers.push({
            quantity: '1',
            cnty_type: '',
            standard: 'B/L'
          })
        } else {
          for(let c of continers) {
            fee.containers.push({
              quantity: c.invoice_containers_count,
              cnty_type: c.invoice_containers_size,
              standard: ''
            })
          }
        }
      }
      renderData.fee.push(fee)
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_transfer)
    }
    if (bl.invoice_masterbi_lolf) {
      let fee = { type: 'LIFT ON LIFT OFF', amount: formatCurrency(bl.invoice_masterbi_lolf), containers: []}
      if(doc.invoice_masterbi_lolf_necessary) {
        if(doc.invoice_masterbi_lolf_type ==='BL') {
          fee.containers.push({
            quantity: '1',
            cnty_type: '',
            standard: 'B/L'
          })
        } else {
          for(let c of continers) {
            fee.containers.push({
              quantity: c.invoice_containers_count,
              cnty_type: c.invoice_containers_size,
              standard: ''
            })
          }
        }
      }
      renderData.fee.push(fee)
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_lolf)
    }
    if (bl.invoice_masterbi_lcl) {
      let fee = { type: 'LCL FEE', amount: formatCurrency(bl.invoice_masterbi_lcl), containers: []}
      if(doc.invoice_masterbi_lcl_necessary) {
        if(doc.invoice_masterbi_lcl_type ==='BL') {
          fee.containers.push({
            quantity: '1',
            cnty_type: '',
            standard: 'B/L'
          })
        } else {
          for(let c of continers) {
            fee.containers.push({
              quantity: c.invoice_containers_count,
              cnty_type: c.invoice_containers_size,
              standard: ''
            })
          }
        }
      }
      renderData.fee.push(fee)
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_lcl)
    }
    if (bl.invoice_masterbi_amendment) {
      let fee = { type: 'AMENDMENT FEE', amount: formatCurrency(bl.invoice_masterbi_amendment), containers: []}
      if(doc.invoice_masterbi_amendment_necessary) {
        if(doc.invoice_masterbi_amendment_type ==='BL') {
          fee.containers.push({
            quantity: '1',
            cnty_type: '',
            standard: 'B/L'
          })
        } else {
          for(let c of continers) {
            fee.containers.push({
              quantity: c.invoice_containers_count,
              cnty_type: c.invoice_containers_size,
              standard: ''
            })
          }
        }
      }
      renderData.fee.push(fee)
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_amendment)
    }
    if (bl.invoice_masterbi_tasac) {
      let masterbi_tasac = ''
      if (bl.invoice_masterbi_tasac_receipt) {
        if(parseFloat(bl.invoice_masterbi_tasac) > parseFloat(bl.invoice_masterbi_tasac_receipt)) {
          masterbi_tasac = parseFloat(bl.invoice_masterbi_tasac) - parseFloat(bl.invoice_masterbi_tasac_receipt)
        }
      } else {
        masterbi_tasac = bl.invoice_masterbi_tasac
      }
      if(parseFloat(masterbi_tasac) > 0 ) {
        let fee = { type: 'TASAC FEE', amount: formatCurrency(masterbi_tasac), containers: []}
        if(doc.invoice_masterbi_tasac_necessary) {
          if(doc.invoice_masterbi_tasac_type ==='BL') {
            fee.containers.push({
              quantity: '1',
              cnty_type: '',
              standard: 'B/L'
            })
          } else {
            for(let c of continers) {
              fee.containers.push({
                quantity: c.invoice_containers_count,
                cnty_type: c.invoice_containers_size,
                standard: ''
              })
            }
          }
        }
        renderData.fee.push(fee)
        renderData.sum_fee += parseFloat(masterbi_tasac)
      }
    }
    if (bl.invoice_masterbi_printing) {
      let fee = { type: 'B/L PRINTING FEE', amount: formatCurrency(bl.invoice_masterbi_printing), containers: []}
      if(doc.invoice_masterbi_printing_necessary) {
        if(doc.invoice_masterbi_printing_type ==='BL') {
          fee.containers.push({
            quantity: '1',
            cnty_type: '',
            standard: 'B/L'
          })
        } else {
          for(let c of continers) {
            fee.containers.push({
              quantity: c.invoice_containers_count,
              cnty_type: c.invoice_containers_size,
              standard: ''
            })
          }
        }
      }
      renderData.fee.push(fee)
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_printing)
    }
    if (bl.invoice_masterbi_others) {
      let fee = { type: 'OTHERS', amount: formatCurrency(bl.invoice_masterbi_others), containers: []}
      if(doc.invoice_masterbi_others_necessary) {
        if(doc.invoice_masterbi_others_type ==='BL') {
          fee.containers.push({
            quantity: '1',
            cnty_type: '',
            standard: 'B/L'
          })
        } else {
          for(let c of continers) {
            fee.containers.push({
              quantity: c.invoice_containers_count,
              cnty_type: c.invoice_containers_size,
              standard: ''
            })
          }
        }
      }
      renderData.fee.push(fee)
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_others)
    }
    if (bl.invoice_masterbi_of) {
      let fee = { type: 'OCEAN FREIGHT', amount: formatCurrency(bl.invoice_masterbi_of), containers: []}
      if(doc.invoice_masterbi_of_fixed && doc.invoice_masterbi_of_fixed === '1') {
        fee.containers.push({
          quantity: '1',
          cnty_type: '',
          standard: 'B/L'
        })
      } else if(doc.invoice_masterbi_of_necessary) {
        if(doc.invoice_masterbi_of_type ==='BL') {
          fee.containers.push({
            quantity: '1',
            cnty_type: '',
            standard: 'B/L'
          })
        } else {
          for(let c of continers) {
            fee.containers.push({
              quantity: c.invoice_containers_count,
              cnty_type: c.invoice_containers_size,
              standard: ''
            })
          }
        }
      }
      renderData.fee.push(fee)
      renderData.sum_fee += parseFloat(bl.invoice_masterbi_of)
    }

    renderData.sum_fee = formatCurrency(renderData.sum_fee)
    let fileInfo = await common.ejs2Pdf('fee.ejs', renderData, 'zhongtan')
    if(!bl.invoice_masterbi_invoice_receipt_date) {
      await tb_uploadfile.destroy({
        where: {
          api_name: 'RECEIPT-FEE',
          uploadfile_index1: bl.invoice_masterbi_id
        }
      })
    }
    await tb_uploadfile.create({
      api_name: 'RECEIPT-FEE',
      user_id: user.user_id,
      uploadfile_index1: bl.invoice_masterbi_id,
      uploadfile_name: fileInfo.name,
      uploadfile_url: fileInfo.url,
      uploadfile_currency: doc.invoice_fee_currency,
      uploadfile_state: 'PB', // TODO state PM => PB
      uploadfile_amount_comment: doc.invoice_fee_comment,
      uploadfile_received_from: customer.user_name,
      uploadfile_invoice_no: 'CTS/' + renderData.invoice_masterbi_carrier + '/' + renderData.voyage_number + '/' + renderData.receipt_no
    })
    await bl.save()
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
    renderData.user_name = commonUser.user_name
    renderData.user_phone = commonUser.user_phone
    renderData.user_email = commonUser.user_email
    renderData.receipt_no = await seq.genReceiptNo()
    renderData.vessel_name = vessel.invoice_vessel_name
    renderData.voyage_number = vessel.invoice_vessel_voyage
    renderData.voyage_ata_date = vessel.invoice_vessel_ata
    renderData.fee_currency = doc.invoice_masterbi_of_currency
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
      uploadfile_currency: doc.invoice_masterbi_of_currency,
      uploadfile_state: 'PB', // TODO state PM => PB
      uploadfile_amount_comment: doc.invoice_masterbi_of_comment,
      uploadfile_received_from: customer.user_name,
      uploadfile_invoice_no: 'CTS/' + renderData.invoice_masterbi_carrier + '/' + renderData.voyage_number + '/' + renderData.receipt_no
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
    if(b.invoice_masterbi_delivery && bl.invoice_masterbi_delivery !== b.invoice_masterbi_delivery) {
      let icd = await tb_icd.findOne({
        where: {
          state : GLBConfig.ENABLE,
          [Op.or]: [{ icd_name: b.invoice_masterbi_delivery }, { icd_code: b.invoice_masterbi_delivery }]
        }
      })
      if(icd) {
        bl.invoice_masterbi_do_icd = icd.icd_name
      }
    }
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
  let doc = common.docValidate(req), user = req.user
  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: doc.invoice_masterbi_id
    }
  })

  if(bl.invoice_masterbi_do_icd) {
    let icd = await tb_icd.findOne({
      where: {
        state : GLBConfig.ENABLE,
        [Op.or]: [{ icd_name: bl.invoice_masterbi_do_icd }, { icd_code: bl.invoice_masterbi_do_icd }]
      }
    })
    let customer = await tb_user.findOne({
      where: {
        user_name: bl.invoice_masterbi_delivery_to,
        state: GLBConfig.ENABLE,
        user_type: GLBConfig.TYPE_CUSTOMER
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

    let commonUser = await tb_user.findOne({
      where: {
        user_id: user.user_id
      }
    })

    if(customer) {
      if(icd) {
        if(!bl.invoice_masterbi_do_delivery_order_no) {
          let delivery_order_no = ('000000000000000' + bl.invoice_masterbi_id).slice(-8)
          bl.invoice_masterbi_do_delivery_order_no = delivery_order_no
        }
        if(icd.icd_edi_type === 'EMAIL') {
          // 发送放货确认至堆场
          if(icd.icd_email) {
            let renderData = {}
            renderData.icdName = icd.icd_name
            renderData.doNo = bl.invoice_masterbi_do_delivery_order_no
            renderData.billNo = bl.invoice_masterbi_bl
            renderData.vessel = vessel.invoice_vessel_name
            renderData.voyage = vessel.invoice_vessel_voyage
            renderData.deliveryTo = bl.invoice_masterbi_delivery_to
            renderData.validTo = bl.invoice_masterbi_valid_to
            renderData.validToStr = moment(bl.invoice_masterbi_valid_to).format('MMM DD, YYYY')
            renderData.fcl = bl.invoice_masterbi_do_fcl
            renderData.user_name = commonUser.user_name
            renderData.user_phone = commonUser.user_phone
            renderData.user_email = commonUser.user_email
            let html = await common.ejs2Html('LadenRelease.ejs', renderData)
            let mailSubject = 'DELIVERY ORDER - B/L#' + bl.invoice_masterbi_bl
            let mailContent = ''
            let mailHtml = html
            let attachments = []
            await mailer.sendEdiMail(GLBConfig.ICD_EDI_EMAIL_SENDER, icd.icd_email.split(';'), GLBConfig.ICD_EDI_EMAIL_SENDER, GLBConfig.STORING_ORDER_BLIND_CARBON_COPY, mailSubject, mailContent, mailHtml, attachments)
          } else {
            return common.error('do_05')
          }
        } else {
          // 发送edi文件
          this.createEditFile(bl, customer, vessel, continers, '9')
        }
        bl.invoice_masterbi_do_edi_state = '9' // GLBConfig.EDI_MESSAGE_FUNCTION
        bl.invoice_masterbi_do_edi_create_time = new Date()
        await bl.save()
      } else {
        return common.error('do_04')
      }
    } else {
      return common.error('do_02')
    }
  }
}

exports.doReplaceEdiAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: doc.invoice_masterbi_id
    }
  })

  if(bl.invoice_masterbi_do_icd) {
    let icd = await tb_icd.findOne({
      where: {
        state : GLBConfig.ENABLE,
        [Op.or]: [{ icd_name: bl.invoice_masterbi_do_icd }, { icd_code: bl.invoice_masterbi_do_icd }]
      }
    })

    let customer = await tb_user.findOne({
      where: {
        user_name: bl.invoice_masterbi_delivery_to,
        state: GLBConfig.ENABLE,
        user_type: GLBConfig.TYPE_CUSTOMER
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

    let commonUser = await tb_user.findOne({
      where: {
        user_id: user.user_id
      }
    })
    if(customer) {
      if(icd) {
        if(icd.icd_edi_type === 'EMAIL') {
          // 发送放货确认至堆场
          if(icd.icd_email) {
            let renderData = {}
            renderData.icdName = icd.icd_name
            renderData.doNo = bl.invoice_masterbi_do_delivery_order_no
            renderData.billNo = bl.invoice_masterbi_bl
            renderData.vessel = vessel.invoice_vessel_name
            renderData.voyage = vessel.invoice_vessel_voyage
            renderData.deliveryTo = bl.invoice_masterbi_delivery_to
            renderData.validTo = bl.invoice_masterbi_valid_to
            renderData.validToStr = moment(bl.invoice_masterbi_valid_to).format('MMM DD, YYYY')
            renderData.fcl = bl.invoice_masterbi_do_fcl
            renderData.user_name = commonUser.user_name
            renderData.user_phone = commonUser.user_phone
            renderData.user_email = commonUser.user_email
            let html = await common.ejs2Html('LadenRelease.ejs', renderData)
            let mailSubject = 'DELIVERY ORDER - B/L#' + bl.invoice_masterbi_bl
            let mailContent = ''
            let mailHtml = html
            let attachments = []
            await mailer.sendEdiMail(GLBConfig.ICD_EDI_EMAIL_SENDER, icd.icd_email.split(';'), GLBConfig.ICD_EDI_EMAIL_SENDER, GLBConfig.STORING_ORDER_BLIND_CARBON_COPY, mailSubject, mailContent, mailHtml, attachments)
          } else {
            return common.error('do_05')
          }
        } else {
          this.createEditFile(bl, customer, vessel, continers, '5')
        }
        bl.invoice_masterbi_do_edi_state = '5' // GLBConfig.EDI_MESSAGE_FUNCTION
        bl.invoice_masterbi_do_edi_cancel_time = new Date()
        await bl.save()
      } else {
        return common.error('do_04')
      }
    } else {
      return common.error('do_02')
    }
  }
}

exports.doCancelEdiAct = async req => {
  let doc = common.docValidate(req)
  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: doc.invoice_masterbi_id
    }
  })

  if(bl.invoice_masterbi_do_icd) {
    let icd = await tb_icd.findOne({
      where: {
        state : GLBConfig.ENABLE,
        [Op.or]: [{ icd_name: bl.invoice_masterbi_do_icd }, { icd_code: bl.invoice_masterbi_do_icd }]
      }
    })

    if(icd && icd.icd_edi_type !== 'EMAIL') {
      bl.invoice_masterbi_do_edi_state = '1' // GLBConfig.EDI_MESSAGE_FUNCTION
      bl.invoice_masterbi_do_edi_cancel_time = new Date()
      await bl.save()

      let customer = await tb_user.findOne({
        where: {
          user_name: bl.invoice_masterbi_delivery_to,
          state: GLBConfig.ENABLE,
          user_type: GLBConfig.TYPE_CUSTOMER
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
      if(customer) {
        this.createEditFile(bl, customer, vessel, continers, '1')
      } else {
        return common.error('do_02')
      }
    }
  }
}

exports.createEditFile = async (bl, customer, vessel, continers, ediStatus) =>{
  let ediData = {}
  let curMoment = moment()
  ediData.senderID = 'COS'
  if(bl.invoice_masterbi_carrier === 'OOCL') {
    ediData.senderID = 'OOCL'
  }
  ediData.interchangeTime = curMoment.format('YYMMDD:HHmm')
  ediData.interchangeID = await seq.genEdiInterchangeID()
  ediData.messageID = await seq.genEdiMessageIDSeq()
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
  if(bl.invoice_masterbi_consignee_name) {
    if(bl.invoice_masterbi_consignee_name.length > 35) {
      ediData.consignee = bl.invoice_masterbi_consignee_name.substring(1, 36)
    } else {
      ediData.consignee = bl.invoice_masterbi_consignee_name
    }
  }
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
  await mailer.sendEdiMail(GLBConfig.EDI_EMAIL_SENDER, GLBConfig.EDI_EMAIL_RECEIVER, GLBConfig.EDI_EMAIL_CARBON_COPY, '', mailSubject, mailContent, mailHtml, attachments)
}

exports.searchFixedDepositAct = async req => {
  let doc = common.docValidate(req)
  let renderData = {}

  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: doc.invoice_masterbi_id
    }
  })

  if(doc.invoice_masterbi_customer_id) {
    let customer = await tb_user.findOne({
      where: {
        user_id: doc.invoice_masterbi_customer_id
      }
    })
    if(customer) {
      renderData.invoice_masterbi_customer_blacklist = GLBConfig.ENABLE === customer.user_blacklist
    }
  }

  let continers = await tb_container.findAll({
    where: {
      invoice_vessel_id: doc.invoice_vessel_id,
      invoice_containers_bl: doc.invoice_masterbi_bl
    },
    order: [['invoice_containers_size', 'ASC']]
  })

  let hasFrozen = false
  for(let c of continers) {
    if(c.invoice_containers_size === '22R1' || c.invoice_containers_size === '42R1' || c.invoice_containers_size === '45R1') {
      hasFrozen = true
    }
  }

  let isTrCo = bl.invoice_masterbi_cargo_type === 'TR' && bl.invoice_masterbi_freight === 'COLLECT'
  let queryStr = `select * from tbl_zhongtan_invoice_default_fee where state = '1' AND fee_cargo_type = ? `
  let replacements = [doc.invoice_masterbi_cargo_type]
  let defaultFees = await model.simpleSelect(queryStr, replacements)
  if(defaultFees) {
    for(let f of defaultFees) {
      let column = ''
      let type = ''
      let fee_config = await tb_fee_config.findOne({
        where: {
          fee_cargo_type: doc.invoice_masterbi_cargo_type,
          fee_name: f.fee_name,
          state: GLBConfig.ENABLE
        }
      })
      if(fee_config) {
        column = fee_config.fee_column
        type = fee_config.fee_type
      }
      renderData[column+'_necessary'] = f.is_necessary
      if(f.fee_type === 'BL') {
        renderData[column] = f.fee_amount
        renderData[column + '_type'] = 'BL'
      } else {
        renderData[column + '_type'] = 'CON'
        if(!renderData[column]) {
          renderData[column] = 0
        }
        for(let c of continers) {
          if(f.fee_container_size === c.invoice_containers_size && c.invoice_containers_type !== 'S') {
            renderData[column] += parseFloat(f.fee_amount)
          }
        }
      }
      if(type === 'Container Deposit') {
        renderData.invoice_container_deposit_currency = f.fee_currency
      } else {
        renderData.invoice_fee_currency = f.fee_currency
        if(isTrCo) {
          renderData[column+'_necessary'] = '0'
        }
      }
    }
  }
  
  if(doc.invoice_masterbi_customer_id) {
    queryStr = `select * from tbl_zhongtan_customer_fixed_deposit where state = '1' 
                    AND fixed_deposit_customer_id = ? AND deposit_work_state = ? AND ((deposit_begin_date <= ? AND deposit_long_term = ?) 
                    OR (deposit_begin_date <= ? AND deposit_expire_date >= ?)) ORDER BY created_at DESC LIMIT 1`
    replacements = [doc.invoice_masterbi_customer_id, 'W', moment().format('YYYY-MM-DD'), GLBConfig.ENABLE, moment().format('YYYY-MM-DD'), moment().format('YYYY-MM-DD')]
    let fixedDeposits = await model.simpleSelect(queryStr, replacements)
    if(fixedDeposits && fixedDeposits.length > 0 && !hasFrozen) {
      renderData.invoice_masterbi_deposit = '0'
      renderData.invoice_masterbi_deposit_necessary = ''
      renderData.invoice_masterbi_deposit_fixed = '1'
      renderData.invoice_masterbi_deposit_fixed_id = fixedDeposits[0].fixed_deposit_id
      renderData.invoice_container_deposit_currency = fixedDeposits[0].deposit_currency ? fixedDeposits[0].deposit_currency : 'USD'
      renderData.invoice_masterbi_deposit_comment = fixedDeposits[0].fixed_deposit_type === 'GU' ? 'GUARANTEE LETTER NO.' + fixedDeposits[0].deposit_guarantee_letter_no : 'FIXED CONTAINER DEPOSIT/' + fixedDeposits[0].deposit_receipt_no
      return common.success(renderData)
    }
  }
  
  if(doc.depositType === 'Container Deposit' && renderData.invoice_masterbi_deposit >= 0) {
    renderData.invoice_masterbi_deposit_fixed = '1'
    return common.success(renderData)
  }

  if(bl.invoice_masterbi_freight_charge && common.isNumber(bl.invoice_masterbi_freight_charge)) {
    renderData.invoice_masterbi_of = bl.invoice_masterbi_freight_charge
    renderData.invoice_masterbi_of_necessary = ''
    renderData.invoice_masterbi_of_fixed = '1'
    renderData.invoice_masterbi_of_currency = bl.invoice_masterbi_freight_currency ? bl.invoice_masterbi_freight_currency : 'USD'
  }

  return common.success(renderData)
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

exports.doEditVesselAct = async req => {
  let doc = common.docValidate(req)
  let vessel = await tb_vessel.findOne({
    where: {
      invoice_vessel_id: doc.invoice_vessel_id
    }
  })
  if(vessel) {
    vessel.invoice_vessel_name = doc.invoice_vessel_name
    vessel.invoice_vessel_code = doc.invoice_vessel_code
    vessel.invoice_vessel_voyage = doc.invoice_vessel_voyage
    vessel.invoice_vessel_call_sign = doc.invoice_vessel_call_sign
    if(doc.invoice_vessel_eta) {
      if(doc.invoice_vessel_eta.length > 10) {
        vessel.invoice_vessel_eta = moment(doc.invoice_vessel_eta).local().format('DD/MM/YYYY')
      } else {
        vessel.invoice_vessel_eta = moment(doc.invoice_vessel_eta, 'DD/MM/YYYY').local().format('DD/MM/YYYY')
      }
    }
    if(doc.invoice_vessel_ata) {
      if(doc.invoice_vessel_ata.length > 10) {
        vessel.invoice_vessel_ata = moment(doc.invoice_vessel_ata).local().format('DD/MM/YYYY')
      } else {
        vessel.invoice_vessel_ata = moment(doc.invoice_vessel_ata, 'DD/MM/YYYY').local().format('DD/MM/YYYY')
      }
    }
    if(doc.invoice_vessel_atd) {
      if(doc.invoice_vessel_atd.length > 10) {
        vessel.invoice_vessel_atd = moment(doc.invoice_vessel_atd).local().format('DD/MM/YYYY')
      } else {
        vessel.invoice_vessel_atd = moment(doc.invoice_vessel_atd, 'DD/MM/YYYY').local().format('DD/MM/YYYY')
      }
    }
    vessel.updated_at = new Date()
    await vessel.save()
  }
  return common.success()
}

exports.changeDoDisabledAct = async req => {
  let doc = common.docValidate(req)
  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: doc.invoice_masterbi_id
    }
  })
  bl.invoice_masterbi_do_disabled = doc.invoice_masterbi_do_disabled
  await bl.save()
  return common.success()
}

exports.changeCnAct = async req => {
  let doc = common.docValidate(req)

  for (let c of doc.changeCn) {
    let cn = await tb_container.findOne({
      where: {
        invoice_containers_id: c.invoice_containers_id
      }
    })
    cn.invoice_containers_type = c.invoice_containers_type
    cn.invoice_containers_no = c.invoice_containers_no
    cn.invoice_containers_size = c.invoice_containers_size
    cn.invoice_containers_seal1 = c.invoice_containers_seal1
    cn.invoice_containers_seal2 = c.invoice_containers_seal2
    cn.invoice_containers_seal3 = c.invoice_containers_seal3
    cn.invoice_containers_freight_indicator = c.invoice_containers_freight_indicator
    cn.invoice_containers_package_no = c.invoice_containers_package_no
    cn.invoice_containers_package_unit = c.invoice_containers_package_unit
    cn.invoice_containers_volumn = c.invoice_containers_volumn
    cn.invoice_containers_volumn_unit = c.invoice_containers_volumn_unit
    cn.invoice_containers_weight = c.invoice_containers_weight
    cn.invoice_containers_weight_unit = c.invoice_containers_weight_unit
    cn.invoice_containers_plug_reefer = c.invoice_containers_plug_reefer
    cn.invoice_containers_min_temperature = c.invoice_containers_min_temperature
    cn.invoice_containers_max_temperature = c.invoice_containers_max_temperature
    await cn.save()
  }

  return common.success()
}

exports.deleteMasterblAct = async req => {
  let doc = common.docValidate(req)
  let bl = await tb_bl.findOne({
    where: {
      invoice_masterbi_id: doc.invoice_masterbi_id
    }
  })

  await tb_container.destroy({
    where: {
      invoice_vessel_id: bl.invoice_vessel_id,
      invoice_containers_bl: bl.invoice_masterbi_bl
    }
  })

  await tb_uploadfile.destroy({
    where: {
      uploadfile_index1: bl.invoice_masterbi_id
    }
  })

  await tb_bl.destroy({
    where: {
      invoice_masterbi_id: bl.invoice_masterbi_id
    }
  })

  return common.success()
}

exports.changeContainersTypeAct = async req => {
  let doc = common.docValidate(req)
  let con = await tb_container.findOne({
    where: {
      invoice_containers_id: doc.invoice_containers_id
    }
  })
  con.invoice_containers_type = doc.invoice_containers_type
  await con.save()
  return common.success()
}

const checkConditionDoState = async (bl, ves) => {
  let overdueCheck = true
  let blacklistCheck = true
  if(ves.invoice_vessel_ata) {
    let discharge_port = bl.invoice_masterbi_destination.substring(0, 2)
    let charge_carrier = 'COSCO'
    if(bl.invoice_masterbi_bl.indexOf('COS') >= 0) {
      charge_carrier  = 'COSCO'
    } else if(bl.invoice_masterbi_bl.indexOf('OOLU') >= 0) {
      charge_carrier  = 'OOCL'
    }
    let continers = await tb_container.findAll({
      where: {
        invoice_vessel_id: bl.invoice_vessel_id,
        invoice_containers_bl: bl.invoice_masterbi_bl
      }
    })
    if(continers) {
      let diff = moment().diff(moment(ves.invoice_vessel_ata, 'DD/MM/YYYY'), 'days') + 1
      let free_days = 0
      let return_date = ''
      for(let c of continers) {
        if(c.invoice_containers_empty_return_overdue_free_days) {
          let temp_free_days = parseInt(c.invoice_containers_empty_return_overdue_free_days)
          if(temp_free_days != 0 && temp_free_days > free_days) {
            free_days = temp_free_days
          }
        }
      }
      for(let c of continers) {
        if(c.invoice_containers_type === 'S') {
          continue
        }
        if(free_days === 0) {
          free_days = await cal_config_srv.queryContainerFreeDays(bl.invoice_masterbi_cargo_type, discharge_port, charge_carrier, c.invoice_containers_size, ves.invoice_vessel_ata)
        }
        return_date = c.invoice_containers_empty_return_date_receipt
        if(c.invoice_containers_empty_return_receipt_release_date && c.invoice_containers_empty_return_date_receipt 
          && moment(c.invoice_containers_empty_return_date_receipt, 'DD/MM/YYYY').isBefore(moment())) {
            overdueCheck = false 
            break
        }
        if(diff > parseInt(free_days) && !c.invoice_containers_empty_return_receipt_release_date) {
          overdueCheck = false 
          break
        }
      }
      // 没有D/O并且滞期收据还箱日期为空
      if(return_date) {
        bl.invoice_masterbi_valid_to = moment(return_date, 'DD/MM/YYYY').format('YYYY-MM-DD')
      } else if(free_days > 0) {
        bl.invoice_masterbi_valid_to = moment(ves.invoice_vessel_ata, 'DD/MM/YYYY').add(free_days - 1, 'days').format('YYYY-MM-DD')
      }
    }
  } 

  if(bl.invoice_masterbi_customer_id) {
    let customer = await tb_user.findOne({
      where: {
        user_id: bl.invoice_masterbi_customer_id
      }
    })
    if(customer) {
      if(GLBConfig.ENABLE === customer.user_blacklist) {
        blacklistCheck = false
      }
    }
  }
  if (overdueCheck && blacklistCheck && (bl.invoice_masterbi_do_disabled !== GLBConfig.ENABLE)) {
    return {check: true, msg: ''}
  } else {
    let msg = ''
    if(!overdueCheck) {
      msg = 'OVERDUE/'
    }
    if(!blacklistCheck) {
      msg = 'BLACKLIST/'
    }
    if(!(bl.invoice_masterbi_do_disabled !== GLBConfig.ENABLE)) {
      msg = 'DO DISABLED'
    }
    return {check: false, msg: msg}
  }
}

const checkDoDepotState = async (bl) => {
  let queryStr = `SELECT COUNT(1) AS count FROM tbl_zhongtan_invoice_containers WHERE invoice_containers_bl = ? AND invoice_vessel_id = ? 
                    AND (invoice_containers_size IN (SELECT container_size_code FROM tbl_zhongtan_container_size WHERE state = '1' AND container_special_type = '1') 
                    OR invoice_containers_size IN (SELECT container_size_name FROM tbl_zhongtan_container_size WHERE state = '1' AND container_special_type = '1'))`
  let replacements = [bl.invoice_masterbi_bl, bl.invoice_vessel_id]
  let items = await model.simpleSelect(queryStr, replacements)
  if(items && items.count && parseInt(items.count) > 0) {
    return true
  }
  return false
}

const checkConditionInvoiceState = async (bl) => {
  let blacklistCheck = true
  if(bl.invoice_masterbi_customer_id) {
    let customer = await tb_user.findOne({
      where: {
        user_id: bl.invoice_masterbi_customer_id
      }
    })
    if(customer) {
      if(GLBConfig.ENABLE === customer.user_blacklist) {
        blacklistCheck = false
      }
    }
  }
  return blacklistCheck
}