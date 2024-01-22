const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_finance_item', {
  finance_item_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  finance_item_type: {
    // 财务类型
    type: db.STRING(20),
    allowNull: false
  },
  finance_item_code: {
    // 项目编码
    type: db.STRING(20),
    allowNull: false
  },
  finance_item_name: {
    // 项目名称
    type: db.STRING(50),
    allowNull: false
  },
  finance_item_ccode: {
    // 项目分类编码
    type: db.STRING(20),
    allowNull: true
  },
  finance_item_cname: {
    // 项目分类名称
    type: db.STRING(20),
    allowNull: true
  },
  finance_item_calss_code: {
    // 项目大类编码
    type: db.STRING(20),
    allowNull: true
  },
  finance_item_calss_name: {
    // 项目大类名称
    type: db.STRING(20),
    allowNull: true
  }
})
