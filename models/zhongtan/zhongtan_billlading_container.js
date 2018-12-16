const db = require('../../util/db');
// 提单表

module.exports = db.defineModel('tbl_zhongtan_billlading_container', {
  billlading_container_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  billlading_id: { // 提单号
    type: db.IDNO,
    allowNull: false
  },
  billlading_container_number: { // 集装箱数量
    type: db.INTEGER,
    allowNull: true
  },
  billlading_container_size: { // 集装箱大小
    type: db.STRING(20)
  },
  billlading_container_type: { // 集装箱类型
    type: db.STRING(20)
  },
  billlading_container_goods_description: { // 商品描述
    type: db.STRING(50),
    allowNull: true
  },
  billlading_container_package_number: { // 商品数量
    type: db.INTEGER,
    allowNull: true
  },
  billlading_container_package_unit: { // 商品单位
    type: db.STRING(50),
    allowNull: true
  },
  billlading_container_gross_weight: { // 毛重
    type: db.INTEGER,
    allowNull: true
  },
  billlading_container_gross_unit: { // 毛重单位
    type: db.STRING(50),
    allowNull: true
  },
  billlading_container_gross_volume: { // 毛体积
    type: db.INTEGER,
    allowNull: true
  },
  billlading_container_gross_volume_unit: { // 毛体积单位
    type: db.STRING(50),
    allowNull: true
  },
  billlading_container_net_weight: { // 净重
    type: db.INTEGER,
    allowNull: true
  },
  billlading_container_net_weight_unit: { // 净重单位
    type: db.STRING(50),
    allowNull: true
  }
});