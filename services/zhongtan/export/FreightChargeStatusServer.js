const X = require('xlsx')
const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const cal_demurrage_srv = require('../equipment/ExportDemurrageCalculationServer')

const tb_vessel = model.zhongtan_export_vessel
const tb_bl = model.zhongtan_export_masterbl
const tb_container = model.zhongtan_export_container
const tb_proforma_vessel = model.zhongtan_export_proforma_vessel
const tb_proforma_bl = model.zhongtan_export_proforma_masterbl
const tb_proforma_container = model.zhongtan_export_proforma_container
const tb_container_size = model.zhongtan_container_size
const tb_shipment_fee = model.zhongtan_export_shipment_fee

exports.initAct = async () => {
  let returnData = {}
  returnData['CONTAINER_SIZE'] = await tb_container_size.findAll({
    attributes: ['container_size_code', 'container_size_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['container_size_code', 'ASC']]
  })

  let queryStr = `SELECT export_vessel_id, export_vessel_name, export_vessel_voyage FROM tbl_zhongtan_export_proforma_vessel WHERE state = '1' ORDER BY STR_TO_DATE(export_vessel_etd, "%d/%m/%Y") DESC`
  let replacements = []
  let vessels = await model.simpleSelect(queryStr, replacements)
  returnData['VESSELS'] = vessels

  queryStr = `SELECT user_id, user_name FROM tbl_common_user WHERE state = '1' AND user_type = ? ORDER BY user_name`
  replacements = [GLBConfig.TYPE_CUSTOMER]
  let agents = await model.simpleSelect(queryStr, replacements)
  returnData['AGENTS'] = agents
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `SELECT b.export_masterbl_id, b.export_masterbl_bl, b.export_masterbl_cargo_type, b.export_masterbl_port_of_load, b.export_masterbl_port_of_discharge, b.export_masterbl_shipper_company, b.loading_list_import, b.proforma_import,
                  v.export_vessel_id, v.export_vessel_name, v.export_vessel_voyage, v.export_vessel_etd, f.total_count, f.receipt_count, f.total_amount
                  from tbl_zhongtan_export_proforma_masterbl b 
                  LEFT JOIN tbl_zhongtan_export_proforma_vessel v ON b.export_vessel_id = v.export_vessel_id 
                  LEFT JOIN (SELECT export_masterbl_id, COUNT(1) AS total_count, COUNT(if(shipment_fee_status = 'RE', 1, null)) AS receipt_count, SUM(shipment_fee_amount) AS total_amount FROM tbl_zhongtan_export_shipment_fee WHERE state = '1' AND shipment_fee_type = 'R' GROUP BY export_masterbl_id) f ON f.export_masterbl_id = b.export_masterbl_id 
                  WHERE b.state = 1 `
  let replacements = []
  if(doc.search_data) {
    if (doc.search_data.masterbl_bl) {
      queryStr += ' and b.export_masterbl_bl like ? '
      replacements.push('%' + doc.search_data.masterbl_bl + '%')
    }
    if (doc.search_data.vessel_id) {
      queryStr += ' and v.export_vessel_id = ? '
      replacements.push(doc.search_data.vessel_id)
    }
    if (doc.search_data.etd_date && doc.search_data.etd_date.length > 1 && doc.search_data.etd_date[0] && doc.search_data.etd_date[1]) {
      queryStr += ' and STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") >= ? and STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") < ? '
      replacements.push(doc.search_data.etd_date[0])
      replacements.push(moment(doc.search_data.etd_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.charge_status === 'RELEASE') {
      queryStr += ` and f.total_count = f.receipt_count and f.total_count > 0 `
    }
    if (doc.search_data.charge_status === 'HOLD') {
      queryStr += ` and f.total_count != f.receipt_count `
    }
    if (doc.search_data.receivable_agent) {
      queryStr += ` and EXISTS (SELECT 1 FROM tbl_zhongtan_export_shipment_fee f WHERE f.export_masterbl_id = b.export_masterbl_id AND f.state = '1' AND f.shipment_fee_type = 'R' AND f.shipment_fee_party = ? GROUP BY f.export_masterbl_id) `
      replacements.push(doc.search_data.receivable_agent)
    }
  }
  queryStr += ' ORDER BY STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") DESC, b.export_masterbl_bl'
  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  let rows = []
  if(result.data) {
    for(let d of result.data) {
      let cons = await tb_proforma_container.findAll({
        where: {
          export_vessel_id: d.export_vessel_id,
          export_container_bl: d.export_masterbl_bl,
          state: GLBConfig.ENABLE
        },
        order: [['export_container_no', 'ASC']]
      })
      if(cons) {
        queryStr = `SELECT shipment_fee_status, shipment_fee_party, u.user_name, shipment_fee_receipt_no, SUM(shipment_fee_amount) AS total_amount FROM tbl_zhongtan_export_shipment_fee f LEFT JOIN tbl_common_user u ON f.shipment_fee_party = u.user_id WHERE f.state = '1' AND shipment_fee_type = 'R' AND export_masterbl_id = ? GROUP BY shipment_fee_status, shipment_fee_party, shipment_fee_receipt_no
        `
        replacements = [d.export_masterbl_id]
        let fees = await model.simpleSelect(queryStr, replacements)
        d.receivable_detail = fees
        for(let c of cons) {
          let bl = JSON.parse(JSON.stringify(d))
          bl.container_id = c.export_container_id
          bl.container_no = c.export_container_no
          bl.container_size_type = c.export_container_size_type
          bl.container_volume = 1
          bl.container_loading_list_import = c.loading_list_import
          bl.container_proforma_import = c.proforma_import
          if(d.total_count === d.receipt_count && d.receipt_count > 0) {
            bl.charge_status = 'RELEASE'
          } else {
            bl.charge_status = 'HOLD'
          }
          rows.push(bl)
        }
      }
    }
  }
  returnData.rows = rows

  return common.success(returnData)
}

exports.exportFreightAct = async (req, res) => {
  let doc = common.docValidate(req)
  let queryStr = `SELECT b.export_masterbl_id, b.export_masterbl_bl, b.export_masterbl_cargo_type, b.export_masterbl_port_of_load, b.export_masterbl_port_of_discharge, b.export_masterbl_shipper_company, 
                  v.export_vessel_id, v.export_vessel_name, v.export_vessel_voyage, v.export_vessel_etd, f.total_count, f.receipt_count, f.total_amount
                  from tbl_zhongtan_export_proforma_masterbl b 
                  LEFT JOIN tbl_zhongtan_export_proforma_vessel v ON b.export_vessel_id = v.export_vessel_id 
                  LEFT JOIN (SELECT export_masterbl_id, COUNT(1) AS total_count, COUNT(if(shipment_fee_status = 'RE', 1, null)) AS receipt_count, SUM(shipment_fee_amount) AS total_amount FROM tbl_zhongtan_export_shipment_fee WHERE state = '1' AND shipment_fee_type = 'R' GROUP BY export_masterbl_id) f ON f.export_masterbl_id = b.export_masterbl_id 
                  WHERE b.state = 1 `
  let replacements = []
  if(doc.search_data) {
    if (doc.search_data.masterbl_bl) {
      queryStr += ' and b.export_masterbl_bl like ? '
      replacements.push('%' + doc.search_data.masterbl_bl + '%')
    }
    if (doc.search_data.vessel_id) {
      queryStr += ' and v.export_vessel_id = ? '
      replacements.push(doc.search_data.vessel_id)
    }
    if (doc.search_data.etd_date && doc.search_data.etd_date.length > 1 && doc.search_data.etd_date[0] && doc.search_data.etd_date[1]) {
      queryStr += ' and STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") >= ? and STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") < ? '
      replacements.push(doc.search_data.etd_date[0])
      replacements.push(moment(doc.search_data.etd_date[1], 'YYYY-MM-DD').add(1, 'days').format('YYYY-MM-DD'))
    }
    if (doc.search_data.charge_status === 'RELEASE') {
      queryStr += ` and f.total_count = f.receipt_count and f.total_count > 0 `
    }
    if (doc.search_data.charge_status === 'HOLD') {
      queryStr += ` and f.total_count != f.receipt_count `
    }
    if (doc.search_data.receivable_agent) {
      queryStr += ` and EXISTS (SELECT 1 FROM tbl_zhongtan_export_shipment_fee f WHERE f.export_masterbl_id = b.export_masterbl_id AND f.state = '1' AND f.shipment_fee_type = 'R' AND f.shipment_fee_party = ? GROUP BY f.export_masterbl_id) `
      replacements.push(doc.search_data.receivable_agent)
    }
  }
  queryStr += ' ORDER BY STR_TO_DATE(v.export_vessel_etd, "%d/%m/%Y") DESC, b.export_masterbl_bl'
  let result = await model.simpleSelect(queryStr, replacements)
  let renderData = []
  if(result) {
    for(let r of result) {
      queryStr = `SELECT GROUP_CONCAT(b.container_size_name, '*', a.container_count) AS group_size, SUM(a.container_count) AS total_count FROM (
        SELECT export_container_size_type, COUNT(export_container_size_type) AS container_count FROM tbl_zhongtan_export_proforma_container 
        WHERE export_container_bl = ? AND export_vessel_id = ? GROUP BY export_container_size_type) a 
        LEFT JOIN tbl_zhongtan_container_size b ON (a.export_container_size_type = b.container_size_code OR a.export_container_size_type = b.container_size_name) AND b.state = '1'`
      replacements = [r.export_masterbl_bl, r.export_vessel_id]
      let con_info = await model.simpleSelect(queryStr, replacements)
      let container_volume = ''
      let container_size = ''
      if(con_info && con_info.length > 0) {
        container_volume = con_info[0].total_count
        container_size = con_info[0].group_size
      }
      queryStr = `SELECT shipment_fee_status, shipment_fee_party, u.user_name, shipment_fee_receipt_no, SUM(shipment_fee_amount) AS total_amount FROM tbl_zhongtan_export_shipment_fee f LEFT JOIN tbl_common_user u ON f.shipment_fee_party = u.user_id WHERE f.state = '1' AND shipment_fee_type = 'R' AND export_masterbl_id = ? GROUP BY shipment_fee_status, shipment_fee_party, shipment_fee_receipt_no
        `
      replacements = [r.export_masterbl_id]
      let fees = await model.simpleSelect(queryStr, replacements)
      if(fees && fees.length > 0) {
        for(let f of fees) {
          renderData.push({
            bl: r.export_masterbl_bl,
            bl_status: (r.total_count === r.receipt_count && r.receipt_count > 0) ? 'RELEASE' : 'HOLD',
            vessel_voyage: r.export_vessel_name + ' ' + r.export_vessel_voyage,
            etd: r.export_vessel_etd ? moment(r.export_vessel_etd, 'DD/MM/YYYY').format('YYYY/MM/DD') : r.export_vessel_etd,
            pol: r.export_masterbl_port_of_load,
            pod: r.export_masterbl_port_of_discharge,
            volume: container_volume,
            cntr_type: container_size,
            shipper: r.export_masterbl_shipper_company,
            total_receivable: r.total_amount,
            receivable: f.total_amount,
            receipt_no: f.shipment_fee_receipt_no,
            agent: f.user_name
          }) 
        }
      } else {
        renderData.push({
          bl: r.export_masterbl_bl,
          bl_status: 'HOLD',
          vessel_voyage: r.export_vessel_name + ' ' + r.export_vessel_voyage,
          etd: r.export_vessel_etd ? moment(r.export_vessel_etd, 'DD/MM/YYYY').format('YYYY/MM/DD') : r.export_vessel_etd,
          pol: r.export_masterbl_port_of_load,
          pod: r.export_masterbl_port_of_discharge,
          volume: container_volume,
          cntr_type: container_size,
          shipper: r.export_masterbl_shipper_company
        }) 
      }
    }
  }
  let filepath = await common.ejs2xlsx('FreightChargeListTemplate.xlsx', renderData)
  res.sendFile(filepath)
}

exports.uploadAct = async req => {
  let fileInfo = await common.fileSaveTemp(req)
  return common.success(fileInfo)
}

exports.loadingListDataAct = async req => {
  let doc = common.docValidate(req), user = req.user
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
        let titleJS = wcJS[0]
        let key_con_no = ''
        let key_ves_voy = ''
        let ves = ''
        let voy = ''
        if(titleJS) {
          for(let k in titleJS) {
            if(k && k.indexOf('FINAL LOADING LIST FOR') >= 0) {
              key_con_no = k
              key_ves_voy = k.replace('FINAL LOADING LIST FOR', '').trim()
              break
            }
          }
        }
        ves = key_ves_voy.split('VOY:')[0].trim()
        voy = key_ves_voy.split('VOY:')[1].trim()
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
              loading_list_import: GLBConfig.ENABLE
            })
          } else {
            proforma_vessel = await tb_proforma_vessel.create({
              export_vessel_name: ves,
              export_vessel_voyage: voy,
              loading_list_import: GLBConfig.ENABLE
            })
          }
        }
        let bl_cons = new Map()
        for(let i = 1; i < wcJS.length; i++) {
          let carrier = wcJS[i]['_1']
          let booking_no = wcJS[i]['_14']
          if(booking_no) {
            booking_no = booking_no.replace(/[^0-9a-zA-Z]/ig, '').trim()
          }
          if(booking_no) {
            let first_b = booking_no.substring(0, 1)
            if(common.isNumber(first_b)) {
              let full_bl = ''
              if(carrier.indexOf('COS') >= 0) {
                full_bl = 'COSU' + booking_no
              } else {
                full_bl = 'OOLU' + booking_no
              }
              if(bl_cons.get(full_bl)) {
                bl_cons.set(full_bl, bl_cons.get(full_bl) + 1)
              } else {
                bl_cons.set(full_bl, 1)
              }
            }
          }
        }
        for (var [k, v] of bl_cons) {
          let proforma_bl = await tb_proforma_bl.findOne({
            where: {
              export_vessel_id: proforma_vessel.export_vessel_id,
              export_masterbl_bl: k,
              state: GLBConfig.ENABLE
            }
          })
          if(proforma_bl) {
            let old_con_count = await tb_proforma_container.count({
              where: {
                state: GLBConfig.ENABLE,
                export_vessel_id: proforma_vessel.export_vessel_id,
                export_container_bl: k
              }
            })
            if(old_con_count > 0 && old_con_count !== v) {
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
          }
        }
        for(let i = 1; i < wcJS.length; i++) {
          let con_no = wcJS[i][key_con_no]
          let carrier = wcJS[i]['_1']
          let sz_ty = wcJS[i]['_4'] + wcJS[i]['_3']
          let poo = wcJS[i]['_6']
          let pol = wcJS[i]['_7']
          let pod = wcJS[i]['_8']
          let seal = wcJS[i]['_12']
          let booking_no = wcJS[i]['_14']
          if(booking_no) {
            booking_no = booking_no.replace(/[^0-9a-zA-Z]/ig, '').trim()
          }
          
          if(booking_no) {
            let first_b = booking_no.substring(0, 1)
            if(common.isNumber(first_b)) {
              let full_bl = ''
              if(carrier.indexOf('COS') >= 0) {
                full_bl = 'COSU' + booking_no
                carrier = 'COSCO'
              } else {
                full_bl = 'OOLU' + booking_no
                carrier = 'OOCL'
              }
              if(!proforma_vessel.export_vessel_code) {
                proforma_vessel.export_vessel_code = carrier
                await proforma_vessel.save()
              }
              let proforma_bl = await tb_proforma_bl.findOne({
                where: {
                  export_vessel_id: proforma_vessel.export_vessel_id,
                  export_masterbl_bl: full_bl,
                  state: GLBConfig.ENABLE
                }
              })
              if(!proforma_bl) {
                if(vessel) {
                  let bl = await tb_bl.findOne({
                    where: {
                      export_vessel_id: vessel.export_vessel_id,
                      export_masterbl_bl: full_bl,
                      state: GLBConfig.ENABLE
                    }
                  })
                  if(bl) {
                    proforma_bl = await tb_proforma_bl.create({
                      relation_export_masterbl_id: bl.export_masterbl_id,
                      export_vessel_id: proforma_vessel.export_vessel_id,
                      export_masterbl_bl_carrier: bl.export_masterbl_bl_carrier,
                      export_masterbl_bl: bl.export_masterbl_bl,
                      export_masterbl_cargo_type: poo.indexOf('TZ') === 0 ? 'LOCAL' : 'TRANSIT',
                      export_masterbl_port_of_load: pol,
                      export_masterbl_port_of_discharge: pod,
                      export_masterbl_forwarder_company: bl.export_masterbl_forwarder_company,
                      export_masterbl_cargo_nature: bl.export_masterbl_cargo_nature,
                      export_masterbl_cargo_descriptions: bl.export_masterbl_cargo_descriptions,
                      loading_list_import: GLBConfig.ENABLE
                    })
                  }else {
                    proforma_bl = await tb_proforma_bl.create({
                      export_vessel_id: proforma_vessel.export_vessel_id,
                      export_masterbl_bl_carrier: carrier,
                      export_masterbl_bl: full_bl,
                      export_masterbl_cargo_type: poo.indexOf('TZ') === 0 ? 'LOCAL' : 'TRANSIT',
                      export_masterbl_port_of_load: pol,
                      export_masterbl_port_of_discharge: pod,
                      loading_list_import: GLBConfig.ENABLE
                    })
                  }
                } else {
                  proforma_bl = await tb_proforma_bl.create({
                    export_vessel_id: proforma_vessel.export_vessel_id,
                    export_masterbl_bl_carrier: carrier,
                    export_masterbl_bl: full_bl,
                    export_masterbl_cargo_type: poo.indexOf('TZ') === 0 ? 'LOCAL' : 'TRANSIT',
                    export_masterbl_port_of_load: pol,
                    export_masterbl_port_of_discharge: pod,
                    loading_list_import: GLBConfig.ENABLE
                  })
                }
              } else {
                proforma_bl.loading_list_import = GLBConfig.ENABLE
                await proforma_bl.save()
              }
              let container = await tb_container.findOne({
                where: {
                  export_vessel_id: vessel.export_vessel_id,
                  export_container_bl: full_bl,
                  export_container_no: con_no,
                  state: GLBConfig.ENABLE
                }
              })
              let proforma_container = await tb_proforma_container.findOne({
                where: {
                  export_vessel_id: proforma_vessel.export_vessel_id,
                  export_container_bl: full_bl,
                  export_container_no: con_no,
                  state: GLBConfig.ENABLE
                }
              })
              if(!proforma_container) {
                if(container) {
                  await tb_proforma_container.create({
                    export_vessel_id: proforma_vessel.export_vessel_id,
                    export_container_bl: full_bl,
                    export_container_no: con_no,
                    export_seal_no: seal || '',
                    export_container_size_type: sz_ty,
                    export_container_soc_type: container.export_container_soc_type,
                    export_container_edi_loading_date: container.export_container_edi_loading_date,
                    export_container_edi_depot_gate_out_date: container.export_container_edi_depot_gate_out_date,
                    export_container_cal_depot_gate_out_date: container.export_container_edi_depot_gate_out_date,
                    export_container_edi_wharf_gate_in_date: container.export_container_edi_wharf_gate_in_date,
                    export_container_get_depot_name: container.export_container_get_depot_name,
                    loading_list_import: GLBConfig.ENABLE
                  })
                } else {
                  await tb_proforma_container.create({
                    export_vessel_id: proforma_vessel.export_vessel_id,
                    export_container_bl: full_bl,
                    export_container_no: con_no,
                    export_container_size_type: sz_ty,
                    export_seal_no: seal || '',
                    export_container_soc_type: 'C',
                    loading_list_import: GLBConfig.ENABLE
                  })
                }
              } else {
                proforma_container.loading_list_import = GLBConfig.ENABLE
                await proforma_container.save()
              }
              await cal_demurrage_srv.calculationDemurrage2Shipment(proforma_vessel.export_vessel_id, full_bl, con_no, user.user_id)
            }
          }
        }
      }
    }
  }
  return common.success()
}