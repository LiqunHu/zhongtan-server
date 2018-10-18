const db = require('../../util/db');

module.exports = db.defineModel('tbl_zhongtan_billoading', {
  billoading_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  billloading_no: { // 提单号
    type: db.STRING(100),
  },
  billloading_destination_place: { // 目的港
    type: db.STRING(100),
  },
  billloading_delivery_place: { // 交货地
    type: db.STRING(100),
  },
  billloading_discharge_port: { // 目的港
    type: db.STRING(100),
  },
  billloading_origin_port: { // 起始港
    type: db.STRING(100),
  },
  billloading_container_number: { // 集装箱数量
    type: db.INTEGER,
  },
  billloading_goods_description: { // 商品描述
    type: db.STRING(50),
  },
  billloading_package_number: { // 商品数量
    type: db.INTEGER,
  },
  billloading_package_unit: { // 商品单位
    type: db.STRING(50),
  },
  billloading_gross_weight: { // 毛重
    type: db.INTEGER,
  },
  billloading_gross_unit: { // 毛重单位
    type: db.STRING(50),
  },
  billloading_gross_volume: { // 毛体积
    type: db.STRING(50),
  },
});