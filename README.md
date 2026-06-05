# 记账本 MVP

这是一个个人离线记账 App 原型，适合先在安卓手机浏览器里使用。它不需要登录、不需要联网，数据保存在当前浏览器本地。

App 的正式网页资源在 `www/` 目录中，安卓封装也会使用这一份文件。

## 已完成功能

- 首次使用录入微信、支付宝、银行卡、校园卡初始余额
- 支出、收入、转账三类流水
- 支出和收入使用固定分类列表
- 支出可标记特殊账单
- 流水支持编辑、删除和筛选
- 首页显示今日支出、预算剩余、总余额
- 统计页显示分类占比、每日趋势、账户余额、大额支出、特殊账单
- 设置页支持账户启用/停用、预算修改、CSV 导出/导入
- 支持 PWA 离线缓存，安卓浏览器可添加到桌面

## 本地运行

如果电脑已安装 Node.js，在本目录运行：

```bash
node serve.js
```

默认地址是 `http://localhost:4173`。

## 封装成安卓 App

当前项目已经接入 Capacitor，并生成了 Android 工程：

```text
android/
```

你安装 Android Studio 后，按下面步骤操作：

1. 打开 Android Studio。
2. 选择 `Open`。
3. 打开这个目录：`D:\aiworkspace\记账本\android`
4. 等 Android Studio 自动同步 Gradle 和安装缺少的 Android SDK。
5. 点击菜单：`Build -> Build Bundle(s) / APK(s) -> Build APK(s)`。
6. 打包完成后，APK 通常在：

```text
D:\aiworkspace\记账本\android\app\build\outputs\apk\debug\app-debug.apk
```

也可以在安装好 Android Studio 和 SDK 后，用命令行打包：

```powershell
cd D:\aiworkspace\记账本\android
.\gradlew.bat assembleDebug
```

如果修改了 `www/` 里的网页文件，重新同步到安卓工程：

```powershell
cd D:\aiworkspace\记账本
npx cap sync android
```

说明：当前电脑还没有完整 Android 构建环境，直接命令行构建时 Gradle 下载超时。项目结构已经准备好，安装 Android Studio 后再打开 `android/` 会更稳。

## 安卓手机使用

1. 让电脑和手机连接同一个局域网。
2. 在电脑启动静态服务器。
3. 用手机浏览器访问电脑的局域网地址和端口。
4. 浏览器菜单中选择“添加到主屏幕”。

## 数据说明

- App 内部数据保存在浏览器 `localStorage` 中。
- CSV 导出会生成 `accounts.csv`、`transactions.csv`、`budgets.csv` 三个文件。
- CSV 导入会覆盖当前本地数据，导入前建议先导出一份备份。

## 后续转原生安卓

当前版本已经把 MVP 的页面、数据结构和核心计算规则跑通。后续安装 Android Studio 和 Android SDK 后，可以把同样的数据模型迁移到 Kotlin + Jetpack Compose + Room，并封装成 APK。
