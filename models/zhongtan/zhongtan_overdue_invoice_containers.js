const db = require('../../app/db')
// 费用

module.exports = db.defineModel('tbl_zhongtan_overdue_invoice_containers', {
  overdue_invoice_containers_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  overdue_invoice_containers_invoice_uploadfile_id: {
    // 发票文件ID
    type: db.STRING(20),
    allowNull: false
  },
  overdue_invoice_containers_invoice_masterbi_id: {
    // 提单ID
    type: db.STRING(20),
    allowNull: false
  },
  overdue_invoice_containers_invoice_containers_id: {
    // 箱ID
    type: db.STRING(20),
    allowNull: false
  },
  overdue_invoice_containers_return_date: {
    // 还箱日期
    type: db.STRING(20),
    allowNull: false
  },
  overdue_invoice_containers_overdue_days: {
    // 超期天数
    type: db.STRING(10),
    allowNull: false
  },
  overdue_invoice_containers_overdue_increase_days: {
    // 新增超期天数
    type: db.STRING(10),
    allowNull: true
  },
  overdue_invoice_containers_overdue_amount: {
    // 超期费
    type: db.STRING(50),
    allowNull: false
  },
  overdue_invoice_containers_receipt_date: {
    // 收据日期
    type: db.DATE,
    allowNull: true
  },
  overdue_invoice_containers_overdue_discharge_date: {
    // 开始日期
    type: db.STRING(20),
    allowNull: true
  },
  overdue_invoice_containers_overdue_staring_date: {
    // 开始日期
    type: db.STRING(20),
    allowNull: true
  },
  overdue_invoice_containers_overdue_free_days: {
    // 免箱期
    type: db.STRING(10),
    allowNull: true
  },
  overdue_invoice_containers_overdue_invoice_amount: {
    // 发票超期费
    type: db.STRING(50),
    allowNull: true
  },
})
