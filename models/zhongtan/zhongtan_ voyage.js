const db = require('../../util/db');
// 航班表

module.exports = db.defineModel('tbl_zhongtan_vessel', {
  voyage_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  vessel_id: {
    type: db.IDNO,
    allowNull: false
  },
  voyage_code: { // 航线编码
    type: db.STRING(100),
    allowNull: false
  },
  voyage_cycke: { // 航线轮次
    type: db.STRING(10),
    allowNull: false
  }
});