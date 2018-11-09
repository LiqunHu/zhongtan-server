const db = require('../../util/db');

module.exports = db.defineModel('tbl_zhongtan_web_article', {
  web_article_id: {
    type: db.IDNO,
    autoIncrement: true,
    primaryKey: true
  },
  web_article_type: {
    type: db.STRING(10) // 1-通知信息
  }, 
  web_article_title: {
    type: db.STRING(200),
    allowNull: true
  },
  web_article_author: {
    type: db.STRING(200),
    allowNull: true
  },
  web_article_body: {
    type: db.TEXT,
    allowNull: true
  },
  web_article_img: {
    type: db.STRING(300),
    allowNull: true
  }
});