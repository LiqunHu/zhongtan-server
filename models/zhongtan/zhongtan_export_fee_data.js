const db = require('../../app/db')
// 费用

module.exports = db.defineModel('tbl_zhongtan_export_fee_data', {
  fee_data_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  fee_data_code: {
    type: db.STRING(50),
    allowNull: false
  },
  fee_data_name: {
    type: db.STRING(50),
    allowNull: false
  },
  fee_data_type: {
    type: db.STRING(10),
    allowNull: false
  },
  fee_data_container_size: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  fee_data_receivable: {
    type: db.STRING(5),
    allowNull: false
  },
  fee_data_receivable_fixed: {
    type: db.STRING(5),
    allowNull: true
  },
  fee_data_receivable_amount: {
    type: db.STRING(50),
    allowNull: true
  },
  fee_data_receivable_amount_currency: {
    type: db.STRING(20),
    allowNull: true
  },
  fee_data_payable: {
    type: db.STRING(5),
    allowNull: false
  },
  fee_data_payable_fixed: {
    type: db.STRING(5),
    allowNull: true
  },
  fee_data_payable_amount: {
    type: db.STRING(50),
    allowNull: true
  },
  fee_data_payable_amount_currency: {
    type: db.STRING(20),
    allowNull: true
  },
  fee_data_transit: {
    // 过境/本地
    type: db.STRING(10),
    defaultValue: '0',
    allowNull: false
  },
  fee_data_payable_common_party: {
    // 通用固定代理
    type: db.STRING(20),
    allowNull: true
  },
  fee_data_payable_cosco_party: {
    // cosco固定代理
    type: db.STRING(20),
    allowNull: true
  },
  fee_data_payable_oocl_party: {
    // oolu固定代理
    type: db.STRING(20),
    allowNull: true
  }
})
