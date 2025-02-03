# Change Log

All notable changes to the "fake-rosrus" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.0.0] - 2025-02-02

### Added
- 基础功能
  - 重新生成设备ID (Regenerate Device ID)
  - 读取当前Token (Read Token)
  - 设置新Token (Set Token)
  - 查看使用情况 (Show Usage)
  - 修改0.45.x版本机器码的获取方式 (Patch MachineId)

- 设备ID管理
  - 修补机器码获取逻辑
  - 自动备份

- 使用情况监控
  - 可配置的自动检查间隔 (20-86400秒)
  - 可配置的使用次数阈值提醒
  - 可配置的剩余次数阈值提醒
  - 支持显示完整的会员信息

### Configuration
- 支持自定义数据库路径
- 支持配置使用情况监控
  - 检查间隔 (20-86400秒)
  - 剩余次数阈值
  - 使用次数阈值