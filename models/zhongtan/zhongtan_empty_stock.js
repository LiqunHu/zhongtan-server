const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_empty_stock', {
  empty_stock_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  empty_stock_container_no: {
    // 箱号
    type: db.STRING(20),
    allowNull: false
  },
  empty_stock_size_type: {
    // 箱型
    type: db.STRING(20),
    allowNull: true
  },
  empty_stock_container_owner: {
    // 持箱人
    type: db.STRING(20),
    allowNull: true
  },
  empty_stock_container_status: {
    // 箱状态 0记录, 1在场, 2离场
    type: db.STRING(5),
    allowNull: false,
    defaultValue: '0',
  },
  empty_stock_in_depot_name: {
    // 进箱堆场
    type: db.STRING(20),
    allowNull: true
  },
  empty_stock_out_depot_name: {
    // 出箱堆场
    type: db.STRING(20),
    allowNull: true
  },
  empty_stock_in_bill_no: {
    // 进箱提单号
    type: db.STRING(20),
    allowNull: true
  },
  empty_stock_out_bill_no: {
    // 出箱提单号
    type: db.STRING(20),
    allowNull: true
  },
  empty_stock_discharge_date: {
    // 卸船日期(进口)
    type: db.STRING(20),
    allowNull: true
  },
  empty_stock_gate_out_terminal_date: {
    // 码头出场日期(进口)
    type: db.STRING(20),
    allowNull: true
  },
  empty_stock_gate_in_depot_date: {
    // 堆场进场日期(进口)
    type: db.STRING(20),
    allowNull: true
  },
  empty_stock_gate_out_depot_date: {
    // 堆场出场日期(出口)
    type: db.STRING(20),
    allowNull: true
  },
  empty_stock_gate_in_terminal_date: {
    // 码头进场日期(出口)
    type: db.STRING(20),
    allowNull: true
  },
  empty_stock_loading_date: {
    // 装船日期(出口)
    type: db.STRING(20),
    allowNull: true
  },
  empty_stock_detention_days: {
    // 滞留天数(装船 - 卸船)
    type: db.STRING(20),
    allowNull: true
  },
  empty_stock_storing_days: {
    // 堆存天数(堆场出场 - 堆场进场)
    type: db.STRING(20),
    allowNull: true
  }
})
