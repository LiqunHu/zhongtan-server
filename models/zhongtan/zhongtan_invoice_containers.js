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
  invoice_containers_laden_release_date: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_containers_laden_release_overdue_days: {
    type: db.STRING(10),
    allowNull: true
  },
  invoice_containers_laden_release_overdue_amount: {
    type: db.STRING(50),
    allowNull: true
  },
  invoice_containers_laden_release_invoice_date: {
    type: db.DATE,
    allowNull: true
  },
  invoice_containers_laden_release_invoice_release_date: {
    type: db.DATE,
    allowNull: true
  },
  invoice_containers_laden_release_receipt_date: {
    type: db.DATE,
    allowNull: true
  },
  invoice_containers_laden_release_receipt_release_date: {
    type: db.DATE,
    allowNull: true
  },
  invoice_containers_empty_return_date: {
    type: db.STRING(20),
    allowNull: true
  },
  invoice_containers_empty_return_overdue_days: {
    type: db.STRING(10),
    allowNull: true
  },
  invoice_containers_empty_return_overdue_amount: {
    type: db.STRING(50),
    allowNull: true
  },
  invoice_containers_empty_return_invoice_date: {
    type: db.DATE,
    allowNull: true
  },
  invoice_containers_empty_return_invoice_release_date: {
    type: db.DATE,
    allowNull: true
  },
  invoice_containers_empty_return_receipt_date: {
    type: db.DATE,
    allowNull: true
  },
  invoice_containers_empty_return_receipt_release_date: {
    type: db.DATE,
    allowNull: true
  }
})
