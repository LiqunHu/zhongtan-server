const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_billlading', {
  billlading_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  billlading_no: {
    // 提单号
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  billlading_type: {
    // 提单类型 进口出口
    type: db.STRING(10),
    allowNull: false
  },
  billlading_state: {
    // 提单状态
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  billlading_service_name: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  billlading_vessel_id: {
    type: db.IDNO,
    allowNull: true
  },
  billlading_voyage_id: {
    type: db.IDNO,
    allowNull: true
  },
  billlading_customer_id: {
    type: db.UUID,
    allowNull: true
  },
  container_manager_id: {
    // 箱管 id
    type: db.IDNO,
    allowNull: true
  },
  billlading_shipper_name: {
    // 发货人姓名
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  billlading_shipper_tel: {
    // 发货人电话
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  billlading_shipper_address: {
    // 发货人地址
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  },
  billlading_consignee_name: {
    // 收货人姓名
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  billlading_consignee_tel: {
    // 收货人电话
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  billlading_consignee_address: {
    // 收货人地址
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  },
  billlading_consignee_tin: {
    // 收货人tin
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  billlading_notify_name: {
    // 联系人姓名
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  billlading_notify_tel: {
    // 联系人电话
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  billlading_notify_address: {
    // 联系人地址
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  },
  billlading_notify_tin: {
    // 联系人tin
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  billlading_original_num: {
    // 提单原件数量
    type: db.STRING(10),
    defaultValue: '0',
    allowNull: false
  },
  billlading_copys_num: {
    // 提单拷贝数量
    type: db.STRING(10),
    defaultValue: '0',
    allowNull: false
  },
  billlading_loading_port_id: {
    // 起始港
    type: db.IDNO,
    allowNull: true
  },
  billlading_discharge_port_id: {
    // 目的港
    type: db.IDNO,
    allowNull: true
  },
  billlading_delivery_place: {
    // 交货地
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  billlading_stuffing_place: {
    // 装货地
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  billlading_stuffing_date: {
    // 装货日期
    type: db.DATEONLY,
    allowNull: true
  },
  billlading_stuffing_requirement: {
    //装货特殊要求
    type: db.STRING(500),
    allowNull: true
  },
  billlading_pay_date: {
    // 付款日期
    type: db.DATEONLY,
    allowNull: true
  },
  billlading_invoice_currency: {
    // 发票币种
    type: db.STRING(10),
    allowNull: true
  },
  billlading_invoice_value: {
    // 发票金额
    type: db.INTEGER,
    allowNull: true
  },
  billlading_freight_charge: {
    // 运费金额
    type: db.INTEGER,
    allowNull: true
  },
  billlading_freight_currency: {
    // 运费币种
    type: db.STRING(10),
    allowNull: true
  },
  billlading_imdg_code: {
    // IMDG code
    type: db.STRING(50),
    allowNull: true
  },
  billlading_packing_type: {
    // 打包类型
    type: db.STRING(10),
    allowNull: true
  },
  billlading_oil_type: {
    // oil类型
    type: db.STRING(10),
    allowNull: true
  },
  billlading_shipping_mark: {
    // 运输标记
    type: db.STRING(200),
    allowNull: true
  },
  billlading_forwarder_code: {
    //
    type: db.STRING(20),
    allowNull: true
  },
  billlading_forwarder_name: {
    //
    type: db.STRING(50),
    allowNull: true
  },
  billlading_forwarder_tel: {
    //
    type: db.STRING(50),
    allowNull: true
  },
  billlading_exporter_name: {
    //
    type: db.STRING(50),
    allowNull: true
  },
  billlading_exporter_tel: {
    //
    type: db.STRING(50),
    allowNull: true
  },
  billlading_exporter_address: {
    //
    type: db.STRING(200),
    allowNull: true
  },
  billlading_exporter_tin: {
    //
    type: db.STRING(50),
    allowNull: true
  },
  billlading_expected_carry_date: {
    // 预计到达日期
    type: db.STRING(50),
    allowNull: true
  },
  billlading_hbl_no: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  billlading_reference_type: {
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  billlading_reference_no: {
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  billlading_bl_type: {
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  billlading_declare_number: {
    type: db.STRING(30),
    defaultValue: '',
    allowNull: false
  },
  billlading_cso: {
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  billlading_teu_standard: {
    type: db.INTEGER,
    allowNull: true
  },
  billlading_feu_standard: {
    type: db.INTEGER,
    allowNull: true
  },
  billlading_feu_high_cube: {
    type: db.INTEGER,
    allowNull: true
  }
})
