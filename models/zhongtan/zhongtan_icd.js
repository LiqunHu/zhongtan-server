const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_icd', {
  icd_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  icd_name: {
    // 堆场名称
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  icd_code: {
    // 堆场代码
    type: db.STRING(50),
    allowNull: false
  },
  icd_email: {
    // 堆场邮箱
    type: db.STRING(1000),
    allowNull: true
  },
  icd_tel: {
    // 堆场电话
    type: db.STRING(300),
    allowNull: true
  },
  icd_edi_type: {
    // edi文件类型
    type: db.STRING(20),
    defaultValue: 'EMAIL',
    allowNull: false
  },
  icd_server_name: {
    // 地址
    type: db.STRING(50),
    allowNull: true
  },
  icd_server_port: {
    // 端口
    type: db.STRING(50),
    allowNull: true
  },
  icd_server_username: {
    // 用户名
    type: db.STRING(50),
    allowNull: true
  },
  icd_server_password: {
    // 密码
    type: db.STRING(50),
    allowNull: true
  },
  icd_server_path: {
    // 上传路径
    type: db.STRING(200),
    allowNull: true
  },
})
