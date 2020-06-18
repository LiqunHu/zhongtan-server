const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_uploadfile', {
  uploadfile_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  api_name: {
    type: db.STRING(100),
    allowNull: false
  },
  user_id: {
    type: db.UUID,
    allowNull: true
  },
  uploadfile_index1: {
    type: db.IDNO,
    allowNull: false
  },
  uploadfile_index2: {
    type: db.IDNO,
    allowNull: true
  },
  uploadfile_index3: {
    type: db.IDNO,
    allowNull: true
  },
  uploadfile_name: {
    type: db.STRING(200),
    defaultValue: '',
    allowNull: true
  },
  uploadfil_release_date: {
    type: db.DATE,
    allowNull: true
  },
  uploadfil_release_user_id: {
    type: db.UUID,
    allowNull: true
  },
  uploadfile_url: {
    type: db.STRING(500),
    defaultValue: '',
    allowNull: true
  },
  uploadfile_acttype: {
    type: db.STRING(20),
    defaultValue: '',
    allowNull: true
  },
  uploadfile_amount: {
    type: db.STRING(50),
    defaultValue: '',
    allowNull: true
  },
  uploadfile_currency: {
    type: db.STRING(10),
    defaultValue: '',
    allowNull: true
  },
  uploadfile_check_cash: {
    // check cash flag
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  uploadfile_check_no: {
    // check no
    type: db.STRING(200),
    defaultValue: '',
    allowNull: false
  },
  uploadfile_receipt_no: {
    // 收据号
    type: db.STRING(50),
    allowNull: true
  },
  uploadfile_received_from: {
    // 缴费者
    type: db.STRING(100),
    allowNull: true
  },
  uploadfile_state: {
    // 文件状态
    type: db.STRING(20),
    defaultValue: '',
    allowNull: false
  },
  uploadfile_remark: {
    type: db.STRING(1000),
    defaultValue: '',
    allowNull: true
  },
  uploadfile_amount_comment: {
    type: db.STRING(200),
    allowNull: true
  },
  uploadfil_undo_release_date: {
    type: db.DATE,
    allowNull: true
  },
  uploadfil_undo_release_user_id: {
    type: db.STRING(36),
    allowNull: true
  },
  uploadfile_customer_id: {
    type: db.STRING(50),
    allowNull: true
  },
  uploadfile_bank_reference_no: {
    type: db.STRING(200),
    allowNull: true
  },
})
