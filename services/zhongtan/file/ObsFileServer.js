const _ = require('lodash')
const moment = require('moment')
const GLBConfig = require('../../../util/GLBConfig')
const common = require('../../../util/CommonUtil')
const model = require('../../../app/model')
const Op = model.Op

const tb_obs_file = model.zhongtan_obs_file

const obsClient = require('../../../util/ObsClient')


exports.searchAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user
  let returnData = {}
  let queryStr = `select f.*, u.user_name from tbl_zhongtan_obs_file f left join tbl_common_user u on f.file_belong = u.user_id where f.state = ? AND (f.file_belong = ? OR f.file_auth = ?)`
  let replacements = [GLBConfig.ENABLE, user.user_id, '1']
  if(doc.fileName) {
    queryStr = queryStr + ' AND file_name LIKE ? AND file_type = ?'
    replacements.push('%' + doc.fileName + '%')
    replacements.push('1')
    if(doc.file_root_id) {
      queryStr = queryStr + ' AND file_root_id = ?'
      replacements.push(doc.file_root_id)
    }
  } else {
    if(doc.file_root_id) {
      queryStr = queryStr + ' AND file_root_id = ?'
      replacements.push(doc.file_root_id)
    } else {
      queryStr = queryStr + ' AND file_root_id IS NULL'
    }
  }
  queryStr += ' ORDER BY f.file_id DESC'
  let files = await model.simpleSelect(queryStr, replacements)
  if(files) {
    for(let f of files) {
      f.created_at = moment(f.created_at).format('YYYY-MM-DD HH:mm:ss')
    }
  }
  returnData.rows = files
  return common.success(returnData)
}

exports.createFolderAct = async req => {
  let doc = common.docValidate(req)
  let user = req.user
  if(doc.file_root_id) {
    let addFolder = await tb_obs_file.findOne({
      where: {
        state: GLBConfig.ENABLE,
        file_root_id: doc.file_root_id,
        file_type: '0',
        file_name: doc.folder_name,
        file_belong: user.user_id
      }
    })
    if (addFolder) {
      return common.error('obs_01')
    }
  } else {
    let addFolder = await tb_obs_file.findOne({
      where: {
        state: GLBConfig.ENABLE,
        file_root_id: {
          [Op.eq]: null
        },
        file_type: '0',
        file_name: doc.folder_name,
        file_belong: user.user_id
      }
    })
    if (addFolder) {
      return common.error('obs_01')
    }
  }
  
  await tb_obs_file.create({
    file_root_id: doc.file_root_id ? doc.file_root_id : null,
    file_type: '0', // GLBConfig.OBS_FILE_TYPE
    file_name: doc.folder_name,
    file_auth: '0', // GLBConfig.OBS_FILE_AUTH
    file_belong: user.user_id
  })
  return common.success()
}

exports.changeAuthAct = async req => {
  let doc = common.docValidate(req)
  let changeFile = await tb_obs_file.findOne({
    where: {
      state: GLBConfig.ENABLE,
      file_id: doc.file_id,
    }
  })
  if(changeFile) {
    if(changeFile.file_auth === '0') {
      changeFile.file_auth = '1'
    } else {
      changeFile.file_auth = '0'
    }
    await changeFile.save()
    if(changeFile.file_auth === '1') {
      // 设置为public，则改文件夹父目录设置为public
      if(changeFile.file_root_id) {
        await changeRootPublic(changeFile.file_root_id)
      }
    } 
    if(changeFile.file_type === '0') {
      await changeSubAuth(changeFile.file_id, changeFile.file_auth)
    }
  }
  return common.success()
}

const changeRootPublic = async (file_root_id) => {
  let rootFile = await tb_obs_file.findOne({
    where: {
      state: GLBConfig.ENABLE,
      file_id: file_root_id,
    }
  })
  if(rootFile) {
    rootFile.file_auth = '1'
    await rootFile.save()
    if(rootFile.file_root_id) {
      await changeRootPublic(rootFile.file_root_id)
    }
  }
}

const changeSubAuth = async (file_id, file_auth) => {
  let subFiles = await tb_obs_file.findAll({
    where: {
      state: GLBConfig.ENABLE,
      file_root_id: file_id,
    }
  })
  if(subFiles) {
    for(let sf of subFiles) {
      sf.file_auth = file_auth
      await sf.save()
      if(sf.file_type === '0') {
        await changeSubAuth(sf.file_id, file_auth)
      }
    }
  }
}

exports.uploadFileAct = async req => {
  let fileInfo = await common.fileSaveTemp(req)
  return common.success(fileInfo)
}

exports.saveFilesAct = async req => {
  let doc = common.docValidate(req)
  let file_root_id = doc.row ? doc.row.file_id : null
  let user = req.user
  let year = moment().format('YYYY')
  let month = moment().format('MM')
  let day = moment().format('DD')
  let faileds = []
  if(doc && doc.files && doc.files.length > 0) {
    let file_auth = '0'
    if(file_root_id) {
      let rootFile = await tb_obs_file.findOne({
        where: {
          state: GLBConfig.ENABLE,
          file_id: file_root_id
        }
      })
      if(rootFile) {
        file_auth = rootFile.file_auth
      }
    }
    for(let f of doc.files) {
      let fileKey =  'zhongtan/userFiles/' + user.user_id + '/' + year + '/' + month + '/' + day + '/' + f.name
      await obsClient.uploadFile2Obs(fileKey, f.path, async function uploadResult(file) {
        if(file && file.code === '0') {
          await tb_obs_file.create({
            file_root_id: file_root_id ? file_root_id : null,
            file_type: '1', // GLBConfig.OBS_FILE_TYPE
            file_bucket: 'zhongtan',
            file_key: fileKey,
            file_version: file.versionId ? file.versionId : null,
            file_name: f.name,
            file_ext: f.ext,
            file_size: f.size,
            file_size_value: await common.fileSize2Str(f.size),
            file_auth: file_auth, // GLBConfig.OBS_FILE_AUTH
            file_belong: user.user_id
          })
        } else {
          faileds.push(f.name + ' msg: ' + file.message )
        }
      })
    }
  }
  return common.success(faileds)
}

exports.downloadFileAct = async (req, res) => {
  let doc = common.docValidate(req)
  let user = req.user
  let downloadFile = await tb_obs_file.findOne({
    where: {
      state: GLBConfig.ENABLE,
      file_id: doc.file_id,
      file_type: '1'
    }
  })
  if(downloadFile) {
    if(downloadFile.file_auth === '1' || downloadFile.file_belong === user.user_id) {
      obsClient.downloadFile2Obs(downloadFile.file_key, downloadFile.file_version, function downloadResult(file) {
        if(file && file.code === '0') {
          res.send(file.data)
        } else {
          res.status(700).send({errno: 'obs_03', msg: file.message})
        }
      })
    } else {
      res.status(700).send({errno: 'obs_03', msg: 'can not download private file'})
    }
    // let fileKey = 'zhongtan/userFiles/fb8b42f0-6fd0-11ea-bda3-2d14e89eb213/2023/03/21/fb8b42f0-6fd0-11ea-bda3-2d14e89eb213/eb80e6f55ba14750b974164237d148b4.xlsx'
  } else {
    res.status(700).send({errno: 'obs_03', msg: 'no file'})
  }
}

exports.searchAdminAct = async req => {
  let doc = common.docValidate(req)
  let returnData = {}
  let queryStr = `select f.*, u.user_name from tbl_zhongtan_obs_file f left join tbl_common_user u on f.file_belong = u.user_id where f.state = ?`
  let replacements = [GLBConfig.ENABLE]
  if(doc.fileName) {
    queryStr = queryStr + ' AND file_name LIKE ? AND file_type = ?'
    replacements.push('%' + doc.fileName + '%')
    replacements.push('1')
    if(doc.file_root_id) {
      queryStr = queryStr + ' AND file_root_id = ?'
      replacements.push(doc.file_root_id)
    }
  } else {
    if(doc.file_root_id) {
      queryStr = queryStr + ' AND file_root_id = ?'
      replacements.push(doc.file_root_id)
    } else {
      queryStr = queryStr + ' AND file_root_id IS NULL'
    }
  }

  queryStr += ' ORDER BY f.file_id DESC'
  let files = await model.simpleSelect(queryStr, replacements)
  if(files) {
    for(let f of files) {
      f.created_at = moment(f.created_at).format('YYYY-MM-DD HH:mm:ss')
    }
  }
  returnData.rows = files
  return common.success(returnData)
}

exports.downloadFileAdminAct = async (req, res) => {
  let doc = common.docValidate(req)
  let downloadFile = await tb_obs_file.findOne({
    where: {
      state: GLBConfig.ENABLE,
      file_id: doc.file_id,
      file_type: '1'
    }
  })
  if(downloadFile) {
    obsClient.downloadFile2Obs(downloadFile.file_key, downloadFile.file_version, function downloadResult(file) {
      if(file && file.code === '0') {
        res.send(file.data)
      } else {
        res.status(700).send({errno: 'obs_03', msg: file.message})
      }
    })
  } else {
    res.status(700).send({errno: 'obs_03', msg: 'no file'})
  }
}