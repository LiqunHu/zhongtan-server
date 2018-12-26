# 目录结构

---

在[快速入门]目录约定规范。

```bash
Server
├── package.json
├── app (整个目录中内容不建议修改)
│   └── index.js (增加大功能模块级别的路由时要修改)
├── bin (执行文件目录)
│   └── www(执行入口，不建议修改)
├── config (配置文件)
|   ├── config-default.js (默认配置文件)
|   └── config.test.js (可选)
├── doc (文档目录)
├── initscript (初始化脚本目录)
|   ├── sequence.sql (建库等纯sql脚本)
|   ├── init-db.js (初始化表脚本)
|   └── init-data.js (初始化数据脚本)
├── models (mysql数据库表对应的models，按功能模块划分)
├── public (swagger doc 等静态资源存放处)
├── routes (HTTP协议路由, 按大功能模块划分)
├── schedule (定时任务)
├── services (主要业务逻辑，按大功能模块划分)
├── test (mocha测试文件目录)
├── util (项目公共文件)
|   ├── CommonUtil.js (公共函数)
|   ├── Error.js (错误字典)
|   ├── GLBConfig.js (全局常量数据字典)
|   └── Sequence.js (序列函数)
├── wsroutes(websocket协议路由)
└── boot.sh(docker启动文件)
```
