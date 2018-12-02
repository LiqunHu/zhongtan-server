const _ = require('lodash')
const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../util/Logger').createLogger('BookingSRV')
const model = require('../../../model')

const tb_billloading = model.zhongtan_billloading
const tb_billloading_container = model.zhongtan_billloading_container
const tb_vessel = model.zhongtan_vessel
const tb_voyage = model.zhongtan_voyage
const tb_portinfo = model.zhongtan_portinfo
const tb_container_manager = model.zhongtan_container_manager

exports.BookingWorkResource = (req, res) => {
  let method = common.reqTrans(req, __filename)
  if (method === 'init') {
    initAct(req, res)
  } else if (method === 'search') {
    searchAct(req, res)
  } else if (method === 'modify') {
    modifyAct(req, res)
  } else if (method === 'cancel') {
    cancelAct(req, res)
  } else if (method === 'bookingConfirm') {
    bookingConfirmAct(req, res)
  } else if (method === 'putboxConfirm') {
    putboxConfirmAct(req, res)
  } else {
    common.sendError(res, 'common_01')
  }
}

async function initAct(req, res) {
  try {
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

    let ports = await tb_portinfo.findAll({
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

    common.sendData(res, returnData)
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function searchAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user
    let returnData = {}

    let queryStr = `select * from tbl_zhongtan_billoading
                    where state = '1' 
                    and billloading_shipper_id = ?`
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

    let result = await model.queryWithCount(req, queryStr, replacements)

    returnData.total = result.count
    returnData.rows = []

    for (let bl of result.data) {
      let d = JSON.parse(JSON.stringify(bl))
      d.billloading_consignee = {
        name: d.billloading_consignee_name,
        address: d.billloading_consignee_address,
        telephone: d.billloading_consignee_tel
      }

      d.billloading_notify = {
        name: d.billloading_notify_name,
        address: d.billloading_notify_address,
        telephone: d.billloading_notify_tel
      }

      d.VoyageINFO = []

      let voyages = await tb_voyage.findAll({
        where: {
          vessel_id: d.billloading_vessel_id,
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

      returnData.rows.push(d)
    }

    common.sendData(res, returnData)
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function modifyAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user

    let modibillloading = await tb_billloading.findOne({
      where: {
        billloading_id: doc.old.billloading_id,
        state: GLBConfig.ENABLE
      }
    })
    if (modibillloading) {
      modibillloading.billloading_vessel_id = doc.new.billloading_vessel_id
      modibillloading.billloading_voyage_id = doc.new.billloading_voyage_id
      modibillloading.billloading_consignee_name = doc.new.billloading_consignee.name
      modibillloading.billloading_consignee_address = doc.new.billloading_consignee.address
      modibillloading.billloading_consignee_tel = doc.new.billloading_consignee.telephone
      modibillloading.billloading_notify_name = doc.new.billloading_notify.name
      modibillloading.billloading_notify_address = doc.new.billloading_notify.address
      modibillloading.billloading_notify_tel = doc.new.billloading_notify.telephone
      modibillloading.billloading_loading_port_id = doc.new.billloading_loading_port_id
      modibillloading.billloading_discharge_port_id = doc.new.billloading_discharge_port_id

      await modibillloading.save()

      let d = JSON.parse(JSON.stringify(modibillloading))
      d.billloading_consignee = {
        name: d.billloading_consignee_name,
        address: d.billloading_consignee_address,
        telephone: d.billloading_consignee_tel
      }

      d.billloading_notify = {
        name: d.billloading_notify_name,
        address: d.billloading_notify_address,
        telephone: d.billloading_notify_tel
      }
      return common.sendData(res, d)
    } else {
      return common.sendError(res, 'operator_03')
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function cancelAct(req, res) {
  try {
    let doc = common.docValidate(req)

    let billloading = await tb_billloading.findOne({
      where: {
        billloading_id: doc.billloading_id,
        state: GLBConfig.ENABLE
      }
    })

    if (billloading.billloading_state != GLBConfig.BLSTATUS_PRE_BOOKING) {
      return common.sendError(res, 'billloading_01')
    } else {
      billloading.state = GLBConfig.DISABLE
      await billloading.save()
      return common.sendData(res)
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function bookingConfirmAct(req, res) {
  try {
    let doc = common.docValidate(req)

    let billloading = await tb_billloading.findOne({
      where: {
        billloading_id: doc.billloading_id,
        state: GLBConfig.ENABLE
      }
    })

    if (billloading.billloading_state != GLBConfig.BLSTATUS_PRE_BOOKING) {
      return common.sendError(res, 'billloading_01')
    } else {
      billloading.billloading_no = _.random(0, 1000)
      billloading.billloading_freight_charge = common.str2Money(doc.billloading_freight_charge)
      billloading.billloading_state = GLBConfig.BLSTATUS_BOOKING

      await billloading.save()
      return common.sendData(res)
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function putboxConfirmAct(req, res) {
  try {
    let doc = common.docValidate(req)

    let billloading = await tb_billloading.findOne({
      where: {
        billloading_id: doc.billloading_id,
        state: GLBConfig.ENABLE
      }
    })

    if (billloading.billloading_state != GLBConfig.BLSTATUS_PUTBOX_APPLY) {
      return common.sendError(res, 'billloading_01')
    } else {
      billloading.container_manager_id = doc.container_manager_id
      billloading.billloading_state = GLBConfig.BLSTATUS_PUTBOX_CONFIRM

      await billloading.save()
      return common.sendData(res)
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}
