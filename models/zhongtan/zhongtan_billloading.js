const db = require('../../util/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_billoading', {
  billloading_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  billloading_no: {
    // 提单号
    type: db.STRING(100),
    allowNull: true
  },
  billloading_type: {
    // 提单类型 进口出口
    type: db.STRING(10),
    allowNull: false
  },
  billloading_state: {
    // 提单状态
    type: db.STRING(10),
    allowNull: false
  },
  billloading_vessel_id: {
    type: db.IDNO,
    allowNull: true
  },
  billloading_voyage_id: {
    type: db.IDNO,
    allowNull: true
  },
  billloading_shipper_id: {
    type: db.ID,
    allowNull: true
  },
  container_manager_id: { // 箱管 id
    type: db.IDNO,
    allowNull: true
  },
  billloading_consignee_name: {
    // 收货人姓名
    type: db.STRING(50),
    allowNull: true
  },
  billloading_consignee_tel: {
    // 收货人电话
    type: db.STRING(50),
    allowNull: true
  },
  billloading_consignee_address: {
    // 收货人地址
    type: db.STRING(200),
    allowNull: true
  },
  billloading_consignee_tin: {
    // 收货人tin
    type: db.STRING(50),
    allowNull: true
  },
  billloading_notify_name: {
    // 联系人姓名
    type: db.STRING(50),
    allowNull: true
  },
  billloading_notify_tel: {
    // 联系人电话
    type: db.STRING(50),
    allowNull: true
  },
  billloading_notify_address: {
    // 联系人地址
    type: db.STRING(200),
    allowNull: true
  },
  billloading_notify_tin: {
    // 联系人tin
    type: db.STRING(50),
    allowNull: true
  },
  billloading_original_num: {
    // 提单原件数量
    type: db.STRING(10),
    allowNull: true
  },
  billloading_copys_num: {
    // 提单拷贝数量
    type: db.STRING(10),
    allowNull: true
  },
  billloading_loading_port_id: {
    // 起始港
    type: db.IDNO,
    allowNull: true
  },
  billloading_discharge_port_id: {
    // 目的港
    type: db.IDNO,
    allowNull: true
  },
  billloading_delivery_place: {
    // 交货地
    type: db.STRING(100),
    allowNull: true
  },
  billloading_stuffing_place: {
    // 装货地
    type: db.STRING(100),
    allowNull: true
  },
  billloading_stuffing_date: {
    // 装货日期
    type: db.DATEONLY,
    allowNull: true
  },
  billloading_stuffing_requirement: {
    //装货特殊要求
    type: db.STRING(500),
    allowNull: true
  },
  billloading_declare_number: {
    type: db.STRING(100),
    allowNull: true
  },
  billloading_pay_date: {
    // 付款日期
    type: db.DATEONLY,
    allowNull: true
  },
  billloading_invoice_currency: {
    // 发票币种
    type: db.STRING(10),
    allowNull: true
  },
  billloading_invoice_value: {
    // 发票金额
    type: db.INTEGER,
    allowNull: true
  },
  billloading_freight_charge: {
    // 运费金额
    type: db.INTEGER,
    allowNull: true
  },
  billloading_freight_currency: {
    // 运费币种
    type: db.STRING(10),
    allowNull: true
  },
  billloading_imdg_code: {
    // IMDG code
    type: db.STRING(50),
    allowNull: true
  },
  billloading_packing_type: {
    // 打包类型
    type: db.STRING(10),
    allowNull: true
  },
  billloading_oil_type: {
    // oil类型
    type: db.STRING(10),
    allowNull: true
  },
  billloading_shipping_mark: {
    // 运输标记
    type: db.STRING(200),
    allowNull: true
  },
  billloading_forwarder_code: {
    //
    type: db.STRING(20),
    allowNull: true
  },
  billloading_forwarder_name: {
    //
    type: db.STRING(50),
    allowNull: true
  },
  billloading_forwarder_tel: {
    //
    type: db.STRING(50),
    allowNull: true
  },
  billloading_exporter_name: {
    //
    type: db.STRING(50),
    allowNull: true
  },
  billloading_exporter_tel: {
    //
    type: db.STRING(50),
    allowNull: true
  },
  billloading_exporter_address: {
    //
    type: db.STRING(200),
    allowNull: true
  },
  billloading_exporter_tin: {
    //
    type: db.STRING(50),
    allowNull: true
  },
  billloading_expected_carry_date: {
    // 预计到达日期
    type: db.STRING(50),
    allowNull: true
  }
})
