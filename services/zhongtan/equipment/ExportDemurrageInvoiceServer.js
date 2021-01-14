const moment = require('moment')
const numberToText = require('number2text')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const model = require('../../../app/model')
const seq = require('../../../util/Sequence')
const mailer = require('../../../util/Mail')
const cal_config_srv = require('./OverdueCalculationConfigServer')
const opSrv = require('../../common/system/OperationPasswordServer')
const Op = model.Op

const tb_user = model.common_user
const tb_vessel = model.zhongtan_export_proforma_vessel
const tb_bl = model.zhongtan_export_proforma_masterbl
const tb_container_size = model.zhongtan_container_size
const tb_container = model.zhongtan_export_proforma_container
const tb_invoice_container = model.zhongtan_export_demurrage_detail
const tb_uploadfile = model.zhongtan_uploadfile
const tb_edi_depot = model.zhongtan_edi_depot

exports.initAct = async () => {
  let returnData = {}
  returnData['CONTAINER_SIZE'] = await tb_container_size.findAll({
    attributes: ['container_size_code', 'container_size_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['container_size_code', 'ASC']]
  })
  returnData['EDI_DEPOT'] = await tb_edi_depot.findAll({
    attributes: ['edi_depot_name'],
    where: {
      state : GLBConfig.ENABLE
    },
    order: [['edi_depot_name', 'ASC']]
  })
  returnData['UPLOAD_STATE'] = GLBConfig.UPLOAD_STATE
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `SELECT a.*, b.export_vessel_name, b.export_vessel_voyage, b.export_vessel_etd, c.export_masterbl_id, c.export_masterbl_bl_carrier, c.export_masterbl_cargo_type
                  from tbl_zhongtan_export_proforma_container a 
                  LEFT JOIN tbl_zhongtan_export_proforma_vessel b ON a.export_vessel_id = b.export_vessel_id AND b.state = '1' 
                  LEFT JOIN tbl_zhongtan_export_proforma_masterbl c ON a.export_container_bl = c.export_masterbl_bl AND c.state = '1' AND c.export_vessel_id = a.export_vessel_id 
                  WHERE a.state = '1'`
  let replacements = []

  if(doc.search_data) {
    if (doc.search_data.export_container_bl) {
      queryStr += ' and a.export_container_bl like ? '
      replacements.push('%' + doc.search_data.export_container_bl + '%')
    }
    if (doc.search_data.export_container_no) {
      queryStr += ' and a.export_container_no like ? '
      replacements.push('%' + doc.search_data.export_container_no + '%')
    }
    if (doc.search_data.export_vessel_name) {
      queryStr += ' and b.export_vessel_name like ? '
      replacements.push('%' + doc.search_data.export_vessel_name + '%')
    }
  }
  queryStr += ' ORDER BY b.export_vessel_id DESC, a.export_container_bl, a.export_container_no'
  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  if(result.data) {
    for(let d of result.data) {
      if(d.export_container_cal_invoice_payty) {
        let customer = await tb_user.findOne({
          where: {
            user_id: d.export_container_cal_invoice_payty
          }
        })
        if(customer) {
          d.customerINFO = [
            {
              id: d.export_container_cal_invoice_payty,
              text: customer.user_name
            }
          ]
        }
      }

      d.files = []
      let queryStr = `SELECT a.*, b.user_name FROM tbl_zhongtan_uploadfile a
          left join tbl_common_user b on a.uploadfil_release_user_id = b.user_id
          WHERE a.uploadfile_index1 = ? AND a.api_name IN('EXPORT-DEMURRAGE-INVOICE', 'EXPORT-DEMURRAGE-RECEIPT') AND a.state = '1' ORDER BY a.uploadfile_id DESC`
      let replacements = [d.invoice_masterbi_id]
      let files = await model.simpleSelect(queryStr, replacements)
      if(files) {
        let fileType = 'INVOICE'
        for(let f of files) {
          if(f.api_name === 'EXPORT-DEMURRAGE-INVOICE') {
            fileType = 'INVOICE'
          } else {
            fileType = 'RECEIPT'
          }
          d.files.push({
            date: moment(f.created_at).format('YYYY-MM-DD'),
            file_id: f.uploadfile_id,
            url: f.uploadfile_url,
            state: f.uploadfile_state,
            file_type: fileType,
            demurrage: f.uploadfile_amount,
            release_date: f.uploadfil_release_date ? moment(f.uploadfil_release_date).format('DD/MM/YYYY HH:mm') : '',
            release_user: f.user_name,
            receipt_no: f.uploadfile_receipt_no
          })
        }
      }
      if(d.export_container_edi_depot_gate_out_date) {
        d.export_container_edi_depot_gate_out_date_disabled = true
      } else {
        d.export_container_edi_depot_gate_out_date_disabled = false
      }
      if(d.export_container_edi_loading_date) {
        d.export_container_edi_loading_date_disabled = true
      } else {
        d.export_container_edi_loading_date_disabled = false
      }
      // cargo_type, discharge_port, carrier, container_type, enabled_date
      d.export_container_cal_static_free_days = await cal_config_srv.queryContainerFreeDays(d.export_masterbl_cargo_type, null, d.export_masterbl_bl_carrier, d.export_container_size_type, d.export_vessel_etd, 'E')
      if(d.export_container_cal_free_days) {
        d.export_container_cal_free_days = parseInt(d.export_container_cal_free_days)
      } else {
        d.export_container_cal_free_days = parseInt(d.export_container_cal_static_free_days)
      }
      let rcount = await tb_invoice_container.count({
        where: {
          demurrage_invoice_containers_id: d.export_container_id,
          demurrage_receipt_uploadfile_id: {
            [Op.ne]: null
          }
        }
      })
      if(rcount > 0) {
        d.export_container_cal_free_days_fixed = true
      } else {
        d.export_container_cal_free_days_fixed = false
      }
    }
  }
  returnData.rows = result.data

  return common.success(returnData)
}

exports.calculationAct = async req => {
  let doc = common.docValidate(req)
  let gate_out_date = doc.gate_out_date
  let loading_date = doc.loading_date
  let charge_carrier = doc.bl_carrier
  let cargo_type = doc.cargo_type
  let free_days = 0
  if(doc.free_days) {
    free_days = parseInt(doc.free_days)
  }
  // free_days, discharge_date, return_date, cargo_type, discharge_port, carrier, container_type, enabled_date
  let cal_result = await cal_config_srv.demurrageCalculation(free_days, gate_out_date, loading_date, cargo_type, null, charge_carrier, doc.containers_size, loading_date, 'E')
  if(cal_result.diff_days === -1) {
    return common.error('equipment_02')
  } else {
    return cal_result
  }
}

exports.demurrageCalculationSaveAct = async req => {
  let doc = common.docValidate(req)
  let con = await tb_container.findOne({
    where: {
      export_container_id: doc.export_container_id
    }
  })
  if(con) {
    let gate_out_date = doc.export_container_edi_depot_gate_out_date
    let charge_carrier = doc.export_masterbl_bl_carrier
    let old_free_days = con.export_container_cal_free_days ? con.export_container_cal_free_days : doc.export_container_cal_static_free_days

    // 保存计算箱子超期信息
    if(doc.export_container_edi_loading_date) {
      con.export_container_edi_loading_date = doc.export_container_edi_loading_date
    }
    con.export_container_edi_depot_gate_out_date = gate_out_date
    if(doc.export_container_cal_free_days) {
      con.export_container_cal_free_days = doc.export_container_cal_free_days
    }
    if(doc.export_container_cal_demurrage_days) {
      con.export_container_cal_demurrage_days = doc.export_container_cal_demurrage_days
    }
    if(doc.export_container_cal_demurrage_amount) {
      con.export_container_cal_demurrage_amount = doc.export_container_cal_demurrage_amount
    }
    await con.save()
    if(old_free_days && doc.export_container_cal_free_days && 
      parseInt(old_free_days) !== parseInt(doc.export_container_cal_free_days)
      && !doc.free_days_single) {
      // 修改了免箱期 同步修改其他免箱期不同的箱子
      let queryStr = `SELECT * FROM tbl_zhongtan_export_proforma_container WHERE export_vessel_id = ? AND export_container_bl = ? 
                      AND export_container_id != ? AND IFNULL(export_container_cal_free_days, '') != ?`
      let replacements = [con.export_vessel_id, con.export_container_bl, con.export_container_id, doc.export_container_cal_free_days]
      let oCons = await model.simpleSelect(queryStr, replacements)
      if(oCons) {
        for(let c of oCons) {
          if(c.export_container_edi_depot_gate_out_date) {
            let oc = await tb_container.findOne({
              where: {
                export_container_id: c.export_container_id
              }
            })
            if(oc) {
              let oc_loading_date = doc.export_vessel_etd
              if(oc.export_container_edi_loading_date) {
                oc_loading_date = oc.invoice_containers_edi_discharge_date
              }
              oc.export_container_cal_free_days = doc.export_container_cal_free_days
              let cal_result = await cal_config_srv.demurrageCalculation(oc.export_container_cal_free_days, oc.export_container_edi_depot_gate_out_date, oc_loading_date, 
                doc.export_masterbl_cargo_type, null, charge_carrier, oc.export_container_size_type, doc.export_vessel_etd, 'E')
              if(cal_result) {
                oc.export_container_cal_demurrage_days = cal_result.overdue_days
                oc.export_container_cal_demurrage_amount = cal_result.overdue_amount
              }
              oc.save()
            }
          } else {
            await tb_container.update(
                {'export_container_cal_free_days': doc.export_container_cal_free_days}, 
                {'where': {'export_container_id': c.export_container_id}}
              )
          }
        }
      }
    }
    return common.success()
  } else {
    return common.error('equipment_03')
  }
}

exports.ediCalculationSaveAct = async req => {
  let doc = common.docValidate(req)
  let con = await tb_container.findOne({
    where: {
      invoice_containers_id: doc.invoice_containers_id
    }
  })
  if(con) {
    if(doc.invoice_containers_edi_discharge_date) {
      con.invoice_containers_edi_discharge_date = doc.invoice_containers_edi_discharge_date
    }
    if(doc.invoice_containers_actually_return_date) {
      con.invoice_containers_actually_return_date = doc.invoice_containers_actually_return_date
      con.invoice_containers_actually_return_overdue_days = doc.invoice_containers_actually_return_overdue_days
      con.invoice_containers_actually_return_overdue_amount = doc.invoice_containers_actually_return_overdue_amount
    }
    await con.save()
    return common.success()
  } else {
    return common.error('equipment_03')
  }
}

exports.searchCustomerAct = async req => {
  let doc = common.docValidate(req)
  if (doc.search_text) {
    let returnData = {
      customerINFO: []
    }
    let queryStr = `select a.user_id, a.user_name from tbl_common_user a where a.state = '1' and a.user_type = '${GLBConfig.TYPE_CUSTOMER}'  
                   and (a.user_username like ? or a.user_phone like ? or a.user_name like ?) ORDER BY a.user_username`
    let replacements = []
    let search_text = doc.search_text + '%'
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

exports.getInvoiceSelectionAct = async req => {
  let doc = common.docValidate(req)
  let action = doc.action
  let selectAll = doc.selectAll
  let selection = []
  if(selectAll && doc.selection && doc.selection.length > 0) {
    let sel0 = doc.selection[0]
    let cons = await tb_container.findAll({
      where: {
        export_container_bl: sel0.export_container_bl,
        export_vessel_id: sel0.export_vessel_id,
        state: GLBConfig.ENABLE
      }
    })
    for(let c of cons) {
      if(c.export_container_cal_demurrage_amount && parseInt(c.export_container_cal_demurrage_amount) > 0) {
        selection.push({
          ...JSON.parse(JSON.stringify(c)),
          export_masterbl_id: sel0.export_masterbl_id,
          export_vessel_id: sel0.export_vessel_id
        })
      }
    }
  } else {
    selection = doc.selection
  }
  if(selection && selection.length > 0) {
    // 判断删除不符合条件的开票箱子
    for(let i = selection.length - 1; i>= 0; i--) {
      let sc = await tb_container.findOne({
        where: {
          export_container_id: selection[i].export_container_id
        }
      })
      if(sc) {
        if(sc.export_container_cal_receipt_amount && sc.export_container_cal_demurrage_amount && (parseInt(sc.export_container_cal_receipt_amount) === parseInt(sc.export_container_cal_demurrage_amount))) {
          selection.splice(i, 1)
        }
      } else {
        selection.splice(i, 1)
      }
    }
  }

  let returnData = {}
  let totalDemurrage = 0
  if(selection && selection.length > 0) {
    if(action === 'reinvoice') {
      for(let s of selection) {
        if(s.export_container_cal_demurrage_amount) {
          totalDemurrage += parseInt(s.export_container_cal_demurrage_amount)
        }
      }
    } else {
      let queryStr = ''
      let replacements = []
      for(let s of selection) {
        queryStr = `SELECT * FROM tbl_zhongtan_export_demurrage_detail WHERE demurrage_invoice_containers_id= ? AND  demurrage_receipt_date IS NOT NULL AND demurrage_receipt_date != '' ORDER BY demurrage_receipt_date DESC LIMIT 1`
        replacements = [s.export_container_id]
        let rcon = await model.simpleSelect(queryStr, replacements)
        if(rcon && rcon.length > 0) {
          totalDemurrage += parseFloat(s.export_container_cal_demurrage_amount) - parseFloat(rcon[0].demurrage_invoice_demurrage_amount) 
        } else {
          totalDemurrage += parseInt(s.export_container_cal_demurrage_amount)
        }
      }
    }
  }
  returnData.totalDemurrage = totalDemurrage
  return common.success(returnData)
}

exports.demurrageInvoiceAct = async req => {
  let doc = common.docValidate(req), user = req.user, curDate = new Date(), invoicePara = doc.invoicePara
  let selectAll = doc.selectAll
  let selection = []
  if(selectAll && doc.selection && doc.selection.length > 0) {
    let sel0 = doc.selection[0]
    let cons = await tb_container.findAll({
      where: {
        export_container_bl: sel0.export_container_bl,
        export_vessel_id: sel0.export_vessel_id,
        state: GLBConfig.ENABLE
      }
    })
    for(let c of cons) {
      if(c.export_container_cal_demurrage_amount && parseInt(c.export_container_cal_demurrage_amount) > 0) {
        selection.push({
          ...JSON.parse(JSON.stringify(c)),
          export_masterbl_id: sel0.export_masterbl_id,
          export_vessel_id: sel0.export_vessel_id
        })
      }
    }
  } else {
    selection = doc.selection
  }
  if(selection && selection.length > 0) {
    // 判断删除不符合条件的开票箱子
    for(let i = selection.length - 1; i>= 0; i--) {
      let sc = await tb_container.findOne({
        where: {
          export_container_id: selection[i].export_container_id
        }
      })
      if(sc) {
        if(sc.export_container_cal_receipt_amount && sc.export_container_cal_demurrage_amount && (parseInt(sc.export_container_cal_receipt_amount) === parseInt(sc.export_container_cal_demurrage_amount))) {
          selection.splice(i, 1)
        }
      } else {
        selection.splice(i, 1)
      }
    }
    let selContainerIds = []
    for(let s of selection) {
      selContainerIds.push(s.export_container_id)
    }
    // 删除未开收据的发票，只保留当次选择的箱子，重新开票
    let queryStr = 'SELECT demurrage_invoice_containers_id, demurrage_invoice_uploadfile_id FROM tbl_zhongtan_export_demurrage_detail WHERE state = ? AND demurrage_invoice_containers_id IN (?) AND demurrage_receipt_date IS NULL'
    let replacements = [GLBConfig.ENABLE, selContainerIds]
    let del_invoices = await model.simpleSelect(queryStr, replacements)
    if(del_invoices) {
      for(let d of del_invoices) {
        let di = await tb_invoice_container.findOne({
          where: {
            state: GLBConfig.ENABLE,
            demurrage_invoice_containers_id: d.demurrage_invoice_containers_id
          }
        })
        if(di) {
          di.state = GLBConfig.DISABLE
          await di.save()
        }
        let df = await tb_uploadfile.findOne({
          where: {
            uploadfile_id: d.demurrage_invoice_uploadfile_id
          }
        })
        if(df) {
          df.state = GLBConfig.DISABLE
          await df.save()
        }
      }
    }
    let row0 = selection[0]
    let bl = await tb_bl.findOne({
      where: {
        export_masterbl_id: row0.export_masterbl_id
      }
    })
  
    let vessel = await tb_vessel.findOne({
      where: {
        export_vessel_id: row0.export_vessel_id
      }
    })
  
    let customer = await tb_user.findOne({
      where: {
        user_id: invoicePara.invoice_customer_id
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
    renderData.cargoType = bl.export_masterbl_cargo_type
    renderData.masterbiBl = bl.export_masterbl_bl
    renderData.invoiceDate = moment().format('YYYY/MM/DD')
    let invoiceNo = await seq.genEquipmentInvoiceSeq()
    renderData.invoiceNo = invoiceNo
    renderData.vesselName = vessel.export_vessel_name
    renderData.voyageNumber = vessel.export_vessel_voyage
    renderData.berthingDate = vessel.export_vessel_etd
    renderData.user_name = commonUser.user_name
    renderData.user_phone = commonUser.user_phone
    renderData.user_email = commonUser.user_email
    let demurrageTotal = 0
    renderData.containers = []
    for(let s of selection) {
      let con = await tb_container.findOne({
        where: {
          export_container_id: s.export_container_id
        }
      })
      let discharge_date = vessel.invoice_vessel_ata
      if(con.invoice_containers_edi_discharge_date) {
        discharge_date = con.invoice_containers_edi_discharge_date
      }
      con.invoice_containers_customer_id = customer.user_id
      con.invoice_containers_empty_return_invoice_date = curDate
      con.invoice_containers_empty_return_date_invoice = con.invoice_containers_empty_return_date
      con.invoice_containers_empty_return_overdue_days_invoice = con.invoice_containers_empty_return_overdue_days
      con.invoice_containers_empty_return_overdue_amount_invoice = con.invoice_containers_empty_return_overdue_amount
      con.invoice_containers_empty_return_edit_flg = GLBConfig.DISABLE
      con.save()
      s.invoice_containers_size = con.invoice_containers_size
      s.invoice_containers_empty_return_date = con.invoice_containers_empty_return_date
      s.invoice_containers_empty_return_overdue_days = con.invoice_containers_empty_return_overdue_days
      s.invoice_containers_empty_return_overdue_amount = con.invoice_containers_empty_return_overdue_amount
     
      queryStr = `SELECT * FROM tbl_zhongtan_overdue_invoice_containers WHERE overdue_invoice_containers_invoice_containers_id= ? AND  overdue_invoice_containers_receipt_date IS NOT NULL AND overdue_invoice_containers_receipt_date != '' ORDER BY overdue_invoice_containers_receipt_date DESC LIMIT 1`
      replacements = [con.invoice_containers_id]
      let rcon = await model.simpleSelect(queryStr, replacements)
      if(rcon && rcon.length > 0) {
        s.starting_date = moment(rcon[0].overdue_invoice_containers_return_date, 'DD/MM/YYYY').add(1, 'days').format('DD/MM/YYYY')
        s.overdue_days = parseInt(con.invoice_containers_empty_return_overdue_days) - parseInt(rcon[0].overdue_invoice_containers_overdue_days)
        s.overdue_amount = parseFloat(con.invoice_containers_empty_return_overdue_amount) - parseFloat(rcon[0].overdue_invoice_containers_overdue_amount) 
      } else {
        s.starting_date = discharge_date
        s.overdue_days = con.invoice_containers_empty_return_overdue_days
        s.overdue_amount = con.invoice_containers_empty_return_overdue_amount
      }
      let conSize = await tb_container_size.findOne({
        where: {
          container_size_code: s.invoice_containers_size
        }
      })
      renderData.containers.push({
        'containerNo': s.invoice_containers_no,
        'sizeType': conSize ? conSize.container_size_name : s.invoice_containers_size,
        'startingDate': s.starting_date,
        'returnDate': s.invoice_containers_empty_return_date,
        'overdusDays': s.overdue_days,
        'demurrage': formatCurrency(s.overdue_amount),
      })
      demurrageTotal += parseFloat(s.overdue_amount)
    }
    renderData.demurrageTotal = formatCurrency(demurrageTotal)
    renderData.demurrageTotalStr = numberToText(demurrageTotal)
    let fileInfo = await common.ejs2Pdf('demurrage.ejs', renderData, 'zhongtan')
    let invoice_file = await tb_uploadfile.create({
      api_name: 'OVERDUE-INVOICE',
      user_id: user.user_id,
      uploadfile_index1: bl.invoice_masterbi_id,
      uploadfile_name: fileInfo.name,
      uploadfile_url: fileInfo.url,
      uploadfile_currency: 'USD',
      uploadfile_state: 'PB', // TODO state PM => PB
      uploadfile_amount: demurrageTotal,
      uploadfile_customer_id: customer.user_id,
      uploadfile_invoice_no: invoiceNo
    })
    for(let s of selection) {
      let discharge_date = vessel.invoice_vessel_ata
      if(s.invoice_containers_edi_discharge_date) {
        discharge_date = s.invoice_containers_edi_discharge_date
      }
      await tb_invoice_container.create({
        overdue_invoice_containers_invoice_uploadfile_id: invoice_file.uploadfile_id,
        overdue_invoice_containers_invoice_masterbi_id: s.invoice_masterbi_id,
        overdue_invoice_containers_invoice_containers_id: s.invoice_containers_id,
        overdue_invoice_containers_return_date: s.invoice_containers_empty_return_date,
        overdue_invoice_containers_overdue_days: s.invoice_containers_empty_return_overdue_days,
        overdue_invoice_containers_overdue_amount: s.invoice_containers_empty_return_overdue_amount,
        overdue_invoice_containers_overdue_free_days: s.invoice_containers_empty_return_overdue_free_days,
        overdue_invoice_containers_overdue_increase_days: s.overdue_days,
        overdue_invoice_containers_overdue_invoice_amount: s.overdue_amount,
        overdue_invoice_containers_overdue_discharge_date: discharge_date,
        overdue_invoice_containers_overdue_staring_date: s.starting_date
      })
    }
    return common.success()
  } else {
    return common.error('equipment_03')
  }
}

exports.demurrageReInvoiceAct = async req => {
  let doc = common.docValidate(req), user = req.user, curDate = new Date()
  let selectAll = doc.selectAll
  let selection = []
  if(selectAll && doc.selection && doc.selection.length > 0) {
    let sel0 = doc.selection[0]
    let cons = await tb_container.findAll({
      where: {
        invoice_containers_bl: sel0.invoice_containers_bl,
        invoice_vessel_id: sel0.invoice_vessel_id,
        state: GLBConfig.ENABLE
      }
    })
    for(let c of cons) {
      if((c.invoice_containers_empty_return_receipt_date && c.invoice_containers_empty_return_overdue_amount && parseInt(c.invoice_containers_empty_return_overdue_amount) === 0) 
                || (c.invoice_containers_empty_return_date && c.invoice_containers_empty_return_overdue_amount && parseInt(c.invoice_containers_empty_return_overdue_amount) > 0)) {
        selection.push({
          ...JSON.parse(JSON.stringify(c)),
          invoice_masterbi_id: sel0.invoice_masterbi_id,
          invoice_vessel_id: sel0.invoice_vessel_id
        })
      }
    }
  } else {
    selection = doc.selection
  }
  let invoicePara = doc.invoicePara
  if(selection && selection.length > 0) {
    let row0 = selection[0]
    let bl = await tb_bl.findOne({
      where: {
        invoice_masterbi_id: row0.invoice_masterbi_id
      }
    })
  
    let vessel = await tb_vessel.findOne({
      where: {
        invoice_vessel_id: row0.invoice_vessel_id
      }
    })
  
    let customer = await tb_user.findOne({
      where: {
        user_id: invoicePara.invoice_customer_id
      }
    })
  
    let commonUser = await tb_user.findOne({
      where: {
        user_id: user.user_id
      }
    })
    
    let deduction = invoicePara.deduction
    let splitDeduction = 0
    if(deduction) {
      splitDeduction = Math.ceil(deduction / selection.length)
    }
    let mergeCon = {}
    for(let s of selection) {
      let con = await tb_container.findOne({
        where: {
          invoice_containers_id: s.invoice_containers_id
        }
      })
      let discharge_date = vessel.invoice_vessel_ata
      if(con.invoice_containers_edi_discharge_date) {
        discharge_date = con.invoice_containers_edi_discharge_date
      }
      con.invoice_containers_customer_id = customer.user_id
      con.invoice_containers_empty_return_invoice_date = curDate
      con.invoice_containers_empty_return_date_invoice = con.invoice_containers_empty_return_date
      con.invoice_containers_empty_return_overdue_days_invoice = con.invoice_containers_empty_return_overdue_days
      if(deduction > splitDeduction) {
        con.invoice_containers_empty_return_overdue_deduction = splitDeduction
        deduction -= splitDeduction
      } else {
        con.invoice_containers_empty_return_overdue_deduction = deduction
      }
      con.invoice_containers_empty_return_overdue_amount_invoice = con.invoice_containers_empty_return_overdue_amount - con.invoice_containers_empty_return_overdue_deduction
      con.invoice_containers_empty_return_edit_flg = GLBConfig.DISABLE
      con.save()
      s.invoice_containers_size = con.invoice_containers_size
      s.invoice_containers_empty_return_date = con.invoice_containers_empty_return_date
      s.invoice_containers_empty_return_overdue_days = con.invoice_containers_empty_return_overdue_days
      s.invoice_containers_empty_return_overdue_amount = con.invoice_containers_empty_return_overdue_amount_invoice
      s.starting_date = discharge_date
      s.overdue_days = con.invoice_containers_empty_return_overdue_days
      s.overdue_amount = con.invoice_containers_empty_return_overdue_amount_invoice
      s.overdue_invoice_containers_overdue_deduction = con.invoice_containers_empty_return_overdue_deduction
      if(mergeCon.hasOwnProperty(s.starting_date)) {
        mergeCon[s.starting_date].push(s)
      } else {
        mergeCon[s.starting_date] = []
        mergeCon[s.starting_date].push(s)
      }
    }
    for(let key in mergeCon) {
      let row0 = mergeCon[key][0]
      let discharge_date = vessel.invoice_vessel_ata
      if(row0.invoice_containers_edi_discharge_date) {
        discharge_date = row0.invoice_containers_edi_discharge_date
      }
      let renderData = {}
      renderData.customerName = customer.user_name
      renderData.address = customer.user_address
      renderData.destination = bl.invoice_masterbi_destination.substring(0, 2)
      if(bl.invoice_masterbi_cargo_type === 'TR' || bl.invoice_masterbi_cargo_type === 'TRANSIT') {
        renderData.cargoType = 'TRANSIT'
      } else {
        renderData.cargoType = 'LOCAL'
      }
      renderData.masterbiBl = bl.invoice_masterbi_bl
      renderData.invoiceDate = moment().format('YYYY/MM/DD')
      let invoiceNo = await seq.genEquipmentInvoiceSeq()
      renderData.invoiceNo = invoiceNo
      renderData.vesselName = vessel.invoice_vessel_name
      renderData.voyageNumber = vessel.invoice_vessel_voyage
      renderData.dischargeDate = discharge_date
      renderData.startingDate = row0.starting_date
      renderData.user_name = commonUser.user_name
      renderData.user_phone = commonUser.user_phone
      renderData.user_email = commonUser.user_email
      let demurrageTotal = 0
      renderData.containers = []
      for(let s of mergeCon[key]) {
        let conSize = await tb_container_size.findOne({
          where: {
            container_size_code: s.invoice_containers_size
          }
        })
        renderData.containers.push({
          'containerNo': s.invoice_containers_no,
          'sizeType': conSize ? conSize.container_size_name : s.invoice_containers_size,
          'returnDate': s.invoice_containers_empty_return_date,
          'overdusDays': s.overdue_days,
          'demurrage': formatCurrency(s.overdue_amount),
        })
        demurrageTotal += parseFloat(s.overdue_amount)
      }
      renderData.demurrageTotal = formatCurrency(demurrageTotal)
      renderData.demurrageTotalStr = numberToText(demurrageTotal)
      let fileInfo = await common.ejs2Pdf('demurrage.ejs', renderData, 'zhongtan')
      let invoice_file = await tb_uploadfile.create({
        api_name: 'OVERDUE-INVOICE',
        user_id: user.user_id,
        uploadfile_index1: bl.invoice_masterbi_id,
        uploadfile_name: fileInfo.name,
        uploadfile_url: fileInfo.url,
        uploadfile_currency: 'USD',
        uploadfile_state: 'PB', // TODO state PM => PB
        uploadfile_amount: demurrageTotal,
        uploadfile_customer_id: customer.user_id,
        uploadfile_invoice_no: invoiceNo
      })
      
      for(let s of mergeCon[key]) {
        let discharge_date = vessel.invoice_vessel_ata
        if(s.invoice_containers_edi_discharge_date) {
          discharge_date = s.invoice_containers_edi_discharge_date
        }
        await tb_invoice_container.create({
          overdue_invoice_containers_invoice_uploadfile_id: invoice_file.uploadfile_id,
          overdue_invoice_containers_invoice_masterbi_id: s.invoice_masterbi_id,
          overdue_invoice_containers_invoice_containers_id: s.invoice_containers_id,
          overdue_invoice_containers_return_date: s.invoice_containers_empty_return_date,
          overdue_invoice_containers_overdue_days: s.invoice_containers_empty_return_overdue_days,
          overdue_invoice_containers_overdue_amount: s.invoice_containers_empty_return_overdue_amount,
          overdue_invoice_containers_overdue_free_days: s.invoice_containers_empty_return_overdue_free_days,
          overdue_invoice_containers_overdue_increase_days: s.overdue_days,
          overdue_invoice_containers_overdue_invoice_amount: s.overdue_amount,
          overdue_invoice_containers_overdue_discharge_date: discharge_date,
          overdue_invoice_containers_overdue_staring_date: s.starting_date,
          overdue_invoice_containers_overdue_deduction: s.overdue_invoice_containers_overdue_deduction
        })
      }
    }
    return common.success()
  } else {
    return common.error('equipment_03')
  }
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

exports.actuallyOverdueCopyAct = async req => {
  let doc = common.docValidate(req)
  let con = await tb_container.findOne({
    where: {
      invoice_containers_id: doc.invoice_containers_id
    }
  })
  if(con) {
    con.invoice_containers_empty_return_date = con.invoice_containers_actually_return_date
    con.invoice_containers_empty_return_overdue_days = con.invoice_containers_actually_return_overdue_days
    con.invoice_containers_empty_return_overdue_amount = con.invoice_containers_actually_return_overdue_amount
    con.save()
  }
  return common.success()
}

exports.containerInvoiceDetailAct = async req => {
  let doc = common.docValidate(req)
  let queryStr = `SELECT a.*, b.user_id, b.uploadfile_state, c.user_name FROM tbl_zhongtan_overdue_invoice_containers a LEFT JOIN tbl_zhongtan_uploadfile b ON a.overdue_invoice_containers_invoice_uploadfile_id = b.uploadfile_id LEFT JOIN tbl_common_user c ON b.user_id = c.user_id WHERE overdue_invoice_containers_invoice_containers_id = ? ORDER BY a.overdue_invoice_containers_id DESC`
  let replacements = []
  replacements.push(doc.invoice_containers_id)
  let result = await model.simpleSelect(queryStr, replacements)
  if(result) {
    for(let r of result) {
      r.invoice_created_at = moment(r.created_at).format('YYYY-MM-DD HH:mm')
      r.overdue_invoice_containers_receipt_date = r.overdue_invoice_containers_receipt_date ? moment(r.overdue_invoice_containers_receipt_date).format('YYYY-MM-DD HH:mm') : ''
    }
  }
  return common.success(result)
}

exports.issuingStoringOrderAct = async req => {
  let doc = common.docValidate(req), user = req.user
  let selection = doc.selection
  let storingOrderPara = doc.storingOrderPara
  let receiptSelection = []
  let receiptInvocieCons = []
  if(selection && selection.length > 0) {
    for(let s of selection) {
      if(s.invoice_containers_issuing_storing_order_status) {
        receiptSelection.push(s)
        let rcon = await tb_invoice_container.findOne({
          where: {
            overdue_invoice_containers_invoice_containers_id: s.invoice_containers_id,
            overdue_invoice_containers_receipt_date: {
              [Op.ne]: null
            }
          },
          order: [['overdue_invoice_containers_overdue_days', 'DESC'], ['overdue_invoice_containers_receipt_date', 'DESC']]
        })
        if(rcon) {
          receiptInvocieCons.push(rcon)
        }
      }
    }
  }
  if(receiptSelection && receiptSelection.length > 0 && receiptInvocieCons && receiptInvocieCons.length > 0) {
    let mergeCon = {}
    for(let r of receiptInvocieCons) {
      if(mergeCon.hasOwnProperty(r.overdue_invoice_containers_return_date)) {
        mergeCon[r.overdue_invoice_containers_return_date].push(r)
      } else {
        mergeCon[r.overdue_invoice_containers_return_date] = []
        mergeCon[r.overdue_invoice_containers_return_date].push(r)
      }
    }

    let row0 = receiptSelection[0]
    let bl = await tb_bl.findOne({
      where: {
        invoice_masterbi_id: row0.invoice_masterbi_id
      }
    })
  
    let vessel = await tb_vessel.findOne({
      where: {
        invoice_vessel_id: row0.invoice_vessel_id
      }
    })
  
    let customer = await tb_user.findOne({
      where: {
        user_id: row0.invoice_containers_customer_id
      }
    })
  
    let commonUser = await tb_user.findOne({
      where: {
        user_id: user.user_id
      }
    })

    let depot = await tb_edi_depot.findOne({
      where: {
        state : GLBConfig.ENABLE,
        edi_depot_name: storingOrderPara.invoice_containers_depot_name
      }
    })
    if(depot.edi_depot_storing_order_email) {
      for(let key in mergeCon) {
        let renderData = {}
        renderData.depotName = depot.edi_depot_name
        renderData.customerName = customer.user_name
        renderData.returnDateStr = moment(key, 'DD/MM/YYYY').format('MMM DD, YYYY')
        renderData.bl = bl.invoice_masterbi_bl
        renderData.vessel = vessel.invoice_vessel_name
        renderData.voyage = vessel.invoice_vessel_voyage
        if(bl.invoice_masterbi_bl) {
          if(bl.invoice_masterbi_bl.indexOf('COS') >= 0) {
            renderData.line = 'COSCO'
          } else if(bl.invoice_masterbi_bl.indexOf('OOLU') >= 0) {
            renderData.line = 'OOCL'
          }
        }
        renderData.user_name = commonUser.user_name
        renderData.user_phone = commonUser.user_phone
        renderData.user_email = commonUser.user_email

        renderData.containers = []
        let seq = 1
        for(let s of mergeCon[key]) {
          let con = await tb_container.findOne({
            where: {
              invoice_containers_id: s.overdue_invoice_containers_invoice_containers_id
            }
          })
          let con_size_type = await tb_container_size.findOne({
            attributes: ['container_size_code', 'container_size_name'],
            where: {
              state : GLBConfig.ENABLE,
              [Op.or]: [{ container_size_code: con.invoice_containers_size }, { container_size_name: con.invoice_containers_size }]
            }
          })
          renderData.containers.push({
            seq: seq,
            containerNo: con.invoice_containers_no,
            sizeTYpe: con_size_type.container_size_name
          })
          seq++
          con.invoice_containers_depot_name = depot.edi_depot_name
          con.save()
        }
        let html = await common.ejs2Html('StoringOrder.ejs', renderData)
        let mailSubject = customer.user_name + '/' + bl.invoice_masterbi_bl
        let mailContent = ''
        let mailHtml = html
        let attachments = []
        await mailer.sendEdiMail(GLBConfig.STORING_ORDER_EMAIL_SENDER, depot.edi_depot_storing_order_email, GLBConfig.STORING_ORDER_CARBON_COPY, GLBConfig.STORING_ORDER_BLIND_CARBON_COPY, mailSubject, mailContent, mailHtml, attachments)
      }
    }
    return common.success()
  } else {
    return common.error('equipment_03')
  }
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