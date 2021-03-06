const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')

const tb_billlading = model.zhongtan_billlading
const tb_billlading_goods = model.zhongtan_billlading_goods
const tb_bltemplate = model.zhongtan_billlading_template
const tb_container = model.zhongtan_container
const tb_vessel = model.zhongtan_vessel
const tb_voyage = model.zhongtan_voyage
const tb_port = model.zhongtan_port
const tb_uploadfile = model.zhongtan_uploadfile

exports.initAct = async () => {
  let returnData = {
    PackageUnitINFO: GLBConfig.PackageUnitINFO,
    VolumeUnitINFO: GLBConfig.VolumeUnitINFO,
    WeightUnitINFO: GLBConfig.WeightUnitINFO,
    ContainerSizeINFO: GLBConfig.ContainerSizeINFO,
    ContainerTypeINFO: GLBConfig.ContainerTypeINFO,
    PayTypeINFO: GLBConfig.PayTypeINFO,
    PayCurrencyINFO: GLBConfig.PayCurrencyINFO,
    BLSTATUSINFO: GLBConfig.BLSTATUSINFO,
    YNINFO: GLBConfig.YNINFO,
    VesselINFO: [],
    PortINFO: []
  }

  let Vessels = await tb_vessel.findAll({
    where: {
      state: GLBConfig.ENABLE
    }
  })

  for (let v of Vessels) {
    returnData.VesselINFO.push({
      id: v.vessel_id,
      text: v.vessel_name
    })
  }

  let ports = await tb_port.findAll({
    where: {
      state: GLBConfig.ENABLE
    }
  })

  for (let p of ports) {
    returnData.PortINFO.push({
      id: p.port_id,
      text: p.port_name + ' - ' + p.port_code
    })
  }
  logger.debug(returnData)
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user
  let returnData = {}

  if (user.user_type != GLBConfig.TYPE_CUSTOMER) {
    return common.error('booking_01')
  }

  let queryStr = `select * from tbl_zhongtan_billlading
                    where state = '1'
                    and billlading_customer_id = ?`
  let replacements = [user.user_id]

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

    d.VoyageINFO = []

    let voyages = await tb_voyage.findAll({
      where: {
        vessel_id: d.billlading_vessel_id,
        state: GLBConfig.ENABLE
      },
      limit: 10,
      order: [['voyage_eta_date', 'DESC']]
    })
    for (let v of voyages) {
      d.VoyageINFO.push({
        id: v.voyage_id,
        text: v.voyage_number + ' - ' + moment(v.voyage_eta_date, 'YYYY-MM-DD').format('MM-DD')
      })
    }

    d.booking_date = moment(bl.created_at).format('YYYY-MM-DD')

    d.billlading_goods = []
    let billlading_goods = await tb_billlading_goods.findAll({
      where: { billlading_id: d.billlading_id }
    })
    for (let g of billlading_goods) {
      d.billlading_goods.push(JSON.parse(JSON.stringify(g)))
    }

    d.billlading_containers = []
    let billlading_containers = await tb_container.findAll({
      where: { billlading_id: d.billlading_id, state: GLBConfig.ENABLE }
    })
    for (let c of billlading_containers) {
      d.billlading_containers.push(JSON.parse(JSON.stringify(c)))
    }

    d.files = []
    let files = await tb_uploadfile.findAll({
      where: {
        uploadfile_index1: d.billlading_id
      },
      order: [['created_at', 'DESC']]
    })
    for (let f of files) {
      let filetype = ''
      if (f.api_name === 'BOOKING-TICTS-LOADINGLIST') {
        filetype = 'TICTS Loading list'
      } else if (f.api_name === 'BOOKING-TPA-LOADINGLIST') {
        filetype = 'TPA Loading list'
      } else if (f.api_name === 'BOOKING-CUSTOMS-LOADINGLIST') {
        filetype = 'CUSTOMS Loading list'
      } else if (f.api_name === 'BOOKING-LOADINGPERMISSION') {
        filetype = 'Loading Permisssion'
      } else if (f.api_name === 'BOOKING-SHIPPINGINSTRUCTION') {
        filetype = 'Shipping Instruction'
      } else if (f.api_name === 'BOOKING-BL-DRAFT') {
        filetype = 'Billlading Draft'
      } else if (f.api_name === 'BOOKING-INVOICE') {
        filetype = 'Invoice'
      } else if (f.api_name === 'BOOKING-RECEIPT') {
        filetype = 'Receipt'
      }

      d.files.push({
        filetype: filetype,
        date: moment(f.created_at).format('YYYY-MM-DD'),
        file_id: f.uploadfile_id,
        url: f.uploadfile_url,
        name: f.uploadfile_name,
        remark: f.uploadfile_remark
      })
    }

    d.fees = {}
    d.fees.billlading_invoice_freight = common.money2Str(d.billlading_invoice_freight)
    d.fees.billlading_invoice_blanding = common.money2Str(d.billlading_invoice_blanding)
    d.fees.billlading_invoice_tasac = common.money2Str(d.billlading_invoice_tasac)
    d.fees.billlading_invoice_ammendment = common.money2Str(d.billlading_invoice_ammendment)
    d.fees.billlading_invoice_isp = common.money2Str(d.billlading_invoice_isp)
    d.fees.billlading_invoice_surchage = common.money2Str(d.billlading_invoice_surchage)
    d.fees.billlading_invoice_of = common.money2Str(d.billlading_invoice_of)
    d.fees.billlading_invoice_others = common.money2Str(d.billlading_invoice_others)
    d.fees.sum_fee = common.money2Str(
      d.billlading_invoice_freight +
        d.billlading_invoice_blanding +
        d.billlading_invoice_tasac +
        d.billlading_invoice_ammendment +
        d.billlading_invoice_isp +
        d.billlading_invoice_surchage +
        d.billlading_invoice_of +
        d.billlading_invoice_others
    )

    d.billlading_invoice_freight = common.money2Str(d.billlading_invoice_freight)
    d.billlading_invoice_blanding = common.money2Str(d.billlading_invoice_blanding)
    d.billlading_invoice_tasac = common.money2Str(d.billlading_invoice_tasac)
    d.billlading_invoice_ammendment = common.money2Str(d.billlading_invoice_ammendment)
    d.billlading_invoice_isp = common.money2Str(d.billlading_invoice_isp)
    d.billlading_invoice_surchage = common.money2Str(d.billlading_invoice_surchage)
    d.billlading_invoice_of = common.money2Str(d.billlading_invoice_of)
    d.billlading_invoice_others = common.money2Str(d.billlading_invoice_others)

    returnData.rows.push(d)
  }

  return common.success(returnData)
}

exports.bookingAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  if (user.user_type != GLBConfig.TYPE_CUSTOMER) {
    return common.error('booking_01')
  }

  let vessel = await tb_vessel.findOne({
    where: {
      vessel_id: doc.billlading_vessel_id
    }
  })
  let billlading_service_name = ''
  if (vessel) {
    billlading_service_name = vessel.vessel_service_name
  }

  let billlading = await tb_billlading.create({
    billlading_type: 'E',
    billlading_state: GLBConfig.BLSTATUS_PRE_BOOKING,
    billlading_service_name: billlading_service_name,
    billlading_vessel_id: doc.billlading_vessel_id || null,
    billlading_voyage_id: doc.billlading_voyage_id || null,
    billlading_customer_id: user.user_id,
    billlading_shipper_name: doc.billlading_shipper_name,
    billlading_shipper_tel: doc.billlading_shipper_tel,
    billlading_shipper_address: doc.billlading_shipper_address,
    billlading_consignee_name: doc.billlading_consignee_name,
    billlading_consignee_tel: doc.billlading_consignee_tel,
    billlading_consignee_address: doc.billlading_consignee_address,
    billlading_notify_name: doc.billlading_notify_name,
    billlading_notify_tel: doc.billlading_notify_tel,
    billlading_notify_address: doc.billlading_notify_address,
    billlading_original_num: doc.billlading_original_num,
    billlading_copys_num: doc.billlading_copys_num,
    billlading_loading_port_id: doc.billlading_loading_port_id,
    billlading_discharge_port_id: doc.billlading_discharge_port_id,
    billlading_delivery_place: doc.billlading_delivery_place,
    billlading_stuffing_place: doc.billlading_stuffing_place,
    billlading_stuffing_date: doc.billlading_stuffing_date || null,
    billlading_stuffing_requirement: doc.billlading_stuffing_requirement,
    billlading_forwarder_name: doc.billlading_forwarder_name,
    billlading_pay_date: doc.billlading_pay_date || null,
    billlading_freight_currency: doc.billlading_freight_currency
  })

  for (let c of doc.billlading_goods) {
    await tb_billlading_goods.create({
      billlading_id: billlading.billlading_id,
      billlading_goods_container_number: c.billlading_goods_container_number || 0,
      billlading_goods_container_size: c.billlading_goods_container_size,
      billlading_goods_container_type: c.billlading_goods_container_type,
      billlading_goods_type: c.billlading_goods_type,
      billlading_goods_description: c.billlading_goods_description || '',
      billlading_goods_package_number: c.billlading_goods_package_number || 0,
      billlading_goods_package_unit: c.billlading_goods_package_unit,
      billlading_goods_gross_weight: c.billlading_goods_gross_weight || 0,
      billlading_goods_gross_unit: c.billlading_goods_gross_unit,
      billlading_goods_gross_volume: c.billlading_goods_gross_volume || 0,
      billlading_goods_gross_volume_unit: c.billlading_goods_gross_volume_unit,
      billlading_goods_net_weight: c.billlading_goods_net_weight || 0,
      billlading_goods_net_unit: c.billlading_goods_net_unit
    })
  }

  return common.success()
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  let modibilllading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.old.billlading_id,
      billlading_customer_id: user.user_id,
      state: GLBConfig.ENABLE
    }
  })
  if (modibilllading) {
    let vessel = await tb_vessel.findOne({
      where: {
        vessel_id: doc.new.billlading_vessel_id
      }
    })

    modibilllading.billlading_service_name = vessel.vessel_service_name
    modibilllading.billlading_vessel_id = doc.new.billlading_vessel_id
    modibilllading.billlading_voyage_id = doc.new.billlading_voyage_id
    modibilllading.billlading_shipper_name = doc.new.billlading_shipper_name
    modibilllading.billlading_shipper_address = doc.new.billlading_shipper_address
    modibilllading.billlading_shipper_tel = doc.new.billlading_shipper_tel
    modibilllading.billlading_consignee_name = doc.new.billlading_consignee_name
    modibilllading.billlading_consignee_address = doc.new.billlading_consignee_address
    modibilllading.billlading_consignee_tel = doc.new.billlading_consignee_tel
    modibilllading.billlading_notify_name = doc.new.billlading_notify_name
    modibilllading.billlading_notify_address = doc.new.billlading_notify_address
    modibilllading.billlading_notify_tel = doc.new.billlading_notify_tel
    modibilllading.billlading_original_num = doc.new.billlading_original_num
    modibilllading.billlading_copys_num = doc.new.billlading_copys_num
    modibilllading.billlading_loading_port_id = doc.new.billlading_loading_port_id
    modibilllading.billlading_discharge_port_id = doc.new.billlading_discharge_port_id
    modibilllading.billlading_stuffing_place = doc.new.billlading_stuffing_place
    modibilllading.billlading_stuffing_date = doc.new.billlading_stuffing_date || null
    modibilllading.billlading_stuffing_requirement = doc.new.billlading_stuffing_requirement
    modibilllading.billlading_pay_date = doc.new.billlading_pay_date || null
    modibilllading.billlading_forwarder_name = doc.new.billlading_forwarder_name
    modibilllading.billlading_freight_currency = doc.new.billlading_freight_currency

    await modibilllading.save()
    let billlading_goods = await tb_billlading_goods.findAll({
      where: { billlading_id: doc.new.billlading_id }
    })
    let oldGoods = []
    for (let g of billlading_goods) {
      oldGoods.push(g.billlading_goods_id)
    }
    let newGoods = []
    for (let g of doc.new.billlading_goods) {
      if (g.billlading_goods_id) {
        let mgood = await tb_billlading_goods.findOne({
          where: {
            billlading_goods_id: g.billlading_goods_id
          }
        })
        mgood.billlading_goods_container_number = g.billlading_goods_container_number || 0
        mgood.billlading_goods_container_size = g.billlading_goods_container_size
        mgood.billlading_goods_container_type = g.billlading_goods_container_type
        mgood.billlading_goods_type = g.billlading_goods_type
        mgood.billlading_goods_description = g.billlading_goods_description
        mgood.billlading_goods_package_number = g.billlading_goods_package_number || 0
        mgood.billlading_goods_package_unit = g.billlading_goods_package_unit
        mgood.billlading_goods_gross_weight = g.billlading_goods_gross_weight || 0
        mgood.billlading_goods_gross_unit = g.billlading_goods_gross_unit
        mgood.billlading_goods_gross_volume = g.billlading_goods_gross_volume || 0
        mgood.billlading_goods_gross_volume_unit = g.billlading_goods_gross_volume_unit
        mgood.billlading_goods_net_weight = g.billlading_goods_net_weight || 0
        mgood.billlading_goods_net_unit = g.billlading_goods_net_unit
        await mgood.save()
        newGoods.push(g.billlading_goods_id)
      } else {
        await tb_billlading_goods.create({
          billlading_id: modibilllading.billlading_id,
          billlading_goods_container_number: g.billlading_goods_container_number,
          billlading_goods_container_size: g.billlading_goods_container_size,
          billlading_goods_container_type: g.billlading_goods_container_type,
          billlading_goods_type: g.billlading_goods_type,
          billlading_goods_description: g.billlading_goods_description,
          billlading_goods_package_number: g.billlading_goods_package_number,
          billlading_goods_package_unit: g.billlading_goods_package_unit,
          billlading_goods_gross_weight: g.billlading_goods_gross_weight,
          billlading_goods_gross_unit: g.billlading_goods_gross_unit,
          billlading_goods_gross_volume: g.billlading_goods_gross_volume,
          billlading_goods_gross_volume_unit: g.billlading_goods_gross_volume_unit,
          billlading_goods_net_weight: g.billlading_goods_net_weight,
          billlading_goods_net_unit: g.billlading_goods_net_unit
        })
      }
    }

    for (let gid of oldGoods) {
      if (newGoods.indexOf(gid) < 0) {
        await tb_billlading_goods.destroy({
          where: {
            billlading_goods_id: gid
          }
        })
      }
    }

    for (let c of doc.new.billlading_containers) {
      let mContainer = await tb_container.findOne({
        where: {
          container_id: c.container_id
        }
      })
      mContainer.container_no = c.container_no
      mContainer.container_iso = c.container_iso
      mContainer.container_size = c.container_size
      mContainer.container_type = c.container_type
      mContainer.container_goods_type = c.container_goods_type
      mContainer.container_goods_description = c.container_goods_description
      mContainer.container_seal_no1 = c.container_seal_no1
      mContainer.container_freight_indicator = c.container_freight_indicator
      mContainer.container_package_no = c.container_package_no
      mContainer.container_package_unit = c.container_package_unit
      mContainer.container_volume = c.container_volume
      mContainer.container_volume_unit = c.container_volume_unit
      mContainer.container_weight = c.container_weight
      mContainer.container_weight_unit = c.container_weight_unit
      mContainer.container_minmum_temperature = c.container_minmum_temperature
      mContainer.container_maxmum_temperature = c.container_maxmum_temperature
      mContainer.container_refer_plug = c.container_refer_plug
      await mContainer.save()
    }

    return common.success()
  } else {
    return common.error('operator_03')
  }
}

exports.searchVoyageAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {
    VoyageINFO: []
  }
  let voyages = await tb_voyage.findAll({
    where: {
      vessel_id: doc.vessel_id,
      state: GLBConfig.ENABLE
    },
    limit: 10,
    order: [['voyage_eta_date', 'DESC']]
  })
  for (let v of voyages) {
    returnData.VoyageINFO.push({
      id: v.voyage_id,
      text: v.voyage_number + ' - ' + moment(v.voyage_eta_date, 'YYYY-MM-DD').format('MM-DD')
    })
  }

  return common.success(returnData)
}

exports.cancelAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      billlading_customer_id: user.user_id,
      state: GLBConfig.ENABLE
    }
  })

  if (billlading.billlading_state != GLBConfig.BLSTATUS_PRE_BOOKING) {
    return common.error('billlading_01')
  } else {
    billlading.state = GLBConfig.DISABLE
    await billlading.save()
    return common.success()
  }
}

exports.pickUpEmptyAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      billlading_customer_id: user.user_id,
      state: GLBConfig.ENABLE
    }
  })

  if (billlading.billlading_state != GLBConfig.BLSTATUS_BOOKING) {
    return common.error('billlading_01')
  } else {
    billlading.billlading_state = GLBConfig.BLSTATUS_PUTBOX_APPLY
    await billlading.save()
    return common.success()
  }
}

exports.submitloadingAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      billlading_customer_id: user.user_id,
      state: GLBConfig.ENABLE
    }
  })

  if (billlading.billlading_state != GLBConfig.BLSTATUS_PUTBOX_CONFIRM && billlading.billlading_state != GLBConfig.BLSTATUS_REJECT_LOADING) {
    return common.error('billlading_01')
  } else {
    billlading.billlading_bl_type = doc.billlading_bl_type
    billlading.billlading_hbl_no = doc.billlading_hbl_no
    billlading.billlading_reference_type = doc.billlading_reference_type
    billlading.billlading_reference_no = doc.billlading_reference_no
    await billlading.save()

    for (let c of doc.billlading_containers) {
      let mContainer = await tb_container.findOne({
        where: {
          container_id: c.container_id
        }
      })
      mContainer.container_no = c.container_no
      mContainer.container_iso = common.getContainerISO(c.container_size, c.container_type)
      mContainer.container_size = c.container_size
      mContainer.container_type = c.container_type
      mContainer.container_goods_type = c.container_goods_type
      mContainer.container_goods_description = c.container_goods_description
      mContainer.container_seal_no1 = c.container_seal_no1
      mContainer.container_freight_indicator = c.container_freight_indicator
      mContainer.container_package_no = c.container_package_no
      mContainer.container_package_unit = c.container_package_unit
      mContainer.container_volume = c.container_volume
      mContainer.container_volume_unit = c.container_volume_unit
      mContainer.container_weight = c.container_weight
      mContainer.container_weight_unit = c.container_weight_unit
      mContainer.container_minmum_temperature = c.container_minmum_temperature
      mContainer.container_maxmum_temperature = c.container_maxmum_temperature
      mContainer.container_refer_plug = c.container_refer_plug
      await mContainer.save()
    }

    billlading.billlading_state = GLBConfig.BLSTATUS_SUBMIT_LOADING

    await billlading.save()

    // let renderData = []
    // let bl = JSON.parse(JSON.stringify(billlading))
    // let lp = await tb_port.findOne({
    //   where: {
    //     port_id: bl.billlading_loading_port_id
    //   }
    // })
    // bl.loading_port_name = lp.port_name
    // let dp = await tb_port.findOne({
    //   where: {
    //     port_id: bl.billlading_discharge_port_id
    //   }
    // })
    // bl.discharge_port_name = dp.port_name
    // bl.discharge_port_country = dp.port_country
    // let goods = await tb_billlading_goods.findAll({
    //   where: {
    //     billlading_id: doc.billlading_id
    //   }
    // })

    // renderData.push([])
    // for (let g of goods) {
    //   let row = JSON.parse(JSON.stringify(bl))
    //   row.billlading_goods_container_number = g.billlading_goods_container_number
    //   row.billlading_goods_description = g.billlading_goods_description
    //   row.billlading_goods_package_number = g.billlading_goods_package_number
    //   row.billlading_goods_package_unit = g.billlading_goods_package_unit
    //   row.billlading_goods_gross_weight = g.billlading_goods_gross_weight
    //   row.billlading_goods_gross_unit = g.billlading_goods_gross_unit
    //   row.billlading_goods_gross_volume = g.billlading_goods_gross_volume
    //   row.billlading_goods_gross_volume_unit = g.billlading_goods_gross_volume_unit
    //   row.billlading_goods_net_weight = g.billlading_goods_net_weight
    //   row.billlading_goods_net_unit = g.billlading_goods_net_unit
    //   renderData[0].push(row)
    // }

    // renderData.push([])
    // let containers = await tb_container.findAll({
    //   where: {
    //     billlading_id: doc.billlading_id
    //   }
    // })

    // for (let c of containers) {
    //   let row = JSON.parse(JSON.stringify(c))
    //   row.billlading_no = billlading.billlading_no
    //   renderData[1].push(row)
    // }

    // let fileInfo = await common.ejs2xlsx('LoadingTemplateCustoms.xlsx', renderData, 'zhongtan')

    // await tb_uploadfile.create({
    //   api_name: 'BOOKING-LOADINGLIST',
    //   user_id: user.user_id,
    //   uploadfile_index1: billlading.billlading_id,
    //   uploadfile_name: fileInfo.name,
    //   uploadfile_url: fileInfo.url
    // })
    if (doc.files.ticts.url) {
      await tb_uploadfile.create({
        api_name: 'BOOKING-TICTS-LOADINGLIST',
        user_id: user.user_id,
        uploadfile_index1: billlading.billlading_id,
        uploadfile_name: doc.files.ticts.name,
        uploadfile_url: doc.files.ticts.url
      })
    }

    if (doc.files.tpa.url) {
      await tb_uploadfile.create({
        api_name: 'BOOKING-TPA-LOADINGLIST',
        user_id: user.user_id,
        uploadfile_index1: billlading.billlading_id,
        uploadfile_name: doc.files.tpa.name,
        uploadfile_url: doc.files.tpa.url
      })
    }

    if (doc.files.customs.url) {
      await tb_uploadfile.create({
        api_name: 'BOOKING-CUSTOMS-LOADINGLIST',
        user_id: user.user_id,
        uploadfile_index1: billlading.billlading_id,
        uploadfile_name: doc.files.customs.name,
        uploadfile_url: doc.files.customs.url
      })
    }

    return common.success()
  }
}

exports.declaranceApprovalAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      billlading_customer_id: user.user_id,
      state: GLBConfig.ENABLE
    }
  })

  if (billlading.billlading_state != GLBConfig.BLSTATUS_FEEDBACK_DECLARE) {
    return common.error('billlading_01')
  } else {
    billlading.billlading_state = GLBConfig.BLSTATUS_CLEARANCE_APPROVAL
    await billlading.save()

    return common.success()
  }
}

exports.shippingInstructionAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      billlading_customer_id: user.user_id,
      state: GLBConfig.ENABLE
    }
  })

  if (
    billlading.billlading_state != GLBConfig.BLSTATUS_LOADING_PERMISSION &&
    billlading.billlading_state != GLBConfig.BLSTATUS_SHIPPING_INSTRUCTION &&
    billlading.billlading_state != GLBConfig.BLSTATUS_CDS_PROCESSING &&
    billlading.billlading_state != GLBConfig.BLSTATUS_FEEDBACK_BLDRAFT
  ) {
    return common.error('billlading_01')
  } else {
    for (let f of doc.instruction_files) {
      await tb_uploadfile.create({
        api_name: 'BOOKING-SHIPPINGINSTRUCTION',
        user_id: user.user_id,
        uploadfile_index1: billlading.billlading_id,
        uploadfile_name: f.name,
        uploadfile_url: f.url,
        remark: doc.uploadfile_remark
      })
    }
    if (billlading.billlading_state === GLBConfig.BLSTATUS_LOADING_PERMISSION) {
      billlading.billlading_state = GLBConfig.BLSTATUS_SHIPPING_INSTRUCTION
      await billlading.save()
    }

    return common.success()
  }
}

exports.uploadAct = async req => {
  let fileInfo = await common.fileSave(req, 'zhongtan')
  return common.success(fileInfo)
}

exports.downloadBookingAct = async (req, res) => {
  let doc = common.docValidate(req)
  let bl = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id
    }
  })

  let vessel = await tb_vessel.findOne({
    where: {
      vessel_id: bl.billlading_vessel_id
    }
  })

  let voyage = await tb_voyage.findOne({
    where: {
      voyage_id: bl.billlading_voyage_id
    }
  })

  let docData = JSON.parse(JSON.stringify(bl))
  docData.booking_date = moment(bl.created_at).format('DD-MMM-YYYY')
  if (bl.billlading_stuffing_date) {
    docData.stuffing_date = moment(bl.billlading_stuffing_date).format('DD-MMM-YYYY')
  } else {
    docData.stuffing_date = ''
  }

  docData.pay_date = bl.billlading_pay_date || ''

  docData.vessel_name = vessel.vessel_name
  docData.voyage_number = voyage.voyage_number

  let lp = await tb_port.findOne({
    where: {
      port_id: bl.billlading_loading_port_id
    }
  })
  docData.loading_port_name = lp.port_name
  let dp = await tb_port.findOne({
    where: {
      port_id: bl.billlading_discharge_port_id
    }
  })
  docData.discharge_port_name = dp.port_name
  docData.discharge_port_country = dp.port_country

  docData.billlading_goods = []
  let billlading_goods = await tb_billlading_goods.findAll({
    where: { billlading_id: bl.billlading_id }
  })
  for (let g of billlading_goods) {
    docData.billlading_goods.push(JSON.parse(JSON.stringify(g)))
  }

  return common.ejs2Word('bookingTemplate.docx', docData, res)
}

exports.searchTemplateAct = async req => {
  // let doc = common.docValidate(req)
  let user = req.user

  let template = await tb_bltemplate.findAll({
    where: {
      billlading_customer_id: user.user_id
    }
  })

  return common.success(template)
}

exports.addTemplateAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_customer_id: user.user_id,
      billlading_no: doc.billlading_no
    }
  })

  if (billlading) {
    await tb_bltemplate.create({
      billlading_customer_id: user.user_id,
      billlading_id: billlading.billlading_id,
      billlading_template_name: doc.billlading_template_name
    })
  } else {
    return common.error('billlading_03')
  }

  return common.success()
}

exports.deleteTemplateAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  let template = await tb_bltemplate.findOne({
    where: {
      billlading_customer_id: user.user_id,
      billlading_template_id: doc.billlading_template_id
    }
  })

  if (template) {
    await template.destroy()
  } else {
    return common.error('billlading_03')
  }

  return common.success()
}

exports.useTemplateAct = async req => {
  let doc = common.docValidate(req),
    returnData = {}

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id
    }
  })

  returnData.billlading_vessel_id = billlading.billlading_vessel_id
  returnData.billlading_voyage_id = billlading.billlading_voyage_id
  returnData.billlading_shipper_name = billlading.billlading_shipper_name
  returnData.billlading_shipper_tel = billlading.billlading_shipper_tel
  returnData.billlading_shipper_address = billlading.billlading_shipper_address
  returnData.billlading_consignee_name = billlading.billlading_consignee_name
  returnData.billlading_consignee_tel = billlading.billlading_consignee_tel
  returnData.billlading_consignee_address = billlading.billlading_consignee_address
  returnData.billlading_notify_name = billlading.billlading_notify_name
  returnData.billlading_notify_tel = billlading.billlading_notify_tel
  returnData.billlading_notify_address = billlading.billlading_notify_address
  returnData.billlading_original_num = billlading.billlading_original_num
  returnData.billlading_copys_num = billlading.billlading_copys_num
  returnData.billlading_loading_port_id = billlading.billlading_loading_port_id
  returnData.billlading_discharge_port_id = billlading.billlading_discharge_port_id
  returnData.billlading_delivery_place = billlading.billlading_delivery_place
  returnData.billlading_stuffing_place = billlading.billlading_stuffing_place
  returnData.billlading_stuffing_date = billlading.billlading_stuffing_date
  returnData.billlading_stuffing_requirement = billlading.billlading_stuffing_requirement
  returnData.billlading_forwarder_name = billlading.billlading_forwarder_name
  returnData.billlading_freight_currency = billlading.billlading_freight_currency

  let goods = await tb_billlading_goods.findAll({
    where: {
      billlading_id: doc.billlading_id
    }
  })
  returnData.billlading_goods = []
  for (let c of goods) {
    returnData.billlading_goods.push({
      billlading_goods_container_number: c.billlading_goods_container_number,
      billlading_goods_container_size: c.billlading_goods_container_size,
      billlading_goods_container_type: c.billlading_goods_container_type,
      billlading_goods_type: c.billlading_goods_type,
      billlading_goods_description: c.billlading_goods_description,
      billlading_goods_package_number: c.billlading_goods_package_number,
      billlading_goods_package_unit: c.billlading_goods_package_unit,
      billlading_goods_gross_weight: c.billlading_goods_gross_weight,
      billlading_goods_gross_unit: c.billlading_goods_gross_unit,
      billlading_goods_gross_volume: c.billlading_goods_gross_volume,
      billlading_goods_gross_volume_unit: c.billlading_goods_gross_volume_unit,
      billlading_goods_net_weight: c.billlading_goods_net_weight,
      billlading_goods_net_unit: c.billlading_goods_net_unit
    })
  }

  return common.success(returnData)
}
