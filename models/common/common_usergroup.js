const db = require('../../app/db')

module.exports = db.defineModel('tbl_common_usergroup', {
  usergroup_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  usergroup_type: {
    type: db.STRING(3),
    defaultValue: '',
    allowNull: false
  },
  usergroup_code: { // 唯一标示用户组
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  usergroup_name: {
    type: db.STRING(50),
    defaultValue: '',
    allowNull: false
  },
  node_type: {
    type: db.STRING(2),
    defaultValue: '',
    allowNull: false
  },
  parent_id: {
    type: db.ID,
    defaultValue: '',
    allowNull: false
  }
})
