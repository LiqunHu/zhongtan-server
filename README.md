## node环境
推荐用nvm 统一管理node 环境  
ubuntu:  wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.33.0/install.sh | bash  
windows: https://github.com/coreybutler/nvm-windows/releases  

nvm install 10.13.0  
nvm use 10.13.0  

国内npm下载慢可使用cnpm  
npm install -g cnpm --registry=https://registry.npm.taobao.org  

## IDE环境
统一使用VS CODE  https://code.visualstudio.com/
setting中增加   
```
"vetur.format.defaultFormatterOptions": {
    "prettyhtml": {
      "printWidth": 200, // No line exceeds 100 characters
      "singleQuote": false // Prefer double quotes over single quotes
    }
  },
```
必须插件:  
vetur vue代码美化以及格式化插件
Prettier vscode formatter

## docker 环境
https://www.docker.com  
ubuntu:  
root用户下执行:  
apt-get update  
apt-get install \  
    apt-transport-https \  
    ca-certificates \  
    curl \  
    software-properties-common  
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -  
add-apt-repository \  
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \  
   $(lsb_release -cs) \  
   stable"  
apt-get update  
apt-get install docker-ce  
增加国内镜像  
```
 /etc/docker/daemon.json
{
  "registry-mirrors": ["https://07myvdj8.mirror.aliyuncs.com"]
}

```

gpasswd -a 用户 docker  将用户加到docker组中  

## 主要功能插件

| Project | Description |
|---------|-------------|
| [lodash]          | 常用操作函数 |
| [express]         | web框架 |
| [ws]              | WebSocket |
| [crypto-js]       | 加解密库 |
| [log4js]          | 日志库 |
| [sequelize]       | 数据库操作ORM 组件 |
| [node-schedule]   | 定时任务组件 |
| [joi]             | 入参校验以及swagger生成 |
| [mocha]           | nodejs测试框架 |
| [should]          | 测试框架结果判断 |
| [supertest]       | nodejs测试模拟调用service |

[lodash]: https://www.lodashjs.com
[express]: https://expressjs.com
[ws]: https://github.com/websockets/ws
[crypto-js]: https://github.com/brix/crypto-js
[log4js]: https://log4js-node.github.io/log4js-node/index.html
[sequelize]: http://docs.sequelizejs.com
[node-schedule]: https://github.com/node-schedule/node-schedule#readme
[joi]: https://github.com/hapijs/joi
[mocha]: https://mochajs.org/
[should]: https://github.com/shouldjs/should.js
[supertest]: https://github.com/visionmedia/supertest#readme

## 后台项目使用
1. cnpm install  

2. 首次运营项目  
bash init.sh 将初始化项目 建立mysql数据库以及运行初始化脚本
*mysql 端口 33306*
*redis 端口 16379*

2. 当重启docker或机器时.  
   bash boot.sh  

3. npm run start / debug 启动项目  
默认后台端口9090

4. npm run genswagger 产生seagger 文档  
9090/swagger 访问swagger文档
