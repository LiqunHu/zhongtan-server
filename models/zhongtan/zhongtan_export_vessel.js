const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_export_vessel', {
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
    type: db.STRING(50),
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
  }
})
