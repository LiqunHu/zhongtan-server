const SftpClient = require('ssh2-sftp-client');
const path = require('path')
const logger = require('../app/logger').createLogger(__filename)

const upload2SFTP = async (uploadParam) => {
  logger.error('SFTP-SSH 开始连接');
  logger.error(uploadParam);
  const sftp = new SftpClient(); // 创建 SFTP 客户端实例
  try {
    // 1. 连接 SFTP 服务器（同步风格：等待连接成功再执行后续操作）
    logger.error('正在连接 SFTP 服务器...');
    let sftpConfig = {
    host: uploadParam.host,    // 如：192.168.1.100
    port: uploadParam.port,                      // 默认 SFTP 端口（通常为 22）
    username: uploadParam.username,         // 如：root、sftpuser
    password: uploadParam.password,           // 密码认证（优先使用，简单）
    // 私钥认证（替代密码，更安全，推荐生产环境使用）
    // privateKey: fs.readFileSync(path.resolve(__dirname, 'id_rsa')), // 本地私钥路径
    // passphrase: '私钥密码', // 若私钥设置了密码，需填写
    readyTimeout: 10000,           // 连接超时时间（10秒）
  };
    await sftp.connect(sftpConfig);
    logger.error('SFTP 连接成功！');

    // 2. 确保远程目标目录存在（递归创建多级目录）
    await sftp.mkdir(uploadParam.path, true); // true = 递归创建
    logger.error(`远程目录已确保存在：${uploadParam.path}`);

    const absLocalPath = path.resolve(uploadParam.local_file); // 转为绝对路径
    // const stats = await fs.stat(absLocalPath); // 获取本地路径状态

    // 3.1 上传单个文件
    const remoteFilePath = path.join(uploadParam.path, path.basename(absLocalPath));
    logger.error(`正在上传文件：${absLocalPath} -> ${remoteFilePath}`);
    await sftp.put(absLocalPath, remoteFilePath); // 同步等待上传完成
    logger.error(`文件上传成功：${remoteFilePath}`);
    return true;
  } catch (error) {
    logger.error('\n❌ 上传失败：', error.message);
  } finally {
    // 4. 无论成功失败，都关闭 SFTP 连接（避免资源泄漏）
    if (sftp.connection) {
      logger.error('正在关闭 SFTP 连接...');
      await sftp.end();
      logger.error('SFTP 连接已关闭');
    }
  }
  return false;
}

module.exports = {
  upload2SFTP: upload2SFTP
}