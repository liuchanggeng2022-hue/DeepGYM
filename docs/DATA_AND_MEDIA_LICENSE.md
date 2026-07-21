# 动作数据与媒体许可说明

更新日期：2026-07-21

## 使用的数据源

- 项目：[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)
- 固定版本：`7455efae41b330c265e7cd4b78dfa848e7ce5ebd`
- 动作记录：1,324 条
- 本项目已纳入：动作元数据与多语言步骤
- 本项目未批量纳入：`images/` 和 `videos/` 媒体文件

固定版本是为了让数据结果可复现；更新上游数据时应先检查记录数量、字段变化、翻译和许可文件，再修改版本。

## 两类内容必须分开理解

### 代码、数据结构和说明文字

上游以 MIT License 发布代码、工具、数据结构和动作说明/翻译。DeepGYM 保留了上游许可证副本与来源信息。

### 图片和 GIF 动图

上游明确声明：

- 媒体版权属于 [Gym visual](https://gymvisual.com/)；
- 媒体不适用 MIT License；
- 只能保持 180×180 分辨率；
- 每次使用必须保留 `© Gym visual — https://gymvisual.com/`；
- 克隆上游仓库本身不授予第三方复用许可；
- 应阅读 [Gym visual Terms & Conditions](https://gymvisual.com/content/3-terms-and-conditions-of-use)，并在需要时直接取得自己的许可。

## 当前原型怎样处理媒体

当前本地原型通过固定版本的 GitHub Raw 地址远程加载可见动作的缩略图和动图，不把 1,324 份媒体复制到 DeepGYM 仓库中。界面在动作详情和全局页脚保留权利人署名。

这只解决开发演示中的技术接入，不代表 DeepGYM 已取得公开发布、商业使用、再分发或离线打包的权利。

## 发布前检查清单

- [ ] 产品所有者已阅读 Gym visual 最新条款；
- [ ] 已书面确认 DeepGYM 的使用场景是否需要独立许可；
- [ ] 若需要，已取得覆盖 macOS / Windows 应用分发方式的许可；
- [ ] 已确认是否允许把媒体放入安装包或 CDN；
- [ ] 已确认分辨率、裁剪、压缩、缓存与二次加工限制；
- [ ] 应用内每个媒体使用位置均保留规定署名；
- [ ] 法律/商业确认记录已归档；
- [ ] 上述事项完成后，才把媒体模式从“远程开发预览”切换为“已授权发布”。

## 工程约束

- 媒体根地址必须配置化；
- 不在代码中删除或覆盖数据记录的 `attribution` 字段；
- 自动检查验证所有记录均有署名；
- 没有许可确认时，构建流程不得把上游 `images/` 或 `videos/` 目录打进发布包；
- 网络加载失败时，文字指导仍然可用。

## 上游许可副本

- [MIT 与媒体例外](../vendor/exercises-dataset/LICENSE)
- [媒体署名与许可通知](../vendor/exercises-dataset/NOTICE.md)
