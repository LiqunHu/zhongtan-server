const _ = require('lodash')
const moment = require('moment')
const fs = require('fs')
const convert = require('xml-js')
const { Parser } = require('json2csv')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const Op = model.Op

const tb_user = model.common_user
const tb_ship = model.zhongtan_import_ship
const tb_billlading = model.zhongtan_import_billlading
const tb_billlading_goods = model.zhongtan_import_billlading_goods
const tb_billlading_charges = model.zhongtan_import_billlading_charges
const tb_billlading_sumcharges = model.zhongtan_import_billlading_sumcharges
const tb_billlading_container = model.zhongtan_import_billlading_container
const tb_shipinfo = model.zhongtan_import_shipinfo
const tb_packaging = model.zhongtan_packaging


exports.initAct = async () => {
  let returnData = {
    TFINFO: GLBConfig.TFINFO
  }

  let ships = await tb_shipinfo.findAll({
    where: {
      state: GLBConfig.ENABLE
    }
  })

  returnData.SHIPSINFO = []
  for (let s of ships) {
    returnData.SHIPSINFO.push({
      id: s.import_shipinfo_vessel_code,
      text: s.import_shipinfo_vessel_name
    })
  }

  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  logger.info(doc)

  let queryStr = `select * from tbl_zhongtan_import_billlading 
                    where state = '1'`
  let replacements = []

  if (doc.vessel) {
    queryStr += ' and import_billlading_vessel_code = ?'
    replacements.push(doc.vessel)
  }

  if (doc.voyage) {
    queryStr += ' and import_billlading_voyage = ?'
    replacements.push(doc.voyage)
  }

  if (doc.bl) {
    queryStr += ' and import_billlading_no = ?'
    replacements.push(doc.bl)
  }

  if (doc.customer) {
    queryStr += ' and import_billlading_customer_id = ?'
    replacements.push(doc.customer)
  }

  if (doc.start_date) {
    queryStr += ' and created_at >= ? and created_at <= ?'
    replacements.push(doc.start_date)
    replacements.push(
      moment(doc.end_date, 'YYYY-MM-DD')
        .add(1, 'days')
        .format('YYYY-MM-DD')
    )
  }

  queryStr += ' order by created_at desc'

  let result = await model.queryWithCount(doc, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = []

  for (let bl of result.data) {
    let d = JSON.parse(JSON.stringify(bl))

    if (d.import_billlading_customer_id) {
      let customer = await tb_user.findOne({
        where: {
          user_id: d.import_billlading_customer_id
        }
      })

      d.customerINFO = {
        name: customer.user_name,
        address: customer.user_address,
        email: customer.user_email,
        phone: customer.user_phone
      }
    } else {
      d.customerINFO = {}
    }

    let goods = await tb_billlading_goods.findAll({
      where: {
        import_billlading_id: d.import_billlading_id
      }
    })
    if (goods) {
      d.goods = JSON.parse(JSON.stringify(goods))
    } else {
      d.goods = []
    }

    let charges = await tb_billlading_charges.findAll({
      where: {
        import_billlading_id: d.import_billlading_id
      }
    })
    if (charges) {
      d.charges = JSON.parse(JSON.stringify(charges))
    } else {
      d.charges = []
    }

    let sumcharges = await tb_billlading_sumcharges.findAll({
      where: {
        import_billlading_id: d.import_billlading_id
      }
    })
    if (sumcharges) {
      d.sumcharges = JSON.parse(JSON.stringify(sumcharges))
    } else {
      d.sumcharges = []
    }

    let container = await tb_billlading_container.findAll({
      where: {
        import_billlading_id: d.import_billlading_id
      }
    })
    if (container) {
      d.container = JSON.parse(JSON.stringify(container))
    } else {
      d.container = []
    }

    let cary = d.import_billlading_consignee.split('<br/>')
    d.ca0 = cary.length > 0 ? cary[0].replace(/\r\n/g, '') : ''

    returnData.rows.push(d)
  }

  return common.success(returnData)
}

const formatInfo = (info, key) => {
  let outary = []
  if (_.isArray(info)) {
    for (let i of info) outary.push(common.df(i[key]))
  } else {
    outary.push(common.df(info[key]))
  }
  return outary.join('<br/>')
}

exports.uploadImportAct = async req => {
  let doc = common.docValidate(req)

  for (let f of doc.upload_files) {
    // var parser = new xml2js.Parser();
    const data = fs.readFileSync(f.response.info.path, 'utf8')
    // console.log(data)
    const xmldata = convert.xml2js(data, { compact: true, spaces: 4 })

    let ship = await tb_ship.findOne({
      where: {
        import_ship_srv_main: xmldata.DATA_DS.P_SVC_MAIN._text,
        import_ship_vessel_main: xmldata.DATA_DS.P_VSL_MAIN._text,
        import_ship_voyage_main: xmldata.DATA_DS.P_VOY_MAIN._text
      }
    })

    let shipinfo = await tb_shipinfo.findOne({
      where: {
        import_shipinfo_vessel_code: xmldata.DATA_DS.P_VSL_MAIN._text
      }
    })

    if (ship) {
      return common.error('import_01')
    } else {
      ship = await tb_ship.create({
        import_ship_srv_main: xmldata.DATA_DS.P_SVC_MAIN._text,
        import_ship_vessel_main: xmldata.DATA_DS.P_VSL_MAIN._text,
        import_ship_voyage_main: xmldata.DATA_DS.P_VOY_MAIN._text
      })

      for (let a of xmldata.DATA_DS.G_DATA) {
        let blarray = []
        if (_.isArray(a.G_DATAA.G_BL_NUMBER)) {
          blarray = a.G_DATAA.G_BL_NUMBER
        } else {
          blarray.push(a.G_DATAA.G_BL_NUMBER)
        }

        if (!shipinfo) {
          shipinfo = await tb_shipinfo.create({
            import_shipinfo_vessel_code: a.G_DATAA.VSL_CDE._text,
            import_shipinfo_vessel_name: a.G_DATAA.VSL_NME._text
          })
        }

        for (let gbl of blarray) {
          let bl = await tb_billlading.create({
            import_billlading_arrive_date: doc.arrive_date,
            import_billlading_srv_code: a.G_DATAA.SVC_CDE._text,
            import_billlading_srv_name: a.G_DATAA.SVC_NME._text,
            import_billlading_vessel_code: a.G_DATAA.VSL_CDE._text,
            import_billlading_vessel_name: a.G_DATAA.VSL_NME._text,
            import_billlading_voyage: a.G_DATAA.VOYAGE._text,
            import_billlading_por: a.G_DATAA.POR._text,
            import_billlading_pod: a.G_DATAA.POD._text,
            import_billlading_pol: a.G_DATAA.POL._text,
            import_billlading_fnd: a.G_DATAA.FND._text,
            import_billlading_flag: a.G_DATAA.FLAG._text,
            import_billlading_no: gbl.BLNUMBER._text,
            import_billlading_cso_no: common.df(gbl.CSO_NO),
            import_billlading_cso_no1: common.df(gbl.CSO_NO1),
            import_billlading_shipper: formatInfo(gbl.G_DETAILS.G_SHIPPER, 'SHIPPER'),
            import_billlading_consignee: formatInfo(gbl.G_DETAILS.G_CONSIGNEE, 'CONSIGNEE'),
            import_billlading_notify_party: formatInfo(gbl.G_DETAILS.G_NOTIFY_PARTY, 'NOTIFY_PARTY'),
            import_billlading_also_notify_party: common.df(gbl.G_DETAILS.ALSO_NOTIFY_PARTY),
            import_billlading_ocean_freight_rate: common.df(gbl.G_DETAILS.G_DATAC.V_RATE),
            import_billlading_ocean_freight_pc: common.df(gbl.G_DETAILS.G_DATAC.V_PC_INDICATOR),
            import_billlading_ocean_freight_ttl_ame: common.df(gbl.G_DETAILS.G_DATAC.V_TTL_AME),
            import_billlading_ocean_freight_currency: common.df(gbl.G_DETAILS.G_DATAC.V_CURRENCY),
            import_billlading_ocean_freight_pay_loc: common.df(gbl.G_DETAILS.G_DATAC.V_PYMT_LOC),
            import_billlading_total_packno: common.df(gbl.G_DETAILS.G_DATAF.PACKNO),
            import_billlading_total_unit: common.df(gbl.G_DETAILS.G_DATAF.BLTOTALUNIT),
            import_billlading_total_gross_weight_kg: common.df(gbl.G_DETAILS.G_DATAF.V_TXTMGROSSWT),
            import_billlading_total_gross_weight_lb: common.df(gbl.G_DETAILS.G_DATAF.V_TXTBGROSSWT),
            import_billlading_total_volume_cbm: common.df(gbl.G_DETAILS.G_DATAF.V_TXTMVOLUME),
            import_billlading_total_volume_cft: common.df(gbl.G_DETAILS.G_DATAF.V_TXTBVOLUME),
            import_billlading_remark: formatInfo(gbl.G_DETAILS.G_DATAH, 'BL_REMARKS')
          })

          if (_.isArray(gbl.G_DETAILS.G_DATAB)) {
            for (let g of gbl.G_DETAILS.G_DATAB) {
              await tb_billlading_goods.create({
                import_billlading_id: bl.import_billlading_id,
                import_billlading_goods_description: common.df(g.DESCRIPTION),
                import_billlading_goods_package_number: common.df(g.IQTY),
                import_billlading_goods_package_unit: common.df(g.PACKUNIT),
                import_billlading_goods_gross_weight_kg: common.df(g.V_DBLMGROSSWT),
                import_billlading_goods_gross_weight_lb: common.df(g.V_DBLBGROSSWT),
                import_billlading_goods_volume_cbm: common.df(g.V_DBLMVOLUME),
                import_billlading_goods_volume_cft: common.df(g.V_DBLBVOLUME),
                import_billlading_goods_marks_num: common.df(g.MARKS_NUM)
              })
            }
          } else {
            await tb_billlading_goods.create({
              import_billlading_id: bl.import_billlading_id,
              import_billlading_goods_description: common.df(gbl.G_DETAILS.G_DATAB.DESCRIPTION),
              import_billlading_goods_package_number: common.df(gbl.G_DETAILS.G_DATAB.IQTY),
              import_billlading_goods_package_unit: common.df(gbl.G_DETAILS.G_DATAB.PACKUNIT),
              import_billlading_goods_gross_weight_kg: common.df(gbl.G_DETAILS.G_DATAB.V_DBLMGROSSWT),
              import_billlading_goods_gross_weight_lb: common.df(gbl.G_DETAILS.G_DATAB.V_DBLBGROSSWT),
              import_billlading_goods_volume_cbm: common.df(gbl.G_DETAILS.G_DATAB.V_DBLMVOLUME),
              import_billlading_goods_volume_cft: common.df(gbl.G_DETAILS.G_DATAB.V_DBLBVOLUME),
              import_billlading_goods_marks_num: common.df(gbl.G_DETAILS.G_DATAB.MARKS_NUM)
            })
          }

          if (_.isArray(gbl.G_DETAILS.G_DATAD)) {
            for (let d of gbl.G_DETAILS.G_DATAD) {
              await tb_billlading_charges.create({
                import_billlading_id: bl.import_billlading_id,
                import_billlading_charges_type: common.df(d.ROWSURCHARGES_CHRG_TYPE),
                import_billlading_charges_description: common.df(d.ROWSURCHARGES_DESCRIPTION),
                import_billlading_charges_basis: common.df(d.ROWSURCHARGES_BASIS),
                import_billlading_charges_rate: common.df(d.ROWSURCHARGES_RATE),
                import_billlading_charges_pc: common.df(d.ROWSURCHARGES_PC_INDICATOR),
                import_billlading_charges_ttl_ame: common.df(d.ROWSURCHARGES_TTL_AMT),
                import_billlading_charges_pay_loc: common.df(d.ROWSURCHARGES_PYMT_LOC),
                import_billlading_charges_currency: common.df(d.ROWSURCHARGES_CURRENCY)
              })
            }
          } else {
            if (gbl.G_DETAILS.G_DATAD) {
              await tb_billlading_charges.create({
                import_billlading_id: bl.import_billlading_id,
                import_billlading_charges_type: common.df(gbl.G_DETAILS.G_DATAD.ROWSURCHARGES_CHRG_TYPE),
                import_billlading_charges_description: common.df(gbl.G_DETAILS.G_DATAD.ROWSURCHARGES_DESCRIPTION),
                import_billlading_charges_basis: common.df(gbl.G_DETAILS.G_DATAD.ROWSURCHARGES_BASIS),
                import_billlading_charges_rate: common.df(gbl.G_DETAILS.G_DATAD.ROWSURCHARGES_RATE),
                import_billlading_charges_pc: common.df(gbl.G_DETAILS.G_DATAD.ROWSURCHARGES_PC_INDICATOR),
                import_billlading_charges_ttl_ame: common.df(gbl.G_DETAILS.G_DATAD.ROWSURCHARGES_TTL_AMT),
                import_billlading_charges_pay_loc: common.df(gbl.G_DETAILS.G_DATAD.ROWSURCHARGES_PYMT_LOC),
                import_billlading_charges_currency: common.df(gbl.G_DETAILS.G_DATAD.ROWSURCHARGES_CURRENCY)
              })
            }
          }

          if (_.isArray(gbl.G_DETAILS.G_DATAG)) {
            for (let g of gbl.G_DETAILS.G_DATAG) {
              await tb_billlading_sumcharges.create({
                import_billlading_id: bl.import_billlading_id,
                import_billlading_sumcharges_pc: common.df(g.V_TXTPCINDICATOR),
                import_billlading_sumcharges_currency: common.df(g.V_TXTCURRENCY),
                import_billlading_sumcharges_amt: common.df(g.V_TXTTTL_AMT)
              })
            }
          } else {
            await tb_billlading_sumcharges.create({
              import_billlading_id: bl.import_billlading_id,
              import_billlading_sumcharges_pc: common.df(gbl.G_DETAILS.G_DATAG.V_TXTPCINDICATOR),
              import_billlading_sumcharges_currency: common.df(gbl.G_DETAILS.G_DATAG.V_TXTCURRENCY),
              import_billlading_sumcharges_amt: common.df(gbl.G_DETAILS.G_DATAG.V_TXTTTL_AMT)
            })
          }

          if (_.isArray(gbl.G_DETAILS.G_DATAI)) {
            for (let i of gbl.G_DETAILS.G_DATAI) {
              await tb_billlading_container.create({
                import_billlading_id: bl.import_billlading_id,
                import_billlading_container_num: common.df(i.SCONTAINER_NUM),
                import_billlading_container_seal: common.df(i.SSEAL_ID),
                import_billlading_container_type: common.df(i.SCNTR_TYPE),
                import_billlading_container_package_cnt: common.df(i.NPIECE_CNT),
                import_billlading_container_cnt_unit: common.df(i.SPIECE_CNT_UNIT),
                import_billlading_container_traffic_mode: common.df(i.TRAFFICMODE),
                import_billlading_container_weight: common.df(i.CGO_WT),
                import_billlading_container_tare_weight: common.df(i.NCONVERTED_TARE_WT)
              })
            }
          } else {
            let i = gbl.G_DETAILS.G_DATAI
            await tb_billlading_container.create({
              import_billlading_id: bl.import_billlading_id,
              import_billlading_container_num: common.df(i.SCONTAINER_NUM),
              import_billlading_container_seal: common.df(i.SSEAL_ID),
              import_billlading_container_type: common.df(i.SCNTR_TYPE),
              import_billlading_container_package_cnt: common.df(i.NPIECE_CNT),
              import_billlading_container_cnt_unit: common.df(i.SPIECE_CNT_UNIT),
              import_billlading_container_traffic_mode: common.df(i.TRAFFICMODE),
              import_billlading_container_weight: common.df(i.CGO_WT),
              import_billlading_container_tare_weight: common.df(i.NCONVERTED_TARE_WT)
            })
          }
        }
      }
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
        text: s.user_name,
        name: s.user_name,
        address: s.user_address,
        phone: s.user_phone
      })
    }
    return common.success(returnData)
  } else {
    return common.success()
  }
}

exports.assignCustomerAct = async req => {
  let doc = common.docValidate(req)

  for (let bl of doc.bls) {
    let b = await await tb_billlading.findOne({
      where: {
        import_billlading_id: bl
      }
    })

    b.import_billlading_customer_id = doc.customer_id
    await b.save()
  }

  return common.success()
}

exports.exportMBLAct = async (req, res) => {
  let doc = common.docValidate(req)

  let queryStr = `select * from tbl_zhongtan_import_billlading 
                    where state = '1'`
  let replacements = []

  if (doc.vessel) {
    queryStr += ' and import_billlading_vessel_code = ?'
    replacements.push(doc.vessel)
  }

  if (doc.voyage) {
    queryStr += ' and import_billlading_voyage = ?'
    replacements.push(doc.voyage)
  }

  if (doc.bl) {
    queryStr += ' and import_billlading_no = ?'
    replacements.push(doc.bl)
  }

  if (doc.customer) {
    queryStr += ' and import_billlading_customer_id = ?'
    replacements.push(doc.customer)
  }

  if (doc.start_date) {
    queryStr += ' and created_at >= ? and created_at <= ?'
    replacements.push(doc.start_date)
    replacements.push(
      moment(doc.end_date, 'YYYY-MM-DD')
        .add(1, 'days')
        .format('YYYY-MM-DD')
    )
  }

  queryStr += ' order by import_billlading_no'

  let result = await model.simpleSelect(queryStr, replacements)

  let jsData = []
  for (let r of result) {
    let row = JSON.parse(JSON.stringify(r))
    row.IM = 'IM'
    row.S = 'S'
    row.PK = 'PK'
    row.KG = 'KG'
    row.CBM = 'CBM'
    row.SB = ''
    let sary = row.import_billlading_shipper.split('<br/>')
    row.sa0 = sary.length > 0 ? sary[0].replace(/\r\n/g, '') : ''
    row.sa1 =
      sary.length > 1
        ? _.takeRight(sary, sary.length - 1)
            .join(' ')
            .replace(/\r\n/g, '')
        : ''
    let cary = row.import_billlading_consignee.split('<br/>')
    row.ca0 = cary.length > 0 ? cary[0].replace(/\r\n/g, '') : ''
    row.ca1 =
      cary.length > 1
        ? _.takeRight(cary, cary.length - 1)
            .join(' ')
            .replace(/\r\n/g, '')
        : ''
    let nary = row.import_billlading_notify_party.split('<br/>')
    row.na0 = nary.length > 0 ? nary[0].replace(/\r\n/g, '') : ''
    row.na1 =
      nary.length > 1
        ? _.takeRight(nary, nary.length - 1)
            .join(' ')
            .replace(/\r\n/g, '')
        : ''
    row.C = 'C'
    row.P = row.import_billlading_remark.search(/PREPAID/i) > 0 ? 'PREPAID' : ''

    let container = await tb_billlading_container.findAll({
      where: {
        import_billlading_id: row.import_billlading_id
      }
    })
    row.CCOUNT = container.length

    let goods = await tb_billlading_goods.findAll({
      where: {
        import_billlading_id: row.import_billlading_id
      }
    })

    let dary = []
    let rmary = []
    for (let g of goods) {
      dary.push(g.import_billlading_goods_description)
      rmary.push(g.import_billlading_goods_marks_num)
    }

    row.GDESC = dary.join(' ').replace(/\r\n/g, '')
    row.GRMARK = rmary.join(' ').replace(/\r\n/g, '')

    // import_billlading_pod import_billlading_fnd import_billlading_pol转换
    if(row.import_billlading_pod) {
      let import_billlading_pod_temp = row.import_billlading_pod.replace(/[^a-zA-Z]/gi, '')
      if(import_billlading_pod_temp.toUpperCase() === 'DARESSALAAM') {
        row.import_billlading_pod = 'TZDAR'
      }
    }
    if(row.import_billlading_fnd) {
      let import_billlading_fnd_temp = row.import_billlading_fnd.replace(/[^a-zA-Z]/gi, '')
      if(import_billlading_fnd_temp.toUpperCase() === 'DARESSALAAM') {
        row.import_billlading_fnd = 'TZDAR'
      }
    }
    if(row.import_billlading_pol) {
      let import_billlading_pol_temp = row.import_billlading_pol.replace(/[^a-zA-Z]/gi, '')
      if(import_billlading_pol_temp.toUpperCase() === 'SINGAPORE') {
        row.import_billlading_pol = 'SGSIN'
      }
    }
    if(row.import_billlading_total_unit) {
      let packing = await tb_packaging.findOne({
        where:{
          state : GLBConfig.ENABLE,
          [Op.or]: [{ packaging_kind: row.import_billlading_total_unit }, { packaging_kind_ak: row.import_billlading_total_unit }, { packaging_code: row.import_billlading_total_unit }]
        }
      })
      if(packing && packing.packaging_code) {
        row.import_billlading_total_unit = packing.packaging_code
      }
    }
    jsData.push(row)
  }

  const fields = [
    'import_billlading_no',
    'IM',
    'S',
    'import_billlading_pod',
    'import_billlading_fnd',
    'import_billlading_fnd',
    'import_billlading_pol',
    'CCOUNT',
    'GDESC',
    'import_billlading_total_packno',
    'import_billlading_total_unit',
    'import_billlading_total_gross_weight_kg',
    'KG',
    'import_billlading_total_volume_cbm',
    'CBM',
    'SB',
    'sa0',
    'sa1',
    'ca0',
    'ca1',
    'SB',
    'na0',
    'na1',
    'SB',
    'C',
    'import_billlading_por',
    'GRMARK',
    'P'
  ]
  const opts = { fields, header: false }

  const parser = new Parser(opts)
  const csv = parser.parse(jsData)

  res.type('csv')
  res.set({
    'Content-Disposition': 'attachment; filename=MBL_UPLOAD.csv'
  })
  res.send(csv)
}

exports.exportCBLAct = async (req, res) => {
  let doc = common.docValidate(req)

  let queryStr = `select * from tbl_zhongtan_import_billlading 
                    where state = '1'`
  let replacements = []

  if (doc.vessel) {
    queryStr += ' and import_billlading_vessel_code = ?'
    replacements.push(doc.vessel)
  }

  if (doc.voyage) {
    queryStr += ' and import_billlading_voyage = ?'
    replacements.push(doc.voyage)
  }

  if (doc.bl) {
    queryStr += ' and import_billlading_no = ?'
    replacements.push(doc.bl)
  }

  if (doc.customer) {
    queryStr += ' and import_billlading_customer_id = ?'
    replacements.push(doc.customer)
  }

  if (doc.start_date) {
    queryStr += ' and created_at >= ? and created_at <= ?'
    replacements.push(doc.start_date)
    replacements.push(
      moment(doc.end_date, 'YYYY-MM-DD')
        .add(1, 'days')
        .format('YYYY-MM-DD')
    )
  }

  queryStr += ' order by import_billlading_no'

  let result = await model.simpleSelect(queryStr, replacements)

  let jsData = []
  for (let r of result) {
    let container = await tb_billlading_container.findAll({
      where: {
        import_billlading_id: r.import_billlading_id
      },
      order: [['import_billlading_container_num', 'ASC']]
    })
    for (let c of container) {
      let row = JSON.parse(JSON.stringify(c))
      row.import_billlading_no = r.import_billlading_no
      row.C = 'C'
      jsData.push(row)
      row.SB = ''
      row.FUL = 'FUL'
      row.PK = 'PK'
      row.CBM = 'CBM'
      row.KG = 'KG'
      row.N = 'N'
    }
  }

  const fields = [
    'import_billlading_no',
    'C',
    'import_billlading_container_num',
    'import_billlading_container_type',
    'import_billlading_container_seal',
    'SB',
    'SB',
    'FUL',
    'import_billlading_container_package_cnt',
    'import_billlading_container_cnt_unit',
    'import_billlading_container_tare_weight',
    'CBM',
    'import_billlading_container_weight',
    'KG',
    'N'
  ]
  const opts = { fields, header: false }

  const parser = new Parser(opts)
  const csv = parser.parse(jsData)

  res.type('csv')
  res.set({
    'Content-Disposition': 'attachment; filename=MBL_UPLOAD.csv'
  })
  res.send(csv)
}

exports.downloadBLAct = async (req, res) => {
  let doc = common.docValidate(req)
  let bl = await tb_billlading.findOne({
    where: {
      import_billlading_id: doc.import_billlading_id
    }
  })
  bl.import_billlading_customer_id = doc.import_billlading_customer_id
  bl.import_billlading_bl_date = doc.bl_date
  await bl.save()

  return common.ejs2Word('importTemplate.docx', doc, res)
}

exports.releasedAct = async req => {
  let doc = common.docValidate(req)
  let bl = await tb_billlading.findOne({
    where: {
      import_billlading_id: doc.import_billlading_id
    }
  })
  if (bl) {
    bl.import_billlading_released_flag = '1'
    await bl.save()
  }
  return common.success()
}

exports.uploadAct = async req => {
  let fileInfo = await common.fileSaveTemp(req)
  return common.success(fileInfo)
}
