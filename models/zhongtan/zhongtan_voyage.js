const db = require('../../app/db')
// 航班表

module.exports = db.defineModel('tbl_zhongtan_voyage', {
  voyage_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  vessel_id: {
    type: db.IDNO,
    allowNull: false
  },
  voyage_number: {
    // 航线编码
    type: db.STRING(100),
    unique: 'voyage_number',
    allowNull: false
  },
  voyage_eta_date: {
    // 开始日期
    type: db.DATEONLY,
    allowNull: false
  },
  voyage_atd_date: {
    // 开始日期
    type: db.DATEONLY,
    allowNull: false
  }
})
