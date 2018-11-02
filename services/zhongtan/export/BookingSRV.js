const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../util/Logger').createLogger('BookingSRV')
const model = require('../../../model')

const tb_billloading = model.zhongtan_billloading
const tb_billloading_container = model.zhongtan_billloading_container

exports.BookingResource = (req, res) => {
  let method = req.query.method
  if (method === 'init') {
    initAct(req, res)
  } else if (method === 'search') {
    searchAct(req, res)
  } else if (method === 'booking') {
    bookingAct(req, res)
  } else {
    common.sendError(res, 'common_01')
  }
}

async function initAct(req, res) {
  try {
    let doc = common.docTrim(req.body)
    let user = req.user
    let returnData = {
      PackageUnitINFO: GLBConfig.PackageUnitINFO,
      VolumeUnitINFO: GLBConfig.VolumeUnitINFO,
      WeightUnitINFO: GLBConfig.WeightUnitINFO,
      ContainerSizeINFO: GLBConfig.ContainerSizeINFO,
      ContainerTypeINFO: GLBConfig.ContainerTypeINFO,
      PayTypeINFO: GLBConfig.PayTypeINFO,
      PayStatusINFO: GLBConfig.PayStatusINFO
    }
    common.sendData(res, returnData)
  } catch (error) {
    common.sendFault(res, error)
  }
}

async function searchAct(req, res) {
  try {
    let doc = common.docTrim(req.body)
    let user = req.user
    

    common.sendData(res, returnData)
  } catch (error) {
    common.sendFault(res, error)
  }
}

async function bookingAct(req, res) {
  try {
    let doc = common.docTrim(req.body)
    let user = req.user

    let billloading = await tb_billloading.create({
      billloading_type: 'E',
      billloading_state: GLBConfig.BLSTATUS_PRE_BOOKING,
      billloading_vessel: doc.billloading_vessel,
      billloading_voyage: doc.billloading_voyage,
      billloading_shipper_id: user.user_id,
      billloading_consignee_name: doc.billloading_consignee_name,
      billloading_consignee_tel: doc.billloading_consignee_tel,
      billloading_consignee_address: doc.billloading_consignee_address,
      billloading_notify_name: doc.billloading_notify_name,
      billloading_notify_tel: doc.billloading_notify_tel,
      billloading_notify_address: doc.billloading_notify_address,
      billloading_original_num: doc.billloading_original_num,
      billloading_copys_num: doc.billloading_copys_num,
      billloading_loading_port: doc.billloading_loading_port,
      billloading_discharge_port: doc.billloading_discharge_port,
      billloading_delivery_place: doc.billloading_delivery_place,
      billloading_stuffing_place: doc.billloading_stuffing_place,
      billloading_stuffing_date: doc.billloading_stuffing_date,
      billloading_stuffing_requirement: doc.billloading_stuffing_requirement,
      billloading_pay_date: doc.billloading_pay_date,
      billloading_invoice_currency: doc.billloading_invoice_currency
    })

    for (let c of doc.billloading_containers) {
      await tb_billloading_container.create({
        billloading_id: billloading.billloading_id,
        billloading_container_number: c.billloading_container_number,
        billloading_container_size: c.billloading_container_size,
        billloading_container_type: c.billloading_container_type,
        billloading_container_goods_description:
          c.billloading_container_goods_description,
        billloading_container_package_number:
          c.billloading_container_package_number,
        billloading_container_package_unit:
          c.billloading_container_package_unit,
        billloading_container_gross_weight:
          c.billloading_container_gross_weight,
        billloading_container_gross_unit: c.billloading_container_gross_unit,
        billloading_container_gross_volume:
          c.billloading_container_gross_volume,
        billloading_container_gross_volume_unit:
          c.billloading_container_gross_volume_unit,
        billloading_container_net_weight: c.billloading_container_net_weight,
        billloading_container_net_weight_unit:
          c.billloading_container_net_weight_unit
      })
    }

    common.sendData(res)
  } catch (error) {
    common.sendFault(res, error)
    return
  }
}
