const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')

const tb_web_article = model.zhongtan_web_article

exports.searchAct = async req => {
  let returnData = {}

  let queryStr = 'select * from tbl_zhongtan_web_article where state = "1" and web_article_type = "1" order by created_at desc'
  let replacements = []

  let result = await model.queryWithCount(req, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = result.data

  logger.debug(returnData)

  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req)
  if (!doc.web_article_img) {
    doc.web_article_img = ''
  }

  let article = await tb_web_article.create({
    web_article_type: '1',
    web_article_title: doc.web_article_title,
    web_article_author: doc.web_article_author,
    web_article_body: doc.web_article_body,
    web_article_img: doc.web_article_img
  })
  return common.success(article)
}

exports.modifyAct = async req => {
  let doc = common.docValidate(req)

  let article = await tb_web_article.findOne({
    where: {
      web_article_id: doc.old.web_article_id
    }
  })
  article.web_article_title = doc.new.web_article_title
  article.web_article_author = doc.new.web_article_author
  article.web_article_body = doc.new.web_article_body
  await article.save()

  return common.success(article)
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let article = await tb_web_article.findOne({
    where: {
      web_article_id: doc.web_article_id
    }
  })

  article.destroy()

  return common.success()
}

exports.mduploadAct = async req => {
  let fileInfo = await common.fileSave(req, 'zhongtan')
  return common.success({
    uploadurl: fileInfo.url
  })
}

exports.mddeleteAct = async () => {
  // let doc = common.docValidate(req)
  // await FileSRV.fileDeleteByUrl('/files/upload/2018/11/14/aa596f6d-c073-4090-8f76-e790fc59f29c.jpg')

  return common.success()
}
