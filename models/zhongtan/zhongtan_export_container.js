const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_export_container', {
  export_container_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  export_vessel_id: {
    // 船信息
    type: db.IDNO,
    allowNull: false
  },
  export_container_bl: {
    // 提单信息
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  export_container_no: {
    // 箱号
    type: db.STRING(20),
    allowNull: true
  },
  export_container_soc_type: {
    // SOC
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_size_type: {
    // 箱型箱类
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  export_container_cargo_weight: {
    // 货重
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  }
})
