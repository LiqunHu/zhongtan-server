const db = require('../../app/db')
// 提单模板

module.exports = db.defineModel('tbl_zhongtan_billlading_template', {
  billlading_template_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  billlading_customer_id: {
    type: db.UUID,
    allowNull: true
  },
  billlading_id: {
    // 提单号
    type: db.IDNO,
    allowNull: false
  },
  billlading_template_name: {
    // 模板名称
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  } 
})
