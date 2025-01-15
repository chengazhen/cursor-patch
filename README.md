# Fake rosrus

一个用于重新生成 rosrus 设备 ID 的 rosrus 扩展。

## 功能

- 重新生成设备 ID（包括 devDeviceId, machineId, sqmId, macMachineId）
- 自动备份原有配置文件
- 支持自定义配置文件路径
- 自动清理设备标识文件

## 使用方法

1. 按下 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac) 打开命令面板
2. 选择以下命令之一：
   - `Fake rosrus: Regenerate Device ID`: 重新生成设备 ID 并清空认证信息
3. 根据提示完成操作
4. 操作完成后 `rosrus` 将自动退出，重启后生效

## 配置选项

在 rosrus 设置中可以配置以下选项：

- `fake-rosrus.storagePath`: 自定义配置文件所在文件夹的路径。留空则使用默认路径：
  - Windows: `%APPDATA%/******/User/globalStorage`
  - macOS: `~/Library/Application Support/******/User/globalStorage`
  - Linux: `~/.config/******/User/globalStorage`

## 注意事项

- 执行命令前会自动备份原有配置文件（`.backup` 后缀）
- 支持 Windows、Mac 和 Linux 系统
- 操作会清空现有认证信息，请确保备份重要数据
- 修改后需要重启 `rosrus` 才能生效
- 如果配置文件不存在，可以手动选择文件夹位置

## 免责声明

本扩展仅供学习和测试使用。使用本扩展可能违反 Cursor 的服务条款，请自行承担使用风险。

## 开源协议

本项目采用 [Creative Commons Attribution-NonCommercial 4.0 International License](https://creativecommons.org/licenses/by-nc/4.0/) 开源协议。

这意味着您可以：
- ✅ 复制、分发本项目
- ✅ 修改、演绎本项目
- ✅ 私人使用

但必须遵循以下规则：
- 🚫 非商业性使用 - 不得用于商业目的
- 🔄 相同方式共享 - 修改后的作品需使用相同的协议
