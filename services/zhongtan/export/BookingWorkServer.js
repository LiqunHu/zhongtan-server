const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')
const mailer = require('../../../util/Mail')

const tb_user = model.common_user
const tb_billlading = model.zhongtan_billlading
const tb_billlading_goods = model.zhongtan_billlading_goods
const tb_container = model.zhongtan_container
const tb_vessel = model.zhongtan_vessel
const tb_voyage = model.zhongtan_voyage
const tb_port = model.zhongtan_port
const tb_container_manager = model.zhongtan_container_manager
const tb_uploadfile = model.zhongtan_uploadfile
const tb_billladingno_batch = model.zhongtan_billladingno_batch
const tb_billladingno_pool = model.zhongtan_billladingno_pool

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
    PortINFO: [],
    ContainerManagerINFO: []
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

  let managers = await tb_container_manager.findAll({
    where: {
      state: GLBConfig.ENABLE
    }
  })

  for (let m of managers) {
    returnData.ContainerManagerINFO.push({
      id: m.container_manager_id,
      text: m.container_manager_name
    })
  }

  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user
  let returnData = {}

  if (user.user_type != GLBConfig.TYPE_EMPLOYEE) {
    return common.error('booking_02')
  }

  let queryStr = `select * from tbl_zhongtan_billlading 
                    where state = '1'`
  let replacements = []

  if (user.user_service_name && user.user_service_name !== 'ALL') {
    queryStr += ` and (billlading_service_name = ? or billlading_service_name = '')`
    replacements.push(user.user_service_name)
  }

  if (doc.billlading_state) {
    queryStr += ' and billlading_state = ?'
    replacements.push(doc.billlading_state)
  }

  if (doc.shipper) {
    queryStr += ' and billlading_customer_id = ?'
    replacements.push(doc.shipper)
  }

  if (doc.vessel) {
    queryStr += ' and billlading_vessel_id = ?'
    replacements.push(doc.vessel)
  }

  if (doc.search_text) {
    queryStr += ' and billlading_no like ?'
    let search_text = '%' + doc.search_text + '%'
    replacements.push(search_text)
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

    let customer = await tb_user.findOne({
      where: {
        user_id: d.billlading_customer_id
      }
    })

    d.customerINFO = {
      name: customer.user_name,
      address: customer.user_address,
      email: customer.user_email,
      phone: customer.user_phone
    }

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
    for (let c of billlading_goods) {
      d.billlading_goods.push(JSON.parse(JSON.stringify(c)))
    }

    d.billlading_containers = []
    let billlading_containers = await tb_container.findAll({
      where: { billlading_id: d.billlading_id }
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
    d.fees.billlading_teu_standard = common.money2Str(d.billlading_teu_standard)
    d.fees.billlading_feu_standard = common.money2Str(d.billlading_feu_standard)
    d.fees.billlading_feu_high_cube = common.money2Str(d.billlading_feu_high_cube)
    d.billlading_teu_standard_f = common.money2Str(d.billlading_teu_standard)
    d.billlading_feu_standard_f = common.money2Str(d.billlading_feu_standard)
    d.billlading_feu_high_cube_f = common.money2Str(d.billlading_feu_high_cube)
    d.fees.sum_fee = common.money2Str(d.billlading_teu_standard + d.billlading_feu_standard + d.billlading_feu_high_cube)

    returnData.rows.push(d)
  }

  return common.success(returnData)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  let modibilllading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.old.billlading_id,
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
    modibilllading.billlading_cso = doc.new.billlading_cso
    modibilllading.billlading_original_num = doc.new.billlading_original_num
    modibilllading.billlading_copys_num = doc.new.billlading_copys_num
    modibilllading.billlading_loading_port_id = doc.new.billlading_loading_port_id
    modibilllading.billlading_discharge_port_id = doc.new.billlading_discharge_port_id
    modibilllading.billlading_stuffing_place = doc.new.billlading_stuffing_place
    modibilllading.billlading_stuffing_date = doc.new.billlading_stuffing_date || null
    modibilllading.billlading_stuffing_requirement = doc.new.billlading_stuffing_requirement
    modibilllading.billlading_pay_date = doc.new.billlading_pay_date || null
    modibilllading.billlading_freight_currency = doc.new.billlading_freight_currency

    if (user.user_service_name === 'ALL') {
      modibilllading.billlading_state = doc.new.billlading_state
      modibilllading.billlading_teu_standard = common.str2Money(doc.new.billlading_teu_standard_f)
      modibilllading.billlading_feu_standard = common.str2Money(doc.new.billlading_feu_standard_f)
      modibilllading.billlading_feu_high_cube = common.str2Money(doc.new.billlading_feu_high_cube_f)
    }

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
        mgood.billlading_goods_description = g.billlading_goods_description || ''
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
          billlading_goods_container_number: g.billlading_goods_container_number || 0,
          billlading_goods_container_size: g.billlading_goods_container_size,
          billlading_goods_container_type: g.billlading_goods_container_type,
          billlading_goods_type: g.billlading_goods_type,
          billlading_goods_description: g.billlading_goods_description || '',
          billlading_goods_package_number: g.billlading_goods_package_number || 0,
          billlading_goods_package_unit: g.billlading_goods_package_unit,
          billlading_goods_gross_weight: g.billlading_goods_gross_weight || 0,
          billlading_goods_gross_unit: g.billlading_goods_gross_unit,
          billlading_goods_gross_volume: g.billlading_goods_gross_volume || 0,
          billlading_goods_gross_volume_unit: g.billlading_goods_gross_volume_unit,
          billlading_goods_net_weight: g.billlading_goods_net_weight || 0,
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

    logger.debug('modify success')
    return common.success()
  } else {
    return common.error('operator_03')
  }
}

exports.cancelAct = async req => {
  let doc = common.docValidate(req)

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
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

exports.searchVesselAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  if (doc.search_text) {
    let returnData = {
      VesselINFO: []
    }
    let queryStr = `select * from tbl_zhongtan_vessel 
                where state = "1"   
                and vessel_service_name = ?
                and vessel_name like ?`
    let replacements = [user.user_service_name]
    let search_text = '%' + doc.search_text + '%'
    replacements.push(search_text)
    let vessels = await model.simpleSelect(queryStr, replacements)
    for (let v of vessels) {
      returnData.VesselINFO.push({
        id: v.vessel_id,
        text: v.vessel_name
      })
    }
    return common.success(returnData)
  } else {
    return common.success()
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

exports.confirmBookingAct = async req => {
  let doc = common.docValidate(req)

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      state: GLBConfig.ENABLE
    }
  })

  if (billlading.billlading_state != GLBConfig.BLSTATUS_PRE_BOOKING) {
    return common.error('billlading_01')
  } else {
    let bl = await tb_billladingno_pool.findOne({
      where: {
        billladingno_pool_vessel_service: billlading.billlading_service_name,
        billladingno_pool_state: '0'
      },
      order: [['billladingno_batch_id'], ['billladingno_pool_no']]
    })

    if (!bl) {
      return common.error('billlading_02')
    }
    bl.billladingno_pool_state = '1'
    await bl.save()

    let goods = await tb_billlading_goods.findAll({
      where: { billlading_id: billlading.billlading_id }
    })

    for (let g of goods) {
      for (let i = 0; i < g.billlading_goods_container_number; i++) {
        await tb_container.create({
          billlading_id: billlading.billlading_id,
          billlading_vessel_id: billlading.billlading_vessel_id,
          billlading_voyage_id: billlading.billlading_voyage_id,
          container_size: g.billlading_goods_container_size,
          container_type: g.billlading_goods_container_type,
          container_goods_type: g.billlading_goods_type,
          container_goods_description: g.billlading_goods_description,
          container_package_no: Math.ceil(g.billlading_goods_package_number / g.billlading_goods_container_number),
          container_package_unit: g.billlading_goods_package_unit,
          container_volume: Math.ceil(g.billlading_goods_gross_volume / g.billlading_goods_container_number),
          container_volume_unit: g.billlading_goods_gross_volume_unit,
          container_weight: Math.ceil(g.billlading_goods_gross_weight / g.billlading_goods_container_number),
          container_weight_unit: g.billlading_goods_gross_unit
        })
      }
    }

    billlading.billlading_no = bl.billladingno_pool_no
    billlading.billlading_vessel_id = doc.billlading_vessel_id
    billlading.billlading_voyage_id = doc.billlading_voyage_id
    billlading.billlading_cso = doc.billlading_cso
    billlading.billlading_teu_standard = common.str2Money(doc.billlading_teu_standard)
    billlading.billlading_feu_standard = common.str2Money(doc.billlading_feu_standard)
    billlading.billlading_feu_high_cube = common.str2Money(doc.billlading_feu_high_cube)
    billlading.billlading_state = GLBConfig.BLSTATUS_BOOKING

    await billlading.save()

    await tb_billladingno_batch.update(
      {
        billladingno_batch_use_count: model.literal('`billladingno_batch_use_count` +1')
      },
      {
        where: {
          billladingno_batch_id: bl.billladingno_batch_id
        }
      }
    )
    return common.success()
  }
}

exports.confirmPickUpAct = async req => {
  let doc = common.docValidate(req)

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      state: GLBConfig.ENABLE
    }
  })

  if (billlading.billlading_state != GLBConfig.BLSTATUS_PUTBOX_APPLY) {
    return common.error('billlading_01')
  } else {
    let manager = await tb_container_manager.findOne({
      where: {
        container_manager_id: doc.container_manager_id
      }
    })

    let shipper = await tb_user.findOne({
      where: {
        user_id: billlading.billlading_customer_id
      }
    })

    let billlading_goods = await tb_billlading_goods.findAll({
      where: { billlading_id: billlading.billlading_id }
    })

    let containers = ''
    for (let g of billlading_goods) {
      containers += g.billlading_goods_container_number + 'X' + g.billlading_goods_container_size + g.billlading_goods_container_type + ', '
    }
    containers = containers.slice(0, containers.length - 2)

    let vessel = await tb_vessel.findOne({
      where: {
        vessel_id: billlading.billlading_vessel_id
      }
    })

    let voyage = await tb_voyage.findOne({
      where: {
        voyage_id: billlading.billlading_voyage_id
      }
    })

    let text = `
    TO ${manager.container_manager_name}:<br/>
    Please Release ${containers} empty containers in a good condition to ${shipper.user_name}<br/>
    Place of stuffing at ${billlading.billlading_stuffing_place}<br/>
    Let us know container number released for our record.<br/>
    S/O: ${billlading.billlading_no} ${containers}<br/>
    VESSEL: ${vessel.vessel_name} ${voyage.voyage_number}<br/>
    `

    await mailer.sendMail(manager.container_manager_email, 'Pick Up ' + billlading.billlading_no, '', text)
    await mailer.sendMail(shipper.user_email, 'Pick Up ' + billlading.billlading_no, text, text)

    // 更改订单状态
    billlading.container_manager_id = doc.container_manager_id
    billlading.billlading_state = GLBConfig.BLSTATUS_PUTBOX_CONFIRM

    await billlading.save()

    return common.success()
  }
}

exports.rejectLoadingAct = async req => {
  let doc = common.docValidate(req)

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      state: GLBConfig.ENABLE
    }
  })

  if (billlading.billlading_state != GLBConfig.BLSTATUS_SUBMIT_LOADING) {
    return common.error('billlading_01')
  } else {
    let file = await tb_uploadfile.findOne({
      where: {
        api_name: 'BOOKING-LOADINGLIST',
        uploadfile_index1: billlading.billlading_id
      },
      order: [['created_at', 'DESC']]
    })

    file.uploadfile_remark = 'reject: ' + doc.reject_reason
    await file.save()

    billlading.billlading_state = GLBConfig.BLSTATUS_REJECT_LOADING
    await billlading.save()
    return common.success()
  }
}

exports.submitCustomsAct = async req => {
  let doc = common.docValidate(req)

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      state: GLBConfig.ENABLE
    }
  })

  if (billlading.billlading_state != GLBConfig.BLSTATUS_SUBMIT_LOADING) {
    return common.error('billlading_01')
  } else {
    billlading.billlading_state = GLBConfig.BLSTATUS_SUBMIT_CUSTOMS
    await billlading.save()

    return common.success()
  }
}

exports.feedbackDeclareNumberAct = async req => {
  let doc = common.docValidate(req)

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      state: GLBConfig.ENABLE
    }
  })

  if (billlading.billlading_state != GLBConfig.BLSTATUS_SUBMIT_CUSTOMS) {
    return common.error('billlading_01')
  } else {
    billlading.billlading_declare_number = doc.billlading_declare_number
    billlading.billlading_state = GLBConfig.BLSTATUS_FEEDBACK_DECLARE
    await billlading.save()

    return common.success()
  }
}

exports.loadingPermissionAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      state: GLBConfig.ENABLE
    }
  })

  if (billlading.billlading_state != GLBConfig.BLSTATUS_CLEARANCE_APPROVAL) {
    return common.error('billlading_01')
  } else {
    for (let f of doc.permission_files) {
      await tb_uploadfile.create({
        api_name: 'BOOKING-LOADINGPERMISSION',
        user_id: user.user_id,
        uploadfile_index1: billlading.billlading_id,
        uploadfile_name: f.name,
        uploadfile_url: f.url
      })
    }

    billlading.billlading_state = GLBConfig.BLSTATUS_LOADING_PERMISSION
    await billlading.save()

    return common.success()
  }
}

exports.sendCDSAct = async req => {
  let doc = common.docValidate(req)

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      state: GLBConfig.ENABLE
    }
  })

  if (billlading.billlading_state != GLBConfig.BLSTATUS_SHIPPING_INSTRUCTION) {
    return common.error('billlading_01')
  } else {
    billlading.billlading_state = GLBConfig.BLSTATUS_CDS_PROCESSING
    await billlading.save()

    return common.success()
  }
}

exports.feedbackBLDraftAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      state: GLBConfig.ENABLE
    }
  })

  if (billlading.billlading_state != GLBConfig.BLSTATUS_CDS_PROCESSING && billlading.billlading_state != GLBConfig.BLSTATUS_FEEDBACK_BLDRAFT) {
    return common.error('billlading_01')
  } else {
    for (let f of doc.bl_files) {
      await tb_uploadfile.create({
        api_name: 'BOOKING-BL-DRAFT',
        user_id: user.user_id,
        uploadfile_index1: billlading.billlading_id,
        uploadfile_name: f.name,
        uploadfile_url: f.url,
        uploadfile_remark: doc.uploadfile_remark
      })
    }
    if(billlading.billlading_state === GLBConfig.BLSTATUS_CDS_PROCESSING) {
      billlading.billlading_state = GLBConfig.BLSTATUS_FEEDBACK_BLDRAFT
      await billlading.save()
    }

    return common.success()
  }
}

exports.generateInvoiceAct = async req => {
  logger.info(req)
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
      vessel_id: bl.billlading_voyage_id
    }
  })

  let docData = JSON.parse(JSON.stringify(bl))
  docData.booking_date = moment(bl.created_at).format('DD-MMM-YYYY')
  if (bl.billlading_stuffing_date) {
    docData.stuffing_date = moment(bl.billlading_stuffing_date).format('DD-MMM-YYYY')
  } else {
    docData.stuffing_date = ''
  }
  if (bl.billlading_pay_date) {
    docData.pay_date = moment(bl.billlading_pay_date).format('DD-MMM-YYYY')
  } else {
    docData.pay_date = ''
  }

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
