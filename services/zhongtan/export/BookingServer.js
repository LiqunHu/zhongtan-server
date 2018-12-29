const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')

const tb_billlading = model.zhongtan_billlading
const tb_billlading_container = model.zhongtan_billlading_container
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
      id: p.portinfo_id,
      text: p.portinfo_name + ' - ' + p.portinfo_code
    })
  }
  logger.debug(returnData)
  return common.success(returnData)
}

exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user
  let returnData = {}

  let queryStr = `select a.*, b.vessel_name, c.voyage_number, c.voyage_eta_date from tbl_zhongtan_billlading a, tbl_zhongtan_vessel b, tbl_zhongtan_voyage c
                    where a.state = '1'
                    and a.billlading_vessel_id = b.vessel_id
                    and a.billlading_voyage_id = c.voyage_id 
                    and billlading_shipper_id = ?`
  let replacements = [user.user_id]

  if (doc.start_date) {
    queryStr += ' and a.created_at >= ? and a.created_at <= ?'
    replacements.push(doc.start_date)
    replacements.push(
      moment(doc.end_date, 'YYYY-MM-DD')
        .add(1, 'days')
        .format('YYYY-MM-DD')
    )
  }
  queryStr += ' order by a.created_at desc'

  let result = await model.queryWithCount(req, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = []

  for (let bl of result.data) {
    let d = JSON.parse(JSON.stringify(bl))
    d.booking_date = moment(bl.created_at).format('YYYY-MM-DD')
    d.billlading_consignee = {
      name: d.billlading_consignee_name,
      address: d.billlading_consignee_address,
      telephone: d.billlading_consignee_tel
    }

    d.billlading_notify = {
      name: d.billlading_notify_name,
      address: d.billlading_notify_address,
      telephone: d.billlading_notify_tel
    }

    d.shipline = {
      vessel: d.billlading_vessel_id,
      voyage: d.billlading_voyage_id,
      vessel_name: d.vessel_name,
      voyage_number: d.voyage_number + moment(d.voyage_eta_date, 'YYYY-MM-DD').format('MM-DD')
    }

    d.portinfo = {
      loading: d.billlading_loading_port_id,
      discharge: d.billlading_discharge_port_id
    }

    d.stuffing = {
      place: d.billlading_stuffing_place,
      date: d.billlading_stuffing_date,
      requirement: d.billlading_stuffing_requirement
    }

    d.billlading_containers = []
    let billlading_containers = await tb_billlading_container.findAll({
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
      order: [['api_name'], ['created_at', 'DESC']]
    })
    for (let f of files) {
      let filetype = ''
      if (f.api_name === 'BOOKING-LOADINGLIST') {
        filetype = '4.Loading list'
      } else if (f.api_name === 'BOOKING-DECLARATION') {
        filetype = '3.Permission'
      } else if (f.api_name === 'BOOKING-INSTRUCTION') {
        filetype = '2.Instruction'
      } else if (f.api_name === 'BOOKING-BILLLADING') {
        filetype = '1.Deaft bill of lading'
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

    returnData.rows.push(d)
  }

  return common.success(returnData)
}

exports.bookingAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  let billlading = await tb_billlading.create({
    billlading_type: 'E',
    billlading_state: GLBConfig.BLSTATUS_PRE_BOOKING,
    billlading_vessel_id: doc.billlading_vessel_id,
    billlading_voyage_id: doc.billlading_voyage_id,
    billlading_shipper_id: user.user_id,
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
    billlading_stuffing_date: doc.billlading_stuffing_date,
    billlading_stuffing_requirement: doc.billlading_stuffing_requirement,
    billlading_pay_date: doc.billlading_pay_date,
    billlading_freight_currency: doc.billlading_freight_currency
  })

  for (let c of doc.billlading_containers) {
    await tb_billlading_container.create({
      billlading_id: billlading.billlading_id,
      billlading_container_number: c.billlading_container_number,
      billlading_container_size: c.billlading_container_size,
      billlading_container_type: c.billlading_container_type,
      billlading_container_goods_description: c.billlading_container_goods_description,
      billlading_container_package_number: c.billlading_container_package_number,
      billlading_container_package_unit: c.billlading_container_package_unit,
      billlading_container_gross_unit: c.billlading_container_gross_unit,
      billlading_container_gross_volume: c.billlading_container_gross_volume,
      billlading_container_gross_volume_unit: c.billlading_container_gross_volume_unit,
      billlading_container_gross_weight: c.billlading_container_gross_weight,
      billlading_container_gross_weight_unit: c.billlading_container_gross_weight_unit
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
      billlading_shipper_id: user.user_id,
      state: GLBConfig.ENABLE
    }
  })
  if (modibilllading) {
    modibilllading.billlading_vessel_id = doc.new.shipline.vessel
    modibilllading.billlading_voyage_id = doc.new.shipline.voyage
    modibilllading.billlading_consignee_name = doc.new.billlading_consignee.name
    modibilllading.billlading_consignee_address = doc.new.billlading_consignee.address
    modibilllading.billlading_consignee_tel = doc.new.billlading_consignee.telephone
    modibilllading.billlading_notify_name = doc.new.billlading_notify.name
    modibilllading.billlading_notify_address = doc.new.billlading_notify.address
    modibilllading.billlading_notify_tel = doc.new.billlading_notify.telephone
    modibilllading.billlading_loading_port_id = doc.new.portinfo.loading
    modibilllading.billlading_discharge_port_id = doc.new.portinfo.discharge
    modibilllading.billlading_stuffing_place = doc.new.stuffing.place
    modibilllading.billlading_stuffing_date = doc.new.stuffing.date
    modibilllading.billlading_stuffing_requirement = doc.new.stuffing.requirement

    await modibilllading.save()

    let d = JSON.parse(JSON.stringify(modibilllading))
    d.billlading_consignee = {
      name: d.billlading_consignee_name,
      address: d.billlading_consignee_address,
      telephone: d.billlading_consignee_tel
    }

    d.billlading_notify = {
      name: d.billlading_notify_name,
      address: d.billlading_notify_address,
      telephone: d.billlading_notify_tel
    }

    let vessel = await tb_vessel.findOne({
      where: {
        vessel_id: d.billlading_vessel_id
      }
    })

    let voyage = await tb_voyage.findOne({
      where: {
        voyage_id: d.billlading_voyage_id
      }
    })

    d.shipline = {
      vessel: d.billlading_vessel_id,
      voyage: d.billlading_voyage_id,
      vessel_name: vessel.vessel_name,
      voyage_number: voyage.voyage_number + moment(voyage.voyage_eta_date, 'YYYY-MM-DD').format('MM-DD')
    }

    d.portinfo = {
      loading: d.billlading_loading_port_id,
      discharge: d.billlading_discharge_port_id
    }

    d.stuffing = {
      place: d.billlading_stuffing_place,
      date: d.billlading_stuffing_date,
      requirement: d.billlading_stuffing_requirement
    }

    return common.success(d)
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
      billlading_shipper_id: user.user_id,
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

exports.putboxApplyAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      billlading_shipper_id: user.user_id,
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
      billlading_shipper_id: user.user_id,
      state: GLBConfig.ENABLE
    }
  })

  if (billlading.billlading_state != GLBConfig.BLSTATUS_PUTBOX_CONFIRM && billlading.billlading_state != GLBConfig.BLSTATUS_REJECT_LOADING) {
    return common.error('billlading_01')
  } else {
    for (let f of doc.loading_files) {
      await tb_uploadfile.create({
        api_name: 'BOOKING-LOADINGLIST',
        user_id: user.user_id,
        uploadfile_index1: billlading.billlading_id,
        uploadfile_name: f.name,
        uploadfile_url: f.url
      })
    }

    billlading.billlading_state = GLBConfig.BLSTATUS_SUBMIT_LOADING
    await billlading.save()

    return common.success()
  }
}

exports.confirmInstructionAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user

  let billlading = await tb_billlading.findOne({
    where: {
      billlading_id: doc.billlading_id,
      billlading_shipper_id: user.user_id,
      state: GLBConfig.ENABLE
    }
  })

  if (billlading.billlading_state != GLBConfig.BLSTATUS_DECLARATION) {
    return common.error('billlading_01')
  } else {
    for (let f of doc.instruction_files) {
      await tb_uploadfile.create({
        api_name: 'BOOKING-INSTRUCTION',
        user_id: user.user_id,
        uploadfile_index1: billlading.billlading_id,
        uploadfile_name: f.name,
        uploadfile_url: f.url
      })
    }
    billlading.billlading_state = GLBConfig.BLSTATUS_CONFIRM_INSTRUCTUON
    await billlading.save()

    return common.success()
  }
}

exports.uploadAct = async req => {
  let fileInfo = await common.fileSave(req, 'zhongtan')
  return common.success(fileInfo)
}
