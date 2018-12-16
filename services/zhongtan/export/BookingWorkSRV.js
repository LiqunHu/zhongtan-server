const _ = require('lodash')
const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../util/Logger').createLogger('BookingSRV')
const model = require('../../../model')
const FileSRV = require('../../../util/FileSRV')

const tb_billlading = model.zhongtan_billlading
const tb_billlading_container = model.zhongtan_billlading_container
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
  } else if (method === 'sendCDS') {
    sendCDSAct(req, res)
  } else if (method === 'sendBL') {
    sendBLAct(req, res)
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

    let queryStr = `select a.*, b.vessel_name, c.voyage_number, c.voyage_eta_date from tbl_zhongtan_billlading a, tbl_zhongtan_vessel b, tbl_zhongtan_voyage c
                    where a.state = '1'
                    and a.billlading_vessel_id = b.vessel_id
                    and a.billlading_voyage_id = c.voyage_id `
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

    common.sendData(res, returnData)
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function modifyAct(req, res) {
  try {
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

    let billlading = await tb_billlading.findOne({
      where: {
        billlading_id: doc.billlading_id,
        state: GLBConfig.ENABLE
      }
    })

    if (billlading.billlading_state != GLBConfig.BLSTATUS_PRE_BOOKING) {
      return common.sendError(res, 'billlading_01')
    } else {
      billlading.state = GLBConfig.DISABLE
      await billlading.save()
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

    let billlading = await tb_billlading.findOne({
      where: {
        billlading_id: doc.billlading_id,
        state: GLBConfig.ENABLE
      }
    })

    if (billlading.billlading_state != GLBConfig.BLSTATUS_PRE_BOOKING) {
      return common.sendError(res, 'billlading_01')
    } else {
      billlading.billlading_no = _.random(0, 1000)
      billlading.billlading_freight_charge = common.str2Money(doc.billlading_freight_charge)
      billlading.billlading_state = GLBConfig.BLSTATUS_BOOKING

      await billlading.save()
      return common.sendData(res)
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function putboxConfirmAct(req, res) {
  try {
    let doc = common.docValidate(req)

    let billlading = await tb_billlading.findOne({
      where: {
        billlading_id: doc.billlading_id,
        state: GLBConfig.ENABLE
      }
    })

    if (billlading.billlading_state != GLBConfig.BLSTATUS_PUTBOX_APPLY) {
      return common.sendError(res, 'billlading_01')
    } else {
      billlading.container_manager_id = doc.container_manager_id
      billlading.billlading_state = GLBConfig.BLSTATUS_PUTBOX_CONFIRM

      await billlading.save()
      return common.sendData(res)
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function rejectLoadingAct(req, res) {
  try {
    let doc = common.docValidate(req)

    let billlading = await tb_billlading.findOne({
      where: {
        billlading_id: doc.billlading_id,
        state: GLBConfig.ENABLE
      }
    })

    if (billlading.billlading_state != GLBConfig.BLSTATUS_SUBMIT_LOADING) {
      return common.sendError(res, 'billlading_01')
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

    let billlading = await tb_billlading.findOne({
      where: {
        billlading_id: doc.billlading_id,
        state: GLBConfig.ENABLE
      }
    })

    if (billlading.billlading_state != GLBConfig.BLSTATUS_SUBMIT_LOADING) {
      return common.sendError(res, 'billlading_01')
    } else {
      for (let f of doc.permission_files) {
        let mv = await FileSRV.fileMove(f.url)
        await tb_uploadfile.create({
          api_name: 'BOOKING-DECLARATION',
          user_id: user.user_id,
          uploadfile_index1: billlading.billlading_id,
          uploadfile_name: f.name,
          uploadfile_url: mv.url,
          uploadfile_remark: 'Declare number: ' + doc.billlading_declare_number
        })
      }

      billlading.billlading_state = GLBConfig.BLSTATUS_DECLARATION
      await billlading.save()

      return common.sendData(res)
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function sendCDSAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user

    let billlading = await tb_billlading.findOne({
      where: {
        billlading_id: doc.billlading_id,
        state: GLBConfig.ENABLE
      }
    })

    if (billlading.billlading_state != GLBConfig.BLSTATUS_CONFIRM_INSTRUCTUON) {
      return common.sendError(res, 'billlading_01')
    } else {
      billlading.billlading_state = GLBConfig.BLSTATUS_CDS_PROCESSING
      await billlading.save()

      return common.sendData(res)
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function sendBLAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user

    let billlading = await tb_billlading.findOne({
      where: {
        billlading_id: doc.billlading_id,
        state: GLBConfig.ENABLE
      }
    })

    if (billlading.billlading_state != GLBConfig.BLSTATUS_CDS_PROCESSING) {
      return common.sendError(res, 'billlading_01')
    } else {
      for (let f of doc.bl_files) {
        let mv = await FileSRV.fileMove(f.url)
        await tb_uploadfile.create({
          api_name: 'BOOKING-BILLLADING',
          user_id: user.user_id,
          uploadfile_index1: billlading.billlading_id,
          uploadfile_name: f.name,
          uploadfile_url: mv.url
        })
      }
      billlading.billlading_state = GLBConfig.BLSTATUS_BILL_LADING
      await billlading.save()

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
