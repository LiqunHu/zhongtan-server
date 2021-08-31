const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_export_proforma_vessel', {
  export_vessel_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  export_vessel_code: {
    // 船公司
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_vessel_name: {
    // 船名
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_vessel_voyage: {
    // 航次
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_vessel_etd: {
    // 计划开船日期
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  proforma_import: {
    // proforma 导入
    type: db.STRING(5),
    defaultValue: '0',
    allowNull: false
  },
  loading_list_import: {
    // loading list 导入
    type: db.STRING(5),
    defaultValue: '0',
    allowNull: false
  },
  shipment_list_import: {
    // shipment list 导入
    type: db.STRING(5),
    defaultValue: '0',
    allowNull: false
  },
  export_vessel_total_prepaid: {
    // 合计预付款
    type: db.STRING(20),
    allowNull: true
  },
  export_vessel_call_sign: {
    // CALL SIGN
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_total_units: {
    // 
    type: db.STRING(10),
    defaultValue: '',
    allowNull: true
  },
})
