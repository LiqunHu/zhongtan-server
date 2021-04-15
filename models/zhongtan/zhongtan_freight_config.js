const db = require('../../app/db')
// 费用

module.exports = db.defineModel('tbl_zhongtan_freight_config', {
  freight_config_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  freight_config_vendor: {
    // 供应商
    type: db.STRING(50),
    allowNull: false
  },
  freight_config_business_type: {
    // 进出口
    type: db.STRING(20),
    allowNull: true
  },
  freight_config_cargo_type: {
    // 进口 IM/TR 出口 LOCAL/TRANSIT
    type: db.STRING(20),
    allowNull: false
  },
  freight_config_pol: {
    // 起运地
    type: db.STRING(20),
    allowNull: false
  },
  freight_config_pod: {
    // 目的地
    type: db.STRING(20),
    allowNull: false
  },
  freight_config_carrier: {
    // 代理
    type: db.STRING(20),
    allowNull: false
  },
  freight_config_size_type: {
    // 箱型
    type: db.STRING(20),
    allowNull: false
  },
  freight_config_amount: {
    // 总运费金额
    type: db.STRING(20),
    allowNull: false
  },
  freight_config_advance: {
    // 预付比例
    type: db.STRING(20),
    allowNull: false
  },
  freight_config_advance_amount: {
    // 预付金额
    type: db.STRING(20),
    allowNull: false
  },
  freight_config_enabled_date: {
    // 启用日期
    type: db.STRING(20),
    allowNull: false
  }
})
