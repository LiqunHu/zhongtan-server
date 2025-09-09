const X = require('xlsx')
const moment = require('moment')
const Decimal = require('decimal.js')
const PDFParser = require('pdf2json')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const opSrv = require('../../common/system/OperationPasswordServer')
const cal_demurrage_srv = require('../equipment/ExportDemurrageCalculationServer')
const booking_load = require('./BookingLoadServer')

const tb_user = model.common_user
const tb_vessel = model.zhongtan_export_vessel
const tb_bl = model.zhongtan_export_masterbl
const tb_container = model.zhongtan_export_container
const tb_proforma_vessel = model.zhongtan_export_proforma_vessel
const tb_proforma_bl = model.zhongtan_export_proforma_masterbl
const tb_proforma_container = model.zhongtan_export_proforma_container
const tb_container_size = model.zhongtan_container_size
const tb_shipment_fee = model.zhongtan_export_shipment_fee
const tb_fee_data = model.zhongtan_export_fee_data
const tb_uploadfile = model.zhongtan_uploadfile
const tb_export_verification = model.zhongtan_export_verification

exports.initAct = async () => {
  let returnData = {}
  let queryStr = `select * from tbl_common_user where state = '1' and user_type = ? and (user_code is not null or user_code <> '')`
  let replacements = [GLBConfig.TYPE_DEFAULT]
  returnData['SALES_CODE'] = await model.simpleSelect(queryStr, replacements)
  return common.success(returnData)
}

exports.uploadBookingAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let sizeConfig = await tb_container_size.findAll({
    where: {
      state: GLBConfig.ENABLE
    }
  })
  for (let f of doc.upload_files) {
    let pdfData = await pdf2jsonParser(f.response.info.path)
    if(pdfData) {
      let regex = '/BILL\\s*OF\\s*LADING\\s*NO.\\s*([a-zA-Z0-9]+)/i' 
      let billOf = common.valueFilter(pdfData, regex) // 提单号
      let ves = '' // 船名
      let voy = '' // 航次
      let cos = ''
      let bl_carrier = ''
      let shipper = ''
      let consignee = ''
      let pol = ''
      let pod = ''
      if(billOf) {
        regex = '/VESSEL\\s*:\\s*([a-zA-Z0-9\\s]+)\\s*($|VOYAGE)/im'
        ves = common.valueFilter(pdfData, regex)
        if(ves) {
          ves = ves.trim().replace(/VOYAGE/im, '').replace(/\s+/g, ' ')
        }
        regex = '/VOYAGE\\s*:\\s*([a-zA-Z0-9\\s]+)\\s*($|B\\/L)/im'
        voy = common.valueFilter(pdfData, regex)
        if(voy) {
          voy = voy.trim().replace(/B\/L/im, '').replace(/\s+/g, '')
        }
        let datas = pdfData.replace(/[\r]/ig, '').split(/[\n]+/ig)
        let sIndex = -1
        if(billOf.indexOf('COSU') >= 0) {
          // COSCO
          if(!ves || !voy) {
            let vesvoyIndex = datas.findIndex((item) => {
              return item.search(/6.\s*Ocean\s*Vessel\s*Voy.\s*No./i) >= 0
            })
            if(vesvoyIndex >= 0) {
              let vesvoyStr = datas.slice(vesvoyIndex, vesvoyIndex + 1).join(' ').trim().replace(/6.\s*Ocean\s*Vessel\s*Voy.\s*No./i, '').replace(/\s+/g, ' ')
              if(vesvoyStr) {
                let lastBlankIndex = vesvoyStr.lastIndexOf(' ')
                ves = vesvoyStr.substring(0, lastBlankIndex).trim()
                voy = vesvoyStr.substring(lastBlankIndex).trim()
              }
            }
          }
          let cosIndex = datas.findIndex((item) => {
            return item.search(/CSO\s*\/\s*AGREEMENT\s*NUMBER/i) >= 0
          })
          let cosStr = datas.slice(cosIndex, cosIndex + 1).join(' ').trim()
          cos = cosStr.substring(cosStr.search(/CSO\s*\/\s*AGREEMENT\s*NUMBER/ig)).replace(/CSO\s*\/\s*AGREEMENT\s*NUMBER/ig, '').trim()
          let shipperSindex = datas.findIndex((item) => {
            return item.search(/1.\s*Shipper\s*Insert\s*Name\s*Address\s*and\s*Phone\s*\/\s*Fax/i) >= 0
          })
          let shipperEindex = datas.findIndex((item) => {
            return item.search(/Booking\s*No./i) >= 0
          })
          shipper = datas.slice(shipperSindex, shipperEindex).join(' ').trim().replace(/1.\s*Shipper\s*Insert\s*Name\s*Address\s*and\s*Phone\s*\/\s*Fax/i, '').replace(/\s+/g, ' ')
          let consigneeSindex = datas.findIndex((item) => {
            return item.search(/2.\s*Consignee\s*Insert\s*Name\s*Address\s*and\s*Phone\/Fax/i) >= 0
          })
          let consigneeEindex = datas.findIndex((item) => {
            return item.search(/Forwarding\s*Agent\s*and\s*References/i) >= 0
          })
          consignee = datas.slice(consigneeSindex, consigneeEindex).join(' ').trim().replace(/2.\s*Consignee\s*Insert\s*Name\s*Address\s*and\s*Phone\/Fax/i, '').replace(/\s+/g, ' ')
          let polpodSindex = datas.findIndex((item) => {
            return item.search(/6.\s*Ocean\s*Vessel\s*Voy.\s*No./i) >= 0
          })
          let polpodEindex = datas.findIndex((item) => {
            return item.search(/9.\s*Combined\s*Transport\s*\*\s*Place\s*of\s*Delivery/i) >= 0
          })
          let polpodStr = datas.slice(polpodSindex, polpodEindex + 1).join(' ')
          let polSindex = polpodStr.search(/7.\s*Port\s*of\s*Loading/ig)
          let polEindex = polpodStr.search(/Service\s*Contract\s*No./ig)
          pol = polpodStr.substring(polSindex, polEindex).replace(/7.\s*Port\s*of\s*Loading/ig, '').replace(/\s+/g, ' ')
          if(pol.lastIndexOf(',') >=0) {
            pol = pol.substring(0, pol.lastIndexOf(','))
          }
          let podSindex = polpodStr.search(/8.\s*Port\s*of\s*Discharge/ig)
          let podEindex = polpodStr.search(/9.\s*Combined\s*Transport/ig)
          pod = polpodStr.substring(podSindex, podEindex).replace(/8.\s*Port\s*of\s*Discharge/ig, '').replace(/\s+/g, ' ')
          if(pod.lastIndexOf(',') >=0) {
            pod = pod.substring(0, pod.lastIndexOf(','))
          }
          sIndex = datas.findIndex((item) => {
              return item.search(/LOAD\s*STOW\s*COUNT\s*AND\s*SEAL/i) >= 0
          })
          bl_carrier = 'COSCO'
        } else if(billOf.indexOf('OOLU') >= 0) {
          //OOCL
          let shipperSindex = datas.findIndex((item) => {
            return item.search(/SHIPPER\s*\/\s*EXPORTER\s*\(COMPLETE\s*NAME\s*AND\s*ADDRESS\)/i) >= 0
          })
          let shipperEindex = datas.findIndex((item) => {
            return item.search(/BOOKING\s*NO./i) >= 0
          })
          shipper = datas.slice(shipperSindex, shipperEindex).join(' ').trim().replace(/SHIPPER\s*\/\s*EXPORTER\s*\(COMPLETE\s*NAME\s*AND\s*ADDRESS\)/i, '').replace(/\s+/g, ' ')
          let consigneeSindex = datas.findIndex((item) => {
            return item.search(/CONSIGNEE\s*\(COMPLETE\s*NAME\s*AND\s*ADDRESS\)/i) >= 0
          })
          let consigneeEindex = datas.findIndex((item) => {
            return item.search(/FORWARDING\s*AGENT-REFERENCES/i) >= 0
          })
          consignee = datas.slice(consigneeSindex, consigneeEindex).join(' ').trim().replace(/CONSIGNEE\s*\(COMPLETE\s*NAME\s*AND\s*ADDRESS\)/i, '').replace(/\s+/g, ' ')
          let polpodSindex = datas.findIndex((item) => {
            return item.search(/VESSEL\s*\/\s*VOYAGE\s*\/\s*FLA/i) >= 0
          })
          let polpodEindex = datas.findIndex((item) => {
            return item.search(/PLACE\s*OF\s*DELIVERY/i) >= 0
          })
          let polpodStr = datas.slice(polpodSindex, polpodEindex + 1).join(' ')
          let polSindex = polpodStr.search(/PORT\s*OF\s*LOADINGD/ig)
          let polEindex = polpodStr.search(/LOADING\s*PIER\s*\/\s*TERMINAL/ig)
          pol = polpodStr.substring(polSindex, polEindex).replace(/PORT\s*OF\s*LOADINGD/ig, '').replace(/\s+/g, ' ')
          if(pol.lastIndexOf(',') >=0) {
            pol = pol.substring(0, pol.lastIndexOf(','))
          }
          let podSindex = polpodStr.search(/PORT\s*OF\s*DISCHARGE/ig)
          let podEindex = polpodStr.search(/PLACE\s*OF\s*DELIVERY/ig)
          pod = polpodStr.substring(podSindex, podEindex).replace(/PORT\s*OF\s*DISCHARGE/ig, '').replace(/\s+/g, ' ')
          sIndex = datas.findIndex((item) => {
            return item.search(/CNTR\.\s*NOS\.\s*W\/SEAL\s*NOS\.\s*MARK/i) >= 0
          })
          bl_carrier = 'OOCL'
        }
        let conRows = []
        if(sIndex >= 0) {
          for(let i = sIndex; i < datas.length; i++) {
            let row = datas[i]
            let fIndex = row.search(/[a-zA-Z]{4}\d{7}\s+/i)
            if(fIndex >= 0 && fIndex < 20) {
              let conRow = row.trim()
              let tempRow = conRow.substr(11)
              let f2Index = tempRow.search(/[a-zA-Z]{4}\d{7}\s+/i)
              if(f2Index >= 0) {
                f2Index = f2Index + 11
                let con1Row = conRow.substring(0, f2Index)
                let con2Row = conRow.substring(f2Index)
                let con1Infos = con1Row.split(/\s\//ig)
                conRows.push(con1Infos)
                let con2Infos = con2Row.split(/\s\//ig)
                conRows.push(con2Infos)
              } else {
                let conInfos = conRow.split(/\s\//ig)
                conRows.push(conInfos)
              }
            }
          }
        }
        if(conRows && conRows.length > 0) {
          let proforma_vessel = await tb_proforma_vessel.findOne({
            where: {
              export_vessel_name: ves,
              export_vessel_voyage: voy,
              state: GLBConfig.ENABLE
            }
          })
          let vessel = await tb_vessel.findOne({
            where: {
              export_vessel_name: ves,
              export_vessel_voyage: voy,
              state: GLBConfig.ENABLE
            }
          })
          if(!proforma_vessel) {
            if(vessel) {
              proforma_vessel = await tb_proforma_vessel.create({
                export_vessel_code: vessel.export_vessel_code,
                export_vessel_name: vessel.export_vessel_name,
                export_vessel_voyage: vessel.export_vessel_voyage,
                export_vessel_etd: vessel.export_vessel_etd,
                proforma_import: GLBConfig.ENABLE
              })
            } else {
              proforma_vessel = await tb_proforma_vessel.create({
                export_vessel_code: bl_carrier,
                export_vessel_name: ves,
                export_vessel_voyage: voy,
                proforma_import: GLBConfig.ENABLE
              })
            }
          }
          let proforma_bl = await tb_proforma_bl.findOne({
            where: {
              export_vessel_id: proforma_vessel.export_vessel_id,
              export_masterbl_bl: billOf,
              state: GLBConfig.ENABLE
            }
          })
          if(proforma_bl && proforma_bl.shipment_list_import === GLBConfig.ENABLE) {
            return common.error('import_01')
          }
          if(!proforma_bl) {
            if(vessel) {
              let bl = await tb_bl.findOne({
                where: {
                  export_vessel_id: vessel.export_vessel_id,
                  export_masterbl_bl: billOf,
                  state: GLBConfig.ENABLE
                }
              })
              if(bl) {
                proforma_bl = await tb_proforma_bl.create({
                  relation_export_masterbl_id: bl.export_masterbl_id,
                  export_vessel_id: proforma_vessel.export_vessel_id,
                  export_masterbl_bl_carrier: bl.export_masterbl_bl_carrier,
                  export_masterbl_bl: bl.export_masterbl_bl,
                  export_masterbl_forwarder_company: bl.export_masterbl_forwarder_company,
                  export_masterbl_cargo_nature: bl.export_masterbl_cargo_nature,
                  export_masterbl_cargo_descriptions: bl.export_masterbl_cargo_descriptions,
                  proforma_import: GLBConfig.ENABLE,
                  export_masterbl_sales_code: bl.export_masterbl_sales_code
                })
              }else {
                proforma_bl = await tb_proforma_bl.create({
                  export_vessel_id: proforma_vessel.export_vessel_id,
                  export_masterbl_bl_carrier: bl_carrier,
                  export_masterbl_bl: billOf,
                  proforma_import: GLBConfig.ENABLE
                })
              }
            } else {
              proforma_bl = await tb_proforma_bl.create({
                export_vessel_id: proforma_vessel.export_vessel_id,
                export_masterbl_bl_carrier: bl_carrier,
                export_masterbl_bl: billOf,
                proforma_import: GLBConfig.ENABLE
              })
            }
          }
          // 查询是否已存在箱子
          let old_con_count = await tb_proforma_container.count({
            where: {
              state: GLBConfig.ENABLE,
              export_vessel_id: proforma_vessel.export_vessel_id,
              export_container_bl: billOf
            }
          })
          if(old_con_count > 0 && old_con_count !== conRows.length) {
            // 已存在箱子并且箱数量不等，删除已保存的相关费用
            let fees = await tb_shipment_fee.findAll({
              where: {
                state: GLBConfig.ENABLE,
                export_masterbl_id: proforma_bl.export_masterbl_id
              }
            })
            if(fees && fees.length > 0) {
              for(let f of fees) {
                f.state = GLBConfig.DISABLE
                await f.save()
              }
            }
          }
          let traffic_mode = ''
          let qty = conRows.length
          let total_packages = 0
          let total_weights = 0
          let total_volumns = 0
          for(let c of conRows) {
            let conNo = c[0].trim()
            let sealNo = c[1].trim()
            let packages = c[2].trim()
            let pg = packages.split(/\s+/)[0]
            let pu = packages.split(/\s+/)[1]
            traffic_mode = c[3].trim()
            let sizeTypes = c[4].trim()
            let st = sizeTypes.split(/\//)[0]
            let ct = ''
            if(sizeConfig) {
              for(let c of sizeConfig) {
                if(c.container_size_name === st) {
                  ct = c.container_size_code
                  break
                }
              }
            }
            if(conNo) {
              let queryStr = `select invoice_containers_no, invoice_containers_size from tbl_zhongtan_invoice_containers where state = '1' and invoice_containers_no = ? LIMIT 1`
              let replacements = [conNo]
              let invoice_con = await model.simpleSelect(queryStr, replacements)
              if(invoice_con && invoice_con.length > 0) {
                if(invoice_con[0].invoice_containers_size && invoice_con[0].invoice_containers_size !== ct) {
                  ct = invoice_con[0].invoice_containers_size
                }
              }
            }
            let we = ''
            let wu = ''
            let vl = ''
            let vu = ''
            if(sizeTypes.split(/\//) && sizeTypes.split(/\//).length > 1) {
              let weights_volumns = sizeTypes.split(/\//)[1]
              let weights = ''
              let volumns = ''
              if(weights_volumns && weights_volumns.split(/;/).length > 1) {
                weights = weights_volumns.split(/;/)[0]
                volumns = weights_volumns.split(/;/)[1]
              } else {
                weights = weights_volumns
              }
              if(weights) {
                let re_we = /(\d+(\.\d+)?)/.exec(weights)
                if(re_we && re_we.length > 0) {
                  we = re_we[0]
                }
                let re_wu = /([a-zA-Z]+)/.exec(weights)
                if(re_wu && re_wu.length > 0) {
                  wu = re_wu[0]
                }
              } 
              if(volumns) {
                let re_vl = /(\d+(\.\d+)?)/.exec(volumns)
                if(re_vl && re_vl.length > 0) {
                  vl = re_vl[0]
                }
                let re_vu = /([a-zA-Z]+)/.exec(volumns)
                if(re_vu && re_vu.length > 0) {
                  vu = re_vu[0]
                }
              }
            }
            if(pg) {
              total_packages = new Decimal(total_packages).plus(new Decimal(pg))
            }
            if(we) {
              total_weights = new Decimal(total_weights).plus(new Decimal(we))
            }
            if(vl) {
              total_volumns = new Decimal(total_volumns).plus(new Decimal(vl))
            }
            let container = await tb_container.findOne({
              where: {
                export_container_bl: billOf,
                export_container_no: conNo,
                state: GLBConfig.ENABLE
              }
            })
            let proforma_container = await tb_proforma_container.findOne({
              where: {
                export_container_bl: billOf,
                export_container_no: conNo,
                state: GLBConfig.ENABLE
              }
            })
            if(!proforma_container) {
              if(container) {
                await tb_proforma_container.create({
                  export_vessel_id: proforma_vessel.export_vessel_id,
                  export_container_bl: billOf,
                  export_container_no: conNo,
                  export_seal_no: sealNo,
                  export_container_soc_type: container.export_container_soc_type,
                  export_container_size_type: ct,
                  export_container_cargo_package: pg,
                  export_container_cargo_package_unit: pu,
                  export_container_cargo_weight: we,
                  export_container_cargo_weight_unit: wu,
                  export_container_cargo_volumn: vl,
                  export_container_cargo_volumn_unit: vu,
                  export_container_edi_loading_date: container.export_container_edi_loading_date,
                  export_container_edi_depot_gate_out_date: container.export_container_edi_depot_gate_out_date,
                  export_container_cal_depot_gate_out_date: container.export_container_edi_depot_gate_out_date,
                  export_container_edi_wharf_gate_in_date: container.export_container_edi_wharf_gate_in_date,
                  export_container_get_depot_name: container.export_container_get_depot_name,
                  proforma_import: GLBConfig.ENABLE
                })
              } else {
                await tb_proforma_container.create({
                  export_vessel_id: proforma_vessel.export_vessel_id,
                  export_container_bl: billOf,
                  export_container_no: conNo,
                  export_seal_no: sealNo,
                  export_container_soc_type: 'C',
                  export_container_size_type: ct,
                  export_container_cargo_package: pg,
                  export_container_cargo_package_unit: pu,
                  export_container_cargo_weight: we,
                  export_container_cargo_weight_unit: wu,
                  export_container_cargo_volumn: vl,
                  export_container_cargo_volumn_unit: vu,
                  proforma_import: GLBConfig.ENABLE
                })
              }
            } else {
              proforma_container.export_seal_no = sealNo
              proforma_container.export_container_size_type = ct
              proforma_container.export_container_cargo_package = pg
              proforma_container.export_container_cargo_package_unit = pu
              proforma_container.export_container_cargo_weight = we
              proforma_container.export_container_cargo_weight_unit = wu
              proforma_container.export_container_cargo_volumn = vl
              proforma_container.export_container_cargo_volumn_unit = vu
              proforma_container.proforma_import = GLBConfig.ENABLE
              if(container) {
                proforma_container.export_container_edi_loading_date = container.export_container_edi_loading_date,
                proforma_container.export_container_edi_depot_gate_out_date = container.export_container_edi_depot_gate_out_date,
                proforma_container.export_container_cal_depot_gate_out_date = container.export_container_edi_depot_gate_out_date,
                proforma_container.export_container_edi_wharf_gate_in_date = container.export_container_edi_wharf_gate_in_date,
                proforma_container.export_container_get_depot_name = container.export_container_get_depot_name
              }
              await proforma_container.save()
            }
            await cal_demurrage_srv.calculationDemurrage2Shipment(proforma_vessel.export_vessel_id, billOf, conNo, user.user_id)
          }
          proforma_bl.export_masterbl_cso_number = cos
          proforma_bl.export_masterbl_shipper_company = shipper
          proforma_bl.export_masterbl_consignee_company = consignee
          proforma_bl.export_masterbl_port_of_load = pol
          proforma_bl.export_masterbl_port_of_discharge = pod
          proforma_bl.export_masterbl_traffic_mode = traffic_mode
          proforma_bl.export_masterbl_container_quantity = qty
          proforma_bl.export_masterbl_container_package = Decimal.isDecimal(total_packages) ? total_packages.toNumber() : total_packages
          proforma_bl.export_masterbl_container_weight = Decimal.isDecimal(total_weights) ? total_weights.toNumber() : total_weights
          proforma_bl.export_masterbl_container_volumn = Decimal.isDecimal(total_volumns) ? total_volumns.toNumber() : total_volumns
          proforma_bl.proforma_import = GLBConfig.ENABLE
          await proforma_bl.save()
        }
      }
    }
  }
  return common.success()
}

const pdf2jsonParser = async (path) => {
  let parserData = ''
  let promise = new Promise(resolve => {
    let pdfParser = new PDFParser(this, 1)
    pdfParser.loadPDF(path)
    // pdfParser.on('pdfParser_dataError', errData => console.error(errData.parserError))
    pdfParser.on('pdfParser_dataReady', () => {
      let data = pdfParser.getRawTextContent()
      resolve(data)
    })
  })
  await promise.then((data) => {
    parserData = data
  })
  return parserData
}

exports.uploadShipmentAct = async req => {
  let doc = common.docValidate(req), user = req.user
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
    if(!vesselInfo || !masterBI || !containers) {
      return common.error('import_03')
    }
   
    let vesslInfoJSTemp = X.utils.sheet_to_json(vesselInfo, {})
    let masterBIJSTemp = X.utils.sheet_to_json(masterBI, {})
    let containersJSTemp = X.utils.sheet_to_json(containers, {})
    let vesslInfoJS = await common.jsonTrim(vesslInfoJSTemp)
    let masterBIJS = await common.jsonTrim(masterBIJSTemp)
    let containersJS = await common.jsonTrim(containersJSTemp)
    if (!(vesslInfoJS[0]['VESSEL NAME'] && vesslInfoJS[0]['VOYAGE NUM'])) {
      return common.error('import_03')
    }
    let vessel_name = vesslInfoJS[0]['VESSEL NAME'].trim()
    let vessel_voyage = vesslInfoJS[0]['VOYAGE NUM'].trim()
    let vessel_code = vesslInfoJS[0]['VESSEL CODE'].trim()
    let vessel_etd = typeof vesslInfoJS[0]['ETD'] === 'object' ? moment(vesslInfoJS[0]['ETD']).add(1, 'days').format('DD/MM/YYYY') : vesslInfoJS[0]['ETD']
    if(!vessel_etd) {
      vessel_etd = moment().format('DD/MM/YYYY')
    }
    let call_sign = vesslInfoJS[0]['CALL SIGN'] ? vesslInfoJS[0]['CALL SIGN'].trim() : ''
    let total_prepaid = vesslInfoJS[0]['TOTAL PREPAID'] ? String(vesslInfoJS[0]['TOTAL PREPAID']).trim() : ''
    let ves = await tb_proforma_vessel.findOne({
      where: {
        export_vessel_name: vessel_name,
        export_vessel_voyage: vessel_voyage,
        state: GLBConfig.ENABLE
      }
    })
    let new_import = true
    if(ves) {
      new_import = false
      ves.shipment_list_import = GLBConfig.ENABLE
      if(!ves.export_vessel_etd && vessel_etd) {
        ves.export_vessel_etd = vessel_etd
      }
      ves.export_vessel_total_prepaid = total_prepaid
      ves.export_vessel_call_sign = call_sign
      await ves.save()
    } else {
      ves = await tb_proforma_vessel.create({
        export_vessel_code: vessel_code,
        export_vessel_name: vessel_name,
        export_vessel_voyage: vessel_voyage,
        export_vessel_etd: vessel_etd,
        export_vessel_total_prepaid: total_prepaid,
        export_vessel_call_sign: call_sign,
        shipment_list_import: GLBConfig.ENABLE
      })
    }
    for (let m of masterBIJS) {
      let masterbi_bl = m['#M B/L No']
      if(masterbi_bl) {
        masterbi_bl = masterbi_bl.trim()
        let bl = await tb_proforma_bl.findOne({
          where: {
            export_vessel_id: ves.export_vessel_id,
            export_masterbl_bl: masterbi_bl,
            state: GLBConfig.ENABLE,
            bk_cancellation_status: GLBConfig.DISABLE
          }
        })
        let load_bl = await tb_bl.findOne({
          where: {
            export_masterbl_bl: masterbi_bl,
            state: GLBConfig.ENABLE
          }
        })
        let bl_carrier = 'COSCO'
        if(masterbi_bl.indexOf('OOLU') >= 0) {
          bl_carrier = 'OOCL'
        }
        let cargo_classification = m['Cargo Classification'] ? m['Cargo Classification'].toString().trim() : ''
        if(load_bl && load_bl.export_masterbl_cargo_type) {
          cargo_classification = load_bl.export_masterbl_cargo_type
        }
        // let bl_type = m['*B/L Typen'] ? m['*B/L Type'].toString().trim() : ''
        let cso_no = m['CSO NO'] ? m['CSO NO'].toString().trim() : ''
        let port_of_loading = m['Port of Loading'] ? m['Port of Loading'].toString().trim() : ''
        let place_of_delivery = m['Place of Delivery'] ? m['Place of Delivery'].toString().trim() : ''
        let number_of_containers = m['Number of Containers'] ? m['Number of Containers'].toString().trim() : ''
        let description_of_goods = m['Description of Goods'] ? m['Description of Goods'].toString().trim() : ''
        let number_of_package = m['Number of Package'] ? m['Number of Package'].toString().trim() : ''
        // let package_unit = m['Package Unit'] ? m['Package Unit'].toString().trim() : ''
        let gross_weight = m['Gross Weight'] ? m['Gross Weight'].toString().trim() : ''
        // let gross_weight_unit = m['Gross Weight Unit'] ? m['Gross Weight Unit'].toString().trim() : ''
        let gross_volume = m['Gross Volume'] ? m['Gross Volume'].toString().trim() : ''
        // let gross_volume_unit = m['Gross Volume Unit'] ? m['Gross Volume Unit'].toString().trim() : ''
        let shipper_name = m['Shipper Name'] ? m['Shipper Name'].toString().trim() : ''
        // let shipper_mark = m['Shipping Mark'] ? m['Shipping Mark'].toString().trim() : ''
        let forwarder_name = m['Forwarder Name'] ? m['Forwarder Name'].toString().trim() : ''
        if(load_bl && load_bl.export_masterbl_forwarder_company) {
          forwarder_name = load_bl.export_masterbl_forwarder_company
        }
        let consignee_name = m['Consignee Name'] ? m['Consignee Name'].toString().trim() : ''
        // let notify_name = m['Notify Name'] ? m['Notify Name'].toString().trim() : ''
        let oft = m['OFT'] ? String(m['OFT']).trim() : ''
        let blf = m['BLF'] ? String(m['BLF']).trim() : ''
        let faf = m['FAF'] ? String(m['FAF']).trim() : ''
        let create_bl = true
        let create_con = true
        if(!new_import) {
          if(bl) {
            create_bl = false
            // shipment 导入
            let bl_cons = []
            for(let c of containersJS) {
              let container_bl = c['#M B/L No']
              let container_no = c['Container No']
              if(container_bl && container_no) {
                container_bl = container_bl.trim()
                container_no = container_no.trim()
                if(container_bl === masterbi_bl) {
                  bl_cons.push(container_no)
                }
              }
            }
            let db_pro_cons = await tb_proforma_container.findAll({
              where: {
                'export_vessel_id': ves.export_vessel_id,
                'export_container_bl': masterbi_bl,
                'state': GLBConfig.ENABLE
              }
            })
            if(db_pro_cons) {
              let pro_cons = []
              for(let pc of db_pro_cons) {
                pro_cons.push(pc.export_container_no)
              }
              let bl_cons_sort = bl_cons.sort()
              let pro_cons_sort = pro_cons.sort()
              if(bl_cons_sort.join() === pro_cons_sort.join()) {
                create_con = false
              } else {
                await tb_proforma_container.update(
                  {'state': GLBConfig.DISABLE}, 
                  {'where': {'export_vessel_id': ves.export_vessel_id, 'export_container_bl': masterbi_bl}}
                )
                // 删除未开票费用
                let fees = await tb_shipment_fee.findAll({
                  where: {
                    state: GLBConfig.ENABLE,
                    export_masterbl_id: bl.export_masterbl_id
                  }
                })
                if(fees && fees.length > 0) {
                  for(let f of fees) {
                    if(f.shipment_fee_status !== 'RE') {
                      f.state = GLBConfig.DISABLE
                      await f.save()
                      if(f.shipment_fee_invoice_id) {
                        let iu = await tb_uploadfile.findOne({
                          where: {
                            uploadfile_id: f.shipment_fee_invoice_id,
                            state: GLBConfig.ENABLE,
                          }
                        })
                        if(iu) {
                          iu.state = GLBConfig.DISABLE
                          await iu.save()
                        }
                      }

                      let evs = await tb_export_verification.findAll({
                        where: {
                          export_masterbl_id: bl.export_masterbl_id,
                          export_verification_api_name: 'SHIPMENT RELEASE',
                          export_verification_state: 'PM',
                          state: GLBConfig.ENABLE
                        }
                      })
                      if(evs && evs.length > 0) {
                        for(let e of evs) {
                          e.state = GLBConfig.DISABLE
                          await e.save()
                        }
                      }
                    }
                  }
                }
              }
            }
            bl.shipment_list_import = GLBConfig.ENABLE
            bl.export_masterbl_cso_number = cso_no
            bl.export_masterbl_shipper_company = shipper_name
            bl.export_masterbl_forwarder_company = forwarder_name
            bl.export_masterbl_consignee_company = consignee_name
            bl.export_masterbl_port_of_load = port_of_loading
            bl.export_masterbl_port_of_discharge = place_of_delivery
            // bl.export_masterbl_traffic_mode = traffic_mode
            bl.export_masterbl_container_quantity = number_of_containers
            bl.export_masterbl_container_weight = gross_weight
            // bl.export_masterbl_cargo_nature = cso_no
            bl.export_masterbl_cargo_descriptions = description_of_goods
            if(!bl.export_masterbl_cargo_type) {
              bl.export_masterbl_cargo_type = cargo_classification
            }
            bl.export_masterbl_container_package = number_of_package
            bl.export_masterbl_container_volumn = gross_volume
            if(!bl.relation_export_masterbl_id) {
              let load_ves = await tb_vessel.findOne({
                where: {
                  export_vessel_name: vessel_name,
                  export_vessel_voyage: vessel_voyage,
                  state: GLBConfig.ENABLE
                }
              })
              if(load_ves) {
                let load_bl = await tb_bl.findOne({
                  where: {
                    export_vessel_id: load_ves.export_vessel_id,
                    export_masterbl_bl: masterbi_bl,
                    state: GLBConfig.ENABLE
                  }
                })
                if(load_bl) {
                  bl.relation_export_masterbl_id = load_bl.export_masterbl_id
                }
              }
            }
            await bl.save()
          }
        }
        if(create_bl) {
          let relation_export_masterbl_id = null
          let export_masterbl_empty_release_agent = null
          let load_ves = await tb_vessel.findOne({
            where: {
              export_vessel_name: vessel_name,
              export_vessel_voyage: vessel_voyage,
              state: GLBConfig.ENABLE
            }
          })
          if(load_ves) {
            let load_bl = await tb_bl.findOne({
              where: {
                export_vessel_id: load_ves.export_vessel_id,
                export_masterbl_bl: masterbi_bl,
                state: GLBConfig.ENABLE
              }
            })
            if(load_bl) {
              relation_export_masterbl_id = load_bl.export_masterbl_id
              export_masterbl_empty_release_agent = load_bl.export_masterbl_empty_release_agent
            }
          }
          bl = await tb_proforma_bl.create({
            relation_export_masterbl_id: relation_export_masterbl_id,
            export_vessel_id: ves.export_vessel_id,
            export_masterbl_bl_carrier: bl_carrier,
            export_masterbl_bl: masterbi_bl,
            export_masterbl_cso_number: cso_no,
            export_masterbl_shipper_company: shipper_name,
            export_masterbl_forwarder_company: forwarder_name,
            export_masterbl_consignee_company: consignee_name,
            export_masterbl_port_of_load: port_of_loading,
            export_masterbl_port_of_discharge: place_of_delivery,
            export_masterbl_container_quantity: number_of_containers,
            export_masterbl_container_weight: gross_weight,
            export_masterbl_cargo_descriptions: description_of_goods,
            export_masterbl_cargo_type: cargo_classification,
            export_masterbl_container_package: number_of_package,
            export_masterbl_container_volumn: gross_volume,
            export_masterbl_empty_release_agent: export_masterbl_empty_release_agent,
            shipment_list_import: GLBConfig.ENABLE
          })
        }
        if(create_con) {
          // 新建箱信息
          for(let c of containersJS) {
            let container_bl = c['#M B/L No']
            let container_no = c['Container No']
            if(container_bl && container_no) {
              container_bl = container_bl.trim()
              if(container_bl === masterbi_bl) {
                container_no = container_no.trim()
                let type_of_container = c['Type Of Container'] ? c['Type Of Container'].toString().trim() : ''
                let container_size = c['Container Size'] ? c['Container Size'].toString().trim() : ''
                let container_seal = c['Seal No.1'] ? c['Seal No.1'].toString().trim() : ''
                // let freight_indicator = m['Freight Indicator'] ? m['Freight Indicator'].toString().trim() : ''
                let no_of_package = c['No Of Package'] ? c['No Of Package'].toString().trim() : ''
                let package_unit = c['Package Unit'] ? c['Package Unit'].toString().trim() : ''
                let volumn = c['Volumn'] ? c['Volumn'].toString().trim() : ''
                let volumn_unit = c['Volumn Unit'] ? c['Volumn Unit'].toString().trim() : ''
                let weight = c['Weight'] ? c['Weight'].toString().trim() : ''
                let weight_unit = c['Weight Unit'] ? c['Weight Unit'].toString().trim() : ''
                let queryStrStock = `SELECT * FROM tbl_zhongtan_empty_stock WHERE state = 1 AND empty_stock_container_no = ? AND empty_stock_container_owner = ? ORDER BY empty_stock_id DESC`
                let replacementsStock = [container_no, bl_carrier] 
                let stock_cons = await model.simpleSelect(queryStrStock, replacementsStock)
                if(!stock_cons || stock_cons.length <= 0) { 
                  let noCarrierQueryStrStock = `SELECT * FROM tbl_zhongtan_empty_stock WHERE state = 1 AND empty_stock_container_no = ? ORDER BY empty_stock_id DESC`
                  let noCarrierReplacementsStock = [container_no] 
                  stock_cons = await model.simpleSelect(noCarrierQueryStrStock, noCarrierReplacementsStock)
                } else if(stock_cons && stock_cons.length > 0) {
                  for(let i = 1; i < stock_cons.length; i++) {
                    let stock_con = stock_cons[i]
                    if(stock_cons[0].empty_stock_discharge_date == stock_con.empty_stock_discharge_date 
                      || stock_cons[0].empty_stock_gate_out_terminal_date == stock_con.empty_stock_gate_out_terminal_date
                      || stock_cons[0].empty_stock_gate_in_depot_date == stock_con.empty_stock_gate_in_depot_date 
                      || stock_cons[0].empty_stock_gate_out_depot_date == stock_con.empty_stock_gate_out_depot_date 
                      || stock_cons[0].empty_stock_gate_in_terminal_date == stock_con.empty_stock_gate_in_terminal_date
                      || stock_cons[0].empty_stock_loading_date == stock_con.empty_stock_loading_date) {
                        if(!stock_cons[0].empty_stock_gate_out_depot_date && stock_con.empty_stock_gate_out_depot_date) {
                          stock_cons[0].empty_stock_gate_out_depot_date = stock_con.empty_stock_gate_out_depot_date
                        }

                        if(!stock_cons[0].empty_stock_gate_in_terminal_date && stock_con.empty_stock_gate_in_terminal_date) {
                          stock_cons[0].empty_stock_gate_in_terminal_date = stock_con.empty_stock_gate_in_terminal_date
                        }

                        if(!stock_cons[0].empty_stock_loading_date && stock_con.empty_stock_loading_date) {
                          stock_cons[0].empty_stock_loading_date = stock_con.empty_stock_loading_date
                        }

                        if(!stock_cons[0].empty_stock_out_depot_name && stock_con.empty_stock_out_depot_name) {
                          stock_cons[0].empty_stock_out_depot_name = stock_con.empty_stock_out_depot_name
                        }
                      }
                  }
                }
                
                
                await tb_proforma_container.create({
                  export_vessel_id: ves.export_vessel_id,
                  export_container_bl:  container_bl,
                  export_container_no: container_no,
                  export_container_soc_type: type_of_container,
                  export_container_size_type: container_size,
                  export_seal_no: container_seal,
                  export_container_cargo_weight: weight,
                  export_container_cargo_weight_unit: weight_unit,
                  export_container_cargo_package: no_of_package,
                  export_container_cargo_package_unit: package_unit,
                  export_container_cargo_volumn: volumn,
                  export_container_cargo_volumn_unit: volumn_unit,
                  shipment_list_import: GLBConfig.ENABLE,
                  export_container_edi_loading_date: stock_cons && stock_cons.length > 0 && stock_cons[0].empty_stock_loading_date ? moment(stock_cons[0].empty_stock_loading_date).format('DD/MM/YYYY'): null,
                  export_container_edi_depot_gate_out_date: stock_cons && stock_cons.length > 0 && stock_cons[0].empty_stock_gate_out_depot_date ?  moment(stock_cons[0].empty_stock_gate_out_depot_date).format('DD/MM/YYYY'): null,
                  export_container_edi_wharf_gate_in_date: stock_cons && stock_cons.length > 0 && stock_cons[0].empty_stock_gate_in_terminal_date ?  moment(stock_cons[0].empty_stock_gate_in_terminal_date).format('DD/MM/YYYY'): null,
                  export_container_get_depot_name: stock_cons && stock_cons.length > 0 ? stock_cons[0].empty_stock_out_depot_name: null
                })
                if(stock_cons && stock_cons.length > 0) {
                  await cal_demurrage_srv.calculationDemurrage2Shipment(ves.export_vessel_id, container_bl, container_no, user.user_id)
                }
              }
            }
          }
          if(bl) {
            let queryStrReFee = `SELECT SUM(shipment_fee_amount) as sumReFee FROM tbl_zhongtan_export_shipment_fee WHERE export_masterbl_id = ? AND fee_data_code = ? AND shipment_fee_type = ? AND shipment_fee_status = 'RE' AND state = '1'`
            if(oft && parseFloat(oft) > 0) {
              let replacementsReFee = [bl.export_masterbl_id, 'OFT', 'R']
              let reFee = await model.simpleSelect(queryStrReFee, replacementsReFee)
              if(reFee && reFee[0].sumReFee) {
                let diffFee = new Decimal(oft).sub(new Decimal(reFee[0].sumReFee)).toNumber()
                if(diffFee !== 0) {
                  await tb_shipment_fee.create({
                    export_masterbl_id: bl.export_masterbl_id,
                    fee_data_code: 'OFT',
                    fee_data_fixed: GLBConfig.ENABLE,
                    shipment_fee_supplement: GLBConfig.DISABLE,
                    shipment_fee_type: 'R',
                    shipment_fee_party: bl.export_masterbl_empty_release_agent,
                    shipment_fee_fixed_amount: GLBConfig.ENABLE,
                    shipment_fee_amount: diffFee,
                    shipment_fee_currency: 'USD',
                    shipment_fee_status: 'SA',
                    shipment_fee_save_by: user.user_id,
                    shipment_fee_save_at: new Date(),
                    shipment_list_import: GLBConfig.ENABLE
                  })
                }
              } else {
                await tb_shipment_fee.create({
                  export_masterbl_id: bl.export_masterbl_id,
                  fee_data_code: 'OFT',
                  fee_data_fixed: GLBConfig.ENABLE,
                  shipment_fee_supplement: GLBConfig.DISABLE,
                  shipment_fee_type: 'R',
                  shipment_fee_party: bl.export_masterbl_empty_release_agent,
                  shipment_fee_fixed_amount: GLBConfig.ENABLE,
                  shipment_fee_amount: oft,
                  shipment_fee_currency: 'USD',
                  shipment_fee_status: 'SA',
                  shipment_fee_save_by: user.user_id,
                  shipment_fee_save_at: new Date(),
                  shipment_list_import: GLBConfig.ENABLE
                })
              }

              let queryStrOFT = `SELECT * FROM tbl_zhongtan_export_fee_data WHERE state = 1 AND fee_data_code = ? AND fee_data_payable = 1 LIMIT 1`
              let replacementsOFT = ['OFT'] 
              let oftFee = await model.simpleSelect(queryStrOFT, replacementsOFT)
              let oft_shipment_fee_party = null
              if(oftFee && oftFee.length > 0) {
                if(masterbi_bl.indexOf('COSU') >= 0){
                  oft_shipment_fee_party = oftFee[0].fee_data_payable_cosco_party ? oftFee[0].fee_data_payable_cosco_party : oftFee[0].fee_data_payable_common_party
                } else if(masterbi_bl.indexOf('OOLU') >= 0){
                  oft_shipment_fee_party = oftFee[0].fee_data_payable_oocl_party ? oftFee[0].fee_data_payable_oocl_party : oftFee[0].fee_data_payable_common_party
                }
              }
              await tb_shipment_fee.create({
                export_masterbl_id: bl.export_masterbl_id,
                fee_data_code: 'OFT',
                fee_data_fixed: GLBConfig.ENABLE,
                shipment_fee_supplement: GLBConfig.DISABLE,
                shipment_fee_type: 'P',
                shipment_fee_party: oft_shipment_fee_party,
                shipment_fee_fixed_amount: GLBConfig.ENABLE,
                shipment_fee_amount: oft,
                shipment_fee_currency: 'USD',
                shipment_fee_status: 'SA',
                shipment_fee_save_by: user.user_id,
                shipment_fee_save_at: new Date(),
                shipment_list_import: GLBConfig.ENABLE
              })
            }
            if(blf && parseFloat(blf) > 0) {
              let replacementsReFee = [bl.export_masterbl_id, 'BLF', 'R']
              let reFee = await model.simpleSelect(queryStrReFee, replacementsReFee)
              if(reFee && reFee[0].sumReFee) {
                let diffFee = new Decimal(blf).sub(new Decimal(reFee[0].sumReFee)).toNumber()
                if(diffFee !== 0) {
                  await tb_shipment_fee.create({
                    export_masterbl_id: bl.export_masterbl_id,
                    fee_data_code: 'BLF',
                    fee_data_fixed: GLBConfig.ENABLE,
                    shipment_fee_supplement: GLBConfig.DISABLE,
                    shipment_fee_type: 'R',
                    shipment_fee_party: bl.export_masterbl_empty_release_agent,
                    shipment_fee_fixed_amount: GLBConfig.ENABLE,
                    shipment_fee_amount: diffFee,
                    shipment_fee_currency: 'USD',
                    shipment_fee_status: 'SA',
                    shipment_fee_save_by: user.user_id,
                    shipment_fee_save_at: new Date(),
                    shipment_list_import: GLBConfig.ENABLE
                  })
                }
              } else {
                await tb_shipment_fee.create({
                  export_masterbl_id: bl.export_masterbl_id,
                  fee_data_code: 'BLF',
                  fee_data_fixed: GLBConfig.ENABLE,
                  shipment_fee_supplement: GLBConfig.DISABLE,
                  shipment_fee_type: 'R',
                  shipment_fee_party: bl.export_masterbl_empty_release_agent,
                  shipment_fee_fixed_amount: GLBConfig.ENABLE,
                  shipment_fee_amount: blf,
                  shipment_fee_currency: 'USD',
                  shipment_fee_status: 'SA',
                  shipment_fee_save_by: user.user_id,
                  shipment_fee_save_at: new Date(),
                  shipment_list_import: GLBConfig.ENABLE
                })
              }
            }
            if(faf && parseFloat(faf) > 0) {
              let replacementsReFee = [bl.export_masterbl_id, 'FAF', 'R']
              let reFee = await model.simpleSelect(queryStrReFee, replacementsReFee)
              if(reFee && reFee[0].sumReFee) {
                let diffFee = new Decimal(faf).sub(new Decimal(reFee[0].sumReFee)).toNumber()
                if(diffFee !== 0) {
                  await tb_shipment_fee.create({
                    export_masterbl_id: bl.export_masterbl_id,
                    fee_data_code: 'FAF',
                    fee_data_fixed: GLBConfig.ENABLE,
                    shipment_fee_supplement: GLBConfig.DISABLE,
                    shipment_fee_type: 'R',
                    shipment_fee_party: bl.export_masterbl_empty_release_agent,
                    shipment_fee_fixed_amount: GLBConfig.ENABLE,
                    shipment_fee_amount: diffFee,
                    shipment_fee_currency: 'USD',
                    shipment_fee_status: 'SA',
                    shipment_fee_save_by: user.user_id,
                    shipment_fee_save_at: new Date(),
                    shipment_list_import: GLBConfig.ENABLE
                  })
                }
              } else {
                await tb_shipment_fee.create({
                  export_masterbl_id: bl.export_masterbl_id,
                  fee_data_code: 'FAF',
                  fee_data_fixed: GLBConfig.ENABLE,
                  shipment_fee_supplement: GLBConfig.DISABLE,
                  shipment_fee_type: 'R',
                  shipment_fee_party: bl.export_masterbl_empty_release_agent,
                  shipment_fee_fixed_amount: GLBConfig.ENABLE,
                  shipment_fee_amount: faf,
                  shipment_fee_currency: 'USD',
                  shipment_fee_status: 'SA',
                  shipment_fee_save_by: user.user_id,
                  shipment_fee_save_at: new Date(),
                  shipment_list_import: GLBConfig.ENABLE
                })
              }

              let queryStrFAF = `SELECT * FROM tbl_zhongtan_export_fee_data WHERE state = 1 AND fee_data_code = ? AND fee_data_payable = 1 LIMIT 1`
              let replacementsFAF = ['FAF'] 
              let fafFee = await model.simpleSelect(queryStrFAF, replacementsFAF)
              let faf_shipment_fee_party = null
              if(fafFee && fafFee.length > 0) {
               if(masterbi_bl.indexOf('COSU') >= 0){
                  faf_shipment_fee_party = fafFee[0].fee_data_payable_cosco_party ? fafFee[0].fee_data_payable_cosco_party : fafFee[0].fee_data_payable_common_party
                } else if(masterbi_bl.indexOf('OOLU') >= 0){
                  faf_shipment_fee_party = fafFee[0].fee_data_payable_oocl_party ? fafFee[0].fee_data_payable_oocl_party : fafFee[0].fee_data_payable_common_party
                }
              }
              await tb_shipment_fee.create({
                export_masterbl_id: bl.export_masterbl_id,
                fee_data_code: 'FAF',
                fee_data_fixed: GLBConfig.ENABLE,
                shipment_fee_supplement: GLBConfig.DISABLE,
                shipment_fee_type: 'P',
                shipment_fee_party: faf_shipment_fee_party,
                shipment_fee_fixed_amount: GLBConfig.ENABLE,
                shipment_fee_amount: faf,
                shipment_fee_currency: 'USD',
                shipment_fee_status: 'SA',
                shipment_fee_save_by: user.user_id,
                shipment_fee_save_at: new Date(),
                shipment_list_import: GLBConfig.ENABLE
              })
            }
          }
        }
        await booking_load.createRolloverCharge(masterbi_bl, user.user_id)
      }
    }
  }
}

exports.uploadAct = async req => {
  let fileInfo = await common.fileSaveTemp(req)
  return common.success(fileInfo)
}

exports.importFreightAct = async req => {
  let doc = common.docValidate(req),
  user = req.user
  for (let f of doc.upload_files) {
    let wb = X.readFile(f.response.info.path, {
      cellFormula: true,
      bookVBA: true,
      cellNF: true,
      cellHTML: true,
      sheetStubs: true,
      cellDates: true,
      cellStyles: true
    })
    if(wb.SheetNames && wb.SheetNames.length > 0) {
      let wc = wb.Sheets[wb.SheetNames[0]]
      let wcTemp= X.utils.sheet_to_json(wc, {})
      let wcJS = await common.jsonTrim(wcTemp)
      if(wcJS && wcJS.length > 0) {
        for(let f of wcJS) {
          if(f['_1']) {
            if(common.isNumber(f['_1'])) {
              if(f['_6'] && common.isNumber(f['_6'])) {
                let queryStr = `SELECT export_masterbl_id, export_masterbl_empty_release_agent FROM tbl_zhongtan_export_proforma_masterbl WHERE state = ? AND (export_masterbl_bl = ? OR export_masterbl_bl = ? )`
                let replacements = [GLBConfig.ENABLE, 'COSU' + f['_1'], 'OOLU' + f['_1']]
                let pmbs = await model.simpleSelect(queryStr, replacements)
                if(pmbs && pmbs.length > 0) {
                  for(let p of pmbs) {
                    let fees = await tb_shipment_fee.findAll({
                      where: {
                        state: GLBConfig.ENABLE,
                        shipment_fee_type: 'R',
                        fee_data_code: 'OFT',
                        export_masterbl_id: p.export_masterbl_id
                      }
                    })
                    if(!fees || fees.length === 0) {
                      await tb_shipment_fee.create({
                        export_masterbl_id: p.export_masterbl_id,
                        fee_data_code: 'OFT',
                        fee_data_fixed: GLBConfig.ENABLE,
                        shipment_fee_supplement: GLBConfig.DISABLE,
                        shipment_fee_type: 'R',
                        shipment_fee_party: p.export_masterbl_empty_release_agent,
                        shipment_fee_amount: f['_6'],
                        shipment_fee_currency: 'USD',
                        shipment_fee_status: 'SA',
                        shipment_fee_save_by: user.user_id,
                        shipment_fee_save_at: new Date()
                      })
                    }
                  }
                } 
              }
            } else {
              let pro_bl = await tb_proforma_bl.findOne({
                where: {
                  state: GLBConfig.ENABLE,
                  export_masterbl_bl: f['_1']
                }
              })
              if(pro_bl && f['_6'] && common.isNumber(f['_6'])) {
                let fees = await tb_shipment_fee.findAll({
                  where: {
                    state: GLBConfig.ENABLE,
                    shipment_fee_type: 'R',
                    fee_data_code: 'OFT',
                    export_masterbl_id: pro_bl.export_masterbl_id
                  }
                })
                if(!fees || fees.length === 0) {
                  await tb_shipment_fee.create({
                    export_masterbl_id: pro_bl.export_masterbl_id,
                    fee_data_code: 'OFT',
                    fee_data_fixed: GLBConfig.ENABLE,
                    shipment_fee_supplement: GLBConfig.DISABLE,
                    shipment_fee_type: 'R',
                    shipment_fee_party: pro_bl.export_masterbl_empty_release_agent,
                    shipment_fee_amount: f['_6'],
                    shipment_fee_currency: 'USD',
                    shipment_fee_status: 'SA',
                    shipment_fee_save_by: user.user_id,
                    shipment_fee_save_at: new Date()
                  })
                }
              }
            }
          }
        }
      }
    }
  }
  return common.success()
}

exports.searchVesselAct = async req => {
  let doc = common.docValidate(req)
  let etd_start_date = doc.etd_start_date
  let etd_end_date = doc.etd_end_date
  let vessel_name = doc.vessel_name
  let masterbi_bl = doc.masterbi_bl
  let shipper_company = doc.shipper_company
  let consignee_company = doc.consignee_company
  let bl_carrier = doc.bl_carrier
  let queryStr =  `SELECT * FROM tbl_zhongtan_export_proforma_vessel v WHERE v.state = '1' AND EXISTS (SELECT 1 FROM tbl_zhongtan_export_proforma_masterbl b WHERE v.export_vessel_id = b.export_vessel_id AND b.state = 1 AND b.bk_cancellation_status <> 1)`
  let replacements = []
  if(masterbi_bl || shipper_company || consignee_company || bl_carrier) {
    queryStr = queryStr + ` AND EXISTS (SELECT 1 FROM tbl_zhongtan_export_proforma_masterbl b WHERE v.export_vessel_id = b.export_vessel_id AND b.state = 1 `
    if(masterbi_bl) {
      queryStr = queryStr + ` AND export_masterbl_bl like ? `
      replacements.push('%' + masterbi_bl + '%')
    }
    if(shipper_company) {
      queryStr = queryStr + ` AND export_masterbl_shipper_company like ? `
      replacements.push('%' + shipper_company + '%')
    }
    if(consignee_company) {
      queryStr = queryStr + ` AND export_masterbl_consignee_company like ? `
      replacements.push('%' + consignee_company + '%')
    }
    if(bl_carrier) {
      queryStr = queryStr + ` AND export_masterbl_bl_carrier = ? `
      replacements.push(bl_carrier)
    }
    queryStr = queryStr + `)`
  }
  if(etd_start_date && etd_end_date) {
    queryStr = queryStr + ` AND STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") >= ? AND STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") <= ? `
    replacements.push(moment(etd_start_date, 'YYYY-MM-DD').format('YYYY-MM-DD'))
    replacements.push(moment(etd_end_date, 'YYYY-MM-DD').format('YYYY-MM-DD'))
  }
  if(vessel_name) {
    queryStr = queryStr + ` AND v.export_vessel_name LIKE ? `
    replacements.push('%' + vessel_name + '%')
  }
  queryStr = queryStr + ` ORDER BY STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") DESC `
  let vessels =  await model.simpleSelect(queryStr, replacements)
  if(vessels) {
    for(let v of vessels) {
      let bcount = await tb_proforma_bl.count({
        where: {
          export_vessel_id: v.export_vessel_id,
          state: GLBConfig.ENABLE
        }
      })
      let ccount = await tb_proforma_container.count({
        where: {
          export_vessel_id: v.export_vessel_id,
          state: GLBConfig.ENABLE
        }
      })
      v.bl_count = bcount
      v.container_count = ccount
      queryStr = `SELECT export_container_size_type containers_size, COUNT(1) containers_size_count FROM tbl_zhongtan_export_proforma_container WHERE state = '1' AND export_vessel_id = ? GROUP BY export_container_size_type`
      replacements = [v.export_vessel_id]
      let sts = await model.simpleSelect(queryStr, replacements)
      if(sts && sts.length > 0) {
        v.size_types = JSON.parse(JSON.stringify(sts))
      }
    }
  }
  return vessels
}

exports.searchBlAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let export_vessel_id = doc.export_vessel_id
  let masterbi_bl = doc.masterbi_bl
  let shipper_company = doc.shipper_company
  let consignee_company = doc.consignee_company
  let bl_carrier = doc.bl_carrier
  let queryStr =  `select * from tbl_zhongtan_export_proforma_masterbl b WHERE b.export_vessel_id = ? AND b.state = ? AND b.bk_cancellation_status <> ? `
  let replacements = [export_vessel_id, GLBConfig.ENABLE, GLBConfig.ENABLE]
  if(masterbi_bl) {
    queryStr = queryStr + ` AND b.export_masterbl_bl LIKE ?`
    replacements.push('%' + masterbi_bl + '%')
  }
  if(shipper_company) {
    queryStr = queryStr + ` AND export_masterbl_shipper_company like ? `
    replacements.push('%' + shipper_company + '%')
  }
  if(consignee_company) {
    queryStr = queryStr + ` AND export_masterbl_consignee_company like ? `
    replacements.push('%' + consignee_company + '%')
  }
  if(bl_carrier) {
    queryStr = queryStr + ` AND export_masterbl_bl_carrier = ? `
    replacements.push(bl_carrier)
  }
  let bls = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = bls.count
  returnData.rows = []
  if(bls.data && bls.data.length > 0) {
    for(let d of bls.data) {
      queryStr =  `select * from tbl_zhongtan_export_shipment_fee WHERE shipment_list_import = ? AND export_masterbl_id = ? AND shipment_fee_status != ? AND state = ?`
      replacements = [GLBConfig.ENABLE, d.export_masterbl_id, 'NE', GLBConfig.ENABLE]
      let fees = await model.simpleSelect(queryStr, replacements)
      if(fees && fees.length > 0) {
        d.shipment_fee = true
      }
      d.old_export_masterbl_sales_code = d.export_masterbl_sales_code
      returnData.rows.push(d)
    }
  }
  return returnData
}

exports.searchContainerAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let export_vessel_id = doc.export_vessel_id
  let masterbi_bl = doc.masterbi_bl
  let queryStr =  `select * from tbl_zhongtan_export_proforma_container c WHERE c.export_vessel_id = ? AND c.state = ?`
  let replacements = [export_vessel_id, GLBConfig.ENABLE]
  if(masterbi_bl) {
    queryStr = queryStr + ` AND c.export_container_bl LIKE ?`
    replacements.push('%' + masterbi_bl + '%')
  }
  let cons = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = cons.count
  returnData.rows = cons.data
  return returnData
}

exports.modifyVesselAct = async req => {
  let doc = common.docValidate(req)
  let vessel = await tb_proforma_vessel.findOne({
    where: {
      export_vessel_id: doc.export_vessel_id
    }
  })
  if(vessel) {
    if(doc.modify_type && doc.modify_type === 'line') {
      vessel.export_total_units = doc.export_total_units
    } else {
      if(vessel.export_vessel_etd !== doc.export_vessel_etd) {
        // ETD修改，重新计算LPF
        let bls = await tb_proforma_bl.findAll({
          where: {
            export_vessel_id: vessel.export_vessel_id,
            state: GLBConfig.ENABLE
          }
        })
        if(moment().diff(moment(doc.export_vessel_etd, 'DD/MM/YYYY'), 'days') > 14) {
          if(bls && bls.length > 0) {
            let lf = await tb_fee_data.findOne({
              where: {
                fee_data_code: 'LPF',
                fee_data_type: 'BL',
                fee_data_receivable: GLBConfig.ENABLE,
                state: GLBConfig.ENABLE
              }
            })
            for(let b of bls) {
              let queryStr = `SELECT shipment_fee_id FROM tbl_zhongtan_export_shipment_fee WHERE state = '1' AND shipment_fee_type = 'R' AND fee_data_code = 'LPF' AND export_masterbl_id = ?`
              let replacements = [b.export_masterbl_id]
              let lpf_rows = await model.simpleSelect(queryStr, replacements)
              if(!lpf_rows || lpf_rows.length <= 0) {
                await tb_shipment_fee.create({
                  export_masterbl_id: b.export_masterbl_id,
                  fee_data_code: lf.fee_data_code,
                  fee_data_fixed: lf.fee_data_receivable_fixed,
                  shipment_fee_supplement: '0',
                  shipment_fee_type: 'R',
                  shipment_fee_amount: lf.fee_data_receivable_amount,
                  shipment_fee_fixed_amount: lf.fee_data_receivable_fixed && lf.fee_data_receivable_fixed === '1' ? lf.fee_data_receivable_amount: '',
                  shipment_fee_currency: lf.shipment_fee_currency ? lf.shipment_fee_currency : 'USD',
                  shipment_fee_status: 'SA',
                  shipment_fee_save_at: new Date()
                })
              }
            }
          }
        } else {
          // 删除没有开收据的LPF
          if(bls && bls.length > 0) {
            for(let b of bls) {
              let lpfs = await tb_shipment_fee.findAll({
                where: {
                  export_masterbl_id: b.export_masterbl_id,
                  shipment_fee_type: 'R',
                  fee_data_code: 'LPF',
                  state: GLBConfig.ENABLE
                }
              })
              if(lpfs && lpfs.length > 0) {
                for(let l of lpfs) {
                  if(l.shipment_fee_status !== 'RE') {
                    l.state = GLBConfig.DISABLE
                    await l.save()
                  }
                }
              }
            }
          }
        }
      }
      vessel.export_vessel_name = doc.export_vessel_name
      vessel.export_vessel_voyage = doc.export_vessel_voyage
      vessel.export_vessel_etd = doc.export_vessel_etd
      vessel.export_total_units = doc.export_total_units
    }
    await vessel.save()
  }
  return common.success()
}

exports.deleteVesselAct = async req => {
  let doc = common.docValidate(req)
  let vessel = await tb_proforma_vessel.findOne({
    where: {
      state: GLBConfig.ENABLE,
      export_vessel_id: doc.export_vessel_id
    }
  })
  if(vessel) {
    vessel.state = GLBConfig.DISABLE
    await vessel.save()
    let bls = await tb_proforma_bl.findAll({
      where: {
        state: GLBConfig.ENABLE,
        export_vessel_id: doc.export_vessel_id
      }
    })
    for(let b of bls) {
      b.state = GLBConfig.DISABLE
      await b.save()
    }
    let cons = await tb_proforma_container.findAll({
      where: {
        state: GLBConfig.ENABLE,
        export_vessel_id: doc.export_vessel_id
      }
    })
    for(let c of cons) {
      c.state = GLBConfig.DISABLE
      await c.save()
    }
  }
  return common.success()
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

exports.getEmptyReleaseAgentsAct = async req => {
  let doc = common.docValidate(req)
  let retData = {}
  if(doc.query) {
    let queryStr = `select a.user_id, a.user_name, a.user_blacklist, a.user_customer_type from tbl_common_user a where a.state = '1' and a.user_type = '${GLBConfig.TYPE_CUSTOMER}' and a.user_name LIKE ? ORDER BY user_name LIMIT 10`
    let replacements = ['%' + doc.query + '%']
    let agents = await model.simpleSelect(queryStr, replacements)
    retData.agents = JSON.parse(JSON.stringify(agents))
  }
  return common.success(retData)
}

exports.bookingDataSaveAct = async req => {
  let doc = common.docValidate(req)
  let bl = await tb_proforma_bl.findOne({
    where: {
      state: GLBConfig.ENABLE,
      export_masterbl_id: doc.export_masterbl_id
    }
  })
  if(bl) {
    if(doc.export_masterbl_empty_release_agent) {
      bl.export_masterbl_empty_release_agent = doc.export_masterbl_empty_release_agent
      let user = await tb_user.findOne({
        where: {
          user_id: bl.export_masterbl_empty_release_agent
        }
      })
      if(user) {
        bl.export_masterbl_forwarder_company = user.user_name
      }
    }
    if(doc.export_masterbl_cargo_type) {
      bl.export_masterbl_cargo_type = doc.export_masterbl_cargo_type
    }
    bl.export_masterbl_sales_code = doc.export_masterbl_sales_code
    await bl.save()
  }
  return common.success()
}

exports.bookingDataDeleteAct = async req => {
  let doc = common.docValidate(req)
  let bl = await tb_proforma_bl.findOne({
    where: {
      state: GLBConfig.ENABLE,
      export_masterbl_id: doc.export_masterbl_id
    }
  })
  if(bl) {
    bl.state = GLBConfig.DISABLE
    await bl.save()
    let cons = await tb_proforma_container.findAll({
      where: {
        state: GLBConfig.ENABLE,
        export_vessel_id: bl.export_vessel_id,
        export_container_bl: bl.export_masterbl_bl
      }
    })
    if(cons) {
      for(let c of cons) {
        c.state = GLBConfig.DISABLE
        await c.save()
      }
    }
  }
}