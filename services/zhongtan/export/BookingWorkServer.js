const _ = require('lodash')
const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')

const tb_billlading = model.zhongtan_billlading
const tb_billlading_goods = model.zhongtan_billlading_goods
const tb_container = model.zhongtan_container
const tb_vessel = model.zhongtan_vessel
const tb_voyage = model.zhongtan_voyage
const tb_port = model.zhongtan_port
const tb_container_manager = model.zhongtan_container_manager
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
      text: m.container_manager_code + ' - ' + m.container_manager_name
    })
  }

  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}

  let queryStr = `select * from tbl_zhongtan_billlading 
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
  queryStr += ' order by created_at desc'

  let result = await model.queryWithCount(req, queryStr, replacements)

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
      billlading_shipper_id: user.user_id,
      state: GLBConfig.ENABLE
    }
  })
  if (modibilllading) {
    modibilllading.billlading_vessel_id = doc.new.billlading_vessel_id
    modibilllading.billlading_voyage_id = doc.new.billlading_voyage_id
    modibilllading.billlading_consignee_name = doc.new.billlading_consignee_name
    modibilllading.billlading_consignee_address = doc.new.billlading_consignee_address
    modibilllading.billlading_consignee_tel = doc.new.billlading_consignee_tel
    modibilllading.billlading_notify_name = doc.new.billlading_notify_name
    modibilllading.billlading_notify_address = doc.new.billlading_notify_address
    modibilllading.billlading_notify_tel = doc.new.billlading_notify_tel
    modibilllading.billlading_loading_port_id = doc.new.billlading_loading_port_id
    modibilllading.billlading_discharge_port_id = doc.new.billlading_discharge_port_id
    modibilllading.billlading_stuffing_place = doc.new.billlading_stuffing_place
    modibilllading.billlading_stuffing_date = doc.new.billlading_stuffing_date
    modibilllading.billlading_stuffing_requirement = doc.new.billlading_stuffing_requirement
    modibilllading.billlading_pay_date = doc.new.billlading_pay_date
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
        mgood.billlading_goods_container_number = g.billlading_goods_container_number
        mgood.billlading_goods_container_size = g.billlading_goods_container_size
        mgood.billlading_goods_container_type = g.billlading_goods_container_type
        mgood.billlading_goods_description = g.billlading_goods_description
        mgood.billlading_goods_package_number = g.billlading_goods_package_number
        mgood.billlading_goods_package_unit = g.billlading_goods_package_unit
        mgood.billlading_goods_gross_weight = g.billlading_goods_gross_weight
        mgood.billlading_goods_gross_unit = g.billlading_goods_gross_unit
        mgood.billlading_goods_gross_volume = g.billlading_goods_gross_volume
        mgood.billlading_goods_gross_volume_unit = g.billlading_goods_gross_volume_unit
        await mgood.save()
        newGoods.push(g.billlading_goods_id)
      } else {
        await tb_billlading_goods.create({
          billlading_id: modibilllading.billlading_id,
          billlading_goods_container_number: g.billlading_goods_container_number,
          billlading_goods_container_size: g.billlading_goods_container_size,
          billlading_goods_container_type: g.billlading_goods_container_type,
          billlading_goods_description: g.billlading_goods_description,
          billlading_goods_package_number: g.billlading_goods_package_number,
          billlading_goods_package_unit: g.billlading_goods_package_unit,
          billlading_goods_gross_weight: g.billlading_goods_gross_weight,
          billlading_goods_gross_unit: g.billlading_goods_gross_unit,
          billlading_goods_gross_volume: g.billlading_goods_gross_volume,
          billlading_goods_gross_volume_unit: g.billlading_goods_gross_volume_unit
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
      mContainer.container_seal_no1 = c.container_seal_no1
      mContainer.container_package_no = c.container_package_no
      mContainer.container_package_unit = c.container_package_unit
      mContainer.container_volume = c.container_volume
      mContainer.container_volume_unit = c.container_volume_unit
      mContainer.container_weight = c.container_weight
      mContainer.container_weight_unit = c.container_weight_unit
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

    billlading.billlading_no = _.random(0, 1000)
    billlading.billlading_freight_charge = common.str2Money(doc.billlading_freight_charge)
    billlading.billlading_state = GLBConfig.BLSTATUS_BOOKING

    await billlading.save()
    return common.success()
  }
}

exports.putboxConfirmAct = async req => {
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

exports.declarationAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      state: GLBConfig.ENABLE
    }
  })

  if (billlading.billlading_state != GLBConfig.BLSTATUS_SUBMIT_LOADING) {
    return common.error('billlading_01')
  } else {
    for (let f of doc.permission_files) {
      await tb_uploadfile.create({
        api_name: 'BOOKING-DECLARATION',
        user_id: user.user_id,
        uploadfile_index1: billlading.billlading_id,
        uploadfile_name: f.name,
        uploadfile_url: f.url,
        uploadfile_remark: 'Declare number: ' + doc.billlading_declare_number
      })
    }

    billlading.billlading_state = GLBConfig.BLSTATUS_DECLARATION
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

  if (billlading.billlading_state != GLBConfig.BLSTATUS_CONFIRM_INSTRUCTUON) {
    return common.error('billlading_01')
  } else {
    billlading.billlading_state = GLBConfig.BLSTATUS_CDS_PROCESSING
    await billlading.save()

    return common.success()
  }
}

exports.sendBLAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      state: GLBConfig.ENABLE
    }
  })

  if (billlading.billlading_state != GLBConfig.BLSTATUS_CDS_PROCESSING) {
    return common.error('billlading_01')
  } else {
    for (let f of doc.bl_files) {
      await tb_uploadfile.create({
        api_name: 'BOOKING-BILLLADING',
        user_id: user.user_id,
        uploadfile_index1: billlading.billlading_id,
        uploadfile_name: f.name,
        uploadfile_url: f.url
      })
    }
    billlading.billlading_state = GLBConfig.BLSTATUS_BILL_LADING
    await billlading.save()

    return common.success()
  }
}

exports.uploadAct = async () => {
  return common.success()
}