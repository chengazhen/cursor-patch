# Fake Cu*sor

一个用于重新生成 `Cu*sor` 设备 ID 和设置 `Access Token` 的 `Cu*sor` 扩展.

## 0.45.x 版本需要使用`Fake Cu*sor: Patch Machine ID`命令修补机器码获取逻辑


## 功能

- 重新生成设备 ID(devDeviceId), 并清空认证信息:
  `Fake Cu*sor: Regenerate Device ID`
- 读取 Access Token: `Fake Cu*sor: Read Token`
- 查看使用情况: `Fake Cu*sor: Show Usage`
- 重新生成设备 ID（devDeviceId）, 并设置 Access Token:
  `Fake Cu*sor: Regenerate & Set Token`
- 修补机器码获取逻辑: `Fake Cu*sor: Patch Machine ID`


## 使用方法

### 一般使用流程: 

1. 按下 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac) 打开命令面板
2. [0.45.x 版本]选择 `Fake Cu*sor: Patch Machine ID` 命令
3. 选择 `Fake Cu*sor: Regenerate Device ID` 命令
4. 根据提示完成操作
5. Cu*sor 将自动退出, 重启后生效

### 另: 

1. 按下 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac) 打开命令面板
2. 选择以下命令之一:
   - `Fake Cu*sor: Regenerate Device ID`: 重新生成设备 ID 并清空认证信息
   - `Fake Cu*sor: Read Token`: 读取当前的 Access Token
   - `Fake Cu*sor: Show Usage`: 显示 Cu*sor 的使用情况
   - `Fake Cu*sor: Regenerate & Set Token`: 重新生成设备 ID 并设置 Access
     Token（可从 `cu*sor.sh` 网站 `Cook,es` 中的 `WorkosCu*sorSessionToken` 获取, 如
     `user_01OJGGAOEIIYNGY4ISYAJT1U8R%3A%3AeyJhbGciOiJIU...` 中 `%3A%3A` 后面的

     `eyJhbGciOiJIU...` ）
   - `Fake Cu*sor: Patch Machine ID`: 修补 Cu*sor 的机器码获取逻辑
3. 根据提示完成操作
4. 操作完成后 Cu*sor 将自动退出, 重启后生效


## 配置选项

在 Cu*sor 设置中可以配置以下选项:

- `fake-cu*sor.storagePath`: 自定义配置文件所在文件夹的路径. 留空则使用默认路径: 
  - Windows: `%APPDATA%/Cu*sor/User/globalStorage`
  - macOS: `~/Library/Application Support/Cu*sor/User/globalStorage`
  - Linux: `~/.config/Cu*sor/User/globalStorage`

- **使用情况监控配置**:
  - `fake-cu*sor.usageMonitor.checkInterval`: 检查间隔（秒），最小为 20 秒
  - `fake-cu*sor.usageMonitor.usageCountThreshold`:
    使用次数阈值，达到该值时发出警告
  - `fake-cu*sor.usageMonitor.usageRemainingThreshold`:
    剩余次数阈值，达到该值时发出警告


## 注意事项

- 执行命令前会自动备份原有配置文件（`.backup` 后缀）
- 支持 Windows、Mac 和 Linux 系统
- 操作会清空现有认证信息, 请确保备份重要数据
- 修改后需要重启 Cu*sor 才能生效
- 如果配置文件不存在, 可以手动选择文件夹位置
- 修补机器码功能仅支持 Cu*sor 0.45.x 版本，升级后需要重新执行
- 修补机器码后需要手动重启 Cu*sor 才能生效


## 开发

```bash
# 先把 package.json.zip 解压到当前目录
npm install
vsce package
```


## 免责声明

本扩展仅供学习和测试使用. 使用本扩展可能违反 Cursor 的服务条款,
请自行承担使用风险.


## 开源协议

本项目采用
[Creative Commons Attribution-NonCommercial 4.0 International License](https://creativecommons.org/licenses/by-nc/4.0/)
开源协议.

这意味着您可以:

- ✅ 复制、分发本项目
- ✅ 修改、演绎本项目
- ✅ 私人使用

但必须遵循以下规则:

- 📝 署名 - 标明原作者及修改情况
- 🚫 非商业性使用 - 不得用于商业目的
- 🔄 相同方式共享 - 修改后的作品需使用相同的协议
