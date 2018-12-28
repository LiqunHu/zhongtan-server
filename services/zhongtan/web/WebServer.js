const moment = require('moment')
const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const MarkdownIt = require('../../../util/markdown.js')
const model = require('../../../app/model')

const tb_web_article = model.zhongtan_web_article
const tb_sail_schedule_upload = model.zhongtan_sail_schedule_upload
const tb_uploadfile = model.zhongtan_uploadfile

exports.getHomePageBoardAct = async () => {
  let returnData = {
    data: {
      message: [],
      schedule: []
    }
  }

  let messages = await tb_web_article.findAll({
    where: {
      web_article_type: '1'
    },
    limit: 5,
    order: [['created_at', 'DESC']]
  })
  for (let m of messages) {
    returnData.data.message.push({
      web_article_id: m.web_article_id,
      web_article_title: m.web_article_title,
      created_at: moment(m.created_at).format('YYYY/MM/DD')
    })
  }

  let schedules = await tb_sail_schedule_upload.findAll({
    limit: 5,
    order: [['created_at', 'DESC']]
  })
  for (let s of schedules) {
    let row = {
      sail_schedule_upload_id: s.sail_schedule_upload_id,
      sail_schedule_upload_desc: s.sail_schedule_upload_desc,
      created_at: moment(s.created_at).format('YYYY/MM/DD'),
      files: []
    }
    let files = await tb_uploadfile.findAll({
      where: {
        api_name: 'SAILSCHEDULECONTROL',
        uploadfile_index1: s.sail_schedule_upload_id
      }
    })
    for (let f of files) {
      row.files.push({
        uploadfile_id: f.uploadfile_id,
        uploadfile_name: f.uploadfile_name,
        uploadfile_url: f.uploadfile_url
      })
    }
    returnData.data.schedule.push(row)
  }

  logger.debug(returnData)
  return common.success(returnData)
}

exports.getMessagesAct = async () => {
  let returnData = {
    data: {
      messages: []
    }
  }

  let messages = await tb_web_article.findAll({
    where: {
      web_article_type: '1'
    },
    limit: 50,
    order: [['created_at', 'DESC']]
  })

  for (let m of messages) {
    returnData.data.messages.push({
      web_article_id: m.web_article_id,
      web_article_title: m.web_article_title,
      created_at: moment(m.created_at).format('YYYY/MM/DD')
    })
  }

  return common.success(returnData)
}

exports.getScheduleAct = async () => {
  let returnData = {
    data: {
      schedule: []
    }
  }

  let schedule = await tb_sail_schedule_upload.findAll({
    limit: 50,
    order: [['created_at', 'DESC']]
  })
  for (let s of schedule) {
    let row = {
      sail_schedule_upload_id: s.sail_schedule_upload_id,
      sail_schedule_upload_desc: s.sail_schedule_upload_desc,
      created_at: moment(s.created_at).format('YYYY/MM/DD'),
      files: []
    }
    let files = await tb_uploadfile.findAll({
      where: {
        api_name: 'SAILSCHEDULE',
        uploadfile_index1: s.sail_schedule_upload_id
      }
    })
    for (let f of files) {
      row.files.push({
        uploadfile_id: f.uploadfile_id,
        uploadfile_name: f.uploadfile_name,
        uploadfile_url: f.uploadfile_url
      })
    }
    returnData.data.schedule.push(row)
  }

  return common.success(returnData)
}

exports.getArticleAct = async req => {
  let doc = common.docValidate(req)

  let article = await tb_web_article.findOne({
    where: {
      web_article_id: doc.web_article_id
    }
  })

  let returnData = JSON.parse(JSON.stringify(article))

  returnData.web_article_markdown = MarkdownIt.render(returnData.web_article_body)
  returnData.created_at = moment(article.created_at).format('YYYY/MM/DD')
  return common.success(returnData)
}
