const db = require('../../app/db')
// 提单表

module.exports = db.defineModel('tbl_zhongtan_obs_file', {
  file_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  file_root_id: {
    // 根目录id
    type: db.INTEGER,
    allowNull: true
  },
  file_type: {
    // 文件类型 
    type: db.STRING(10),
    allowNull: false
  },
  file_bucket: {
    // 文件桶 
    type: db.STRING(20),
    allowNull: true
  },
  file_key: {
    // 文件key 
    type: db.STRING(200),
    allowNull: true
  },
  file_version: {
    // 文件版本 
    type: db.STRING(50),
    allowNull: true
  },
  file_name: {
    // 文件名称 
    type: db.STRING(100),
    allowNull: false
  },
  file_ext: {
    // 文件后缀 
    type: db.STRING(10),
    allowNull: true
  },
  file_size: {
    // 文件大小 
    type: db.INTEGER,
    allowNull: true
  },
  file_size_value: {
    // 文件大小
    type: db.STRING(20),
    allowNull: true
  },
  file_auth: {
    // 文件权限 私有，公有 
    type: db.STRING(10),
    allowNull: false
  },
  file_belong: {
    // 文件所属用户 
    type: db.STRING(50),
    allowNull: true
  }
})
