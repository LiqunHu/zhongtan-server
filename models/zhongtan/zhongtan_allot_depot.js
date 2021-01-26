const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_allot_depot', {
  allot_depot_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  allot_depot_enabled: {
    // 启用日期
    type: db.STRING(20),
    allowNull: false
  },
  allot_depot_rules: {
    // 分配规则
    type: db.JSON,
    allowNull: false
  }
})
