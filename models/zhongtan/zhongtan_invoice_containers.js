const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_invoice_containers', {
  invoice_containers_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  invoice_vessel_id: {
    type: db.IDNO,
    allowNull: false
  },
  invoice_containers_bl: {
    // #M B/L No
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_containers_type: {
    // Type Of Container
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_containers_no: {
    // Container No
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  invoice_containers_size: {
    // Container Size
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_containers_seal1: {
    // Seal No.1
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_containers_seal2: {
    // Seal No.2
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_containers_seal3: {
    // Seal No.3
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_containers_freight_indicator: {
    // Freight Indicator
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_containers_package_no: {
    // No Of Package
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_containers_package_unit: {
    // Package Unit
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_containers_volumn: {
    // Volumn
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_containers_volumn_unit: {
    // Volumn Unit
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_containers_weight: {
    // Weight
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  invoice_containers_weight_unit: {
    // Weight Unit
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_containers_plug_reefer: {
    // Plug type of reefer
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_containers_min_temperature: {
    // Minimum Temperature
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_containers_max_temperature: {
    // Maximum Temperature
    type: db.STRING(10),
    defaultValue: '',
    allowNull: false
  },
  invoice_containers_state: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_containers_empty_return_date: {
    // 还空日期
    type: db.STRING(20),
    allowNull: true
  },
  invoice_containers_empty_return_overdue_days: {
    // 还空超期天数
    type: db.STRING(10),
    allowNull: true
  },
  invoice_containers_empty_return_overdue_amount: {
    // 还空超期金额
    type: db.STRING(50),
    allowNull: true
  },
  invoice_containers_empty_return_date_invoice: {
    // 开票还空开票日期
    type: db.STRING(20),
    allowNull: true
  },
  invoice_containers_empty_return_overdue_days_invoice: {
    // 开票还空超期天数
    type: db.STRING(10),
    allowNull: true
  },
  invoice_containers_empty_return_overdue_amount_invoice: {
    // 开票还空超期金额
    type: db.STRING(50),
    allowNull: true
  },
  invoice_containers_empty_return_date_receipt: {
    // 收据还空开票日期
    type: db.STRING(20),
    allowNull: true
  },
  invoice_containers_empty_return_overdue_days_receipt: {
    // 收据还空超期天数
    type: db.STRING(10),
    allowNull: true
  },
  invoice_containers_empty_return_overdue_amount_receipt: {
    // 收据还空超期金额
    type: db.STRING(50),
    allowNull: true
  },
  invoice_containers_empty_return_invoice_date: {
    // 还空开票日期
    type: db.DATE,
    allowNull: true
  },
  invoice_containers_empty_return_invoice_release_date: {
    // 还空开票release日期
    type: db.DATE,
    allowNull: true
  },
  invoice_containers_empty_return_receipt_date: {
    // 还空收据日期
    type: db.DATE,
    allowNull: true
  },
  invoice_containers_empty_return_receipt_release_date: {
    // 还空收据release日期
    type: db.DATE,
    allowNull: true
  },
  invoice_containers_actually_return_date: {
    // 还空场站EDI日期
    type: db.STRING(20),
    allowNull: true
  },
  invoice_containers_actually_return_overdue_days: {
    // 还空场站
    type: db.STRING(10),
    allowNull: true
  },
  invoice_containers_actually_return_overdue_amount: {
    type: db.STRING(50),
    allowNull: true
  },
  invoice_containers_customer_id: {
    type: db.STRING(50),
    allowNull: true
  },
  invoice_containers_actually_return_edi_date: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_containers_depot_name: {
    // 场站名称
    type: db.STRING(50),
    allowNull: true
  },
  invoice_containers_empty_return_overdue_free_days: {
    // 免箱期
    type: db.STRING(10),
    allowNull: true
  },
  invoice_containers_empty_return_date_receipt_no: {
    // 收据编号
    type: db.STRING(50),
    allowNull: true
  },
  invoice_containers_actually_gate_out_edi_date: {
    // gate out
    type: db.STRING(50),
    allowNull: true
  },
  invoice_containers_actually_gate_out_date: {
    // gate out
    type: db.STRING(50),
    allowNull: true
  },
})
