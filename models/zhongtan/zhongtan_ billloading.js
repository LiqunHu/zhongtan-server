const db = require('../../util/db');

module.exports = db.defineModel('tbl_zhongtan_billoading', {
  billoading_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  billloading_no: { // 提单号
    type: db.STRING(100),
    allowNull: false
  },
  billloading_type: { // 提单类型 进口出口
    type: db.STRING(10),
    allowNull: false
  },
  billloading_state: { // 提单状态
    type: db.STRING(10),
    allowNull: false
  },
  billloading_destination_place: { // 目的港
    type: db.STRING(100),
    allowNull: true
  },
  billloading_delivery_place: { // 交货地
    type: db.STRING(100),
    allowNull: true
  },
  billloading_discharge_port: { // 目的港
    type: db.STRING(100),
    allowNull: true
  },
  billloading_origin_port: { // 起始港
    type: db.STRING(100),
    allowNull: true
  },
  billloading_container_number: { // 集装箱数量
    type: db.INTEGER,
    allowNull: true
  },
  billloading_goods_description: { // 商品描述
    type: db.STRING(50),
    allowNull: true
  },
  billloading_package_number: { // 商品数量
    type: db.INTEGER,
    allowNull: true
  },
  billloading_package_unit: { // 商品单位
    type: db.STRING(50),
    allowNull: true
  },
  billloading_gross_weight: { // 毛重
    type: db.INTEGER,
    allowNull: true
  },
  billloading_gross_unit: { // 毛重单位
    type: db.STRING(50),
    allowNull: true
  },
  billloading_gross_volume: { // 毛体积
    type: db.INTEGER,
    allowNull: true
  },
  billloading_gross_volume_unit: { // 毛体积单位
    type: db.STRING(50),
    allowNull: true
  },
  billloading_net_weight: { // 净重
    type: db.INTEGER,
    allowNull: true
  },
  billloading_net_weight_unit: { // 净重单位
    type: db.STRING(50),
    allowNull: true
  },
  billloading_invoice_value: { // 发票金额
    type: db.INTEGER,
    allowNull: true
  },
  billloading_invoice_currency: { // 发票币种
    type: db.STRING(10),
    allowNull: true
  },
  billloading_freight_charge: { // 运费金额
    type: db.INTEGER,
    allowNull: true
  },
  billloading_freight_currency: { // 运费币种
    type: db.STRING(10),
    allowNull: true
  },
  billloading_imdg_code: { // IMDG code
    type: db.STRING(50),
    allowNull: true
  },
  billloading_packing_type: { // 打包类型
    type: db.STRING(10),
    allowNull: true
  },
  billloading_oil_type: { // oil类型
    type: db.STRING(10),
    allowNull: true
  },
  billloading_shipping_mark: { // 运输标记
    type: db.STRING(200),
    allowNull: true
  },
  billloading_forwarder_code: { // 
    type: db.STRING(20),
    allowNull: true
  },
  billloading_forwarder_name: { // 
    type: db.STRING(50),
    allowNull: true
  },
  billloading_forwarder_tel: { // 
    type: db.STRING(50),
    allowNull: true
  },
  billloading_exporter_name: { // 
    type: db.STRING(50),
    allowNull: true
  },
  billloading_exporter_tel: { // 
    type: db.STRING(50),
    allowNull: true
  },
  billloading_exporter_address: { // 
    type: db.STRING(200),
    allowNull: true
  },
  billloading_exporter_tin: { // 
    type: db.STRING(50),
    allowNull: true
  },
  billloading_consignee_name: { // 收货人姓名
    type: db.STRING(50),
    allowNull: true
  },
  billloading_consignee_tel: { // 收货人电话 
    type: db.STRING(50),
    allowNull: true
  },
  billloading_consignee_address: { // 收货人地址 
    type: db.STRING(200),
    allowNull: true
  },
  billloading_consignee_tin: { // 收货人tin
    type: db.STRING(50),
    allowNull: true
  },
  billloading_notify_name: { // 联系人姓名
    type: db.STRING(50),
    allowNull: true
  },
  billloading_notify_tel: { // 联系人电话 
    type: db.STRING(50),
    allowNull: true
  },
  billloading_notify_address: { // 联系人地址 
    type: db.STRING(200),
    allowNull: true
  },
  billloading_notify_tin: { // 联系人tin
    type: db.STRING(50),
    allowNull: true
  },
  billloading_expected_carry_date: { // 预计到达日期
    type: db.STRING(50),
    allowNull: true
  }
});