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
const tb_uploadfile = model.zhongtan_uploadfile

exports.BookingResource = (req, res) => {
  let method = common.reqTrans(req, __filename)
  if (method === 'init') {
    initAct(req, res)
  } else if (method === 'search') {
    searchAct(req, res)
  } else if (method === 'booking') {
    bookingAct(req, res)
  } else if (method === 'modify') {
    modifyAct(req, res)
  } else if (method === 'searchVoyage') {
    searchVoyageAct(req, res)
  } else if (method === 'cancel') {
    cancelAct(req, res)
  } else if (method === 'putboxApply') {
    putboxApplyAct(req, res)
  } else if (method === 'submitloading') {
    submitloadingAct(req, res)
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

      // loading list files
      d.loading_files = []
      let files = await tb_uploadfile.findAll({
        where: {
          api_name: 'BOOKING-LOADINGLIST',
          uploadfile_index1: d.billloading_id
        },
        order: [['created_at', 'DESC']]
      })

      for (let f of files) {
        d.loading_files.push({
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          name: f.uploadfile_name,
          remark: f.uploadfile_remark
        })
      }

      // declaration files
      d.permission_files = []
      let dfiles = await tb_uploadfile.findAll({
        where: {
          api_name: 'BOOKING-DECLARATION',
          uploadfile_index1: d.billloading_id
        },
        order: [['created_at', 'DESC']]
      })

      for (let f of dfiles) {
        d.permission_files.push({
          file_id: f.uploadfile_id,
          url: f.uploadfile_url,
          name: f.uploadfile_name
        })
      }

      returnData.rows.push(d)
    }

    common.sendData(res, returnData)
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function bookingAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user

    let billloading = await tb_billloading.create({
      billloading_type: 'E',
      billloading_state: GLBConfig.BLSTATUS_PRE_BOOKING,
      billloading_vessel_id: doc.billloading_vessel_id,
      billloading_voyage_id: doc.billloading_voyage_id,
      billloading_shipper_id: user.user_id,
      billloading_consignee_name: doc.billloading_consignee_name,
      billloading_consignee_tel: doc.billloading_consignee_tel,
      billloading_consignee_address: doc.billloading_consignee_address,
      billloading_notify_name: doc.billloading_notify_name,
      billloading_notify_tel: doc.billloading_notify_tel,
      billloading_notify_address: doc.billloading_notify_address,
      billloading_original_num: doc.billloading_original_num,
      billloading_copys_num: doc.billloading_copys_num,
      billloading_loading_port_id: doc.billloading_loading_port_id,
      billloading_discharge_port_id: doc.billloading_discharge_port_id,
      billloading_delivery_place: doc.billloading_delivery_place,
      billloading_stuffing_place: doc.billloading_stuffing_place,
      billloading_stuffing_date: doc.billloading_stuffing_date,
      billloading_stuffing_requirement: doc.billloading_stuffing_requirement,
      billloading_pay_date: doc.billloading_pay_date,
      billloading_freight_currency: doc.billloading_freight_currency
    })

    for (let c of doc.billloading_containers) {
      await tb_billloading_container.create({
        billloading_id: billloading.billloading_id,
        billloading_container_number: c.billloading_container_number,
        billloading_container_size: c.billloading_container_size,
        billloading_container_type: c.billloading_container_type,
        billloading_container_goods_description: c.billloading_container_goods_description,
        billloading_container_package_number: c.billloading_container_package_number,
        billloading_container_package_unit: c.billloading_container_package_unit,
        billloading_container_gross_weight: c.billloading_container_gross_weight,
        billloading_container_gross_unit: c.billloading_container_gross_unit,
        billloading_container_gross_volume: c.billloading_container_gross_volume,
        billloading_container_gross_volume_unit: c.billloading_container_gross_volume_unit,
        billloading_container_net_weight: c.billloading_container_net_weight,
        billloading_container_net_weight_unit: c.billloading_container_net_weight_unit
      })
    }

    common.sendData(res)
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

async function cancelAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user

    let billloading = await tb_billloading.findOne({
      where: {
        billloading_id: doc.billloading_id,
        billloading_shipper_id: user.user_id,
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

async function putboxApplyAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user

    let billloading = await tb_billloading.findOne({
      where: {
        billloading_id: doc.billloading_id,
        billloading_shipper_id: user.user_id,
        state: GLBConfig.ENABLE
      }
    })

    if (billloading.billloading_state != GLBConfig.BLSTATUS_BOOKING) {
      return common.sendError(res, 'billloading_01')
    } else {
      billloading.billloading_state = GLBConfig.BLSTATUS_PUTBOX_APPLY
      await billloading.save()
      return common.sendData(res)
    }
  } catch (error) {
    return common.sendFault(res, error)
  }
}

async function submitloadingAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user

    let billloading = await tb_billloading.findOne({
      where: {
        billloading_id: doc.billloading_id,
        billloading_shipper_id: user.user_id,
        state: GLBConfig.ENABLE
      }
    })

    if (billloading.billloading_state != GLBConfig.BLSTATUS_PUTBOX_CONFIRM && billloading.billloading_state != GLBConfig.BLSTATUS_REJECT_LOADING) {
      return common.sendError(res, 'billloading_01')
    } else {
      for (let f of doc.loading_files) {
        let mv = await FileSRV.fileMove(f.url)
        await tb_uploadfile.create({
          api_name: 'BOOKING-LOADINGLIST',
          user_id: user.user_id,
          uploadfile_index1: billloading.billloading_id,
          uploadfile_name: f.name,
          uploadfile_url: mv.url
        })
      }

      billloading.billloading_state = GLBConfig.BLSTATUS_SUBMIT_LOADING
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
