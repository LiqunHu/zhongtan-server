const _ = require('lodash')
const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../util/Logger').createLogger('BookingSRV')
const model = require('../../../model')
const FileSRV = require('../../../util/FileSRV')

const tb_billloading = model.zhongtan_billloading
const tb_billloading_container = model.zhongtan_billloading_container
const tb_vessel = model.zhongtan_vessel
const tb_voyage = model.zhongtan_voyage
const tb_portinfo = model.zhongtan_portinfo
const tb_container_manager = model.zhongtan_container_manager
const tb_uploadfile = model.zhongtan_uploadfile

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
  } else if (method === 'searchVoyage') {
    searchVoyageAct(req, res)
  } else if (method === 'bookingConfirm') {
    bookingConfirmAct(req, res)
  } else if (method === 'putboxConfirm') {
    putboxConfirmAct(req, res)
  } else if (method === 'rejectLoading') {
    rejectLoadingAct(req, res)
  } else if (method === 'declaration') {
    declarationAct(req, res)
  } else if (method === 'upload') {
    uploadAct(req, res)
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

    let queryStr = `select a.*, b.vessel_name, c.voyage_number, c.voyage_eta_date from tbl_zhongtan_billoading a, tbl_zhongtan_vessel b, tbl_zhongtan_voyage c
                    where a.state = '1'
                    and a.billloading_vessel_id = b.vessel_id
                    and a.billloading_voyage_id = c.voyage_id `
    let replacements = []

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

      d.shipline = {
        vessel: d.billloading_vessel_id,
        voyage: d.billloading_voyage_id,
        vessel_name: d.vessel_name,
        voyage_number: d.voyage_number + moment(d.voyage_eta_date, 'YYYY-MM-DD').format('MM-DD')
      }

      d.portinfo = {
        loading: d.billloading_loading_port_id,
        discharge: d.billloading_discharge_port_id
      }

      d.stuffing = {
        place: d.billloading_stuffing_place,
        date: d.billloading_stuffing_date,
        requirement: d.billloading_stuffing_requirement
      }

      d.billloading_containers = []
      let billloading_containers = await tb_billloading_container.findAll({
        where: { billloading_id: d.billloading_id }
      })
      for (let c of billloading_containers) {
        d.billloading_containers.push(JSON.parse(JSON.stringify(c)))
      }

      d.files = []
      let files = await tb_uploadfile.findAll({
        where: {
          uploadfile_index1: d.billloading_id
        },
        order: [['api_name'], ['created_at', 'DESC']]
      })
      for (let f of files) {
        let filetype = ''
        if (f.api_name === 'BOOKING-LOADINGLIST') {
          filetype = 'Loading list'
        } else if (f.api_name === 'BOOKING-DECLARATION') {
          filetype = 'Permission'
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
        billloading_shipper_id: user.user_id,
        state: GLBConfig.ENABLE
      }
    })
    if (modibillloading) {
      modibillloading.billloading_vessel_id = doc.new.shipline.vessel
      modibillloading.billloading_voyage_id = doc.new.shipline.voyage
      modibillloading.billloading_consignee_name = doc.new.billloading_consignee.name
      modibillloading.billloading_consignee_address = doc.new.billloading_consignee.address
      modibillloading.billloading_consignee_tel = doc.new.billloading_consignee.telephone
      modibillloading.billloading_notify_name = doc.new.billloading_notify.name
      modibillloading.billloading_notify_address = doc.new.billloading_notify.address
      modibillloading.billloading_notify_tel = doc.new.billloading_notify.telephone
      modibillloading.billloading_loading_port_id = doc.new.portinfo.loading
      modibillloading.billloading_discharge_port_id = doc.new.portinfo.discharge
      modibillloading.billloading_stuffing_place = doc.new.stuffing.place
      modibillloading.billloading_stuffing_date = doc.new.stuffing.date
      modibillloading.billloading_stuffing_requirement = doc.new.stuffing.requirement

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

      let vessel = await tb_vessel.findOne({
        where: {
          vessel_id: d.billloading_vessel_id
        }
      })

      let voyage = await tb_voyage.findOne({
        where: {
          voyage_id: d.billloading_voyage_id
        }
      })

      d.shipline = {
        vessel: d.billloading_vessel_id,
        voyage: d.billloading_voyage_id,
        vessel_name: vessel.vessel_name,
        voyage_number: voyage.voyage_number + moment(voyage.voyage_eta_date, 'YYYY-MM-DD').format('MM-DD')
      }

      d.portinfo = {
        loading: d.billloading_loading_port_id,
        discharge: d.billloading_discharge_port_id
      }

      d.stuffing = {
        place: d.billloading_stuffing_place,
        date: d.billloading_stuffing_date,
        requirement: d.billloading_stuffing_requirement
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

async function searchVoyageAct(req, res) {
  try {
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

    common.sendData(res, returnData)
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

async function rejectLoadingAct(req, res) {
  try {
    let doc = common.docValidate(req)

    let billloading = await tb_billloading.findOne({
      where: {
        billloading_id: doc.billloading_id,
        state: GLBConfig.ENABLE
      }
    })

    if (billloading.billloading_state != GLBConfig.BLSTATUS_SUBMIT_LOADING) {
      return common.sendError(res, 'billloading_01')
    } else {
      let file = await tb_uploadfile.findOne({
        where: {
          api_name: 'BOOKING-LOADINGLIST',
          uploadfile_index1: billloading.billloading_id
        },
        order: [['created_at', 'DESC']]
      })

      file.uploadfile_remark = 'reject: ' + doc.reject_reason
      await file.save()

      billloading.billloading_state = GLBConfig.BLSTATUS_REJECT_LOADING
      await billloading.save()
      return common.sendData(res)
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function declarationAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user

    let billloading = await tb_billloading.findOne({
      where: {
        billloading_id: doc.billloading_id,
        state: GLBConfig.ENABLE
      }
    })

    if (billloading.billloading_state != GLBConfig.BLSTATUS_SUBMIT_LOADING) {
      return common.sendError(res, 'billloading_01')
    } else {
      for (let f of doc.permission_files) {
        let mv = await FileSRV.fileMove(f.url)
        await tb_uploadfile.create({
          api_name: 'BOOKING-DECLARATION',
          user_id: user.user_id,
          uploadfile_index1: billloading.billloading_id,
          uploadfile_name: f.name,
          uploadfile_url: mv.url,
          uploadfile_remark: 'Declare number: ' + doc.billloading_declare_number
        })
      }

      billloading.billloading_state = GLBConfig.BLSTATUS_DECLARATION
      await billloading.save()

      return common.sendData(res)
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function uploadAct(req, res) {
  try {
    let fileInfo = await FileSRV.fileSaveTemp(req)
    common.sendData(res, fileInfo)
  } catch (error) {
    common.sendFault(res, error)
    return
  }
}
