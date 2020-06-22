const db = require('../../app/db')
// 费用

module.exports = db.defineModel('tbl_zhongtan_overdue_charge_rule', {
  overdue_charge_rule_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  overdue_charge_cargo_type: {
    // IM/TR
    type: db.STRING(10),
    allowNull: false
  },
  overdue_charge_discharge_port: {
    // 目的港
    type: db.STRING(20),
    allowNull: false
  },
  overdue_charge_carrier: {
    // COSCO/OOCL
    type: db.STRING(10),
    allowNull: false
  },
  overdue_charge_container_size: {
    // 箱尺寸 箱型
    type: db.STRING(10),
    allowNull: false
  },
  overdue_charge_min_day: {
    // 最新天数
    type: db.STRING(10),
    allowNull: false
  },
  overdue_charge_max_day: {
    // 最大天数
    type: db.STRING(10),
    allowNull: false
  },
  overdue_charge_amount: {
    // 金额
    type: db.STRING(20),
    allowNull: false
  },
  overdue_charge_currency: {
    // 币种
    type: db.STRING(10),
    defaultValue: 'USD',
    allowNull: false
  },
  overdue_charge_enabled_date: {
    // 启用日期
    type: db.STRING(20),
    allowNull: true
  }
})
