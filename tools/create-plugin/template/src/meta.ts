/** 代码元数据：随插件代码装载，宿主启动时上报 Main；package.json 只保留装载/分类字段。 */
export const meta = {
  "name": "示例插件",
  "description": "洛书插件模板：宿主服务缝 + 工作台页签 + 设置 + 快捷键",
  "publisher": "洛书示例",
  "settings": {
    "groups": [
      {
        "id": "demo",
        "label": "示例设置",
        "entries": [
          {
            "key": "greeting",
            "type": "string",
            "label": "问候语",
            "default": "你好，洛书",
            "description": "演示代码元数据设置声明；保存后写入插件设置段"
          }
        ]
      }
    ]
  }
} as const
