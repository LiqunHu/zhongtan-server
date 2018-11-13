const db = require('../../util/db')
const GLBConfig = require('../../util/GLBConfig')

module.exports = db.defineModel('tbl_common_domainmenu', {
  domainmenu_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  domain_id: {
    type: db.IDNO,
    allowNull: true
  },
  domainmenu_name: {
    type: db.STRING(300),
    allowNull: false
  },
  domainmenu_icon: {
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  domainmenu_index: {
    type: db.INTEGER,
    defaultValue: '0',
    allowNull: false
  },
  api_id: {
    type: db.IDNO,
    allowNull: true
  },
  api_function: {
    type: db.STRING(100),
    defaultValue: '',
    allowNull: false
  },
  node_type: {
    // NODETYPEINFO
    type: db.STRING(2),
    allowNull: true
  },
  parent_id: {
    type: db.ID,
    allowNull: true
  },
  root_show_flag: {
    type: db.STRING(2),
    defaultValue: GLBConfig.TRUE // 1 need auth, 0 not
  }
})
