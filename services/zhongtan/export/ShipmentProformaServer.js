const moment = require('moment')
const PDFParser = require('pdf2json')
const Decimal = require('decimal.js')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const opSrv = require('../../common/system/OperationPasswordServer')

const tb_user = model.common_user
const tb_vessel = model.zhongtan_export_vessel
const tb_bl = model.zhongtan_export_masterbl
const tb_container = model.zhongtan_export_container
const tb_proforma_vessel = model.zhongtan_export_proforma_vessel
const tb_proforma_bl = model.zhongtan_export_proforma_masterbl
const tb_proforma_container = model.zhongtan_export_proforma_container
const tb_container_size = model.zhongtan_container_size

exports.uploadBookingAct = async req => {
  let doc = common.docValidate(req)
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
        regex = '/VESSEL\\s*:\\s*([a-zA-Z0-9]+)\\s*VOYAGE/i'
        ves = common.valueFilter(pdfData, regex)
        regex = '/VOYAGE\\s*:\\s*([a-zA-Z0-9]+)\\s*B\\/L/i'
        voy = common.valueFilter(pdfData, regex)
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
            if(fIndex >= 0) {
              let conRow = row.trim()
              let tempRow = conRow.substr(11)
              let f2Index = tempRow.search(/[a-zA-Z]{4}\d{7}\s+/i)
              if(f2Index >= 0) {
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
                export_vessel_etd: vessel.export_vessel_etd
              })
            } else {
              proforma_vessel = await tb_proforma_vessel.create({
                export_vessel_code: bl_carrier,
                export_vessel_name: ves,
                export_vessel_voyage: voy
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
                  export_masterbl_cargo_descriptions: bl.export_masterbl_cargo_descriptions
                })
              }else {
                proforma_bl = await tb_proforma_bl.create({
                  export_vessel_id: proforma_vessel.export_vessel_id,
                  export_masterbl_bl_carrier: bl_carrier,
                  export_masterbl_bl: billOf
                })
              }
            } else {
              proforma_bl = await tb_proforma_bl.create({
                export_vessel_id: proforma_vessel.export_vessel_id,
                export_masterbl_bl_carrier: bl_carrier,
                export_masterbl_bl: billOf
              })
            }
          }
          let proforma_cons_old = await tb_proforma_container.findAll({
            where: {
              export_vessel_id: proforma_vessel.export_vessel_id,
              export_container_bl: proforma_bl.export_masterbl_bl,
              state: GLBConfig.ENABLE
            }
          })
          if(proforma_cons_old && proforma_cons_old.length > 0) {
            for(let co of proforma_cons_old) {
              co.state = GLBConfig.DISABLE
              await co.save()
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
                export_containe_edi_loading_date: container.export_containe_edi_loading_date,
                export_containe_edi_depot_gate_out_date: container.export_containe_edi_depot_gate_out_date,
                export_containe_cal_depot_gate_out_date: container.export_containe_edi_depot_gate_out_date,
                export_containe_edi_wharf_gate_in_date: container.export_containe_edi_wharf_gate_in_date,
                export_containe_get_depot_name: container.export_containe_get_depot_name
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
                export_container_cargo_volumn_unit: vu
              })
            }
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

exports.uploadAct = async req => {
  let fileInfo = await common.fileSaveTemp(req)
  return common.success(fileInfo)
}

exports.searchVesselAct = async req => {
  let doc = common.docValidate(req)
  let etd_start_date = doc.etd_start_date
  let etd_end_date = doc.etd_end_date
  let vessel_name = doc.vessel_name
  let masterbi_bl = doc.masterbi_bl
  let queryStr =  `SELECT * FROM tbl_zhongtan_export_proforma_vessel v `
  let replacements = []
  if(masterbi_bl) {
    queryStr = queryStr + ` LEFT JOIN tbl_zhongtan_export_proforma_masterbl b ON v.export_vessel_id = b.export_vessel_id WHERE v.state = '1' AND b.state = '1' AND b.export_masterbl_bl like ? `
    replacements.push('%' + masterbi_bl + '%')
  } else {
    queryStr = queryStr + ` WHERE v.state = '1' `
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
    }
  }
  return vessels
}

exports.searchBlAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let export_vessel_id = doc.export_vessel_id
  let masterbi_bl = doc.masterbi_bl
  let queryStr =  `select * from tbl_zhongtan_export_proforma_masterbl b WHERE b.export_vessel_id = ? AND b.state = ?`
  let replacements = [export_vessel_id, GLBConfig.ENABLE]
  if(masterbi_bl) {
    queryStr = queryStr + ` AND b.export_masterbl_bl LIKE ?`
    replacements.push('%' + masterbi_bl + '%')
  }
  let bls = await model.queryWithCount(doc, queryStr, replacements)
  returnData.total = bls.count
  returnData.rows = bls.data
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
    vessel.export_vessel_name = doc.export_vessel_name
    vessel.export_vessel_voyage = doc.export_vessel_voyage
    vessel.export_vessel_etd = doc.export_vessel_etd
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
    await bl.save()
  }
  return common.success()
}