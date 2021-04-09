const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_logistics_shipment_list', {
  shipment_list_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  shipment_list_bill_no: {
    // 提单号
    type: db.STRING(50),
    allowNull: false
  },
  shipment_list_cargo_type: {
    // 本地，过境
    type: db.STRING(20),
    allowNull: false
  },
  shipment_list_cntr_owner: {
    // 持箱人
    type: db.STRING(50),
    allowNull: false
  },
  shipment_list_size_type: {
    // 箱型尺寸
    type: db.STRING(20),
    allowNull: false
  },
  shipment_list_business_type: {
    // 业务类别
    type: db.STRING(20),
    allowNull: false
  },
  shipment_list_container_no: {
    // 箱号
    type: db.STRING(20),
    allowNull: false
  },
  shipment_list_port_of_destination: {
    // 卸港
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_discharge_date: {
    // 进口卸船日期
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_depot_gate_out_date: {
    // 出口出场日期
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_port_of_loading: {
    // 装港
    type: db.STRING(50),
    allowNull: true
  },
  shipment_list_dar_customs_release_date: {
    // 客户确认日期
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_truck_departure_date: {
    // 出车日期
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_truck_plate: {
    // 车牌号
    type: db.STRING(50),
    allowNull: true
  },
  shipment_list_ata_destination: {
    // 目的地
    type: db.STRING(50),
    allowNull: true
  },
  shipment_list_delivery_date: {
    // 交付日期
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_empty_return_date: {
    // 进口还箱日期
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_loading_date: {
    // 出口 COSCO进场/OOCL装船日期
    type: db.DATEONLY,
    allowNull: true
  },
  shipment_list_vendor: {
    type: db.STRING(50),
    allowNull: true
  },
  shipment_list_remark: {
    type: db.STRING(200),
    allowNull: true
  },
  shipment_list_cargo_weight: {
    // 单箱货重
    type: db.STRING(20),
    allowNull: true
  },
  shipment_list_ata_tz_border: {
    type: db.STRING(50),
    allowNull: true
  },
  shipment_list_ata_foreing_border: {
    type: db.STRING(50),
    allowNull: true
  },
  shipment_list_border_release_date: {
    // 
    type: db.DATEONLY,
    allowNull: true
  }
})
