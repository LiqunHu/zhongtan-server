const db = require('../../util/db');
// 集装箱表

module.exports = db.defineModel('tbl_zhongtan_container', {
  container_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  billlading_id: { // 提单号
    type: db.STRING(100),
  },
  container_no: { // 箱号
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
  container_iso: { // 集装箱ISO 型号
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  container_size: { // 集装箱大小
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  container_type: { // 集装箱类型
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  container_seal_no1: { // 封号1
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  container_seal_no2: { // 封号2
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  container_seal_no3: { // 封号3
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  container_freight_indicator: { // 运费指示器
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  container_goods_description: { // 运费指示器
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  container_package_no: { // 包装数
    type: db.INTEGER(20),
    defaultValue: '0',
    allowNull: false
  },
  container_package_unit: { // 包装类型
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  container_volume: { // 体积
    type: db.INTEGER(20),
    defaultValue: '0',
    allowNull: false
  },
  container_volume_unit: { // 体积单位
    type: db.STRING(20),
    defaultValue: '0',
    allowNull: false
  },
  container_weight: { // 重量
    type: db.INTEGER(20),
    defaultValue: '0',
    allowNull: false
  },
  container_weight_unit: { // 重量单位
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  container_minmum_temperature: { // 最低温度
    type: db.INTEGER(20),
    allowNull: true
  },
  container_maxmum_temperature: { // 最高温度
    type: db.INTEGER(20),
    allowNull: true
  },
  container_refer_plug: { // 
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  }
});